/**
 * Launches TaskLogic, opens the planificador for the project
 * "Construcción Centro Logístico Norte", triggers PNG export,
 * and takes a screenshot of the planificador view.
 *
 * Usage: node scripts/take-gantt-screenshot.mjs
 */

import { _electron as electron } from 'playwright-core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(fileURLToPath(import.meta.url), '../../');
const SHOT_DIR = 'C:\\Temp\\shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const electronBin = path.join(APP_DIR, 'node_modules/electron/dist/electron.exe');

console.log('Launching TaskLogic…');
const app = await electron.launch({
  executablePath: electronBin,
  args: [APP_DIR],
  timeout: 60_000,
});

// Wait for app to fully load
await new Promise(r => setTimeout(r, 6_000));

const page = app.windows().find(w => !w.url().startsWith('devtools://'))
    ?? await app.firstWindow();

await page.waitForLoadState('domcontentloaded');
console.log('App loaded. URL:', page.url());

// Screenshot of initial state
await page.screenshot({ path: path.join(SHOT_DIR, '01-home.png') });
console.log('Screenshot 01-home.png saved');

// Find and click the project "Construcción Centro Logístico Norte"
const clicked = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('[data-id], .project-card, li, .proyecto-card, [data-proyecto-id]')];
  const target = cards.find(el => el.textContent?.includes('Centro Log'));
  if (target) { target.click(); return 'clicked: ' + target.tagName; }

  // fallback: find any clickable with matching text
  const all = [...document.querySelectorAll('*')];
  const el = all.find(e => e.children.length === 0 && e.textContent?.trim().includes('Centro Log'));
  if (el) { el.closest('[data-id], li, .card, article, [onclick]')?.click(); return 'clicked via fallback'; }
  return 'NOT_FOUND';
});
console.log('Open project:', clicked);
await new Promise(r => setTimeout(r, 2_000));
await page.screenshot({ path: path.join(SHOT_DIR, '02-after-click.png') });
console.log('Screenshot 02-after-click.png saved');

// Look for planificador button / tab
const planClick = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button, a, [data-action], nav li, .tab')];
  const btn = btns.find(b => /planif|gantt|cronograma/i.test(b.textContent));
  if (btn) { btn.click(); return 'clicked: ' + btn.textContent?.trim().slice(0, 40); }
  return 'NOT_FOUND';
});
console.log('Planificador nav:', planClick);
await new Promise(r => setTimeout(r, 2_000));
await page.screenshot({ path: path.join(SHOT_DIR, '03-planificador.png') });
console.log('Screenshot 03-planificador.png saved');

// Try to trigger the PNG export
const exportClick = await page.evaluate(() => {
  // look for export button / menu
  const btns = [...document.querySelectorAll('button, [data-action]')];
  let btn = btns.find(b => b.dataset?.action === 'export-png');
  if (!btn) btn = btns.find(b => /exportar|export|png/i.test(b.textContent));
  if (btn) { btn.click(); return 'clicked: ' + (btn.dataset?.action || btn.textContent?.trim().slice(0,40)); }
  return 'NOT_FOUND';
});
console.log('Export button:', exportClick);
await new Promise(r => setTimeout(r, 1_000));

// If a dropdown appeared, click the PNG option
const pngClick = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button, [data-action], li, a')];
  const btn = btns.find(b => b.dataset?.action === 'export-png' || /png/i.test(b.textContent));
  if (btn) { btn.click(); return 'clicked: ' + (btn.textContent?.trim().slice(0,40)); }
  return 'NOT_FOUND';
});
console.log('PNG option:', pngClick);
await new Promise(r => setTimeout(r, 3_000));

await page.screenshot({ path: path.join(SHOT_DIR, '04-after-export.png') });
console.log('Screenshot 04-after-export.png saved');

// Print page structure to understand what's rendered
const structure = await page.evaluate(() => {
  const gantt = document.querySelector('.gantt-container, .gantt, #gantt, [class*="gantt"]');
  if (gantt) return 'Found gantt: ' + gantt.className + ' children: ' + gantt.children.length;
  const main = document.querySelector('main, #app, .app');
  return 'No gantt found. Body classes: ' + document.body.className.slice(0,100);
});
console.log('DOM structure:', structure);

await app.close();
console.log('\nDone! Screenshots saved to', SHOT_DIR);
