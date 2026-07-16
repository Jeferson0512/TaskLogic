/**
 * Connects to the running TaskLogic Electron app via CDP,
 * navigates to the planificador of "Construcción Centro Logístico Norte",
 * takes a screenshot, and triggers PNG export.
 */
import { chromium } from 'playwright-core';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SHOT_DIR = 'C:\\Temp\\shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

console.log('Connecting to Electron via CDP on port 9222…');
const browser = await chromium.connectOverCDP('http://localhost:9222');
const contexts = browser.contexts();
console.log('Contexts:', contexts.length);

// Find the renderer page (not devtools)
let page = null;
for (const ctx of contexts) {
  for (const p of ctx.pages()) {
    const url = p.url();
    console.log('  page:', url);
    if (!url.startsWith('devtools://') && !url.includes('about:')) {
      page = p;
    }
  }
}

if (!page) {
  // Try opening a new page in the first context
  page = await contexts[0]?.newPage?.() ?? null;
}

if (!page) {
  console.log('No renderer page found');
  await browser.close();
  process.exit(1);
}

console.log('Using page:', page.url());
await page.waitForLoadState('domcontentloaded');

// Screenshot initial state
await page.screenshot({ path: path.join(SHOT_DIR, '01-home.png'), fullPage: false });
console.log('01-home.png');

// Log what's visible to understand the UI structure
const uiInfo = await page.evaluate(() => {
  const lists = document.querySelectorAll('.project-list, .proyectos-list, ul, ol');
  const cards = document.querySelectorAll('[data-id], .card, .proyecto, li');
  return {
    title: document.title,
    bodyClasses: document.body.className,
    cardsCount: cards.length,
    firstCardText: cards[0]?.textContent?.trim().slice(0, 80),
    projectTexts: [...cards].slice(0, 10).map(c => c.textContent?.trim().slice(0, 50)),
  };
});
console.log('UI info:', JSON.stringify(uiInfo, null, 2));

// Find and click the Construcción project
const clickResult = await page.evaluate(() => {
  // Try to find elements containing "Centro Log" or "Logístico"
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  const matches = [];
  while ((node = walker.nextNode())) {
    if (node.nodeValue?.includes('Log') && node.nodeValue?.includes('Centro')) {
      matches.push(node.parentElement?.tagName + ': ' + node.nodeValue?.trim().slice(0, 50));
    }
  }

  // Click it
  const allEls = [...document.querySelectorAll('*')];
  const target = allEls.find(el =>
    el.children.length <= 3 &&
    (el.textContent?.includes('Centro Log') || el.textContent?.includes('Logístico Norte'))
  );
  if (target) {
    const clickable = target.closest('li, [data-id], .card, button, [onclick]') ?? target;
    clickable.click();
    return { found: true, tag: clickable.tagName, text: clickable.textContent?.trim().slice(0, 60), matches };
  }
  return { found: false, matches };
});
console.log('Click project:', JSON.stringify(clickResult));
await new Promise(r => setTimeout(r, 2000));
await page.screenshot({ path: path.join(SHOT_DIR, '02-project.png') });
console.log('02-project.png');

// Look for planificador tab
const planNav = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button, a, [data-section], nav li, .tab, [data-tab]')];
  const btn = btns.find(b => /planif|gantt|cronograma/i.test(b.textContent || b.dataset?.section || b.dataset?.tab || ''));
  if (btn) {
    btn.click();
    return 'clicked: ' + (btn.textContent?.trim().slice(0, 40));
  }
  return 'NOT_FOUND — buttons: ' + btns.slice(0, 10).map(b => b.textContent?.trim().slice(0, 20)).join(' | ');
});
console.log('Planificador nav:', planNav);
await new Promise(r => setTimeout(r, 2000));
await page.screenshot({ path: path.join(SHOT_DIR, '03-planificador.png') });
console.log('03-planificador.png');

// Look for export menu button
const exportMenu = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button, [data-action]')];
  const btn = btns.find(b =>
    /export|exportar/i.test(b.textContent || '') ||
    /export/i.test(b.dataset?.action || '')
  );
  if (btn) { btn.click(); return 'clicked: ' + (btn.textContent?.trim().slice(0, 40)); }
  return 'NOT_FOUND — all buttons: ' + btns.map(b => b.textContent?.trim().slice(0,20)).join(' | ');
});
console.log('Export menu:', exportMenu);
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: path.join(SHOT_DIR, '04-export-menu.png') });

// Click PNG option
const pngBtn = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button, [data-action], li, a')];
  const btn = btns.find(b => b.dataset?.action === 'export-png' || /png.*alta|alta.*png|png/i.test(b.textContent || ''));
  if (btn) { btn.click(); return 'clicked: ' + (btn.textContent?.trim().slice(0, 40)); }
  return 'NOT_FOUND';
});
console.log('PNG export:', pngBtn);
await new Promise(r => setTimeout(r, 3000));
await page.screenshot({ path: path.join(SHOT_DIR, '05-after-export.png') });
console.log('05-after-export.png');

await browser.disconnect();
console.log('\nDone! Screenshots in', SHOT_DIR);
