/**
 * 掷骰入口。实际步骤由 module/flows/ 中的流程完成；这里保留旧的函数签名，方便宏与其他模块调用。
 */
import { ActionFlow } from "../flows/action-flow.mjs";
import { EffectFlow } from "../flows/effect-flow.mjs";
import { createCard, itemStats } from "../flows/common.mjs";
import { localize, enrich } from "../utils.mjs";

/**
 * 执行一次行动检定（技能、攻击、反应、属性检定共用）。参数见 ActionFlowInput。
 * @returns {Promise<ChatMessage|null>}
 */
export async function rollAction(actor, cfg) {
  const state = await new ActionFlow(actor, { ...cfg }, { item: cfg.item ?? null }).begin();
  return state?.data.message ?? null;
}

/**
 * 掷效应（伤害）骰。冒险转化的蓄势只提升奖励骰，且不超过传奇级（d20；突破传奇时为神话级 d100）。
 * @param {Actor} actor
 * @param {Item} item 武器或战技
 * @param {{chances?: number, beyondLegendary?: boolean, targets?: object[], fastForward?: boolean}} [options]
 *   beyondLegendary：行动检定中绽放命运「突破传奇」，奖励骰上限提升到 d100
 */
export async function rollDamage(actor, item, { chances = 0, beyondLegendary = false, targets = [], fastForward = false } = {}) {
  const state = await new EffectFlow(actor, { chances, beyondLegendary, targets, fastForward }, { item }).begin();
  return state?.data.message ?? null;
}

/** 发布一张无检定的物品卡片（道具、天赋、结晶回路等）。 */
export async function postItemCard(actor, item, { tags = [] } = {}) {
  return createCard(actor, "chat/action-card.hbs", {
    title: item.name,
    icon: "fa-solid fa-box-open",
    itemImg: item.img,
    stats: itemStats(item),
    band: localize(`TYPES.Item.${item.type}`),
    actorName: actor?.name,
    actorImg: actor?.img,
    roll: null,
    tags,
    description: await enrich(item.system.description),
    showDamage: !!actor && item.system.damage > 0
  }, {
    flags: { kind: "item", actorUuid: actor?.uuid ?? null, itemUuid: item.uuid, chances: 0, targets: [] }
  });
}
