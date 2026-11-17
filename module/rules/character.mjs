/**
 * 角色派生数值：纯函数，不依赖 Foundry。
 */
import { abilityBonusDice } from "./dice.mjs";

/** 九项属性，顺序同规则书角色卡。 */
export const ABILITY_KEYS = Object.freeze(["str", "agi", "sta", "spd", "sol", "emp", "mem", "rsn", "rsl"]);

/** 21 项核心技能及其默认属性（GM 可按情境改用其他属性）。 */
export const SKILL_DEFAULT_ABILITY = Object.freeze({
  athletics: "str",
  awareness: "rsn",
  beastHandling: "emp",
  crafting: "rsn",
  defense: "spd",
  entertain: "emp",
  heavyWeapons: "agi",
  legerdemain: "agi",
  lightWeapons: "agi",
  medicine: "rsn",
  occult: "sol",
  orbalArts: "sol",
  piloting: "spd",
  rangedWeapons: "agi",
  resistance: "rsl",
  science: "rsn",
  social: "emp",
  stealth: "agi",
  studies: "mem",
  survival: "sta",
  unarmed: "agi"
});

export const RESOURCE_KEYS = Object.freeze(["durability", "health", "vigor", "mana", "ep"]);

/** 每级成长（V1.1 第 14 章「升级加成」）。 */
export const PER_LEVEL = Object.freeze({ durability: 6, health: 10, vigor: 4, mana: 4, ep: 0 });

export const BASE_GUARD = 15;
export const BASE_WARD = 15;
export const BASE_ACTIONS = 2;
export const BASE_MOVE_FT = 10;
export const MOVE_FT_PER_SPEED_DIE = 5;
export const DEFENSE_VIGOR_COST = 5;
export const RESISTANCE_MANA_COST = 5;

/**
 * 计算资源上限。
 * @param {Record<string, number>} abilities 属性值，如 {sta: 15, rsl: 13, sol: 17}
 * @param {number} level 等级（≥1）
 * @param {Record<string, number>} [bonus] 天赋等带来的额外上限
 */
export function resourceMaxima(abilities, level = 1, bonus = {}) {
  const a = key => Number(abilities[key]) || 0;
  const lv = Math.max(1, Math.trunc(Number(level) || 1)) - 1;
  const base = {
    durability: a("sta") + a("rsl"),
    health: a("sta") + 10,
    vigor: a("sta") + 20,
    mana: a("rsl") + 20,
    ep: a("sol") * 10 + 50
  };
  const out = {};
  for (const key of RESOURCE_KEYS) {
    out[key] = Math.max(0, base[key] + PER_LEVEL[key] * lv + (Number(bonus[key]) || 0));
  }
  return out;
}

/** 天赋等提高上限时，当前值随之增加的资源（规则书第 5 章「资源」）。 */
export const RAISE_WITH_MAX = Object.freeze(["durability", "vigor", "mana"]);

/**
 * 上限提高后的当前值：当前值增加与上限相同的数值，保留已消耗的部分。上限降低或不变时不调整。
 * 例：魔力 30/50 时上限 +20 → 50/70。
 * @param {Record<string, number>} before 原上限
 * @param {Record<string, number>} after 新上限
 * @param {Record<string, number>} current 当前值
 * @returns {Record<string, number>} 需要更新的当前值
 */
export function raisedCurrentValues(before, after, current, keys = RAISE_WITH_MAX) {
  const out = {};
  for (const key of keys) {
    const delta = (Number(after[key]) || 0) - (Number(before[key]) || 0);
    if (delta > 0) out[key] = (Number(current[key]) || 0) + delta;
  }
  return out;
}

/** 武器技能：武术战技据此找到所用的武器。 */
export const WEAPON_SKILLS = Object.freeze(["lightWeapons", "heavyWeapons", "rangedWeapons", "unarmed"]);

/**
 * 武术战技所用的武器：已装备、武器技能与战技检定技能相同、且有伤害值的第一把武器。
 * 魔法战技、未勾选「加上武器基础伤害骰」或检定技能不是武器技能时为 null。
 * @param {{type: string, system: object}} craft
 * @param {Iterable<{type: string, system: object}>} items 角色持有的物品
 */
export function craftWeapon(craft, items = []) {
  const sys = craft?.system;
  if (craft?.type !== "craft" || !sys || sys.craftType === "magical" || !sys.addWeaponDamage) return null;
  if (!WEAPON_SKILLS.includes(sys.skill)) return null;
  for (const item of items) {
    const w = item?.system;
    if (item.type === "weapon" && w?.equipped && w.skill === sys.skill && w.damage > 0) return item;
  }
  return null;
}

/** 移动力（尺）：10 尺 + 每个速度奖励骰 5 尺。 */
export function movementFeet(speedScore) {
  return BASE_MOVE_FT + MOVE_FT_PER_SPEED_DIE * abilityBonusDice(speedScore).dice;
}

/** 每轮恢复的活力：每 5 点耐力恢复 1 点。 */
export function vigorRecovery(staminaScore) {
  return Math.floor((Number(staminaScore) || 0) / 5);
}

/**
 * 结算一次伤害。
 * 先扣减护甲等级，再按伤害倍率（减半/加倍，向下取整）调整，然后扣耐久；
 * 耐久归零后进入负伤，溢出部分转入生命值。
 * 尚有生命值时，伤害最多把生命值打到 0（休克）；生命值已为 0 时再受伤即死亡。
 * @param {{durability: number, health: number}} current
 * @param {number} damage 原始伤害
 * @param {number} [armorRank] 护甲等级
 * @param {number} [multiplier] 伤害倍率（如伤害类型带来的减半或加倍），在扣除护甲之后应用
 */
export function applyDamage(current, damage, armorRank = 0, multiplier = 1) {
  const raw = Math.max(0, Math.trunc(Number(damage) || 0));
  const afterArmor = Math.max(0, raw - Math.max(0, Math.trunc(Number(armorRank) || 0)));
  const rate = Number.isFinite(Number(multiplier)) ? Math.max(0, Number(multiplier)) : 1;
  const net = Math.floor(afterArmor * rate);
  let durability = Math.max(0, Number(current.durability) || 0);
  let health = Number(current.health) || 0;
  let shock = false;
  let dead = false;

  const toDurability = Math.min(durability, net);
  durability -= toDurability;
  const overflow = net - toDurability;

  if (overflow > 0) {
    if (health > 0) {
      health -= overflow;
      if (health <= 0) {
        health = 0;
        shock = true;
      }
    } else {
      dead = true;
    }
  }

  return { durability, health, net, afterArmor, absorbed: raw - afterArmor, wounded: durability <= 0, shock, dead };
}
