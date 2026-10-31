import { TRAILS } from "../config.mjs";
import { templatePath } from "../utils.mjs";
import { onEditImage, onSwitchTab, effectActions, prepareEffects } from "./common.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export const ITEM_DETAIL_TEMPLATES = ["weapon", "armor", "craft", "quartz", "talent", "gear"]
  .map(type => templatePath(`item/details/${type}.hbs`));

export class TrailsItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["trails", "sheet", "item"],
    position: { width: 560, height: 600 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      editImage: onEditImage,
      switchTab: onSwitchTab,
      use: TrailsItemSheet.#onUse,
      ...effectActions
    }
  };

  static PARTS = {
    sheet: { template: templatePath("item/item-sheet.hbs"), scrollable: [".sheet-body"] }
  };

  tabGroups = { primary: "details" };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    return Object.assign(context, {
      item,
      system: item.system,
      config: TRAILS,
      editable: this.isEditable,
      tab: this.tabGroups.primary,
      detailsPartial: templatePath(`item/details/${item.type}.hbs`),
      effects: prepareEffects(item),
      canUse: !!item.actor
    });
  }

  static #onUse() {
    return this.item.use();
  }
}
