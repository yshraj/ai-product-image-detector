// Page Object Model — full settings (options) page.
class OptionsPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.version = page.locator('#version');
    this.confidenceSlider = page.locator('#opt-confidence');
    this.confidenceVal = page.locator('#confidence-val');
    this.enabledToggle = page.locator('#opt-enabled');
    this.clearHistoryBtn = page.locator('#clear-history');
    this.historyItems = page.locator('.hist-item');
    this.historyEmpty = page.locator('#history-empty');
    this.resetAllBtn = page.locator('#reset-all');
    this.siteChecks = page.locator('#site-checks');
  }

  async goto(url) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async setConfidence(value) {
    await this.page.$eval('#opt-confidence', (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }

  siteCheckbox(site) {
    return this.siteChecks.locator(`input[data-site="${site}"]`);
  }
}

module.exports = { OptionsPage };
