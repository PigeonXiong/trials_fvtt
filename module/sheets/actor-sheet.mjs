import { ABILITY_KEYS } from "../rules/character.mjs";
import { TRAILS } from "../config.mjs";
import { templatePath, localize, TextEditorImpl } from "../utils.mjs";
import { onEditImage, effectActions, prepareEffects } from "./common.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const ITEM_GROUPS = ["weapon", "armor", "craft", "quartz", "talent", "gear"];

function itemFromTarget(sheet, target) {
  const id = target.closest("[data-item-id]")?.dataset.itemId;
  return id ? sheet.actor.items.get(id) : null;
}

/** 角色卡与 NPC 卡的公共基类。 */
class TrailsActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["trails", "sheet", "actor"],
    position: { width: 800, height: 840 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      editImage: onEditImage,
      rollAbility: TrailsActorSheet.#onRollAbility,
      rollSkill: TrailsActorSheet.#onRollSkill,
      rollDefense: TrailsActorSheet.#onRollDefense,
      rollResistance: TrailsActorSheet.#onRollResistance,
      rollInitiative: TrailsActorSheet.#onRollInitiative,
      useItem: TrailsActorSheet.#onUseItem,
      rollDamage: TrailsActorSheet.#onRollDamage,
      createItem: TrailsActorSheet.#onCreateItem,
      editItem: TrailsActorSheet.#onEditItem,
      deleteItem: TrailsActorSheet.#onDeleteItem,
      toggleEquipped: TrailsActorSheet.#onToggleEquipped,
      toggleDestined: TrailsActorSheet.#onToggleDestined,
      ...effectActions
    }
  };

  tabGroups = { primary: "main" };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;

    const items = Object.fromEntries(ITEM_GROUPS.map(type => [type, []]));
    for (const item of actor.items.contents.sort((a, b) => a.sort - b.sort)) {
      items[item.type]?.push(this._prepareItem(item));
    }

    return Object.assign(context, {
      actor,
      system,
      config: TRAILS,
      editable: this.isEditable,
      owner: actor.isOwner,
      tab: this.tabGroups.primary,
      abilities: ABILITY_KEYS.map(key => ({
        key,
        ...system.abilities[key],
        label: TRAILS.abilities[key],
        abbr: TRAILS.abilityAbbr[key]
      })),
      items,
      effects: prepareEffects(actor),
      wounded: system.wounded
    });
  }

  _prepareItem(item) {
    const sys = item.system;
    const data = { id: item.id, name: item.name, img: item.img, type: item.type, system: sys };
    if ("damage" in sys && sys.damage > 0) {
      const faces = TRAILS.rankFaces[sys.quality];
      const extra = [];
      if (sys.addStrength) extra.push(localize("TRAILS.AbilityAbbr.str"));
      if (sys.bonusDamageDice) extra.push(`${sys.bonusDamageDice}BD`);
      data.damageLabel = [`${sys.damage}d${faces}`, ...extra].join(" + ");
    }
    if (item.type === "craft" && sys.cost) {
      data.costLabel = `${sys.cost} ${localize(TRAILS.resources[sys.resource])}`;
    }
    data.meta = {
      talent: () => [sys.tree, sys.rank ? `R${sys.rank}` : ""].filter(Boolean).join(" · "),
      quartz: () => [localize(TRAILS.elements[sys.element]), localize(TRAILS.quartzRarities[sys.rarity])].join(" · "),
      gear: () => `×${sys.quantity}`
    }[item.type]?.() ?? "";
    return data;
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.element.addEventListener("dragover", event => event.preventDefault());
    this.element.addEventListener("drop", this.#onDrop.bind(this));
  }

  /** 重新渲染后保持折叠区的展开状态。 */
  #openDetails = new Set();

  _onRender(context, options) {
    super._onRender(context, options);
    for (const details of this.element.querySelectorAll("details[class]")) {
      details.open = this.#openDetails.has(details.className);
      details.addEventListener("toggle", () => {
        if (details.open) this.#openDetails.add(details.className);
        else this.#openDetails.delete(details.className);
      });
    }
    for (const row of this.element.querySelectorAll("[data-item-id]")) {
      row.setAttribute("draggable", "true");
      row.addEventListener("dragstart", event => {
        const item = this.actor.items.get(row.dataset.itemId);
        if (item) event.dataTransfer.setData("text/plain", JSON.stringify(item.toDragData()));
      });
    }
  }

  /** v12 的 ActorSheetV2 尚无内建拖放，这里自行处理物品拖入。 */
  async #onDrop(event) {
    if (!this.isEditable) return;
    const data = TextEditorImpl().getDragEventData(event);
    if (data?.type !== "Item") return;
    event.preventDefault();
    const item = await Item.implementation.fromDropData(data);
    if (!item || item.parent === this.actor) return;
    return this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
  }

  static #onRollAbility(event, target) {
    return this.actor.rollAbility(target.dataset.ability, { fastForward: event.shiftKey });
  }

  static #onRollSkill(event, target) {
    return this.actor.rollSkill(target.dataset.skill, { fastForward: event.shiftKey });
  }

  static #onRollDefense(event) {
    return this.actor.rollDefense({ fastForward: event.shiftKey });
  }

  static #onRollResistance(event) {
    return this.actor.rollResistance({ fastForward: event.shiftKey });
  }

  static #onRollInitiative() {
    return this.actor.rollInitiative({ createCombatants: true });
  }

  static #onUseItem(event, target) {
    const item = itemFromTarget(this, target);
    return item && this.actor.useItem(item, { fastForward: event.shiftKey });
  }

  static #onRollDamage(event, target) {
    const item = itemFromTarget(this, target);
    return item && this.actor.rollDamage(item);
  }

  static #onCreateItem(event, target) {
    const type = target.dataset.type;
    return Item.implementation.create({
      name: localize(`TYPES.Item.${type}`),
      type
    }, { parent: this.actor, renderSheet: true });
  }

  static #onEditItem(event, target) {
    return itemFromTarget(this, target)?.sheet.render(true);
  }

  static #onDeleteItem(event, target) {
    return itemFromTarget(this, target)?.deleteDialog();
  }

  static #onToggleEquipped(event, target) {
    const item = itemFromTarget(this, target);
    return item?.update({ "system.equipped": !item.system.equipped });
  }

  static #onToggleDestined() {
    return this.actor.update({ "system.destined": !this.actor.system.destined });
  }
}

export class CharacterSheet extends TrailsActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["character"]
  };

  static PARTS = {
    header: { template: templatePath("actor/character-header.hbs") },
    tabs: { template: templatePath("actor/tabs.hbs") },
    main: { template: templatePath("actor/character-main.hbs"), scrollable: [""] },
    combat: { template: templatePath("actor/actor-combat.hbs"), scrollable: [""] },
    inventory: { template: templatePath("actor/character-inventory.hbs"), scrollable: [""] },
    bio: { template: templatePath("actor/character-bio.hbs"), scrollable: [""] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;
    context.tabs = ["main", "combat", "inventory", "bio"].map(id => ({
      id, label: `TRAILS.Tab.${id}`, active: context.tab === id
    }));
    context.resources = Object.entries(system.resources).map(([key, r]) => ({
      key, ...r, label: TRAILS.resources[key]
    }));
    context.skills = Object.entries(system.skills).map(([key, s]) => ({
      key, ...s,
      label: TRAILS.skills[key],
      total: s.dice + (system.abilities[s.ability]?.dice ?? 0)
    })).sort((a, b) => localize(a.label).localeCompare(localize(b.label), "zh-Hans-CN"));
    return context;
  }
}

export class NpcSheet extends TrailsActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["npc"],
    position: { width: 720, height: 780 }
  };

  static PARTS = {
    header: { template: templatePath("actor/npc-header.hbs") },
    tabs: { template: templatePath("actor/tabs.hbs") },
    main: { template: templatePath("actor/npc-main.hbs"), scrollable: [""] },
    combat: { template: templatePath("actor/actor-combat.hbs"), scrollable: [""] },
    bio: { template: templatePath("actor/npc-bio.hbs"), scrollable: [""] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.tabs = ["main", "combat", "bio"].map(id => ({
      id, label: `TRAILS.Tab.${id}`, active: context.tab === id
    }));
    context.resources = Object.entries(this.actor.system.resources).map(([key, r]) => ({
      key, ...r, label: TRAILS.resources[key]
    }));
    return context;
  }
}
