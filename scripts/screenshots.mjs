// The landing page's pictures, taken from the playground on a day without a seasonal theme, while a dealer is on shift:
// the lobby and every game for the page, and the lobby again as the 1200×630 preview of shared links. Run with
// `npm run screenshots` while `npm run dev` serves the playground.
import { chromium } from '@playwright/test';

const PLAYGROUND = process.env.PLAYGROUND_URL ?? 'http://localhost:5173/';
const OUT = new URL('../playground/public/', import.meta.url);
const DAY = new Date(2026, 4, 5, 10, 45);
const GAMES = ['wheel', 'roulette', 'slot', 'pachinko', 'scratch', 'blackjack', 'holdem'];
const PRIVATE = ['blackjack', 'holdem'];

const browser = await chromium.launch();

async function room(viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.clock.setFixedTime(DAY);
  await page.goto(PLAYGROUND);
  await page.getByRole('button', { name: 'Feeling lucky' }).click();
  await page.locator('feeling-lucky .lk-room.is-ready').waitFor();
  await page.waitForTimeout(1500);
  return page;
}

// A game's shot keeps its table, without the room's header and curtains.
const TABLE = { x: 160, y: 100, width: 960, height: 600 };

const save = (page, name, { type = 'jpeg', clip } = {}) =>
  page.screenshot({ path: new URL(name, OUT).pathname, type, clip, ...(type === 'jpeg' && { quality: 80 }) });

const og = await room({ width: 1200, height: 630 });
await save(og, 'og.png', { type: 'png' });
await og.close();

const page = await room({ width: 1280, height: 800 });
await save(page, 'shots/lobby.jpg');
for (const game of GAMES) {
  if (PRIVATE.includes(game)) await page.locator('feeling-lucky .lk-pager button').nth(1).click();
  await page.locator(`feeling-lucky .lk-table--${game}`).click();
  await page.locator('feeling-lucky .lk-stage').waitFor();
  await page.waitForTimeout(1500);
  await save(page, `shots/${game}.jpg`, { clip: TABLE });
  await page.keyboard.press('Escape');
  await page.locator('feeling-lucky fl-lobby').waitFor();
  await page.waitForTimeout(600);
}

await browser.close();
