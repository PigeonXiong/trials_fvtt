import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRequest, requestAbility, resolveCheckKey, parseCheckArgs, collectResults, MAX_LABEL_LENGTH
} from "../module/rules/check-request.mjs";

const NAMES = {
  skills: { athletics: ["运动", "Athletics"], stealth: ["隐匿", "Stealth"] },
  abilities: { agi: ["敏捷", "敏", "Agility", "AGI"], str: ["力量", "力", "Strength", "STR"] }
};

test("规范化：无效的检定类型或键返回 null", () => {
  assert.equal(normalizeRequest({ type: "skill", key: "flying" }), null);
  assert.equal(normalizeRequest({ type: "ability", key: "athletics" }), null);
  assert.equal(normalizeRequest({ type: "save", key: "str" }), null);
  assert.equal(normalizeRequest(), null);
});

test("规范化：VS 取非负整数，留空为 null；情境说明去空白并截断", () => {
  const r = normalizeRequest({ type: "skill", key: "athletics", vs: "15.7", label: "  攀爬城墙 " });
  assert.deepEqual(r, { type: "skill", key: "athletics", ability: null, vs: 15, label: "攀爬城墙" });
  assert.equal(normalizeRequest({ type: "skill", key: "athletics", vs: "" }).vs, null);
  assert.equal(normalizeRequest({ type: "skill", key: "athletics", vs: null }).vs, null);
  assert.equal(normalizeRequest({ type: "skill", key: "athletics", vs: "abc" }).vs, null);
  assert.equal(normalizeRequest({ type: "skill", key: "athletics", vs: -3 }).vs, 0);
  assert.equal(normalizeRequest({ type: "skill", key: "athletics", label: "x".repeat(200) }).label.length, MAX_LABEL_LENGTH);
});

test("规范化：改用属性只对技能检定有效，与默认属性相同时视为未改", () => {
  assert.equal(normalizeRequest({ type: "skill", key: "athletics", ability: "agi" }).ability, "agi");
  assert.equal(normalizeRequest({ type: "skill", key: "athletics", ability: "str" }).ability, null);
  assert.equal(normalizeRequest({ type: "skill", key: "athletics", ability: "luck" }).ability, null);
  assert.equal(normalizeRequest({ type: "ability", key: "str", ability: "agi" }).ability, null);
});

test("检定使用的属性", () => {
  assert.equal(requestAbility(normalizeRequest({ type: "skill", key: "athletics" })), "str");
  assert.equal(requestAbility(normalizeRequest({ type: "skill", key: "athletics", ability: "agi" })), "agi");
  assert.equal(requestAbility(normalizeRequest({ type: "ability", key: "rsl" })), "rsl");
});

test("识别键名与显示名（不区分大小写）", () => {
  assert.deepEqual(resolveCheckKey("athletics"), { type: "skill", key: "athletics" });
  assert.deepEqual(resolveCheckKey("str"), { type: "ability", key: "str" });
  assert.deepEqual(resolveCheckKey("运动", NAMES), { type: "skill", key: "athletics" });
  assert.deepEqual(resolveCheckKey("STEALTH", NAMES), { type: "skill", key: "stealth" });
  assert.deepEqual(resolveCheckKey("敏捷", NAMES), { type: "ability", key: "agi" });
  assert.deepEqual(resolveCheckKey("Athletics"), { type: "skill", key: "athletics" });
  assert.equal(resolveCheckKey("飞行", NAMES), null);
  assert.equal(resolveCheckKey(""), null);
});

test("解析 @Check 写法", () => {
  assert.deepEqual(parseCheckArgs("athletics|vs:15", NAMES, "攀爬城墙"),
    { type: "skill", key: "athletics", ability: null, vs: 15, label: "攀爬城墙" });
  assert.deepEqual(parseCheckArgs("运动|15|属性：敏捷", NAMES),
    { type: "skill", key: "athletics", ability: "agi", vs: 15, label: "" });
  assert.deepEqual(parseCheckArgs("athletics | ability:AGI | DC:20", NAMES),
    { type: "skill", key: "athletics", ability: "agi", vs: 20, label: "" });
  assert.deepEqual(parseCheckArgs("力量", NAMES), { type: "ability", key: "str", ability: null, vs: null, label: "" });
  assert.equal(parseCheckArgs("飞行|vs:15", NAMES), null);
  assert.equal(parseCheckArgs("", NAMES), null);
});

test("结果汇总：每个角色只留最新一次，按先后排列", () => {
  const results = collectResults([
    { actorUuid: "Actor.a", total: 12, success: false, timestamp: 10 },
    { actorUuid: "Actor.b", total: 30, success: true, timestamp: 20 },
    { actorUuid: "Actor.a", total: 25, success: true, timestamp: 30 }
  ]);
  assert.deepEqual(results.map(r => [r.actorUuid, r.total]), [["Actor.b", 30], ["Actor.a", 25]]);
  assert.deepEqual(collectResults([]), []);
});
