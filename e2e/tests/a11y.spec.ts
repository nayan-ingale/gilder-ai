import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { ask, signIn } from './helpers.ts';

/**
 * Automated accessibility checks (axe) on every main page, on a desktop and a phone screen. Any
 * serious or critical problem fails the test, with the rule and the elements it found.
 */

async function expectAccessible(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const problems = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(' ')).join(', ')})`,
    );
  expect(problems, `${name} has accessibility problems`).toEqual([]);
}

for (const tag of ['', ' @phone']) {
  test(`main pages pass automated accessibility checks${tag}`, async ({ page }) => {
    await page.goto('/login');
    await expectAccessible(page, 'sign-in');

    await signIn(page);
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: 'Message' })).toBeVisible();
    await expectAccessible(page, 'new chat');

    await ask(page, 'Say hi.');
    await expectAccessible(page, 'chat');

    await page.goto('/settings/general');
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
    await expectAccessible(page, 'general settings');

    await page.goto('/settings/billing');
    await expect(page.getByRole('heading', { name: 'Payment history' })).toBeVisible();
    await expectAccessible(page, 'billing');

    await page.goto('/settings/usage');
    await expect(page.getByRole('heading', { name: 'Usage', level: 2 })).toBeVisible();
    await expectAccessible(page, 'usage');
  });
}
