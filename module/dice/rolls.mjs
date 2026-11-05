import { actionPool, effectPool, countBursts, resolveAction, burstDestinedReasons, MAX_CHANCES, CHANCE_VS }
  from "../rules/dice.mjs";
import { SYSTEM_ID, TRAILS } from "../config.mjs";
import { renderTemplate, templatePath, FormDataExtendedImpl, localize, format, enrich } from "../utils.mjs";

/** 带 x（爆发）修饰的骰项即奖励骰。 */
const isBonusTerm = term => term.modifiers?.some(m => m.startsWith("x"));

function countRollBursts(roll) {
  return roll.dice.filter(isBonusTerm).reduce((n, d) => n + countBursts(d.results, d.faces), 0);
}

const toInt = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

/**
 * 弹出检定选项对话框。
 * @returns {Promise<object|null>} 用户关闭对话框时为 null
 */
async function promptActionOptions({ title, ability, allowAbility, allowChances, vs, summary }) {
  const chanceChoices = Object.fromEntries(Array.from({ length: MAX_CHANCES + 1 }, (_, n) => [
    n, n ? format("TRAILS.Roll.ChanceOption", { n, vs: n * CHANCE_VS }) : "0"
  ]));
  const content = await renderTemplate(templatePath("dialog/roll-dialog.hbs"), {
    ability, allowAbility, allowChances, vs, summary, chanceChoices,
    abilityChoices: TRAILS.abilities
  });
  return foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["trails", "trails-dialog"],
    content,
    buttons: [{
      action: "roll",
      label: localize("TRAILS.Roll.Roll"),
      icon: "fa-solid fa-dice-d20",
      default: true,
      callback: (event, button) => new (FormDataExtendedImpl())(button.form).object
    }],
    rejectClose: false
  });
}

async function createCard(actor, template, data, { rolls = [], flags = {} } = {}) {
  const content = await renderTemplate(templatePath(template), data);
  const messageData = {
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls,
    sound: rolls.length ? CONFIG.sounds.dice : undefined,
    flags: { [SYSTEM_ID]: flags }
  };
  ChatMessage.applyRollMode(messageData, game.settings.get("core", "rollMode"));
  return ChatMessage.create(messageData);
}

async function maybeBecomeDestined(actor, outcome) {
  if (!outcome.destinedReasons.length) return null;
  if (!("destined" in actor.system) || actor.system.destined || !actor.isOwner) return null;
  await actor.update({ "system.destined": true });
  return outcome.destinedReasons.map(r => localize(`TRAILS.Destined.Reason.${r}`)).join("、");
}

/**
 * 执行一次行动检定（技能、攻击、反应、属性检定共用）。
 * @param {Actor} actor
 * @param {object} cfg
 * @param {string} cfg.title 卡片标题
 * @param {string} [cfg.subtitle]
 * @param {(ability: string|null) => {dice: number, challenges: number, notes: string[], warnings: string[]}} cfg.pool
 *   由属性计算基础骰池；notes 显示在对话框，warnings（负伤等自动挑战）显示在卡片
 * @param {string|null} [cfg.ability] 默认属性
 * @param {boolean} [cfg.allowAbility] 是否允许在对话框中改用其他属性
 * @param {boolean} [cfg.allowChances] 是否允许承担冒险（反应不可）
 * @param {number|null} [cfg.vs] 默认胜利总值
 * @param {{resource: string, amount: number}|null} [cfg.cost] 资源消耗
 * @param {Item|null} [cfg.item] 关联物品（武器、战技）
 * @param {boolean} [cfg.offerDamage] 命中后提供伤害按钮
 * @param {boolean} [cfg.fastForward] 跳过对话框
 */
export async function rollAction(actor, cfg) {
  const ability = cfg.ability ?? null;
  const defaults = { ability, vs: cfg.vs ?? null, chances: 0, extraDice: 0, charges: 0, challenges: 0, flat: 0 };
  let input = defaults;
  if (!cfg.fastForward) {
    const summary = cfg.pool(ability).notes.join("；");
    const result = await promptActionOptions({
      title: cfg.title, ability, summary,
      allowAbility: !!cfg.allowAbility && !!ability,
      allowChances: cfg.allowChances !== false,
      vs: defaults.vs
    });
    if (!result) return null;
    input = { ...defaults, ...result };
  }

  const options = {
    ability: input.ability || ability,
    vs: input.vs === null || input.vs === "" ? null : toInt(input.vs, null),
    chances: cfg.allowChances === false ? 0 : toInt(input.chances),
    extraDice: toInt(input.extraDice),
    charges: toInt(input.charges),
    challenges: toInt(input.challenges),
    flat: toInt(input.flat)
  };

  if (cfg.cost?.amount && !actor.canSpend(cfg.cost.resource, cfg.cost.amount)) return null;

  const base = cfg.pool(options.ability);
  const pool = actionPool({
    bonusDice: base.dice + options.extraDice,
    charges: options.charges,
    challenges: base.challenges + options.challenges,
    flat: options.flat
  });
  const roll = await new Roll(pool.formula).evaluate();
  const natural = roll.dice.find(d => !isBonusTerm(d))?.total ?? 0;
  const bursts = countRollBursts(roll);
  const outcome = resolveAction({ total: roll.total, vs: options.vs, chances: options.chances, natural, bursts });

  if (cfg.cost?.amount) await actor.spendResource(cfg.cost.resource, cfg.cost.amount);
  const destined = await maybeBecomeDestined(actor, outcome);

  const tags = [];
  if (options.ability) tags.push(localize(TRAILS.abilities[options.ability]));
  if (pool.dice) tags.push(format("TRAILS.Roll.BonusDiceTag", { n: pool.dice, faces: pool.faces }));
  if (cfg.cost?.amount) tags.push(format("TRAILS.Roll.CostTag", { n: cfg.cost.amount, resource: localize(TRAILS.resources[cfg.cost.resource]) }));
  tags.push(...base.warnings);

  const showDamage = !!cfg.offerDamage && cfg.item?.system.damage > 0 && outcome.success !== false;
  return createCard(actor, "chat/action-card.hbs", {
    title: cfg.title,
    subtitle: cfg.subtitle,
    img: cfg.item?.img ?? actor.img,
    tags,
    rollHTML: await roll.render(),
    outcome,
    destined,
    description: cfg.item ? await enrich(cfg.item.system.description) : "",
    showDamage
  }, {
    rolls: [roll],
    flags: {
      kind: "action",
      actorUuid: actor.uuid,
      itemUuid: cfg.item?.uuid ?? null,
      chances: outcome.chances,
      success: outcome.success
    }
  });
}

/**
 * 掷效果（伤害）骰。冒险转化的蓄势只提升奖励骰，且不超过传奇（d20）。
 * @param {Actor} actor
 * @param {Item} item 武器或战技
 * @param {{chances?: number}} [options]
 */
export async function rollDamage(actor, item, { chances = 0 } = {}) {
  const sys = item.system;
  const strengthDice = sys.addStrength ? actor.system.abilities.str.dice : 0;
  const pool = effectPool({
    effectDice: sys.damage,
    effectFaces: TRAILS.rankFaces[sys.quality],
    bonusDice: strengthDice + sys.bonusDamageDice,
    charges: chances,
    challenges: actor.system.wounded ? 1 : 0
  });
  const roll = await new Roll(pool.formula).evaluate();
  const bursts = countRollBursts(roll);
  const destined = await maybeBecomeDestined(actor, { destinedReasons: burstDestinedReasons(bursts) });

  const tags = [localize(TRAILS.ranks[sys.quality])];
  if (sys.damageType) tags.push(sys.damageType);
  if (strengthDice) tags.push(format("TRAILS.Roll.StrengthTag", { n: strengthDice }));
  if (chances) tags.push(format("TRAILS.Roll.ChargeTag", { n: chances }));
  if (actor.system.wounded) tags.push(localize("TRAILS.Roll.WoundedTag"));

  return createCard(actor, "chat/damage-card.hbs", {
    title: format("TRAILS.Roll.DamageTitle", { name: item.name }),
    img: item.img,
    tags,
    rollHTML: await roll.render(),
    critical: bursts > 0,
    bursts,
    destined
  }, {
    rolls: [roll],
    flags: { kind: "damage", actorUuid: actor.uuid, itemUuid: item.uuid }
  });
}

/** 发布一张无检定的物品卡片（道具、天赋、结晶回路等）。 */
export async function postItemCard(actor, item, { tags = [] } = {}) {
  return createCard(actor, "chat/action-card.hbs", {
    title: item.name,
    img: item.img,
    tags,
    rollHTML: "",
    outcome: null,
    destined: null,
    description: await enrich(item.system.description),
    showDamage: !!actor && item.system.damage > 0
  }, {
    flags: { kind: "item", actorUuid: actor?.uuid ?? null, itemUuid: item.uuid, chances: 0 }
  });
}
