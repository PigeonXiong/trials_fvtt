import { ABILITY_KEYS, SKILL_DEFAULT_ABILITY, BASE_GUARD, BASE_WARD, BASE_ACTIONS, resourceMaxima, movementFeet, vigorRecovery }
  from "../rules/character.mjs";
import { abilityBonusDice } from "../rules/dice.mjs";
import { int, str, choice, resource } from "./fields.mjs";

const { SchemaField, BooleanField, HTMLField } = foundry.data.fields;

const abilitiesField = () => new SchemaField(Object.fromEntries(
  ABILITY_KEYS.map(k => [k, new SchemaField({ value: int(10, { min: 0 }) })])
));

/** 角色与 NPC 共用：属性加值骰、负伤等派生值。 */
class TrailsActorModel extends foundry.abstract.TypeDataModel {
  prepareAbilities() {
    for (const [key, ability] of Object.entries(this.abilities)) {
      const { dice, challenges } = abilityBonusDice(ability.value);
      ability.dice = dice;
      ability.challenges = challenges;
      ability.key = key;
    }
  }

  get wounded() {
    return this.resources.durability.max > 0 && this.resources.durability.value <= 0;
  }

  /** 由已装备护甲累加的数值。 */
  equippedArmor() {
    const totals = { armorRank: 0, guard: 0, ward: 0 };
    for (const item of this.parent.items) {
      if (item.type !== "armor" || !item.system.equipped) continue;
      totals.armorRank += item.system.armorRank;
      totals.guard += item.system.guardBonus;
      totals.ward += item.system.wardBonus;
    }
    return totals;
  }
}

export class CharacterData extends TrailsActorModel {
  static defineSchema() {
    return {
      level: int(1, { min: 1 }),
      xp: int(0, { min: 0 }),
      skillPoints: int(15),
      abilities: abilitiesField(),
      reputation: int(10),
      resources: new SchemaField({
        durability: resource(),
        health: resource(),
        vigor: resource(),
        mana: resource(),
        ep: resource()
      }),
      defenses: new SchemaField({
        guard: new SchemaField({ bonus: int(0) }),
        ward: new SchemaField({ bonus: int(0) }),
        armorRank: new SchemaField({ bonus: int(0) })
      }),
      actions: new SchemaField({ bonus: int(0) }),
      initiative: new SchemaField({ bonus: int(0) }),
      skills: new SchemaField(Object.fromEntries(Object.entries(SKILL_DEFAULT_ABILITY).map(([key, ability]) => [
        key, new SchemaField({ dice: int(0, { min: 0 }), ability: choice(ABILITY_KEYS, ability) })
      ]))),
      destined: new BooleanField({ initial: false }),
      details: new SchemaField({
        vantageHistory: str(),
        vantageDestiny: str(),
        martialAffinity: str(),
        elementalAffinity: str(),
        memberships: str(),
        connections: str()
      }),
      mira: int(0),
      biography: new HTMLField({ required: true, blank: true })
    };
  }

  prepareDerivedData() {
    this.prepareAbilities();
    const scores = Object.fromEntries(Object.entries(this.abilities).map(([k, a]) => [k, a.value]));
    const bonus = Object.fromEntries(Object.entries(this.resources).map(([k, r]) => [k, r.bonus]));
    const maxima = resourceMaxima(scores, this.level, bonus);
    for (const [key, max] of Object.entries(maxima)) this.resources[key].max = max;

    const armor = this.equippedArmor();
    this.defenses.guard.value = BASE_GUARD + armor.guard + this.defenses.guard.bonus;
    this.defenses.ward.value = BASE_WARD + armor.ward + this.defenses.ward.bonus;
    this.defenses.armorRank.value = armor.armorRank + this.defenses.armorRank.bonus;
    this.actions.value = BASE_ACTIONS + this.actions.bonus;
    this.initiative.dice = this.initiative.bonus;
    this.movement = movementFeet(this.abilities.spd.value);
    this.vigorRecovery = vigorRecovery(this.abilities.sta.value);
  }

  /** 新建角色时的资源初始值（此时尚未派生）。 */
  static initialResources(source) {
    const scores = Object.fromEntries(ABILITY_KEYS.map(k => [k, source.abilities?.[k]?.value ?? 10]));
    const bonus = Object.fromEntries(Object.entries(source.resources ?? {}).map(([k, r]) => [k, r?.bonus ?? 0]));
    return resourceMaxima(scores, source.level ?? 1, bonus);
  }
}

export class NpcData extends TrailsActorModel {
  static defineSchema() {
    return {
      tier: choice(["ordinary", "heroic", "epic"], "ordinary"),
      risk: int(1, { min: 0 }),
      size: str(),
      abilities: abilitiesField(),
      reputation: int(0),
      combat: new SchemaField({
        actions: int(2, { min: 0 }),
        initiative: int(0, { min: 0 }),
        attack: int(0, { min: 0 }),
        assault: int(0, { min: 0 }),
        defense: int(0, { min: 0 }),
        resistance: int(0, { min: 0 }),
        guard: int(BASE_GUARD),
        ward: int(BASE_WARD),
        armorRank: int(0, { min: 0 }),
        movement: str("")
      }),
      resources: new SchemaField({
        durability: resource(20),
        health: resource(10),
        vigor: resource(20),
        mana: resource(20)
      }),
      rewards: new SchemaField({
        exp: int(0, { min: 0 }),
        sepith: str(),
        items: str()
      }),
      traits: new HTMLField({ required: true, blank: true }),
      biography: new HTMLField({ required: true, blank: true })
    };
  }

  prepareDerivedData() {
    this.prepareAbilities();
    const armor = this.equippedArmor();
    this.defenses = {
      guard: { value: this.combat.guard + armor.guard },
      ward: { value: this.combat.ward + armor.ward },
      armorRank: { value: this.combat.armorRank + armor.armorRank }
    };
    this.actions = { value: this.combat.actions };
    this.initiative = { dice: this.combat.initiative };
  }
}
