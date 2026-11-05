/** 各流程共用的工具：掷骰解析、目标收集、聊天卡片、命定。 */
import { countBursts } from "../rules/dice.mjs";
import { COVER } from "../rules/roll-config.mjs";
import { SYSTEM_ID, TRAILS } from "../config.mjs";
import { renderTemplate, templatePath, localize, format } from "../utils.mjs";

/** 带 x（爆发）修饰的骰项即奖励骰。 */
export const isBonusTerm = term => term.modifiers?.some(m => m.startsWith("x"));

/** 统计一次掷骰中奖励骰的爆发次数。 */
export function countRollBursts(roll) {
  return roll.dice.filter(isBonusTerm).reduce((n, d) => n + countBursts(d.results, d.faces), 0);
}

/** 行动骰（d20）的原始点数。 */
export function naturalResult(roll) {
  return roll.dice.find(d => d.faces === 20 && !isBonusTerm(d))?.total ?? 0;
}

/** 聊天卡片里的掷骰区：公式、总值和可展开的骰子明细。 */
export async function rollDisplay(roll) {
  return { formula: roll.formula, total: roll.total, tooltip: await roll.getTooltip() };
}

/** 来源的效果文字，例如「+2 奖励骰」「1 挑战」。 */
export function sourceEffect(source) {
  if (source.effectText) return source.effectText;
  const parts = [];
  if (source.dice) parts.push(format("TRAILS.Hud.SourceDice", { n: signed(source.dice) }));
  if (source.charges) parts.push(format("TRAILS.Hud.SourceCharges", { n: source.charges }));
  if (source.challenges) parts.push(format("TRAILS.Hud.SourceChallenges", { n: source.challenges }));
  if (source.flat) parts.push(signed(source.flat));
  return parts.join(" · ") || format("TRAILS.Hud.SourceDice", { n: "+0" });
}

export const signed = n => (n >= 0 ? `+${n}` : `${n}`);

/** 来源是否属于「减值」一栏（挑战或负数）。 */
export const isHindrance = s => (s.challenges ?? 0) > 0 || (s.dice ?? 0) < 0 || (s.flat ?? 0) < 0;

/* -------------------------------------------- */
/*  目标                                         */
/* -------------------------------------------- */

/**
 * 把一个 Token 转成面板与卡片使用的目标条目。
 * @param {TokenDocument|Token} token
 * @param {string} [cover]
 */
export function targetEntry(token, cover = "none") {
  const doc = token.document ?? token;
  const actor = doc.actor;
  if (!actor) return null;
  const defenses = actor.system.defenses ?? {};
  return {
    tokenUuid: doc.uuid,
    actorUuid: actor.uuid,
    name: doc.name,
    img: doc.texture?.src || actor.img,
    guard: defenses.guard?.value ?? null,
    ward: defenses.ward?.value ?? null,
    armorRank: defenses.armorRank?.value ?? 0,
    cover: cover in COVER ? cover : "none"
  };
}

/** 当前用户选中的目标；保留已有条目上设置过的掩护。 */
export function currentTargets(previous = []) {
  const covers = new Map(previous.map(t => [t.tokenUuid, t.cover]));
  return Array.from(game.user.targets)
    .map(token => targetEntry(token, covers.get(token.document.uuid)))
    .filter(Boolean);
}

/** 由卡片 flags 中保存的目标还原条目（场景中找不到 Token 时退回保存的快照）。 */
export function storedTargets(stored = []) {
  return stored.map(t => {
    const doc = t.tokenUuid ? fromUuidSync(t.tokenUuid) : null;
    return (doc && targetEntry(doc, t.cover)) ?? { ...t };
  });
}

/** 由目标条目找到要结算的角色（未链接的 Token 用其合成角色）。 */
export function targetActor(entry) {
  const doc = entry.tokenUuid ? fromUuidSync(entry.tokenUuid) : null;
  return doc?.actor ?? (entry.actorUuid ? fromUuidSync(entry.actorUuid) : null);
}

/* -------------------------------------------- */
/*  聊天卡片与命定                               */
/* -------------------------------------------- */

/**
 * 渲染模板并发出聊天消息。
 * @param {Actor} actor
 * @param {string} template
 * @param {object} data
 * @param {{rolls?: Roll[], flags?: object, rollMode?: string}} [options]
 */
export async function createCard(actor, template, data, { rolls = [], flags = {}, rollMode } = {}) {
  const content = await renderTemplate(templatePath(template), data);
  const messageData = {
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls,
    sound: rolls.length ? CONFIG.sounds.dice : undefined,
    flags: { [SYSTEM_ID]: flags }
  };
  ChatMessage.applyRollMode(messageData, rollMode ?? game.settings.get("core", "rollMode"));
  return ChatMessage.create(messageData);
}

/**
 * 满足条件时进入命定状态。
 * @returns {Promise<string|null>} 触发原因（用于卡片显示）
 */
export async function maybeBecomeDestined(actor, reasons = []) {
  if (!reasons.length) return null;
  if (!("destined" in actor.system) || actor.system.destined || !actor.isOwner) return null;
  await actor.update({ "system.destined": true });
  return reasons.map(r => localize(`TRAILS.Destined.Reason.${r}`)).join("、");
}

/** 卡片标题下的物品数据行（伤害、射程、消耗、范围）。 */
export function itemStats(item) {
  if (!item) return [];
  const sys = item.system;
  const stats = [];
  if (sys.damage > 0) {
    stats.push(`${localize("TRAILS.Item.Damage")} ${sys.damage}d${TRAILS.rankFaces[sys.quality]}`);
  }
  if (sys.range) stats.push(`${localize("TRAILS.Item.Range")} ${sys.range}`);
  if (item.type === "craft") {
    if (sys.cost) stats.push(`${sys.cost} ${localize(TRAILS.resources[sys.resource])}`);
    if (sys.area && sys.area !== "self") stats.push(localize(TRAILS.areas[sys.area]));
  }
  return stats;
}
