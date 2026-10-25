// ABOUTME: Optional on macOS: keeps the gallery running in the background and starts it at login (launchd).
// ABOUTME: Usage: node gallery/install-service.mjs --install  (or --print to see the configuration). Elsewhere, run node gallery/server.mjs.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const runtime = dirname(fileURLToPath(import.meta.url));
const label = 'local.microsite-gallery';
const logs = join(homedir(), 'Library/Logs/microsite-gallery');
const plistPath = join(homedir(), 'Library/LaunchAgents', `${label}.plist`);
const domain = `gui/${process.getuid()}`;
const xml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array>
    <string>${xml(process.execPath)}</string>
    <string>${xml(join(runtime, 'server.mjs'))}</string>
  </array>
  <key>WorkingDirectory</key><string>${xml(runtime)}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>ProcessType</key><string>Interactive</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>StandardOutPath</key><string>${xml(join(logs, 'microsite-gallery.log'))}</string>
  <key>StandardErrorPath</key><string>${xml(join(logs, 'microsite-gallery-error.log'))}</string>
</dict></plist>
`;

if (process.argv.includes('--print')) {
  console.log(plist);
} else if (process.argv.includes('--install') && process.platform === 'darwin') {
  if (runtime.startsWith('/private/tmp/') || runtime.startsWith('/tmp/')) {
    throw new Error('Copy the gallery to a durable directory before installing its service.');
  }
  if (!existsSync(join(runtime, 'server.mjs'))) throw new Error('Gallery server is missing.');
  mkdirSync(dirname(plistPath), { recursive: true });
  mkdirSync(logs, { recursive: true });
  writeFileSync(plistPath, plist, { mode: 0o600 });
  const run = args => spawnSync('/bin/launchctl', args, { encoding: 'utf8' });
  if (run(['print', `${domain}/${label}`]).status === 0) {
    const stop = run(['bootout', `${domain}/${label}`]);
    if (stop.status !== 0) throw new Error(stop.stderr || 'Could not stop the existing gallery service.');
  }
  const start = run(['bootstrap', domain, plistPath]);
  if (start.status !== 0) throw new Error(start.stderr || 'Could not start the gallery service.');
  console.log(`Installed ${label}\nConfiguration: ${plistPath}\nLogs: ${logs}`);
} else {
  console.error('Use --print to inspect the configuration, or --install on macOS to install and start it.');
  process.exitCode = 1;
}
