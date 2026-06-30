// Page Object Model — extension popup (4-tab shopping assistant).
class PopupPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.scanPanel = page.locator('#panel-scan');
    this.comparePanel = page.locator('#panel-compare');
    this.toolsPanel = page.locator('#panel-tools');
    this.settingsPanel = page.locator('#panel-settings');
    this.statusCard = page.locator('#status-card');
    this.statusChip = page.locator('#status-chip');
    this.toggleEnabled = page.locator('#toggle-enabled');
    this.rescanBtn = page.locator('#rescan');
    this.compareList = page.locator('#compare-list');
    this.toolsList = page.locator('#tools-list');
    this.reverseList = page.locator('#reverse-list');
  }

  async goto(url) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  nav(tab) {
    return this.page.locator(`#nav-${tab}`);
  }

  async selectTab(tab) {
    await this.nav(tab).click();
  }

  async openSettings() {
    await this.selectTab('settings');
  }

  async connectHuggingFace(token) {
    await this.openSettings();
    await this.page.locator('#tab-huggingface').click();
    await this.page.locator('#hf-token').fill(token);
    await this.page.locator('#hf-save').click();
  }
}

module.exports = { PopupPage };
