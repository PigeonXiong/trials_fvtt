/**
 * 检定面板（HUD）的纯数据模型：把「来源复选框 + 加减按钮 + 逐目标掩护」汇总为骰池与 VS。
 * 不依赖 Foundry，可在 Node 中测试。参考 Lancer 的 AccDiffHudData。
 */
import {
  actionPool, effectPool, resolveAction, DIE_RANKS, MAX_CHANCES, CHANCE_VS,
  DEFAULT_BONUS_FACES, MIN_BONUS_FACES, MAX_BONUS_FACES
} from "./dice.mjs";

/**
 * 掩护（V1.1 第 4 章「掩护」）。
 * - 轻度：物防 +10，仅针对直接远程攻击，区域攻击不受影响。
 * - 部分：物防 +3，针对攻击护甲等级 +5（伤害作用于掩体）。
 * - 完全：物防 +5，对抗远程攻击护甲等级 +10（掩体足够坚固时）。
 */
export const COVER = Object.freeze({
  none: Object.freeze({ guard: 0, armor: 0 }),
  light: Object.freeze({ guard: 10, armor: 0 }),
  partial: Object.freeze({ guard: 3, armor: 5 }),
  full: Object.freeze({ guard: 5, armor: 10 })
});
export const COVER_KEYS = Object.freeze(Object.keys(COVER));

/** 面板上各个加减项的取值范围。 */
export const ADJUST_LIMITS = Object.freeze({
  chances: [0, MAX_CHANCES],
  extraDice: [-20, 20],
  charges: [0, 10],
  challenges: [0, 10],
  flat: [-99, 99],
  effectDice: [0, 99]
});

const toInt = value => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

/** 把加减项限制在允许范围内；未知的键只取整。 */
export function clampAdjust(key, value) {
  const n = toInt(value);
  const limits = ADJUST_LIMITS[key];
  if (!limits) return n;
  return Math.min(limits[1], Math.max(limits[0], n));
}

/**
 * 来源：骰池中的一项加值或减值，例如「轻武器技能 +2 奖励骰」「负伤 1 挑战」。
 * @typedef {object} RollSource
 * @property {string} id
 * @property {string} label
 * @property {number} [dice]        奖励骰
 * @property {number} [charges]     蓄势
 * @property {number} [challenges]  挑战
 * @property {number} [flat]        固定修正
 * @property {boolean} [enabled]    是否计入（默认计入）
 * @property {boolean} [locked]     不可在面板上取消
 */

/** 按 id 应用面板上的勾选状态；锁定的来源总是计入。 */
export function applyToggles(sources = [], toggles = {}) {
  return sources.map(s => {
    const enabled = s.locked ? true : (s.id in toggles ? !!toggles[s.id] : s.enabled !== false);
    return { ...s, enabled };
  });
}

/** 汇总所有启用的来源。 */
export function sumSources(sources = []) {
  const total = { dice: 0, charges: 0, challenges: 0, flat: 0 };
  for (const s of sources) {
    if (s.enabled === false) continue;
    total.dice += toInt(s.dice);
    total.charges += toInt(s.charges);
    total.challenges += toInt(s.challenges);
    total.flat += toInt(s.flat);
  }
  return total;
}

/** 合并来源与面板上的手动加减项。 */
function combine(config) {
  const src = sumSources(config.sources);
  return {
    bonusDice: Math.max(0, src.dice + toInt(config.extraDice)),
    charges: Math.max(0, src.charges + toInt(config.charges)),
    challenges: Math.max(0, src.challenges + toInt(config.challenges)),
    flat: src.flat + toInt(config.flat)
  };
}

/**
 * 行动检定面板 → 骰池。
 * @param {{sources?: RollSource[], extraDice?: number, charges?: number, challenges?: number, flat?: number}} config
 */
export function buildActionPool(config = {}) {
  const parts = combine(config);
  const pool = actionPool(parts);
  return { ...parts, dice: pool.dice, faces: pool.faces, formula: pool.formula };
}

/**
 * 效应检定面板 → 骰池（效应骰按品质、不爆发；奖励骰爆发且不超过传奇级）。
 * @param {{effectDice?: number, effectFaces?: number, sources?: RollSource[], extraDice?: number,
 *   charges?: number, challenges?: number, flat?: number}} config
 */
export function buildEffectPool(config = {}) {
  const parts = combine(config);
  const effectDice = Math.max(0, toInt(config.effectDice));
  const effectFaces = toInt(config.effectFaces) || 8;
  const pool = effectPool({ ...parts, effectDice, effectFaces });
  return { ...parts, effectDice, effectFaces, dice: pool.bonusDice, faces: pool.faces, formula: pool.formula };
}

/**
 * 骰阶条：d4 … d20，标出基础骰阶（d10）与升降后的骰阶。
 * @returns {{faces: number, base: boolean, current: boolean}[]}
 */
export function rankLadder(faces, baseFaces = DEFAULT_BONUS_FACES) {
  return DIE_RANKS
    .filter(r => r.faces >= MIN_BONUS_FACES && r.faces <= MAX_BONUS_FACES)
    .map(r => ({ key: r.key, faces: r.faces, base: r.faces === baseFaces, current: r.faces === faces }));
}

/** 掩护带来的物防加值；只对物防生效。 */
export function coverGuardBonus(cover, defense) {
  return defense === "guard" ? (COVER[cover]?.guard ?? 0) : 0;
}

/** 掩护带来的护甲等级加值。 */
export function coverArmorBonus(cover) {
  return COVER[cover]?.armor ?? 0;
}

/**
 * 单个目标的 VS 拆解：防御值 + 掩护 + 冒险。
 * @param {{defenseValue: number, defense: string, cover?: string, chances?: number}} p
 */
export function targetVS({ defenseValue, defense, cover = "none", chances = 0 }) {
  const base = toInt(defenseValue);
  const coverBonus = coverGuardBonus(cover, defense);
  const chanceBonus = clampAdjust("chances", chances) * CHANCE_VS;
  return { base, cover: coverBonus, chances: chanceBonus, total: base + coverBonus + chanceBonus };
}

/**
 * 逐目标判定一次行动检定，并汇总整体结果。
 * 有目标时，命中任一目标即视为成功（用于「承担 3 点冒险并成功」的命定判定）。
 * @param {object} p
 * @param {number} p.total
 * @param {number} [p.natural]
 * @param {number} [p.bursts]
 * @param {number} [p.chances]
 * @param {string} [p.defense]  guard / ward
 * @param {{defenseValue: number, cover?: string}[]} [p.targets]
 * @param {number|null} [p.vs]  无目标时的手动 VS
 * @param {boolean} [p.strict]  反应检定：需严格高于
 */
export function resolveTargets({ total, natural = 0, bursts = 0, chances = 0, defense = "none", targets = [], vs = null, strict = false }) {
  if (!targets.length) {
    return { ...resolveAction({ total, vs, chances, natural, bursts, strict }), targets: [] };
  }
  const results = targets.map(t => {
    const parts = targetVS({ defenseValue: t.defenseValue, defense, cover: t.cover, chances });
    const r = resolveAction({ total, vs: parts.total - parts.chances, chances, natural, bursts, strict });
    return { ...t, vs: parts, targetVS: r.targetVS, success: r.success };
  });
  const success = results.some(r => r.success);
  const overall = resolveAction({ total, vs: null, chances, natural, bursts });
  const destinedReasons = [...overall.destinedReasons];
  if (success && overall.chances === MAX_CHANCES) destinedReasons.push("chances");
  return { ...overall, success, destinedReasons, targets: results };
}
