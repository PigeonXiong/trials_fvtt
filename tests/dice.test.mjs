import test from "node:test";
import assert from "node:assert/strict";
import {
  abilityBonusDice, actionPool, effectPool, shiftFaces, countBursts, resolveAction,
  reactionSucceeds, facesForRank, rankKey, burstDestinedReasons
} from "../module/rules/dice.mjs";

test("属性奖励骰：15 起 +1，每 5 点再 +1", () => {
  assert.deepEqual(abilityBonusDice(4), { dice: 0, challenges: 1 });
  assert.deepEqual(abilityBonusDice(5), { dice: 0, challenges: 0 });
  assert.deepEqual(abilityBonusDice(14), { dice: 0, challenges: 0 });
  assert.equal(abilityBonusDice(15).dice, 1);
  assert.equal(abilityBonusDice(19).dice, 1);
  assert.equal(abilityBonusDice(20).dice, 2);
  assert.equal(abilityBonusDice(25).dice, 3);
  assert.equal(abilityBonusDice(50).dice, 8);
});

test("蓄势与挑战一对一抵消并在 d4~d20 之间升降", () => {
  assert.equal(shiftFaces(10, 0, 0), 10);
  assert.equal(shiftFaces(10, 1, 0), 12);
  assert.equal(shiftFaces(10, 2, 0), 20);
  assert.equal(shiftFaces(10, 3, 0), 20, "冒险不能超过传奇");
  assert.equal(shiftFaces(10, 0, 1), 8);
  assert.equal(shiftFaces(10, 0, 5), 4, "不能低于 d4");
  assert.equal(shiftFaces(10, 2, 2), 10);
  assert.equal(shiftFaces(100, 0, 0), 100, "本身高于上限的骰型保持不变");
});

test("等阶键与骰型互转", () => {
  assert.equal(facesForRank("ordinary"), 8);
  assert.equal(rankKey(12), "epic");
  assert.throws(() => facesForRank("nope"));
});

test("行动骰池公式", () => {
  assert.equal(actionPool().formula, "1d20");
  assert.equal(actionPool({ bonusDice: 3 }).formula, "1d20 + 3d10x");
  assert.equal(actionPool({ bonusDice: 2, challenges: 1 }).formula, "1d20 + 2d8x");
  assert.equal(actionPool({ bonusDice: 2, charges: 1, flat: -2 }).formula, "1d20 + 2d12x - 2");
  assert.equal(actionPool({ bonusDice: -1 }).dice, 0);
});

test("效应骰池：效应骰不爆发，奖励骰爆发", () => {
  assert.equal(effectPool({ effectDice: 2, effectFaces: 8, bonusDice: 1 }).formula, "2d8 + 1d10x");
  assert.equal(effectPool({ effectDice: 14, effectFaces: 12, bonusDice: 3, charges: 2 }).formula, "14d12 + 3d20x");
  assert.equal(effectPool({ effectDice: 1, effectFaces: 6, bonusDice: 2, challenges: 1 }).formula, "1d6 + 2d8x");
  assert.equal(effectPool({}).formula, "0");
});

test("爆发计数只计有效的最大值结果", () => {
  const results = [{ result: 10, active: true }, { result: 10, active: true }, { result: 3, active: true }, { result: 10, active: false }];
  assert.equal(countBursts(results, 10), 2);
});

test("检定判定：冒险每个 +15 VS，达成即成功", () => {
  assert.deepEqual(resolveAction({ total: 20, vs: 20 }).success, true);
  assert.deepEqual(resolveAction({ total: 19, vs: 20 }).success, false);
  const r = resolveAction({ total: 40, vs: 20, chances: 1 });
  assert.equal(r.targetVS, 35);
  assert.equal(r.success, true);
  assert.equal(resolveAction({ total: 50, vs: 15, chances: 9 }).chances, 3, "冒险最多 3 点");
  assert.equal(resolveAction({ total: 12 }).success, null, "无 VS 时不判定");
});

test("命定触发条件", () => {
  assert.deepEqual(resolveAction({ total: 25, natural: 20 }).destinedReasons, ["natural20"]);
  assert.deepEqual(resolveAction({ total: 25, bursts: 3 }).destinedReasons, ["bursts"]);
  assert.deepEqual(resolveAction({ total: 60, vs: 15, chances: 3 }).destinedReasons, ["chances"]);
  assert.deepEqual(resolveAction({ total: 59, vs: 15, chances: 3 }).destinedReasons, []);
  assert.deepEqual(burstDestinedReasons(3), ["bursts"], "效应掷骰爆发 3 颗同样进入命定");
  assert.deepEqual(burstDestinedReasons(2), []);
});

test("反应需严格高于行动方", () => {
  assert.equal(reactionSucceeds(21, 20), true);
  assert.equal(reactionSucceeds(20, 20), false);
});
