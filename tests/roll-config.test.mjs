import test from "node:test";
import assert from "node:assert/strict";
import {
  COVER, clampAdjust, applyToggles, sumSources, buildActionPool, buildEffectPool, rankLadder,
  coverGuardBonus, coverArmorBonus, targetVS, resolveTargets, toggleSource, forcedChances
} from "../module/rules/roll-config.mjs";
import { resolveAction, effectPool } from "../module/rules/dice.mjs";

const sources = [
  { id: "skill", label: "轻武器", dice: 2, locked: true },
  { id: "ability", label: "敏捷", dice: 1, locked: true },
  { id: "wounded", label: "负伤", challenges: 1 },
  { id: "bloom", label: "绽放命运", dice: 3, enabled: false }
];

test("加减项限制在规则范围内", () => {
  assert.equal(clampAdjust("chances", 5), 3, "冒险最多 3 点");
  assert.equal(clampAdjust("chances", -1), 0);
  assert.equal(clampAdjust("charges", -2), 0);
  assert.equal(clampAdjust("extraDice", -3), -3, "额外奖励骰可以为负");
  assert.equal(clampAdjust("flat", "7"), 7);
  assert.equal(clampAdjust("unknown", 2.8), 2);
});

test("来源勾选：锁定项总计入，默认关闭的项需手动勾选", () => {
  const base = applyToggles(sources);
  assert.deepEqual(base.map(s => s.enabled), [true, true, true, false]);
  const toggled = applyToggles(sources, { wounded: false, bloom: true, skill: false });
  assert.deepEqual(toggled.map(s => s.enabled), [true, true, false, true], "锁定的技能骰不能取消");
  assert.deepEqual(sumSources(toggled), { dice: 6, charges: 0, challenges: 0, flat: 0 });
});

test("行动骰池：来源 + 手动加减即时汇总为公式", () => {
  const cfg = { sources: applyToggles(sources) };
  assert.equal(buildActionPool(cfg).formula, "1d20 + 3d8x", "负伤下降一级");
  assert.equal(buildActionPool({ ...cfg, charges: 1 }).formula, "1d20 + 3d10x", "蓄势与挑战抵消");
  assert.equal(buildActionPool({ ...cfg, charges: 3, extraDice: 1, flat: 2 }).formula, "1d20 + 4d20x + 2");
  assert.equal(buildActionPool({ ...cfg, extraDice: -9 }).formula, "1d20", "奖励骰不会为负");
  const pool = buildActionPool({ ...cfg, challenges: 4 });
  assert.equal(pool.faces, 4, "最低 d4");
  assert.equal(pool.challenges, 5);
});

test("效应骰池：冒险转化的蓄势只提升奖励骰，且不超过传奇级", () => {
  const cfg = {
    effectDice: 2, effectFaces: 8,
    sources: [{ id: "strength", dice: 2 }, { id: "chances", charges: 3 }]
  };
  assert.equal(buildEffectPool(cfg).formula, "2d8 + 2d20x");
  assert.equal(buildEffectPool({ ...cfg, effectDice: 3, flat: -1 }).formula, "3d8 + 2d20x - 1");
  assert.equal(buildEffectPool({ effectDice: 1, effectFaces: 12, sources: [{ id: "w", challenges: 1 }], extraDice: 1 }).formula, "1d12 + 1d8x");
});

test("骰阶条标出基础骰阶与当前骰阶", () => {
  const ladder = rankLadder(12);
  assert.deepEqual(ladder.map(r => r.faces), [4, 6, 8, 10, 12, 20]);
  assert.equal(ladder.find(r => r.base).faces, 10);
  assert.equal(ladder.find(r => r.current).faces, 12);
});

test("掩护：物防加值只对物防生效，护甲加值用于伤害", () => {
  assert.equal(coverGuardBonus("light", "guard"), 10);
  assert.equal(coverGuardBonus("partial", "guard"), 3);
  assert.equal(coverGuardBonus("full", "guard"), 5);
  assert.equal(coverGuardBonus("full", "ward"), 0, "魔防不受掩护影响");
  assert.equal(coverArmorBonus("partial"), 5);
  assert.equal(coverArmorBonus("full"), 10);
  assert.equal(coverArmorBonus("light"), 0);
  assert.equal(coverArmorBonus("bogus"), 0);
  assert.equal(Object.keys(COVER).length, 4);
});

test("目标 VS = 防御值 + 掩护 + 冒险 × 15", () => {
  assert.deepEqual(targetVS({ defenseValue: 15, defense: "guard", cover: "partial", chances: 2 }),
    { base: 15, cover: 3, chances: 30, total: 48 });
  assert.equal(targetVS({ defenseValue: 18, defense: "ward", cover: "full" }).total, 18);
});

test("逐目标判定：各自比较 VS，命中任一即整体成功", () => {
  const r = resolveTargets({
    total: 30, chances: 1, defense: "guard",
    targets: [{ name: "A", defenseValue: 15, cover: "none" }, { name: "B", defenseValue: 15, cover: "full" }]
  });
  assert.deepEqual(r.targets.map(t => t.targetVS), [30, 35]);
  assert.deepEqual(r.targets.map(t => t.success), [true, false]);
  assert.equal(r.success, true);
  assert.equal(r.chances, 1);
});

test("逐目标判定：3 点冒险命中任一目标即进入命定", () => {
  const r = resolveTargets({
    total: 60, chances: 3, defense: "guard",
    targets: [{ defenseValue: 15, cover: "none" }, { defenseValue: 20, cover: "none" }]
  });
  assert.deepEqual(r.targets.map(t => t.success), [true, false]);
  assert.deepEqual(r.destinedReasons, ["chances"]);
  const miss = resolveTargets({ total: 59, chances: 3, defense: "guard", targets: [{ defenseValue: 15 }] });
  assert.equal(miss.success, false);
  assert.deepEqual(miss.destinedReasons, []);
});

test("无目标时使用手动 VS；反应检定需严格高于", () => {
  assert.equal(resolveTargets({ total: 20, vs: 20 }).success, true);
  assert.equal(resolveTargets({ total: 20, vs: 20, strict: true }).success, false);
  assert.equal(resolveTargets({ total: 21, vs: 20, strict: true }).success, true);
  assert.equal(resolveTargets({ total: 12 }).success, null);
  assert.equal(resolveAction({ total: 20, vs: 20, strict: true }).success, false);
});

const bloomOptions = [
  { id: "bloom", label: "绽放命运：+3 奖励骰", dice: 3, enabled: false, group: "bloom" },
  { id: "beyondLegendary", label: "绽放命运：突破传奇", enabled: false, group: "bloom", forceChances: 3 },
  { id: "wounded", label: "负伤", challenges: 1 }
];

test("绽放命运的选项互斥：勾选一项会取消同组其他项", () => {
  let toggles = toggleSource(applyToggles(bloomOptions), {}, "bloom");
  assert.deepEqual(applyToggles(bloomOptions, toggles).map(s => s.enabled), [true, false, true]);
  toggles = toggleSource(applyToggles(bloomOptions, toggles), toggles, "beyondLegendary");
  assert.deepEqual(applyToggles(bloomOptions, toggles).map(s => s.enabled), [false, true, true]);
  toggles = toggleSource(applyToggles(bloomOptions, toggles), toggles, "beyondLegendary");
  assert.deepEqual(applyToggles(bloomOptions, toggles).map(s => s.enabled), [false, false, true], "再次点击取消");
  toggles = toggleSource(applyToggles(bloomOptions, toggles), toggles, "wounded");
  assert.equal(applyToggles(bloomOptions, toggles)[2].enabled, false, "不在组内的来源照常切换");
});

test("突破传奇强制承担 3 点冒险", () => {
  assert.equal(forcedChances(applyToggles(bloomOptions)), null);
  assert.equal(forcedChances(applyToggles(bloomOptions, { beyondLegendary: true })), 3);
  assert.equal(forcedChances([{ id: "x", forceChances: 9 }]), 3, "不超过冒险上限");
});

test("突破传奇：效应奖励骰上限提升到 d100，实际骰阶仍由蓄势决定", () => {
  const base = { effectDice: 2, effectFaces: 8, sources: [{ id: "str", dice: 2 }] };
  assert.equal(buildEffectPool({ ...base, charges: 3 }).formula, "2d8 + 2d20x", "默认上限 d20");
  assert.equal(buildEffectPool({ ...base, charges: 3, maxFaces: 100 }).formula, "2d8 + 2d100x");
  assert.equal(buildEffectPool({ ...base, charges: 2, maxFaces: 100 }).formula, "2d8 + 2d20x", "蓄势不足时到不了 d100");
  assert.equal(buildEffectPool({ ...base, charges: 4, challenges: 1, maxFaces: 100 }).formula, "2d8 + 2d100x");
  assert.equal(buildEffectPool({ ...base, charges: 3, challenges: 1, maxFaces: 100 }).formula, "2d8 + 2d20x", "挑战照常抵消");
  assert.equal(buildEffectPool({ ...base, charges: 9, maxFaces: 100 }).faces, 100, "d100 是最高一级");
  assert.equal(buildEffectPool({ ...base, charges: 3, maxFaces: 12 }).maxFaces, 20, "只接受 d20 或 d100 两种上限");
  assert.equal(effectPool({ effectDice: 1, bonusDice: 1, charges: 3, maxFaces: 100 }).formula, "1d8 + 1d100x");
});

test("骰阶条在突破传奇时延伸到 d100", () => {
  assert.deepEqual(rankLadder(100, 10, 100).map(r => r.faces), [4, 6, 8, 10, 12, 20, 100]);
  assert.equal(rankLadder(100, 10, 100).find(r => r.current).faces, 100);
});
