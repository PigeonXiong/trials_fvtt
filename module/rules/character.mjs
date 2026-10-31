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

/**
 * 每级成长。规则书未写明魔力的每级成长值（原文缺数字），暂按耐力的 4 处理，待勘误。
 */
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

/** 移动力（尺）：10 尺 + 每个速度加值骰 5 尺。 */
export function movementFeet(speedScore) {
  return BASE_MOVE_FT + MOVE_FT_PER_SPEED_DIE * abilityBonusDice(speedScore).dice;
}

/** 每轮恢复的耐力：每 5 点体魄恢复 1 点。 */
export function vigorRecovery(staminaScore) {
  return Math.floor((Number(staminaScore) || 0) / 5);
}

/**
 * 结算一次伤害。
 * 先扣减护甲等级，再扣耐久；耐久归零后进入负伤，溢出部分转入生命值。
 * 尚有生命值时，伤害最多把生命值打到 0（休克）；生命值已为 0 时再受伤即死亡。
 * @param {{durability: number, health: number}} current
 * @param {number} damage 原始伤害
 * @param {number} [armorRank] 护甲等级
 */
export function applyDamage(current, damage, armorRank = 0) {
  const raw = Math.max(0, Math.trunc(Number(damage) || 0));
  const net = Math.max(0, raw - Math.max(0, Math.trunc(Number(armorRank) || 0)));
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

  return { durability, health, net, absorbed: raw - net, wounded: durability <= 0, shock, dead };
}
