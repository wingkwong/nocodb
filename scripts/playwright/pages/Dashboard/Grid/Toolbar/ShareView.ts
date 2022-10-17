import BasePage from "../../../Base";
import { ToolbarPage } from ".";

export class ToolbarShareViewPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`.nc-modal-share-view`);
  }

  async enablePassword(pwd: string) {
    await this.get()
      .locator(`[data-pw="nc-modal-share-view__with-password"]`)
      .click();
    await this.get()
      .locator(`[data-pw="nc-modal-share-view__password"]`)
      .fill(pwd);
    await this.get()
      .locator(`[data-pw="nc-modal-share-view__save-password"]`)
      .click();
    await this.toastWait({ message: "Successfully updated" });
  }

  async disablePassword() {
    await this.get()
      .locator(`[data-pw="nc-modal-share-view__with-password"`)
      .click();
  }

  async toggleDownload() {
    await this.get()
      .locator(`[data-pw="nc-modal-share-view__with-csv-download"]`)
      .click();
  }

  async getShareLink() {
    return this.get()
      .locator(`[data-pw="nc-modal-share-view__link"]`)
      .innerText();
  }

  async close() {
    await this.get().locator(`.ant-modal-close-x`).click();
  }
}
