/**
 * Playwright driver for TaskLogic Electron app (Windows).
 * Usage: node scripts/drive-electron.mjs
 *
 * Commands (one per stdin line):
 *   launch     – start the app
 *   ss [name]  – screenshot to C:\Temp\shots\<name>.png
 *   click <sel>
 *   eval <js>
 *   text [sel]
 *   wait <sel>
 *   quit
 */

import { _electron as electron } from 'playwright-core';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(fileURLToPath(import.meta.url), '../../');
const SHOT_DIR = process.env.SCREENSHOT_DIR || 'C:\\Temp\\shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const electronBin = path.join(APP_DIR, 'node_modules/electron/dist/electron.exe');

let app = null;
let page = null;

const COMMANDS = {
  async launch() {
    if (app) return console.log('already launched');
    console.log('Launching…');
    app = await electron.launch({
      executablePath: electronBin,
      args: [APP_DIR],
      timeout: 60_000,
    });
    await new Promise(r => setTimeout(r, 6_000));
    page = app.windows().find(w => !w.url().startsWith('devtools://'))
        ?? await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    console.log('launched.', app.windows().length, 'window(s). URL:', page.url());
  },

  async ss(name) {
    if (!page) return console.log('ERROR: launch first');
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await page.screenshot({ path: f, fullPage: false });
    console.log('screenshot:', f);
  },

  async click(sel) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate(s => {
      const el = document.querySelector(s);
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK';
    }, sel);
    console.log('click', sel, '→', r);
  },

  async 'click-text'(text) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate(t => {
      const els = [...document.querySelectorAll('button, a, li, [role="button"], [data-action]')];
      const el = els.find(e => e.textContent?.trim() === t)
              ?? els.find(e => e.textContent?.trim().includes(t));
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK: ' + el.tagName + ' "' + el.textContent?.trim().slice(0, 40) + '"';
    }, text);
    console.log('click-text', JSON.stringify(text), '→', r);
  },

  async wait(sel) {
    if (!page) return console.log('ERROR: launch first');
    try {
      await page.waitForSelector(sel, { timeout: 10_000 });
      console.log('found:', sel);
    } catch { console.log('TIMEOUT:', sel); }
  },

  async eval(expr) {
    if (!page) return console.log('ERROR: launch first');
    try { console.log(JSON.stringify(await page.evaluate(expr))); }
    catch (e) { console.log('ERROR:', e.message); }
  },

  async text(sel) {
    if (!page) return console.log('ERROR: launch first');
    console.log(await page.evaluate(
      s => (s ? document.querySelector(s) : document.body)?.innerText?.slice(0, 500) ?? '(null)',
      sel || null));
  },

  async sleep(ms) {
    await new Promise(r => setTimeout(r, Number(ms) || 2000));
    console.log('slept', ms || 2000, 'ms');
  },

  async quit() {
    if (app) await app.close().catch(() => {});
    app = null; page = null;
  },

  help() { console.log('commands:', Object.keys(COMMANDS).join(', ')); },
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'driver> ' });

rl.on('line', async line => {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  if (!cmd) return rl.prompt();
  const fn = COMMANDS[cmd];
  if (!fn) { console.log('unknown:', cmd, '— try: help'); return rl.prompt(); }
  try { await fn(rest.join(' ')); } catch (e) { console.log('ERROR:', e.message); }
  if (cmd === 'quit') { rl.close(); process.exit(0); }
  rl.prompt();
});

rl.on('close', async () => { if (COMMANDS.quit) await COMMANDS.quit(); process.exit(0); });
console.log('TaskLogic driver ready. Type "launch" to start the app.');
rl.prompt();
