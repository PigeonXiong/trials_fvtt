/**
 * 效应检定流程（目前用于伤害）。
 *
 * initEffectData → setEffectTargets → showEffectHUD → rollEffect → applyEffectDestined → printEffectCard
 */
import { Flow, flowSteps } from "./flow.mjs";
import { RollHud } from "../apps/roll-hud.mjs";
import { applyToggles, buildEffectPool, coverArmorBonus } from "../rules/roll-config.mjs";
import { burstDestinedReasons } from "../rules/dice.mjs";
import { TRAILS } from "../config.mjs";
import { localize, format } from "../utils.mjs";
import {
  countRollBursts, rollDisplay, currentTargets, storedTargets, createCard, maybeBecomeDestined, itemStats
} from "./common.mjs";

export class EffectFlow extends Flow {
  static steps = [
    "initEffectData",
    "setEffectTargets",
    "showEffectHUD",
    "rollEffect",
    "applyEffectDestined",
    "printEffectCard"
  ];
}

/**
 * 伤害来源：力量奖励骰、物品额外奖励骰、冒险转化的蓄势、负伤。
 * 效应掷骰的奖励骰只受益于蓄势；挑战仅在明确说明时（如负伤）才生效。
 */
function damageSources(actor, item, chances) {
  const sys = item.system;
  const sources = [];
  const strength = actor.system.abilities?.str?.dice ?? 0;
  if (strength || sys.addStrength) {
    sources.push({ id: "strength", label: localize("TRAILS.Source.Strength"), dice: strength, enabled: !!sys.addStrength });
  }
  if (sys.bonusDamageDice) {
    sources.push({ id: "itemBonus", label: localize("TRAILS.Source.ItemBonus"), dice: sys.bonusDamageDice, locked: true });
  }
  if (chances) {
    sources.push({
      id: "chances", label: localize("TRAILS.Source.ChanceCharges"), charges: chances,
      hint: localize("TRAILS.Source.ChanceChargesHint")
    });
  }
  if (actor.system.wounded) {
    sources.push({ id: "wounded", label: localize("TRAILS.Source.Wounded"), challenges: 1 });
  }
  return sources;
}

/**
 * state.data 输入：
 * @property {number} [chances]   来自行动检定的冒险
 * @property {object[]} [targets] 来自行动卡片的命中目标
 * @property {boolean} [fastForward]
 */
async function initEffectData(state) {
  const { actor, item, data } = state;
  const sys = item.system;
  const chances = data.chances ?? 0;
  data.hud = {
    kind: "effect",
    title: format("TRAILS.Roll.DamageTitle", { name: item.name }),
    band: localize("TRAILS.Hud.Band.Damage"),
    icon: "fa-solid fa-burst",
    stats: itemStats(item),
    effectDice: sys.damage,
    effectFaces: TRAILS.rankFaces[sys.quality],
    effectRank: localize(TRAILS.ranks[sys.quality]),
    ability: null,
    getSources: () => damageSources(actor, item, chances),
    sources: [],
    toggles: {},
    allowChances: false,
    chances: 0,
    extraDice: 0,
    charges: 0,
    challenges: 0,
    flat: 0,
    targets: [],
    trackTargets: true,
    damageType: sys.damageType,
    rollMode: game.settings.get("core", "rollMode")
  };
}

/** 优先使用行动卡片上命中的目标，否则读取当前选中的目标。 */
async function setEffectTargets(state) {
  const { data } = state;
  data.hud.targets = data.targets?.length ? storedTargets(data.targets) : currentTargets();
}

async function showEffectHUD(state) {
  if (state.data.fastForward) return;
  const result = await RollHud.prompt(state.data.hud);
  if (!result) return false;
}

async function rollEffect(state) {
  const { data } = state;
  const hud = data.hud;
  hud.sources = applyToggles(hud.getSources(), hud.toggles);
  data.pool = buildEffectPool(hud);
  data.roll = await new Roll(data.pool.formula).evaluate();
  data.bursts = countRollBursts(data.roll);
}

async function applyEffectDestined(state) {
  state.data.destined = await maybeBecomeDestined(state.actor, burstDestinedReasons(state.data.bursts));
}

async function printEffectCard(state) {
  const { actor, item, data } = state;
  const { hud, roll, bursts } = data;

  const tags = [hud.effectRank];
  if (hud.damageType) tags.push(hud.damageType);
  for (const s of hud.sources) {
    if (!s.enabled) continue;
    if (s.dice) tags.push(`${s.label} +${s.dice}`);
    else if (s.charges) tags.push(`${s.label} ${format("TRAILS.Roll.ChargeTag", { n: s.charges })}`);
    else if (s.challenges) tags.push(s.label);
  }
  if (hud.extraDice) tags.push(format("TRAILS.Hud.TagExtraDice", { n: hud.extraDice > 0 ? `+${hud.extraDice}` : hud.extraDice }));
  if (hud.charges) tags.push(format("TRAILS.Roll.ChargeTag", { n: hud.charges }));
  if (hud.challenges) tags.push(format("TRAILS.Hud.TagChallenges", { n: hud.challenges }));
  if (hud.flat) tags.push(`${localize("TRAILS.Roll.Flat")} ${hud.flat > 0 ? `+${hud.flat}` : hud.flat}`);

  const targets = hud.targets.map(t => {
    const bonus = coverArmorBonus(t.cover);
    const coverLabel = t.cover !== "none" ? localize(`TRAILS.Cover.${t.cover}`) : "";
    return {
      ...t,
      armorBonus: bonus,
      armorTotal: (t.armorRank ?? 0) + bonus,
      coverLabel,
      armorTooltip: coverLabel
        ? format("TRAILS.Damage.ArmorTooltipCover", { rank: t.armorRank ?? 0, cover: coverLabel, bonus })
        : format("TRAILS.Damage.ArmorTooltip", { rank: t.armorRank ?? 0 })
    };
  });

  data.message = await createCard(actor, "chat/damage-card.hbs", {
    title: hud.title,
    icon: hud.icon,
    stats: hud.stats,
    band: bursts ? format("TRAILS.Hud.Band.DamageBurst", { n: bursts }) : hud.band,
    burst: bursts > 0,
    actorName: actor.name,
    actorImg: actor.img,
    roll: await rollDisplay(roll),
    destined: data.destined,
    tags,
    targets
  }, {
    rolls: [roll],
    rollMode: hud.rollMode,
    flags: {
      kind: "damage",
      actorUuid: actor.uuid,
      itemUuid: item.uuid,
      targets: hud.targets.map(t => ({
        tokenUuid: t.tokenUuid, actorUuid: t.actorUuid, name: t.name, img: t.img,
        armorRank: t.armorRank, cover: t.cover
      }))
    }
  });
}

export function registerEffectSteps(steps = flowSteps) {
  steps.set("initEffectData", initEffectData);
  steps.set("setEffectTargets", setEffectTargets);
  steps.set("showEffectHUD", showEffectHUD);
  steps.set("rollEffect", rollEffect);
  steps.set("applyEffectDestined", applyEffectDestined);
  steps.set("printEffectCard", printEffectCard);
}
