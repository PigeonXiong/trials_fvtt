import { ABILITY_KEYS, SKILL_DEFAULT_ABILITY } from "./rules/character.mjs";
import { DIE_RANKS } from "./rules/dice.mjs";

export const SYSTEM_ID = "trails-of-destiny";
export const SYSTEM_PATH = `systems/${SYSTEM_ID}`;

const label = (prefix, keys) => Object.fromEntries(keys.map(k => [k, `TRAILS.${prefix}.${k}`]));

export const TRAILS = {
  abilities: label("Ability", ABILITY_KEYS),
  abilityAbbr: label("AbilityAbbr", ABILITY_KEYS),
  skills: label("Skill", Object.keys(SKILL_DEFAULT_ABILITY)),
  skillDefaultAbility: SKILL_DEFAULT_ABILITY,
  resources: label("Resource", ["durability", "health", "vigor", "mana", "ep"]),
  ranks: label("Rank", DIE_RANKS.map(r => r.key)),
  rankFaces: Object.fromEntries(DIE_RANKS.map(r => [r.key, r.faces])),
  weaponSkills: label("Skill", ["lightWeapons", "heavyWeapons", "rangedWeapons", "unarmed"]),
  craftTypes: label("CraftType", ["martial", "magical", "sCraft"]),
  craftResources: label("Resource", ["vigor", "mana"]),
  areas: label("Area", ["self", "melee", "target", "burst", "line", "cone"]),
  defenseTargets: label("DefenseTarget", ["none", "guard", "ward"]),
  elements: label("Element", ["none", "earth", "water", "fire", "wind", "time", "space", "mirage"]),
  quartzRarities: label("Rarity", ["common", "rare", "superRare", "ultraRare"]),
  npcTiers: label("Tier", ["ordinary", "heroic", "epic"])
};

/** 状态异常，替换 Foundry 默认的状态列表。 */
export const STATUS_EFFECTS = [
  ["burning", "icons/svg/fire.svg"],
  ["freeze", "icons/svg/frozen.svg"],
  ["petrify", "icons/svg/statue.svg"],
  ["seal", "icons/svg/silenced.svg"],
  ["magicSeal", "icons/svg/mute.svg"],
  ["poisoned", "icons/svg/poison.svg"],
  ["confused", "icons/svg/daze.svg"],
  ["bleed", "icons/svg/blood.svg"],
  ["blinded", "icons/svg/blind.svg"],
  ["dazed", "icons/svg/stoned.svg"],
  ["dazzled", "icons/svg/sun.svg"],
  ["deafened", "icons/svg/deaf.svg"],
  ["encumbered", "icons/svg/anchor.svg"],
  ["enthralled", "icons/svg/heal.svg"],
  ["fatigued", "icons/svg/sleep.svg"],
  ["fear", "icons/svg/terror.svg"],
  ["restrained", "icons/svg/net.svg"],
  ["sickened", "icons/svg/acid.svg"],
  ["unconscious", "icons/svg/unconscious.svg"],
  ["winded", "icons/svg/degen.svg"],
  ["wounded", "icons/svg/bones.svg"],
  ["knockedDown", "icons/svg/falling.svg"]
].map(([id, img]) => ({ id, name: `TRAILS.Condition.${id}`, img }));
