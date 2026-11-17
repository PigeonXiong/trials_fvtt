import test from "node:test";
import assert from "node:assert/strict";
import {
  resourceMaxima, movementFeet, vigorRecovery, applyDamage, raisedCurrentValues, craftWeapon,
  SKILL_DEFAULT_ABILITY, ABILITY_KEYS
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

test("伤害倍率在扣除护甲之后应用，减半向下取整", () => {
  const half = applyDamage({ durability: 50, health: 25 }, 20, 5, 0.5);
  assert.equal(half.afterArmor, 15);
  assert.equal(half.absorbed, 5);
  assert.equal(half.net, 7, "规则书示例：20 伤害、护甲等级 5、减半 → 7");
  assert.equal(half.durability, 43);
  const double = applyDamage({ durability: 50, health: 25 }, 20, 5, 2);
  assert.equal(double.net, 30, "规则书示例：加倍 → 30");
  assert.equal(applyDamage({ durability: 50, health: 25 }, 20, 5).net, 15, "默认倍率为 1");
  assert.equal(applyDamage({ durability: 50, health: 25 }, 4, 5, 2).net, 0, "护甲完全吸收后加倍仍为 0");
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

test("上限提高时当前值同步增加；上限降低或不变时不调整", () => {
  assert.deepEqual(raisedCurrentValues({ mana: 50 }, { mana: 70 }, { mana: 30 }), { mana: 50 }, "规则书示例：30/50 → 50/70");
  const before = resourceMaxima({ sta: 15, rsl: 13, sol: 17 }, 1);
  const after = resourceMaxima({ sta: 15, rsl: 13, sol: 17 }, 2, { vigor: 10 });
  const current = { durability: 20, health: 10, vigor: 5, mana: 33, ep: 100 };
  assert.deepEqual(raisedCurrentValues(before, after, current), { durability: 26, vigor: 19, mana: 37 },
    "只调整耐久、活力、魔力；生命值与导力能量不变");
  assert.deepEqual(raisedCurrentValues(after, before, current), {}, "上限降低时不调整");
});

test("武术战技找到已装备的同技能武器", () => {
  const craft = (system = {}) => ({ type: "craft", system: { craftType: "martial", skill: "lightWeapons", addWeaponDamage: true, ...system } });
  const sword = { type: "weapon", system: { skill: "lightWeapons", equipped: true, damage: 2, quality: "heroic" } };
  const spare = { type: "weapon", system: { skill: "lightWeapons", equipped: false, damage: 3 } };
  const rifle = { type: "weapon", system: { skill: "rangedWeapons", equipped: true, damage: 2 } };
  assert.equal(craftWeapon(craft(), [spare, rifle, sword]), sword);
  assert.equal(craftWeapon(craft(), [spare, rifle]), null, "未装备的武器不算");
  assert.equal(craftWeapon(craft({ craftType: "magical" }), [sword]), null, "魔法战技不加武器伤害");
  assert.equal(craftWeapon(craft({ addWeaponDamage: false }), [sword]), null, "取消勾选时不加");
  assert.equal(craftWeapon(craft({ skill: "occult" }), [sword]), null, "检定技能不是武器技能时不加");
  assert.equal(craftWeapon(craft({ craftType: "sCraft" }), [sword]), sword, "S 战技默认按武术战技处理");
  assert.equal(craftWeapon(sword, [sword]), null, "只处理战技");
});
