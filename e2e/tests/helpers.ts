import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

/**
 * Signs a fresh test user in with dev sign-in (on in development and CI only), so every test
 * starts with its own account and its 100 sign-up credits.
 */
export async function signIn(page: Page): Promise<string> {
  const email = `e2e-${randomUUID().slice(0, 8)}@example.com`;
  // The gateway refuses changes without the app's own Origin, as a browser would send it.
  const origin = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000').origin;
  const response = await page.request.post('/api/auth/dev-session', {
    headers: { origin },
    data: { email, name: 'E2E Tester' },
  });
  expect(response.status(), 'dev sign-in must be on (AUTH_DEV_LOGIN=true)').toBe(200);
  return email;
}

/**
 * Sends a message from the composer and waits until its answer has finished: a new answer is
 * in the thread and the Regenerate button (shown only when nothing is being written) is back.
 */
export async function ask(page: Page, text: string): Promise<void> {
  // Type only once the page is interactive: text typed before React takes over is not seen.
  await page.waitForLoadState('networkidle');
  const before = await answers(page).count();
  const box = page.getByRole('textbox', { name: 'Message' });
  await box.fill(text);
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
  await box.press('Enter');
  await expect(answers(page)).toHaveCount(before + 1);
  await expect(page.getByRole('button', { name: 'Regenerate' })).toBeVisible({ timeout: 60_000 });
}

/** The answers in the thread (not the user's messages). */
export function answers(page: Page) {
  return page
    .getByRole('list', { name: 'Messages' })
    .getByRole('listitem')
    .filter({ hasText: 'GilderAi said:' });
}
