import { ABILITY_KEYS, SKILL_DEFAULT_ABILITY } from "../rules/character.mjs";
import { DIE_RANKS } from "../rules/dice.mjs";
import { int, str, choice } from "./fields.mjs";

const { BooleanField, HTMLField } = foundry.data.fields;

const RANK_KEYS = DIE_RANKS.map(r => r.key);
const SKILL_KEYS = Object.keys(SKILL_DEFAULT_ABILITY);

const description = () => new HTMLField({ required: true, blank: true });
const price = () => int(0, { min: 0 });

/** 武器：伤害值 = 伤害骰数量，骰型由品质决定。 */
export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      skill: choice(["lightWeapons", "heavyWeapons", "rangedWeapons", "unarmed"], "lightWeapons"),
      ability: choice(ABILITY_KEYS, "agi"),
      quality: choice(RANK_KEYS, "ordinary"),
      damage: int(1, { min: 0 }),
      addStrength: new BooleanField({ initial: true }),
      bonusDamageDice: int(0, { min: 0 }),
      damageType: str(),
      range: str(),
      equipped: new BooleanField({ initial: false }),
      price: price(),
      description: description()
    };
  }
}

export class ArmorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quality: choice(RANK_KEYS, "ordinary"),
      armorRank: int(0, { min: 0 }),
      guardBonus: int(0),
      wardBonus: int(0),
      equipped: new BooleanField({ initial: false }),
      price: price(),
      description: description()
    };
  }
}

/** 战技：消耗活力或魔力；每次使用都进行行动检定，targets 决定对抗物防、魔防或不对抗。 */
export class CraftData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      craftType: choice(["martial", "magical", "sCraft"], "martial"),
      resource: choice(["vigor", "mana"], "vigor"),
      cost: int(0, { min: 0 }),
      actions: int(1, { min: 0 }),
      skill: choice(SKILL_KEYS, "lightWeapons"),
      ability: choice(ABILITY_KEYS, "agi"),
      targets: choice(["none", "guard", "ward"], "guard"),
      area: choice(["self", "melee", "target", "area", "burst", "line", "cone"], "target"),
      areaSize: str(),
      damage: int(0, { min: 0 }),
      quality: choice(RANK_KEYS, "ordinary"),
      addStrength: new BooleanField({ initial: false }),
      bonusDamageDice: int(0, { min: 0 }),
      damageType: str(),
      affinity: str(),
      modifier: str(),
      description: description()
    };
  }
}

/** 结晶回路：字段与 Orbment_web 保持一致，以便后续迁移导力器构筑。 */
export class QuartzData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quartzType: str(),
      element: choice(["none", "earth", "water", "fire", "wind", "time", "space", "mirage"], "none"),
      rarity: choice(["common", "rare", "superRare", "ultraRare"], "common"),
      effect: str(),
      arts: str(),
      price: price(),
      description: description()
    };
  }
}

export class TalentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      tree: str(),
      rank: int(1, { min: 0 }),
      cost: int(1, { min: 0 }),
      description: description()
    };
  }
}

export class GearData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: int(1, { min: 0 }),
      price: price(),
      description: description()
    };
  }
}
