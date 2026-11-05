/**
 * 行动检定流程：技能、属性、攻击、战技、防御反应、抵抗反应共用。
 *
 * initActionData → setActionTargets → showActionHUD → checkActionCost → rollActionCheck
 * → spendActionCost → applyActionDestined → printActionCard
 */
import { Flow, flowSteps } from "./flow.mjs";
import { RollHud } from "../apps/roll-hud.mjs";
import { applyToggles, buildActionPool, resolveTargets, coverGuardBonus } from "../rules/roll-config.mjs";
import { TRAILS } from "../config.mjs";
import { localize, format, enrich } from "../utils.mjs";
import {
  countRollBursts, naturalResult, rollDisplay, currentTargets, createCard, maybeBecomeDestined, itemStats
} from "./common.mjs";

export class ActionFlow extends Flow {
  static steps = [
    "initActionData",
    "setActionTargets",
    "showActionHUD",
    "checkActionCost",
    "rollActionCheck",
    "spendActionCost",
    "applyActionDestined",
    "printActionCard"
  ];
}

/**
 * 流程输入（state.data）：
 * @typedef {object} ActionFlowInput
 * @property {string} title
 * @property {string} band          卡片色带文字，例如「攻击 VS 物防」
 * @property {string} [icon]
 * @property {(ability: string|null) => {sources: object[]}} pool  由属性生成骰池来源
 * @property {string|null} [ability]
 * @property {boolean} [allowAbility]
 * @property {boolean} [allowChances]  反应不可承担冒险
 * @property {boolean} [reaction]      反应检定：需严格高于 VS
 * @property {string} [defense]        guard / ward：读取目标的物防或魔防
 * @property {number|null} [vs]
 * @property {{resource: string, amount: number}|null} [cost]
 * @property {Item|null} [item]
 * @property {boolean} [offerDamage]
 * @property {boolean} [fastForward]   跳过面板，按默认值直接掷骰
 */

/** 命定状态下可以「绽放命运」：消耗命定，为一次行动或反应掷骰 +3 奖励骰。 */
function bloomSource(actor) {
  if (!actor.system.destined || !actor.isOwner) return null;
  return {
    id: "bloom",
    label: localize("TRAILS.Source.Bloom"),
    hint: localize("TRAILS.Source.BloomHint"),
    dice: 3,
    enabled: false,
    consumesDestined: true
  };
}

async function initActionData(state) {
  const { actor, data } = state;
  const bloom = bloomSource(actor);
  const cost = data.cost?.amount ? data.cost : null;
  let costInfo = null;
  if (cost) {
    const have = actor.system.resources?.[cost.resource]?.value ?? 0;
    costInfo = {
      ...cost,
      have,
      short: have < cost.amount,
      label: format("TRAILS.Hud.Cost", { n: cost.amount, resource: localize(TRAILS.resources[cost.resource]), have })
    };
  }
  const item = state.item ?? data.item ?? null;
  state.item = item;

  data.hud = {
    kind: "action",
    title: data.title,
    band: data.band,
    icon: data.icon ?? "fa-solid fa-dice-d20",
    stats: itemStats(item),
    ability: data.ability ?? null,
    abilityChoices: data.allowAbility && data.ability ? TRAILS.abilities : null,
    getSources: ability => [...data.pool(ability).sources, ...(bloom ? [bloom] : [])],
    sources: [],
    toggles: {},
    allowChances: data.allowChances !== false,
    chances: 0,
    extraDice: 0,
    charges: 0,
    challenges: 0,
    flat: 0,
    defense: data.defense ?? "none",
    targets: [],
    trackTargets: false,
    vs: data.vs ?? null,
    reaction: !!data.reaction,
    cost: costInfo,
    rollMode: game.settings.get("core", "rollMode")
  };
}

async function setActionTargets(state) {
  const hud = state.data.hud;
  if (!["guard", "ward"].includes(hud.defense)) return;
  hud.targets = currentTargets();
  hud.trackTargets = true;
}

async function showActionHUD(state) {
  if (state.data.fastForward) return;
  const result = await RollHud.prompt(state.data.hud);
  if (!result) return false;
}

async function checkActionCost(state) {
  const cost = state.data.hud.cost;
  if (cost && !state.actor.canSpend(cost.resource, cost.amount)) return false;
}

async function rollActionCheck(state) {
  const { data } = state;
  const hud = data.hud;
  hud.sources = applyToggles(hud.getSources(hud.ability), hud.toggles);
  const pool = buildActionPool(hud);
  const roll = await new Roll(pool.formula).evaluate();
  const natural = naturalResult(roll);
  const bursts = countRollBursts(roll);
  const targets = hud.targets
    .filter(t => t[hud.defense] !== null && t[hud.defense] !== undefined)
    .map(t => ({ ...t, defenseValue: t[hud.defense] }));
  data.pool = pool;
  data.roll = roll;
  data.outcome = resolveTargets({
    total: roll.total,
    natural,
    bursts,
    chances: hud.allowChances ? hud.chances : 0,
    defense: hud.defense,
    targets,
    vs: hud.vs,
    strict: hud.reaction
  });
  data.bloomed = hud.sources.some(s => s.consumesDestined && s.enabled);
}

async function spendActionCost(state) {
  const cost = state.data.hud.cost;
  if (cost) await state.actor.spendResource(cost.resource, cost.amount);
}

/** 绽放命运会消耗命定，且同一回合不能再次进入命定。 */
async function applyActionDestined(state) {
  const { actor, data } = state;
  if (data.bloomed) {
    await actor.update({ "system.destined": false });
    return;
  }
  data.destined = await maybeBecomeDestined(actor, data.outcome.destinedReasons);
}

async function printActionCard(state) {
  const { actor, item, data } = state;
  const { hud, outcome, roll } = data;
  const resultLabels = hud.reaction || !outcome.targets.length
    ? { hit: "TRAILS.Roll.Success", miss: "TRAILS.Roll.Failure" }
    : { hit: "TRAILS.Roll.Hit", miss: "TRAILS.Roll.Miss" };

  const targets = outcome.targets.map(t => ({
    ...t,
    coverLabel: t.cover !== "none" ? localize(`TRAILS.Cover.${t.cover}`) : "",
    coverGuard: coverGuardBonus(t.cover, hud.defense),
    resultLabel: localize(t.success ? resultLabels.hit : resultLabels.miss)
  }));

  const tags = hud.sources.filter(s => s.enabled && (s.dice || s.charges || s.challenges || s.flat))
    .map(s => `${s.label} ${s.dice ? (s.dice > 0 ? `+${s.dice}` : s.dice) : ""}`.trim());
  if (hud.extraDice) tags.push(format("TRAILS.Hud.TagExtraDice", { n: hud.extraDice > 0 ? `+${hud.extraDice}` : hud.extraDice }));
  if (hud.charges) tags.push(format("TRAILS.Roll.ChargeTag", { n: hud.charges }));
  if (hud.challenges) tags.push(format("TRAILS.Hud.TagChallenges", { n: hud.challenges }));
  if (hud.flat) tags.push(`${localize("TRAILS.Roll.Flat")} ${hud.flat > 0 ? `+${hud.flat}` : hud.flat}`);
  if (hud.cost) tags.push(format("TRAILS.Roll.CostTag", { n: hud.cost.amount, resource: localize(TRAILS.resources[hud.cost.resource]) }));

  const anyHit = outcome.targets.length ? outcome.targets.some(t => t.success) : outcome.success !== false;
  const showDamage = !!data.offerDamage && item?.system.damage > 0 && anyHit;

  const badges = [];
  if (outcome.natural === 20) badges.push({ cls: "nat20", label: localize("TRAILS.Roll.Natural20") });
  if (outcome.bursts) badges.push({ cls: "burst", label: `${localize("TRAILS.Roll.Burst")} ×${outcome.bursts}` });
  if (outcome.chances) badges.push({ cls: "chance", label: `${localize("TRAILS.Roll.Chances")} ×${outcome.chances}` });
  if (data.bloomed) badges.push({ cls: "bloom", label: localize("TRAILS.Source.Bloom") });

  data.message = await createCard(actor, "chat/action-card.hbs", {
    title: hud.title,
    icon: hud.icon,
    stats: hud.stats,
    band: hud.band,
    actorName: actor.name,
    actorImg: actor.img,
    itemImg: item?.img ?? null,
    roll: await rollDisplay(roll),
    outcome,
    targets,
    resultLabel: outcome.success === null ? "" : localize(outcome.success ? resultLabels.hit : resultLabels.miss),
    badges,
    destined: data.destined,
    tags,
    description: item ? await enrich(item.system.description) : "",
    showDamage,
    damageCharges: outcome.chances
  }, {
    rolls: [roll],
    rollMode: hud.rollMode,
    flags: {
      kind: "action",
      actorUuid: actor.uuid,
      itemUuid: item?.uuid ?? null,
      chances: outcome.chances,
      success: outcome.success,
      targets: outcome.targets.map(t => ({
        tokenUuid: t.tokenUuid, actorUuid: t.actorUuid, name: t.name, img: t.img,
        cover: t.cover, targetVS: t.targetVS, success: t.success
      }))
    }
  });
}

export function registerActionSteps(steps = flowSteps) {
  steps.set("initActionData", initActionData);
  steps.set("setActionTargets", setActionTargets);
  steps.set("showActionHUD", showActionHUD);
  steps.set("checkActionCost", checkActionCost);
  steps.set("rollActionCheck", rollActionCheck);
  steps.set("spendActionCost", spendActionCost);
  steps.set("applyActionDestined", applyActionDestined);
  steps.set("printActionCard", printActionCard);
}
