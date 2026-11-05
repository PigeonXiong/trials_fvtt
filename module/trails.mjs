/**
 * 英雄传说：命之轨迹 TRPG（非官方）— Foundry VTT 系统入口。
 */
import { SYSTEM_ID, TRAILS, STATUS_EFFECTS } from "./config.mjs";
import { CharacterData, NpcData } from "./data/actor-models.mjs";
import { WeaponData, ArmorData, CraftData, QuartzData, TalentData, GearData } from "./data/item-models.mjs";
import { TrailsActor } from "./documents/actor.mjs";
import { TrailsItem } from "./documents/item.mjs";
import { TrailsCombatant } from "./documents/combatant.mjs";
import { CharacterSheet, NpcSheet } from "./sheets/actor-sheet.mjs";
import { TrailsItemSheet, ITEM_DETAIL_TEMPLATES } from "./sheets/item-sheet.mjs";
import { registerChatListeners } from "./chat.mjs";
import { loadTemplates, templatePath, localize, DocumentSheetConfigImpl } from "./utils.mjs";
import * as diceRules from "./rules/dice.mjs";
import * as characterRules from "./rules/character.mjs";

const PARTIALS = [
  "actor/parts/combat-strip.hbs",
  "actor/parts/item-list.hbs",
  "actor/parts/effects.hbs"
].map(templatePath);

Hooks.once("init", () => {
  console.log(`${SYSTEM_ID} | 初始化命之轨迹系统`);

  CONFIG.TRAILS = TRAILS;
  game.trails = {
    rules: { dice: diceRules, character: characterRules },
    useItem
  };

  CONFIG.Actor.documentClass = TrailsActor;
  CONFIG.Item.documentClass = TrailsItem;
  CONFIG.Combatant.documentClass = TrailsCombatant;

  CONFIG.Actor.dataModels = { character: CharacterData, npc: NpcData };
  CONFIG.Item.dataModels = {
    weapon: WeaponData,
    armor: ArmorData,
    craft: CraftData,
    quartz: QuartzData,
    talent: TalentData,
    gear: GearData
  };

  const bars = ["resources.durability", "resources.health", "resources.vigor", "resources.mana"];
  CONFIG.Actor.trackableAttributes = {
    character: { bar: [...bars, "resources.ep"], value: [] },
    npc: { bar: bars, value: [] }
  };

  CONFIG.ActiveEffect.legacyTransferral = false;
  CONFIG.statusEffects = STATUS_EFFECTS;
  CONFIG.Combat.initiative = { formula: "1d20", decimals: 0 };

  const SheetConfig = DocumentSheetConfigImpl();
  SheetConfig.registerSheet(Actor, SYSTEM_ID, CharacterSheet, {
    types: ["character"], makeDefault: true, label: "TRAILS.Sheet.CharacterSheet"
  });
  SheetConfig.registerSheet(Actor, SYSTEM_ID, NpcSheet, {
    types: ["npc"], makeDefault: true, label: "TRAILS.Sheet.NpcSheet"
  });
  SheetConfig.registerSheet(Item, SYSTEM_ID, TrailsItemSheet, {
    makeDefault: true, label: "TRAILS.Sheet.ItemSheet"
  });

  registerChatListeners();
  return loadTemplates([...PARTIALS, ...ITEM_DETAIL_TEMPLATES]);
});

/* -------------------------------------------- */
/*  快捷栏宏                                     */
/* -------------------------------------------- */

/** 宏入口：game.trails.useItem("Actor.xxx.Item.yyy") */
async function useItem(uuid) {
  const item = await fromUuid(uuid);
  if (!item) return ui.notifications.warn(localize("TRAILS.Notify.SourceMissing"));
  return item.use();
}

Hooks.on("hotbarDrop", (bar, data, slot) => {
  if (data.type !== "Item" || !data.uuid?.startsWith("Actor.")) return;
  createItemMacro(data.uuid, slot);
  return false;
});

async function createItemMacro(uuid, slot) {
  const item = await fromUuid(uuid);
  if (!item) return;
  const command = `game.trails.useItem("${uuid}");`;
  const macro = game.macros.find(m => m.command === command) ?? await Macro.create({
    name: item.name,
    type: "script",
    img: item.img,
    command
  });
  return game.user.assignHotbarMacro(macro, slot);
}
