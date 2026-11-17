import { expect, test } from '@playwright/test';
import { answers, ask, signIn } from './helpers.ts';

test.describe('signed out', () => {
  test('sends visitors to sign-in', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  });
});

test.describe('chatting', () => {
  test('starts a chat from its first message, streams the answer and names the chat', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto('/');

    await ask(page, 'Give me two tips for learning to cook.');

    await expect(page).toHaveURL(/\/c\/[a-f0-9]{24}$/);
    await expect(answers(page)).toHaveCount(1);
    await expect(answers(page).first()).not.toHaveText('GilderAi said:');
    await expect(page.getByRole('button', { name: 'Regenerate' })).toBeVisible();
    // The new chat gets a title instead of "New chat", in the header and the tab.
    await expect(page.locator('main header h1')).not.toHaveText('New chat');
    await expect(page).not.toHaveTitle(/^New chat/);
  });

  test('scrolls the conversation to the newest answer, never the page around it', async ({
    page,
  }) => {
    // Short, so the conversation is taller than the window.
    await page.setViewportSize({ width: 1280, height: 480 });
    await signIn(page);
    await page.goto('/');
    await ask(page, 'Give me two tips for learning to cook.');
    await ask(page, 'And two more, please.');

    const scroll = await page.evaluate(() => {
      const root = document.scrollingElement as Element;
      const main = document.querySelector('main') as HTMLElement;
      return {
        pageTop: root.scrollTop,
        pageOverflow: root.scrollHeight - root.clientHeight,
        conversationTaller: main.scrollHeight > main.clientHeight,
        fromEnd: Math.round(main.scrollHeight - main.scrollTop - main.clientHeight),
      };
    });
    expect(scroll).toEqual({ pageTop: 0, pageOverflow: 0, conversationTaller: true, fromEnd: 0 });
  });

  test('regenerates the latest answer in place', async ({ page }) => {
    await signIn(page);
    await page.goto('/');
    await ask(page, 'Say hello in one short sentence.');

    await page.getByRole('button', { name: 'Regenerate' }).click();
    // While the new answer is written the button is gone; it comes back when it is done.
    await expect(page.getByRole('button', { name: 'Regenerate' })).toBeHidden();

    await expect(answers(page)).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Regenerate' })).toBeVisible();
  });

  test('answers from the web with /search and lists the sources', async ({ page }) => {
    await signIn(page);
    await page.goto('/');

    await ask(page, '/search what is the capital of France');

    await expect(page.getByRole('region', { name: 'Sources' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Sources' }).getByRole('link').first(),
    ).toBeVisible();
  });
});

test.describe('credits', () => {
  test('charges answers, and shows billing and usage', async ({ page }) => {
    await signIn(page);
    await page.goto('/');
    await ask(page, 'One word: blue or green?');

    await page.goto('/settings/usage');
    const totals = page.getByRole('region', { name: 'Totals' });
    await expect(totals.getByText('Credits used')).toBeVisible();
    await expect(totals.getByText('1', { exact: true }).first()).toBeVisible();

    await page.goto('/settings/billing');
    await expect(page.getByText('Test payments only.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buy Starter' })).toBeVisible();
    await expect(page.getByText(/^99\s+credits$/).first()).toBeVisible();
  });
});

test.describe('account', () => {
  test('logs out and is sent to sign-in', async ({ page }) => {
    await signIn(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('on a phone @phone', () => {
  test('reaches the chat list from the menu and chats @phone', async ({ page }) => {
    await signIn(page);
    await page.goto('/');
    await ask(page, 'Name one planet.');

    await page.getByRole('button', { name: 'Open chats' }).click();
    const panel = page.getByRole('dialog', { name: 'GilderAi' });
    await expect(panel.getByRole('navigation', { name: 'Chats' }).getByRole('link')).toHaveCount(1);
    await expect(panel.getByRole('region', { name: 'Credits' })).toBeVisible();
  });
});
