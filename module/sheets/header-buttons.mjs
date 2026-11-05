/**
 * 角色卡标题栏按钮。
 *
 * v12 的 ApplicationV2 角色卡有两个与旧版（ApplicationV1）不同的地方：
 * 1. 「指示物模板」被收在「⋮」菜单里；这里把它放回标题栏。
 * 2. 不会触发旧版的 getActorSheetHeaderButtons 钩子，v12 也没有给 ApplicationV2 加按钮的钩子，
 *    所以 Theatre Inserts 等模组的按钮不会出现。这里在 v12 下手动触发旧钩子，
 *    并按旧版的结构（<a><i></i>文字</a>）把按钮放到标题栏。v13 起由核心的新钩子处理，不再重复触发。
 */

const PROTOTYPE_ACTION = "configurePrototypeToken";

/** 从「⋮」菜单中去掉已经放到标题栏的控件。 */
export function withoutHeaderButtons(controls) {
  return controls.filter(c => c.action !== PROTOTYPE_ACTION);
}

/** 旧版标题栏按钮：<a class="header-button"><i></i>文字</a>，模组依赖这个结构更新图标和文字。 */
function legacyButton({ label = "", class: cls = "", icon = "", tooltip, onclick }) {
  const button = document.createElement("a");
  button.className = `header-control header-button control trails-header-button ${cls}`.trim();
  if (tooltip) button.dataset.tooltip = tooltip;
  const i = document.createElement("i");
  i.className = icon;
  button.append(i, document.createTextNode(game.i18n.localize(label)));
  button.addEventListener("click", event => {
    event.preventDefault();
    onclick?.(event);
  });
  return button;
}

/** 收集模组通过旧钩子添加的按钮（仅 v12）。 */
function moduleButtons(sheet) {
  if ((game.release?.generation ?? 12) >= 13) return [];
  const buttons = [];
  Hooks.call("getActorSheetHeaderButtons", sheet, buttons);
  return buttons.filter(b => b && typeof b === "object");
}

/**
 * 在角色卡标题栏（标题之后、「⋮」之前）插入按钮。应在 _renderFrame 之后调用。
 * @param {ActorSheetV2} sheet
 */
export function insertHeaderButtons(sheet) {
  const anchor = sheet.window?.controls;
  if (!anchor) return;
  const elements = moduleButtons(sheet).map(legacyButton);

  if (sheet.document.testUserPermission(game.user, "OWNER")) {
    const label = game.i18n.localize("TOKEN.TitlePrototype");
    const button = legacyButton({ label, class: "configure-token", icon: "fa-solid fa-user-circle" });
    button.dataset.action = PROTOTYPE_ACTION; // 由 ActorSheetV2 自带的动作处理
    elements.push(button);
  }

  anchor.before(...elements);
}
