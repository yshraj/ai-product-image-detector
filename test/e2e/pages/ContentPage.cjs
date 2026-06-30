// Page Object Model — marketplace page with content-script overlays.
const { MYNTRA_LISTING_URL } = require('../helpers/constants.cjs');

class ContentPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.badges = page.locator('.rmf-badge');
    this.scores = page.locator('.rmf-score');
    this.scannedCards = page.locator('.product-base[data-rmf-scanned="true"]');
    this.productCards = page.locator('.product-base');
    this.popover = page.locator('.rmf-pop');
  }

  async gotoListing(url = MYNTRA_LISTING_URL) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async gotoProduct(url) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async waitForBadges(min = 1, timeout = 20_000) {
    const { expect } = require('@playwright/test');
    await expect.poll(() => this.badges.count(), { timeout }).toBeGreaterThanOrEqual(min);
  }

  async waitForScan(min = 1, timeout = 20_000) {
    const { expect } = require('@playwright/test');
    await expect.poll(() => this.scannedCards.count(), { timeout }).toBeGreaterThanOrEqual(min);
  }

  async scrollToBottom() {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  async setViewportAllVisible() {
    await this.page.setViewportSize({ width: 1280, height: 1400 });
  }
}

module.exports = { ContentPage };
