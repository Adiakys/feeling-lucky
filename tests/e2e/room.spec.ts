import { expect, test, type Page } from '@playwright/test';
import type { GameId } from '../../src/config/types';
import { dailyBonus, GAME_IDS, PRIVATE_GAMES } from '../../src/engine/tiers';

// A day on which no game is swapped for its game of the day, so every table opens its classic game.
const QUIET_DAY = (() => {
  const day = new Date(2026, 4, 1, 12);
  while (['slot', 'scratch'].includes(dailyBonus(day).game)) day.setDate(day.getDate() + 1);
  return day;
})();

async function openRoom(page: Page, errors: string[]) {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && !message.text().includes('favicon') && errors.push(message.text()));
  await page.clock.setFixedTime(QUIET_DAY);
  await page.goto('/');
  await page.getByRole('button', { name: 'Feeling lucky' }).click();
  await expect(page.locator('feeling-lucky .lk-room.is-ready')).toBeVisible();
}

async function openGame(page: Page, game: GameId) {
  if (PRIVATE_GAMES.includes(game)) await page.locator('feeling-lucky .lk-pager button').nth(1).click();
  await page.locator(`feeling-lucky .lk-table--${game}`).click();
  await expect(page.locator('feeling-lucky .lk-stage')).toBeVisible();
}

for (const game of GAME_IDS)
  test(`${game} opens from the lobby and goes back`, async ({ page }) => {
    const errors: string[] = [];
    await openRoom(page, errors);
    await openGame(page, game);
    await page.keyboard.press('Escape');
    await expect(page.locator('feeling-lucky fl-lobby')).toBeAttached();
    expect(errors).toEqual([]);
  });

test('a jackpot on the slot reaches onWin and the certificate', async ({ page }) => {
  const errors: string[] = [];
  const wins: string[] = [];
  page.on('console', (message) => message.text().startsWith('win') && wins.push(message.text()));
  await openRoom(page, errors);
  await openGame(page, 'slot');
  await page.evaluate(() => (Math.random = () => 0.001));
  await page.locator('feeling-lucky .lk-btn--primary').click();
  await expect(page.locator('feeling-lucky .lk-cert')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('feeling-lucky .lk-jackpot-tag')).toBeVisible();
  expect(wins).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('the room follows the page language', async ({ page }) => {
  const errors: string[] = [];
  await openRoom(page, errors);
  await expect(page.locator('feeling-lucky .lk-head h2')).toHaveText('Games room');
  await page.evaluate(() => (document.documentElement.lang = 'it'));
  await expect(page.locator('feeling-lucky .lk-head h2')).toHaveText('Sala giochi');
  expect(errors).toEqual([]);
});

test('the developer menu forces a language over the page’s', async ({ page }) => {
  const errors: string[] = [];
  await openRoom(page, errors);
  await page.keyboard.press('Control+Shift+L');
  await page.getByLabel('Password').fill('password');
  await page.keyboard.press('Enter');
  const language = page.locator('feeling-lucky .lk-dev-row').filter({ hasText: /^(Language|Lingua)/ }).locator('select');
  await language.selectOption('it');
  await expect(page.locator('feeling-lucky .lk-head h2')).toHaveText('Sala giochi');
  await language.selectOption('');
  await expect(page.locator('feeling-lucky .lk-head h2')).toHaveText('Games room');
  expect(errors).toEqual([]);
});
