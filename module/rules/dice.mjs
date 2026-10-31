/**
 * 命之轨迹（Promethium System）掷骰规则：纯函数，不依赖 Foundry，可在 Node 中直接测试。
 *
 * 动作检定 = 1d20（动作骰）+ N 个加值骰，对比成功总和（VS）。
 * 加值骰默认 d10（英雄），每个充能升一阶、每个挑战降一阶，两者一对一抵消。
 * 加值骰掷出最大值时爆发：再掷一颗同型骰并累加，可无限连爆。
 */

/** 骰子等阶，从低到高。 */
export const DIE_RANKS = Object.freeze([
  { key: "feeble", faces: 4 },
  { key: "poor", faces: 6 },
  { key: "ordinary", faces: 8 },
  { key: "heroic", faces: 10 },
  { key: "epic", faces: 12 },
  { key: "legendary", faces: 20 },
  { key: "mythic", faces: 100 }
]);

export const ACTION_DIE_FACES = 20;
export const DEFAULT_BONUS_FACES = 10;
export const MIN_BONUS_FACES = 4;
/** 机会与充能不能把效果推过传说（d20）。 */
export const MAX_BONUS_FACES = 20;
export const MAX_CHANCES = 3;
export const CHANCE_VS = 15;
export const BURSTS_FOR_DESTINED = 3;

export function rankIndex(faces) {
  const index = DIE_RANKS.findIndex(r => r.faces === faces);
  if (index < 0) throw new Error(`未知骰型 d${faces}`);
  return index;
}

export function rankKey(faces) {
  return DIE_RANKS[rankIndex(faces)].key;
}

export function facesForRank(key) {
  const rank = DIE_RANKS.find(r => r.key === key);
  if (!rank) throw new Error(`未知等阶 ${key}`);
  return rank.faces;
}

/**
 * 按充能/挑战调整骰型。
 * @param {number} faces 基础骰型
 * @param {number} charges 充能数
 * @param {number} challenges 挑战数
 * @param {{min?: number, max?: number}} [limits]
 */
export function shiftFaces(faces, charges = 0, challenges = 0, { min = MIN_BONUS_FACES, max = MAX_BONUS_FACES } = {}) {
  const lo = rankIndex(min);
  const hi = Math.max(rankIndex(max), rankIndex(faces));
  const index = Math.min(hi, Math.max(lo, rankIndex(faces) + charges - challenges));
  return DIE_RANKS[index].faces;
}

/**
 * 属性值对应的加值骰：15 起 +1，此后每 5 点再 +1；低于 5 时该属性的检定受 1 个挑战。
 * @returns {{dice: number, challenges: number}}
 */
export function abilityBonusDice(score) {
  const value = Number(score) || 0;
  if (value < 5) return { dice: 0, challenges: 1 };
  if (value < 15) return { dice: 0, challenges: 0 };
  return { dice: Math.floor((value - 10) / 5), challenges: 0 };
}

function clampInt(value, min, max = Infinity) {
  const n = Math.trunc(Number(value) || 0);
  return Math.min(max, Math.max(min, n));
}

function formatFlat(flat) {
  const n = Math.trunc(Number(flat) || 0);
  if (!n) return "";
  return n > 0 ? ` + ${n}` : ` - ${Math.abs(n)}`;
}

/**
 * 计算动作检定的骰池。
 * @param {object} p
 * @param {number} [p.bonusDice] 加值骰数量（属性 + 技能 + 情境）
 * @param {number} [p.charges] 作用于本次检定的充能
 * @param {number} [p.challenges] 作用于本次检定的挑战（负伤、低属性等应已计入）
 * @param {number} [p.flat] 固定修正（规则中罕见，留作 GM 裁定）
 */
export function actionPool({ bonusDice = 0, charges = 0, challenges = 0, flat = 0 } = {}) {
  const dice = clampInt(bonusDice, 0);
  const faces = shiftFaces(DEFAULT_BONUS_FACES, clampInt(charges, 0), clampInt(challenges, 0));
  let formula = `1d${ACTION_DIE_FACES}`;
  if (dice > 0) formula += ` + ${dice}d${faces}x`;
  formula += formatFlat(flat);
  return { dice, faces, formula };
}

/**
 * 计算效果（伤害/治疗）骰池：效果骰按品质决定骰型、不爆发；加值骰会爆发。
 * @param {object} p
 * @param {number} [p.effectDice] 效果骰数量（如武器伤害值）
 * @param {number} [p.effectFaces] 效果骰骰型（品质，普通 d8、英雄 d10……）
 * @param {number} [p.bonusDice] 加值骰数量（如力量加值骰）
 * @param {number} [p.charges] 充能（通常来自机会）
 * @param {number} [p.challenges] 挑战（负伤等）
 */
export function effectPool({ effectDice = 0, effectFaces = 8, bonusDice = 0, charges = 0, challenges = 0, flat = 0 } = {}) {
  const dice = clampInt(effectDice, 0);
  const bonus = clampInt(bonusDice, 0);
  const faces = shiftFaces(DEFAULT_BONUS_FACES, clampInt(charges, 0), clampInt(challenges, 0));
  rankIndex(effectFaces);
  const parts = [];
  if (dice > 0) parts.push(`${dice}d${effectFaces}`);
  if (bonus > 0) parts.push(`${bonus}d${faces}x`);
  let formula = parts.join(" + ") || "0";
  formula += formatFlat(flat);
  return { dice, effectFaces, bonusDice: bonus, faces, formula };
}

/** 统计爆发次数：加值骰中每个掷出最大值的有效结果计一次。 */
export function countBursts(results, faces) {
  return results.filter(r => r.active !== false && r.result === faces).length;
}

/**
 * 判定动作检定结果。
 * @param {object} p
 * @param {number} p.total 掷骰总值
 * @param {number|null} [p.vs] 基础成功总和；为空表示没有固定目标（如对抗检定）
 * @param {number} [p.chances] 承担的机会数（每个 VS +15）
 * @param {number} [p.natural] 动作骰原始点数
 * @param {number} [p.bursts] 加值骰爆发次数
 */
export function resolveAction({ total, vs = null, chances = 0, natural = 0, bursts = 0 }) {
  const chanceCount = clampInt(chances, 0, MAX_CHANCES);
  const hasTarget = vs !== null && vs !== undefined && vs !== "" && Number.isFinite(Number(vs));
  const targetVS = hasTarget ? Number(vs) + chanceCount * CHANCE_VS : null;
  const success = hasTarget ? total >= targetVS : null;
  const destinedReasons = [];
  if (natural === ACTION_DIE_FACES) destinedReasons.push("natural20");
  if (bursts >= BURSTS_FOR_DESTINED) destinedReasons.push("bursts");
  if (success && chanceCount === MAX_CHANCES) destinedReasons.push("chances");
  return { targetVS, success, chances: chanceCount, natural, bursts, destinedReasons };
}

/**
 * 对抗反应：反应方需严格高于行动方，平局归行动方。
 * @returns {boolean} 反应是否成功
 */
export function reactionSucceeds(reactionTotal, actionTotal) {
  return reactionTotal > actionTotal;
}
