# ABOUTME: Captures every sprint section at desktop and phone widths with agent-browser.
# ABOUTME: Checks overflow, book pages, interactions and browser errors, then makes a contact sheet.
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import provider


class BrowserError(RuntimeError):
    pass


class Browser:
    def __init__(self, output):
        self.runtime = output / 'runtime'
        self.runtime.mkdir(parents=True, exist_ok=True)
        self.env = {**os.environ, 'AGENT_BROWSER_SOCKET_DIR': '.'}
        self.session = f'sprintqa-{os.getpid()}'

    def run(self, *args):
        command = provider.tool('browser', 'agent-browser')
        try:
            result = subprocess.run([command, '--session', self.session, '--json', *map(str, args)],
                                    cwd=self.runtime, env=self.env, text=True, capture_output=True, timeout=45)
        except FileNotFoundError:
            raise BrowserError(f'{command} is not installed (see SETUP.md, apps and connectors)')
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError:
            raise BrowserError(result.stderr.strip() or result.stdout.strip() or 'No browser response')
        if result.returncode or not payload.get('success', False):
            raise BrowserError(str(payload.get('error', result.stderr)))
        return payload.get('data')

    def evaluate(self, code):
        result = self.run('eval', code)
        return result.get('result') if isinstance(result, dict) and 'result' in result else result


def capture(browser, html, output, label, expected):
    files, checks, failures = [], [], []
    for width in (1440, 390):
        browser.run('set', 'viewport', width, 1000)
        browser.run('--allow-file-access', 'open', html.as_uri())
        browser.evaluate('(async()=>{await document.fonts.ready; await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));return true})()')
        browser.run('set', 'media', 'reduced-motion')
        # Pages with reveal on scroll only show content once it has been scrolled to.
        browser.evaluate('(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=600){scrollTo({top:y,behavior:"instant"});await new Promise(r=>setTimeout(r,40))}scrollTo({top:0,behavior:"instant"});return true})()')
        selectors = browser.evaluate("[...document.querySelectorAll('header,main>section,footer')].map(el=>el.id?'#'+el.id:el.tagName.toLowerCase())")
        for index, selector in enumerate(selectors):
            browser.run('scrollintoview', selector)
            browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))')
            state = browser.evaluate('''(()=>{const el=document.querySelector(%s),r=el.getBoundingClientRect();return {
                x:Math.max(0,Math.round(r.left+scrollX)),y:Math.round(r.top+scrollY),
                width:Math.round(r.width),height:Math.round(r.height),
                scrollWidth:document.documentElement.scrollWidth,innerWidth,
                brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length};})()''' % json.dumps(selector))
            checks.append({'page': label, 'width': width, 'section': selector, **state})
            if state['scrollWidth'] != state['innerWidth']:
                failures.append(f'{label} {width} {selector}: horizontal overflow')
            if state['brokenImages']:
                failures.append(f'{label} {width}: {state["brokenImages"]} broken images')
            full = output / f'{label}-{width}-full.png'
            browser.run('screenshot', '--full', full)
            target = output / f'{label}-{width}-{index:02d}-{selector.lstrip("#")}.png'
            subprocess.run(['magick', str(full), '-crop',
                            f'{state["width"]}x{state["height"]}+{state["x"]}+{state["y"]}',
                            '+repage', str(target)], check=True, capture_output=True)
            files.append(target)
        book = browser.evaluate('''(()=>{const b=window.dfReportBook;return {
            pages:b?b.getPageCount():0,dom:document.querySelectorAll('#df-book .pf-page').length,
            expected:Number(document.querySelector('#df-book').dataset.pageCount)||%d};})()''' % expected)
        checks.append({'page': label, 'width': width, 'book': book})
        if book['pages'] != expected or book['dom'] != expected:
            failures.append(f'{label} {width}: book has {book}, expected {expected}')
        # Exercise all tabs, a real page turn and the full-size reader.
        for i in range(3):
            browser.run('click', f'#exampleTab{i}')
            good = browser.evaluate(f"document.querySelector('#exampleTab{i}').getAttribute('aria-selected')==='true' && !document.querySelector('#examplePanel{i}').hidden")
            if not good:
                failures.append(f'{label} {width}: example tab {i} failed')
        browser.run('click', '#df-bkNext')
        browser.run('wait', '1000')
        if browser.evaluate('window.dfReportBook.getCurrentPageIndex()') == 0:
            failures.append(f'{label} {width}: page turn failed')
        browser.run('click', '#df-open-reader')
        reader = browser.evaluate("({open:document.querySelector('#df-report-reader').open,pages:document.querySelectorAll('#df-reader-pages .df-reader-page').length})")
        if browser.evaluate('document.documentElement.scrollWidth !== innerWidth'):
            failures.append(f'{label} {width}: reader has horizontal overflow')
        if not reader['open'] or reader['pages'] != expected:
            failures.append(f'{label} {width}: reader failed: {reader}')
        browser.run('press', 'Escape')
        errors = browser.run('errors')
        console = browser.run('console')
        checks.append({'page': label, 'width': width, 'errors': errors, 'console': console})
        if isinstance(errors, dict) and errors.get('errors'):
            failures.append(f'{label} {width}: browser errors: {errors["errors"]}')
        messages = console.get('messages', []) if isinstance(console, dict) else []
        if any(message.get('type', message.get('level')) == 'error' for message in messages if isinstance(message, dict)):
            failures.append(f'{label} {width}: console errors')
        browser.run('errors', '--clear')
        browser.run('console', '--clear')
    return files, checks, failures


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('html', type=Path)
    parser.add_argument('--reference', type=Path, help='Read-only golden HTML for matching section captures')
    args = parser.parse_args()
    html = args.html.resolve()
    output = html.parent.parent / 'qa'
    output.mkdir(parents=True, exist_ok=True)
    expected = provider.claims()['report_defaults']['page_count']
    browser = Browser(output)
    result = {'status': 'FAIL', 'checks': [], 'failures': []}
    try:
        # Only startup may be skipped. Later browser or QA failures are real failures.
        try:
            browser.run('open', 'about:blank')
        except BrowserError as error:
            result.update(status='SKIP', reason=f'agent-browser cannot start in this environment: {error}')
            print(result['reason'])
            return 2
        images, checks, failures = capture(browser, html, output, 'rebuilt', expected)
        result['checks'].extend(checks)
        result['failures'].extend(failures)
        if args.reference:
            reference_images, checks, failures = capture(browser, args.reference.resolve(), output, 'golden', expected)
            images += reference_images
            result['checks'].extend(checks)
            result['failures'].extend(failures)
        # Pair rebuilt and golden captures in the sheet when a reference was supplied.
        images.sort(key=lambda path: (int(path.name.split('-')[1]), path.name.split('-')[2], path.name.startswith('golden')))
        font = next((str(path) for path in [Path('/System/Library/Fonts/Supplemental/Arial.ttf'),
                    Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),
                    Path('C:/Windows/Fonts/arial.ttf')] if path.exists()), None)
        if not font:
            raise BrowserError('No contact-sheet font found; install Arial or DejaVu Sans')
        thumbs = []
        for path in images:
            thumb = output / (path.stem + '-thumb.png')
            subprocess.run(['magick', str(path), '-thumbnail', '280x420', '-background', '#ffffff',
                            '-gravity', 'center', '-extent', '300x450', '-gravity', 'south',
                            '-font', font, '-pointsize', '11', '-annotate', '+0+5', path.stem, str(thumb)], check=True)
            thumbs.append(thumb)
        subprocess.run(['magick', 'montage', '-font', font, *map(str, thumbs), '-tile', '4x', '-geometry', '+8+8',
                        '-background', '#e7e7e7', str(output / 'contact-sheet.png')], check=True)
        result['status'] = 'FAIL' if result['failures'] else 'PASS'
        print(f'{result["status"]}: {output / "contact-sheet.png"}')
        for failure in result['failures']:
            print('  - ' + failure)
        return int(bool(result['failures']))
    except (BrowserError, subprocess.SubprocessError, OSError) as error:
        result['failures'].append(str(error))
        print(f'FAIL QA: {error}')
        return 1
    finally:
        (output / 'results.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
        if result['status'] != 'SKIP':
            try:
                browser.run('close')
            except BrowserError:
                pass


if __name__ == '__main__':
    sys.exit(main())
