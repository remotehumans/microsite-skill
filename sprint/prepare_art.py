# ABOUTME: Makes transparent illustration stickers with sealed gaps and a thin paper halo.
# ABOUTME: Also divides generated paper art by its paper colour and levels it to white.
import argparse
from collections import deque
from pathlib import Path
import subprocess
import tempfile

SKILL = Path(__file__).resolve().parents[1]
ART = SKILL / 'assets/art'
STORY = ('interviews', 'knowledge', 'workflows', 'processmap-43', 'opportunities', 'report')


def magick(*args):
    return subprocess.run(['magick', *map(str, args)], check=True, capture_output=True).stdout


def normalise(source, target):
    paper = magick(source, '-crop', '100%x4%+0+0', '+repage', '-resize', '1x1!',
                   '-format', '#%[hex:p{0,0}]', 'info:').decode().strip()
    magick(source, '(', '-clone', '0', '-fill', paper, '-colorize', '100', ')',
           '-compose', 'Divide_Src', '-composite', '-level', '0%,95%', target)


def sticker(source, target, threshold=28, gap=11, halo=3, border=8):
    """Port the pilot's diamond dilation, outside fill and border_value=1 erosion."""
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    width, height = map(int, magick(source, '-format', '%w %h', 'info:').split())
    if min(width, height) <= border * 2:
        raise ValueError('Art is too small for the border strip')
    # A source that is already transparent keeps its alpha and colour.
    if magick(source, '-format', '%[opaque]', 'info:').strip() == b'False':
        magick(source, '-strip', '-define', 'png:color-type=6', target)
        print(f'Preserved alpha: {target}')
        return
    rgb = magick(source, '-alpha', 'off', '-depth', '8', 'rgb:-')
    hist = [[0] * 256 for _ in range(3)]
    for i, value in enumerate(rgb):
        hist[i % 3][value] += 1
    paper = []
    for channel in hist:
        count = 0
        for value, frequency in enumerate(channel):
            count += frequency
            if count >= width * height / 2:
                paper.append(value)
                break
    ink = bytearray(width * height)
    for y in range(border, height - border):
        for x in range(border, width - border):
            k = y * width + x
            ink[k] = 255 if max(abs(rgb[3*k+c] - paper[c]) for c in range(3)) > threshold else 0
    with tempfile.TemporaryDirectory(dir=target.parent) as folder:
        folder = Path(folder)
        mask = folder / 'mask.pgm'
        mask.write_bytes(f'P5\n{width} {height}\n255\n'.encode() + ink)
        closed = magick(mask, '-morphology', 'Dilate', f'Diamond:{gap}', '-depth', '8', 'gray:-')
        outside = bytearray(width * height)
        queue = deque()
        for k in [*range(width), *range((height-1)*width, height*width),
                  *range(0, width*height, width), *range(width-1, width*height, width)]:
            if not closed[k] and not outside[k]:
                outside[k] = 255
                queue.append(k)
        while queue:
            k = queue.popleft()
            x = k % width
            for n in (k-width, k+width, k-1 if x else -1, k+1 if x<width-1 else -1):
                if 0 <= n < len(outside) and not closed[n] and not outside[n]:
                    outside[n] = 255
                    queue.append(n)
        # Inverting and dilating the keep mask is erosion of outside with border_value=1.
        mask.write_bytes(f'P5\n{width} {height}\n255\n'.encode() + bytes(255-v for v in outside))
        alpha = bytearray(magick(mask, '-virtual-pixel', 'black', '-morphology', 'Dilate',
                                f'Diamond:{halo}', '-blur', '0x1', '-depth', '8', 'gray:-'))
        for y in range(height):
            for x in range(width):
                if x < border or x >= width-border or y < border or y >= height-border:
                    alpha[y*width+x] = 0
        mask.write_bytes(f'P5\n{width} {height}\n255\n'.encode() + alpha)
        magick(source, '-alpha', 'off', mask, '-compose', 'CopyOpacity', '-composite',
               '-strip', '-define', 'png:color-type=6', target)
    print(f'Sticker: {target}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('story', 'sticker', 'normalise', 'logo'))
    parser.add_argument('source', nargs='?', type=Path)
    parser.add_argument('target', nargs='?', type=Path)
    args = parser.parse_args()
    ART.mkdir(parents=True, exist_ok=True)
    if args.mode == 'story':
        for name in STORY:
            sticker(SKILL / f'assets/story/{name}.png', ART / f'{name}.png')
    else:
        if not args.source or not args.target:
            parser.error('source and target are required')
        if args.mode == 'logo':
            args.target.parent.mkdir(parents=True, exist_ok=True)
            magick(args.source, '-alpha', 'set', '-fuzz', '5%', '-transparent', 'white',
                   '-strip', '-define', 'png:color-type=6', args.target)
        elif args.mode == 'normalise':
            args.target.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(dir=args.target.parent) as folder:
                white = Path(folder) / 'white.png'
                normalise(args.source, white)
                sticker(white, args.target)
        else:
            sticker(args.source, args.target)


if __name__ == '__main__':
    main()
