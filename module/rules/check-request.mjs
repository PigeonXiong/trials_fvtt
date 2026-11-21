/**
 * 检定请求的纯数据部分：规范化 GM 填写的检定、解析日志中的 @Check[...] 写法、汇总各角色的结果。
 * 不依赖 Foundry，可在 Node 中测试。
 *
 * 检定请求：
 * @typedef {object} CheckRequest
 * @property {"skill"|"ability"} type
 * @property {string} key            技能键（athletics…）或属性键（str…）
 * @property {string|null} ability   技能检定改用的属性；null 表示该技能的默认属性
 * @property {number|null} vs        基础胜利总值（冒险另加）；null 表示对抗检定或由玩家填写
 * @property {string} label          GM 写的情境说明，例如「攀爬城墙」
 */
import { ABILITY_KEYS, SKILL_DEFAULT_ABILITY } from "./character.mjs";

export const SKILL_KEYS = Object.freeze(Object.keys(SKILL_DEFAULT_ABILITY));
export const MAX_LABEL_LENGTH = 80;

const VS_LIMIT = 999;

function parseVS(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(VS_LIMIT, Math.max(0, Math.trunc(n)));
}

/**
 * 规范化一个检定请求；检定类型无效时返回 null。
 * @param {object} input
 * @returns {CheckRequest|null}
 */
export function normalizeRequest({ type, key, ability = null, vs = null, label = "" } = {}) {
  if (type === "skill") {
    if (!SKILL_KEYS.includes(key)) return null;
  } else if (type === "ability") {
    if (!ABILITY_KEYS.includes(key)) return null;
  } else return null;
  const abilityOverride = type === "skill" && ABILITY_KEYS.includes(ability) && ability !== SKILL_DEFAULT_ABILITY[key]
    ? ability
    : null;
  return {
    type,
    key,
    ability: abilityOverride,
    vs: parseVS(vs),
    label: String(label ?? "").trim().slice(0, MAX_LABEL_LENGTH)
  };
}

/**
 * 检定实际使用的属性：属性检定即其本身，技能检定为改用的属性或默认属性。
 * @param {CheckRequest} request
 */
export function requestAbility(request) {
  if (request.type === "ability") return request.key;
  return request.ability ?? SKILL_DEFAULT_ABILITY[request.key];
}

/**
 * 「运动」或「athletics」→ {type, key}。先认键名，再认各语言下的名称（不区分大小写）。
 * @param {string} word
 * @param {{skills?: Record<string, string[]>, abilities?: Record<string, string[]>}} [names] 各键的显示名
 */
export function resolveCheckKey(word, { skills = {}, abilities = {} } = {}) {
  const raw = String(word ?? "").trim();
  if (!raw) return null;
  if (SKILL_KEYS.includes(raw)) return { type: "skill", key: raw };
  if (ABILITY_KEYS.includes(raw)) return { type: "ability", key: raw };
  const lower = raw.toLowerCase();
  const find = (keys, table) => keys.find(k => k.toLowerCase() === lower
    || (table[k] ?? []).some(name => String(name).trim().toLowerCase() === lower));
  const skill = find(SKILL_KEYS, skills);
  if (skill) return { type: "skill", key: skill };
  const ability = find(ABILITY_KEYS, abilities);
  if (ability) return { type: "ability", key: ability };
  return null;
}

/**
 * 解析日志里的检定写法 @Check[运动|vs:15|ability:agi]{攀爬城墙} 方括号内的部分。
 * - 第一段是技能或属性（键名或显示名）；
 * - 之后的 `vs:15`（或单独的数字）是胜利总值，`ability:agi`（或「属性:敏捷」）改用属性。
 * @param {string} text 方括号内的文字
 * @param {object} [names] 同 resolveCheckKey
 * @param {string} [label] 花括号内的文字
 * @returns {CheckRequest|null}
 */
export function parseCheckArgs(text, names = {}, label = "") {
  const parts = String(text ?? "").split("|").map(p => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  const target = resolveCheckKey(parts.shift(), names);
  if (!target) return null;
  let vs = null;
  let ability = null;
  for (const part of parts) {
    const match = part.match(/^([^:：]+)[:：](.*)$/);
    if (!match) {
      if (/^\d+$/.test(part)) vs = part;
      continue;
    }
    const name = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (["vs", "dc"].includes(name)) vs = value;
    else if (["ability", "属性", "屬性"].includes(name)) {
      ability = resolveCheckKey(value, { abilities: names.abilities ?? {} })?.key ?? null;
    }
  }
  return normalizeRequest({ ...target, ability, vs, label });
}

/**
 * 汇总回应某个请求的检定结果：每个角色只保留最新一次，按掷骰先后排列。
 * @param {{actorUuid?: string, actorName?: string, actorImg?: string, total?: number,
 *   success?: boolean|null, timestamp?: number, hidden?: boolean}[]} entries
 */
export function collectResults(entries = []) {
  const latest = new Map();
  for (const entry of entries) {
    const id = entry.actorUuid ?? entry.actorName ?? "";
    const prev = latest.get(id);
    if (!prev || (entry.timestamp ?? 0) >= (prev.timestamp ?? 0)) latest.set(id, entry);
  }
  return [...latest.values()].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
}
