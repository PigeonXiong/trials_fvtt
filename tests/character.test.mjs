import test from "node:test";
import assert from "node:assert/strict";
import {
  resourceMaxima, movementFeet, vigorRecovery, applyDamage, SKILL_DEFAULT_ABILITY, ABILITY_KEYS
} from "../module/rules/character.mjs";

test("21 项核心技能都指向合法属性", () => {
  const skills = Object.entries(SKILL_DEFAULT_ABILITY);
  assert.equal(skills.length, 21);
  for (const [, ability] of skills) assert.ok(ABILITY_KEYS.includes(ability));
});

test("1 级资源上限", () => {
  const max = resourceMaxima({ sta: 15, rsl: 13, sol: 17 }, 1);
  assert.deepEqual(max, { durability: 28, health: 25, vigor: 35, mana: 33, ep: 220 });
});

test("升级与额外加成", () => {
  const max = resourceMaxima({ sta: 15, rsl: 13, sol: 17 }, 3, { durability: 5, ep: 100 });
  assert.equal(max.durability, 28 + 12 + 5);
  assert.equal(max.health, 25 + 20);
  assert.equal(max.vigor, 35 + 8);
  assert.equal(max.ep, 320);
});

test("移动力与活力恢复", () => {
  assert.equal(movementFeet(10), 10);
  assert.equal(movementFeet(20), 20);
  assert.equal(vigorRecovery(17), 3);
});

test("伤害先扣护甲再扣耐久", () => {
  const r = applyDamage({ durability: 20, health: 25 }, 12, 4);
  assert.equal(r.net, 8);
  assert.equal(r.absorbed, 4);
  assert.equal(r.durability, 12);
  assert.equal(r.health, 25);
  assert.equal(r.wounded, false);
});

test("耐久溢出转入生命值并负伤", () => {
  const r = applyDamage({ durability: 5, health: 25 }, 15);
  assert.equal(r.durability, 0);
  assert.equal(r.health, 15);
  assert.equal(r.wounded, true);
  assert.equal(r.shock, false);
});

test("尚有生命值时最多打到 0 并休克；已为 0 时死亡", () => {
  const shock = applyDamage({ durability: 0, health: 5 }, 50);
  assert.equal(shock.health, 0);
  assert.equal(shock.shock, true);
  assert.equal(shock.dead, false);
  const dead = applyDamage({ durability: 0, health: 0 }, 1);
  assert.equal(dead.dead, true);
  const blocked = applyDamage({ durability: 0, health: 0 }, 3, 5);
  assert.equal(blocked.dead, false, "完全被护甲吸收时不受伤");
});
