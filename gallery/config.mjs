// ABOUTME: Finds everything the gallery reads: the skill's settings.json, the active profile, the workspace of campaigns and the private gallery data folder.
// ABOUTME: Campaigns are folders in the workspace with data/campaign.json; the gallery's own records live in <workspace>/.gallery so the skill folder stays clean.
import fs from 'node:fs';
import path from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';

export const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const expand = p => p.startsWith('~') ? path.join(homedir(), p.slice(1)) : p;
const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;

export function settings() {
  const file = expand(process.env.MICROSITE_SETTINGS || path.join(skill, 'settings.json'));
  return fs.existsSync(file) ? read(file) : {};
}

export function profile() {
  const name = process.env.MICROSITE_PROFILE || settings().profile || 'sample-studio';
  const file = path.join(skill, 'profiles', name, 'profile.json');
  return fs.existsSync(file) ? read(file) : {provider: {}, delivery: {}};
}

export function workspace() {
  return path.resolve(expand(option('--workspace') || process.env.MICROSITE_WORKSPACE || settings().paths?.projects || '~/microsites'));
}

export const dataDir = (root = workspace()) => path.join(root, '.gallery');

// One campaign per workspace folder holding data/campaign.json. Its own gallery files sit in <campaign>/gallery.
export function discoverCampaigns(root = workspace()) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, {withFileTypes: true})
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && fs.existsSync(path.join(root, e.name, 'data/campaign.json')))
    .map(e => {
      const source = path.join(root, e.name), campaign = read(path.join(source, 'data/campaign.json'));
      return {id: e.name, name: campaign.name || e.name, mode: campaign.mode || 'many', source, gallery: path.join(source, 'gallery'), thread: campaign.chat || ''};
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function brand() {
  const p = profile().provider || {};
  return {business: p.business || 'Microsites', person: p.first_name || p.person || 'you'};
}

export function publicURL(slug) {
  const base = (profile().delivery?.public_base_url || '').replace(/\/$/, '');
  return /^https:\/\//.test(base) ? base + '/' + slug : null;
}
