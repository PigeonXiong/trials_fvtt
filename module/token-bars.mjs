/**
 * Token 资源条的默认设置。
 *
 * - 可见性：PC（character）的资源条对所有人始终显示；NPC 只对拥有者（含 GM）始终显示。
 * - 未启用 Bar Brawl：沿用核心的两条资源条（耐久、生命值，见 system.json）。
 * - 启用 Bar Brawl：新建角色自动配好全套资源条。
 *     上方：耐久（最上排）、生命值，显示数值；
 *     下方：活力 | 魔力同排一左一右，导力能量在最下排（仅 PC），不显示数值。
 *   如果 GM 在 Bar Brawl 里为该角色类型「保存为默认」，Bar Brawl 会用自己的设置覆盖这里的布局。
 *
 * 本文件顶层不访问 Foundry 全局对象，纯函数可以直接在 Node 中测试。
 */

/** 与 CONST.TOKEN_DISPLAY_MODES 数值一致。 */
export const DISPLAY_MODES = Object.freeze({ NONE: 0, OWNER: 40, ALWAYS: 50 });

/** Bar Brawl 逐条可见性的取值（INHERIT = GM 沿用拥有者设置）。 */
export const BRAWL_VISIBILITY = Object.freeze({ INHERIT: -1, NONE: 0, ALWAYS: 50 });

/** 同排两条资源条各占的宽度之外，再空出 1% 作为间隙。 */
const HALF_ROW_INDENT = 51;

/**
 * Bar Brawl 布局。Bar Brawl 按 order 依次排布：
 * top-inner 从 token 顶边向下堆叠（先排的在最上），bottom-inner 从底边向上堆叠（先排的在最下）；
 * shareHeight 的条不占用高度，下一条会排到同一行。
 * id 只有 bar1 / bar2 有特殊含义：它们与核心的两条资源条同步。
 */
export const BRAWL_LAYOUT = Object.freeze([
  { id: "bar1", resource: "durability", position: "top-inner", style: "fraction", colors: ["#3b4252", "#9fb0c8"] },
  { id: "bar2", resource: "health", position: "top-inner", style: "fraction", colors: ["#5c1414", "#d64545"] },
  { id: "bar5", resource: "ep", position: "bottom-inner", style: "none", colors: ["#1a3357", "#5b8fd6"], types: ["character"] },
  { id: "bar3", resource: "vigor", position: "bottom-inner", style: "none", colors: ["#6b3d10", "#e0913a"], indentRight: HALF_ROW_INDENT, shareHeight: true },
  { id: "bar4", resource: "mana", position: "bottom-inner", style: "none", colors: ["#33245a", "#9474d6"], indentLeft: HALF_ROW_INDENT }
]);

export const isPlayerCharacter = type => type === "character";

/** 核心资源条的显示模式（Token 的 displayBars）。 */
export function displayBarsFor(type) {
  return isPlayerCharacter(type) ? DISPLAY_MODES.ALWAYS : DISPLAY_MODES.OWNER;
}

/** Bar Brawl 每条资源条的可见性。 */
export function brawlVisibilityFor(type) {
  return {
    gmVisibility: BRAWL_VISIBILITY.INHERIT,
    ownerVisibility: BRAWL_VISIBILITY.ALWAYS,
    otherVisibility: isPlayerCharacter(type) ? BRAWL_VISIBILITY.ALWAYS : BRAWL_VISIBILITY.NONE
  };
}

function brawlBar(layout, order, type) {
  return {
    id: layout.id,
    order,
    attribute: `resources.${layout.resource}`,
    position: layout.position,
    mincolor: layout.colors[0],
    maxcolor: layout.colors[1],
    style: layout.style,
    label: "",
    indentLeft: layout.indentLeft ?? 0,
    indentRight: layout.indentRight ?? 0,
    shareHeight: !!layout.shareHeight,
    ...brawlVisibilityFor(type)
  };
}

/**
 * 某类角色的 Bar Brawl 全套资源条（写入 prototypeToken.flags.barbrawl.resourceBars）。
 * @param {string} type 角色类型
 * @returns {Record<string, object>}
 */
export function brawlBarsFor(type) {
  const layout = BRAWL_LAYOUT.filter(l => !l.types || l.types.includes(type));
  return Object.fromEntries(layout.map((l, order) => [l.id, brawlBar(l, order, type)]));
}

/**
 * 新建角色时要写入的原型 Token 默认值（扁平键）。创建数据里已有的设置（复制、导入的角色）不会被覆盖。
 * @param {string} type 角色类型
 * @param {object} data 创建数据
 * @param {{brawlActive?: boolean}} [options]
 * @returns {Record<string, unknown>}
 */
export function prototypeTokenDefaults(type, data = {}, { brawlActive = false } = {}) {
  const token = data.prototypeToken ?? {};
  const updates = {};
  if (token.displayBars === undefined) updates["prototypeToken.displayBars"] = displayBarsFor(type);
  if (brawlActive && !token.flags?.barbrawl?.resourceBars) {
    updates["prototypeToken.flags.barbrawl.resourceBars"] = brawlBarsFor(type);
  }
  return updates;
}

/**
 * Bar Brawl 为缺少记录的 bar1 / bar2 临时生成的条会继承 displayBars；而启用 Bar Brawl 后
 * displayBars 被固定为「始终」，所以迁移时要把这两条写成明确的记录。
 */
function fallbackBar(id, attribute, type) {
  const layout = BRAWL_LAYOUT.find(l => `resources.${l.resource}` === attribute);
  const order = id === "bar1" ? 0 : 1;
  if (layout) return { ...brawlBar(layout, order, type), id };
  return {
    id,
    order,
    attribute,
    position: id === "bar1" ? "bottom-inner" : "top-inner",
    mincolor: id === "bar1" ? "#FF0000" : "#000080",
    maxcolor: id === "bar1" ? "#80FF00" : "#80B3FF",
    ...brawlVisibilityFor(type)
  };
}

/**
 * 已有 Token（或原型 Token）的可见性补丁：已有的条只改可见性，不动布局和颜色；
 * 启用 Bar Brawl 时，缺少记录的 bar1 / bar2 会补成完整的条（见 fallbackBar）。
 * @param {string} type 角色类型
 * @param {object} source Token 源数据（toObject() 的结果）
 * @param {{brawlActive?: boolean}} [options]
 * @returns {object} 可直接传给 update 的嵌套对象
 */
export function tokenBarPatch(type, source = {}, { brawlActive = false } = {}) {
  const patch = { displayBars: displayBarsFor(type) };
  const stored = source.flags?.barbrawl?.resourceBars ?? {};
  const { ownerVisibility, otherVisibility } = brawlVisibilityFor(type);
  const bars = {};
  for (const id of Object.keys(stored)) {
    if (stored[id] && typeof stored[id] === "object") bars[id] = { id, ownerVisibility, otherVisibility };
  }
  if (brawlActive) {
    for (const id of ["bar1", "bar2"]) {
      const attribute = source[id]?.attribute;
      if (!stored[id] && attribute) bars[id] = fallbackBar(id, attribute, type);
    }
  }
  if (Object.keys(bars).length) patch.flags = { barbrawl: { resourceBars: bars } };
  return patch;
}

/** 当前是否启用了 Bar Brawl（只能在 Foundry 中调用）。 */
export function barBrawlActive() {
  return !!game.modules.get("barbrawl")?.active;
}
