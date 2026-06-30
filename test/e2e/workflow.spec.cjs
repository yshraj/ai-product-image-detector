// End-to-end user workflow: scan → inspect → export → settings → history.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { PopupPage } = require('./pages/PopupPage.cjs');
const { OptionsPage } = require('./pages/OptionsPage.cjs');
const { activateMarketplaceTab } = require('./helpers/tab-utils.cjs');

test.describe('Full user workflow', () => {
  test('scan product listing → open details → connect HF → verify history', async ({
    extensionContext,
    popupUrl,
    optionsUrl,
    contentPage,
  }) => {
    // 1. User opens a marketplace category page — images get scanned.
    await contentPage.setViewportAllVisible();
    await contentPage.gotoListing();
    await contentPage.waitForBadges();
    const badgeCount = await contentPage.badges.count();
    expect(badgeCount).toBeGreaterThan(0);

    // 2. User clicks a badge to understand why it was flagged.
    await contentPage.badges.first().click();
    await expect(contentPage.popover).toBeVisible();
    await expect(contentPage.popover).toContainText('Why flagged?');
    await contentPage.page.keyboard.press('Escape');

    // 3. User opens the popup — scan stats are available on the listing tab.
    const { getContentStats } = require('./helpers/chrome-messaging.cjs');
    await expect.poll(() => getContentStats(extensionContext), { timeout: 10_000 }).toMatchObject({
      scanned: expect.any(Number),
    });

    await activateMarketplaceTab(extensionContext, 'men-shirts');
    const popupTab = await extensionContext.newPage();
    const popup = new PopupPage(popupTab);
    await popup.goto(popupUrl);
    await expect(popup.scanPanel).toBeVisible();

    // 4. User connects Hugging Face from Settings.
    await popup.connectHuggingFace('hf_demotoken123');
    await expect(popup.statusChip).toHaveText('Connected');

    // 5. User opens full settings — history lists flagged items.
    const optTab = await extensionContext.newPage();
    const options = new OptionsPage(optTab);
    await options.goto(optionsUrl);
    await expect.poll(() => options.historyItems.count(), { timeout: 10_000 }).toBeGreaterThan(0);

    // 6. User clears history.
    await options.clearHistoryBtn.click();
    await expect(options.historyEmpty).toBeVisible();

    await popupTab.close();
    await optTab.close();
  });
});
