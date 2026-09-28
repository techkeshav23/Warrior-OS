// ═══════════════════════════════════════════════════════════
// WARRIOR OS — E2E smoke test
// Boot → lock screen → desktop. Ctrl+K must open the command palette.
// Then every desktop icon (ids read from the DOM, never hardcoded) is
// double-clicked: a window must appear, its lazy app chunk must load,
// and the window must close again. Console errors and uncaught page
// errors fail the run, except known external network failures.
// ═══════════════════════════════════════════════════════════

import { test, expect, type Locator, type Page } from '@playwright/test';

/** Title bar of a real OS window (Window.tsx). Phantom ghosts have none. */
const WINDOW_TITLE_BAR = '.window-drag-handle';
/** How long each app stays open so mount-time errors can surface. */
const SETTLE_MS = 700;
/** Same-origin API routes whose 5xx only means their external upstream is down. */
const UPSTREAM_PROXY_ROUTES = ['/api/weather'];
/** Uncaught errors that are browser noise or network-level fetch failures. */
const BENIGN_PAGE_ERRORS: RegExp[] = [
  /ResizeObserver loop/i,
  // A same-origin fetch to the running server returns a response; only an
  // unreachable (external) host makes fetch itself reject like this.
  /^(TypeError: )?(Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed)$/i,
];

function isExternalUrl(url: string, origin: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    return new URL(url).origin !== origin;
  } catch {
    return false;
  }
}

/** True for console errors caused by the network outside this app. */
function isKnownExternalFailure(text: string, url: string, origin: string): boolean {
  // Resources the browser failed to load from another host (Chrome reports
  // the failing resource's URL as the message location).
  if (isExternalUrl(url, origin)) return true;
  const mentioned = text.match(/https?:\/\/[^\s'"`)]+/g) ?? [];
  if (/failed|blocked|cors|err_/i.test(text) && mentioned.some((u) => isExternalUrl(u, origin))) {
    return true;
  }
  // The weather proxy answers 5xx (e.g. 502) when its upstream provider is unreachable.
  if (/status of 5\d\d/.test(text)) {
    try {
      const { pathname } = new URL(url);
      return UPSTREAM_PROXY_ROUTES.some((route) => pathname.startsWith(route));
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Click / double-click like a user when the element is the topmost thing
 * under its centre. When something covers it (the phantom ghost of the
 * window just closed, a tour spotlight, the creature), fire the DOM event
 * on the element itself instead of waiting for the overlay to leave.
 */
async function activate(target: Locator, action: 'click' | 'dblclick'): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const onTop = await target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit !== null && (hit === el || el.contains(hit));
  });
  if (onTop) {
    try {
      if (action === 'click') await target.click({ timeout: 3_000 });
      else await target.dblclick({ timeout: 3_000 });
      return;
    } catch {
      // Covered after all (something moved over it) — dispatch below.
    }
  }
  await target.dispatchEvent(action);
}

/**
 * Dismiss the first-visit guided tour (or a similar overlay) through its
 * "Skip" button. With `waitMs`, first wait that long for one to appear.
 * Returns true when something was skipped.
 */
async function dismissOverlays(page: Page, waitMs = 0): Promise<boolean> {
  const skip = page
    .locator('[data-guided-tour]')
    .getByRole('button', { name: /\bskip\b/i })
    .or(page.getByRole('button', { name: /\bskip\b/i }))
    .first();
  if (waitMs > 0) {
    await skip.waitFor({ state: 'visible', timeout: waitMs }).catch(() => undefined);
  }
  let skipped = false;
  for (let i = 0; i < 3 && (await skip.isVisible()); i++) {
    await activate(skip, 'click').catch(() => undefined);
    skipped = true;
    await page.waitForTimeout(300);
  }
  return skipped;
}

/** Close every visible window through its title-bar Close button. */
async function closeAllWindows(page: Page): Promise<boolean> {
  const bars = page.locator(WINDOW_TITLE_BAR);
  for (let attempt = 0; attempt < 8; attempt++) {
    const open = await bars.count();
    if (open === 0) return true;
    const close = bars.last().getByRole('button', { name: 'Close', exact: true });
    await activate(close, 'click');
    await expect(bars).toHaveCount(open - 1, { timeout: 5_000 }).catch(() => undefined);
  }
  return (await bars.count()) === 0;
}

function iconButton(page: Page, id: string): Locator {
  const value = id.replace(/["\\]/g, '\\$&');
  return page
    .locator(`[data-desktop-icon="${value}"] button, button[data-desktop-icon="${value}"]`)
    .first();
}

test('boots to the desktop, Ctrl+K opens the palette, every app opens and closes cleanly', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? 'http://localhost:3100').origin;
  const errors: string[] = [];
  const problems: string[] = [];
  let stage = 'boot';

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    const { url } = msg.location();
    if (isKnownExternalFailure(text, url, origin)) return;
    errors.push(`[${stage}] console.error: ${text}${url ? ` (${url})` : ''}`);
  });
  page.on('pageerror', (err) => {
    if (BENIGN_PAGE_ERRORS.some((re) => re.test(err.message))) return;
    errors.push(`[${stage}] uncaught: ${err.name}: ${err.message}`);
  });

  const desktopIcons = page.locator('[data-desktop-icon]');

  await test.step('boot and unlock', async () => {
    await page.goto('/');
    const password = page
      .getByTestId('lock-password')
      .or(page.locator('input[type="password"]'))
      .first();
    await expect(password, 'lock screen after the boot sequence').toBeVisible({ timeout: 60_000 });
    stage = 'lock';
    // Owner path: any password + Enter unlocks.
    await password.fill('warrior');
    await password.press('Enter');
    stage = 'desktop';
    try {
      await expect(desktopIcons.first()).toBeVisible({ timeout: 20_000 });
    } catch (err) {
      // Fallback: the visitor path ("Explore as Guest").
      const guest = page
        .getByTestId('lock-guest')
        .or(page.getByRole('button', { name: /guest/i }))
        .first();
      if (!(await guest.isVisible())) throw err;
      test.info().annotations.push({ type: 'note', description: 'Unlocked through the guest button' });
      await guest.click();
      await expect(desktopIcons.first()).toBeVisible({ timeout: 20_000 });
    }
    // The first-visit tour starts on its own once the desktop settles
    // (after the first-boot celebration, within ~15 s); skip it.
    stage = 'tour';
    const skipped = await dismissOverlays(page, 20_000);
    test.info().annotations.push({
      type: 'note',
      description: skipped ? 'Skipped the first-visit tour' : 'No first-visit tour appeared',
    });
    await closeAllWindows(page);
  });

  await test.step('Ctrl+K opens the command palette', async () => {
    stage = 'command-palette';
    // Shortcuts are ignored while a text field has focus.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
    await page.keyboard.press('Control+k');
    const palette = page
      .getByRole('textbox', { name: /command palette/i })
      .or(page.getByPlaceholder(/search apps/i))
      .first();
    await expect(palette).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
  });

  const ids = await desktopIcons.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-desktop-icon') ?? '').filter(Boolean)
  );
  expect(ids.length, 'desktop icons found').toBeGreaterThan(0);
  test.info().annotations.push({ type: 'apps', description: `${ids.length}: ${ids.join(', ')}` });

  for (const id of ids) {
    await test.step(`open and close "${id}"`, async () => {
      stage = id;
      await dismissOverlays(page);
      if (!(await closeAllWindows(page))) {
        problems.push(`[${id}] a window from the previous app could not be closed`);
      }

      const icon = iconButton(page, id);
      if (!(await icon.isVisible())) {
        problems.push(`[${id}] desktop icon is not visible`);
        return;
      }
      await activate(icon, 'dblclick');

      const bars = page.locator(WINDOW_TITLE_BAR);
      try {
        await expect(bars.first()).toBeVisible({ timeout: 15_000 });
      } catch {
        problems.push(`[${id}] no window appeared after double-clicking the icon`);
        return;
      }

      // The app chunk is lazy: wait for AppLoading to hand over to the app.
      try {
        await expect(page.getByText(/Loading module/i)).toHaveCount(0, { timeout: 20_000 });
      } catch {
        problems.push(`[${id}] app was still loading after 20 s`);
      }
      if ((await page.getByText(/This app failed to load/i).count()) > 0) {
        problems.push(`[${id}] app chunk failed to load`);
      }
      await page.waitForTimeout(SETTLE_MS);

      // Windows carry their app id: make sure this icon opened its own app.
      const openedApps = await page
        .locator('[data-window-id]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-app-id') ?? ''));
      if (openedApps.length > 0 && !openedApps.includes(id)) {
        problems.push(`[${id}] opened ${openedApps.join(', ')} instead`);
      }
      // An app crash is contained by the window's error boundary.
      if ((await page.locator('[data-app-fault]').count()) > 0) {
        problems.push(`[${id}] app crashed (SYSTEM FAULT panel shown)`);
      }

      if (!(await closeAllWindows(page))) {
        problems.push(`[${id}] window did not close`);
      }
    });
  }

  stage = 'done';
  expect.soft(problems, 'apps that did not open, load or close cleanly').toEqual([]);
  expect(errors, 'console errors / uncaught exceptions').toEqual([]);
});
