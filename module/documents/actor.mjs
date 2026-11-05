import { applyDamage, DEFENSE_VIGOR_COST, RESISTANCE_MANA_COST } from "../rules/character.mjs";
import { CharacterData } from "../data/actor-models.mjs";
import { rollAction, rollDamage, postItemCard } from "../dice/rolls.mjs";
import { SYSTEM_ID, TRAILS } from "../config.mjs";
import { localize, format, renderTemplate, templatePath } from "../utils.mjs";
import { prototypeTokenDefaults, barBrawlActive } from "../token-bars.mjs";

export class TrailsActor extends Actor {
  async _preCreate(data, options, user) {
    if ((await super._preCreate(data, options, user)) === false) return false;
    // 资源条可见性与 Bar Brawl 全套资源条（Bar Brawl 自己的 preCreateActor 钩子在此之后运行）
    const updates = prototypeTokenDefaults(this.type, data, { brawlActive: barBrawlActive() });
    if (this.type !== "character") {
      this.updateSource(updates);
      return;
    }
    Object.assign(updates, {
      "prototypeToken.actorLink": true,
      "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY,
      "prototypeToken.sight.enabled": true
    });
    const maxima = CharacterData.initialResources(this._source.system);
    for (const [key, max] of Object.entries(maxima)) {
      if (data.system?.resources?.[key]?.value !== undefined) continue;
      updates[`system.resources.${key}.value`] = max;
      updates[`system.resources.${key}.max`] = max;
    }
    this.updateSource(updates);
  }

  get isCharacter() {
    return this.type === "character";
  }

  /* -------------------------------------------- */
  /*  骰池                                         */
  /* -------------------------------------------- */

  /**
   * 生成骰池函数：返回检定面板上的来源列表（固定奖励骰、属性奖励骰、低属性与负伤带来的挑战）。
   * @param {number} fixedDice 技能、战斗数值等固定奖励骰
   * @param {string|null} fixedLabel 固定奖励骰的名称；为 null 时不列出
   * @param {{useAbilityDice?: boolean}} [options] NPC 的战斗数值已含属性，不再叠加
   */
  makePool(fixedDice, fixedLabel = null, { useAbilityDice = true } = {}) {
    return abilityKey => {
      const ability = abilityKey ? this.system.abilities[abilityKey] : null;
      const abilityLabel = abilityKey ? localize(TRAILS.abilities[abilityKey]) : "";
      const sources = [];
      if (fixedLabel !== null) sources.push({ id: "fixed", label: fixedLabel, dice: fixedDice, locked: true });
      if (ability && useAbilityDice) sources.push({ id: "ability", label: abilityLabel, dice: ability.dice ?? 0, locked: true });
      if (ability?.challenges) {
        sources.push({
          id: "lowAbility",
          label: format("TRAILS.Source.LowAbility", { ability: abilityLabel }),
          challenges: ability.challenges
        });
      }
      if (this.system.wounded) {
        sources.push({ id: "wounded", label: localize("TRAILS.Source.Wounded"), challenges: 1, hint: localize("TRAILS.Roll.WoundedBanner") });
      }
      return { sources };
    };
  }

  /* -------------------------------------------- */
  /*  检定                                         */
  /* -------------------------------------------- */

  rollAbility(abilityKey, options = {}) {
    return rollAction(this, {
      title: format("TRAILS.Roll.AbilityCheck", { ability: localize(TRAILS.abilities[abilityKey]) }),
      band: localize("TRAILS.Hud.Band.Ability"),
      icon: "fa-solid fa-dumbbell",
      ability: abilityKey,
      pool: this.makePool(0),
      ...options
    });
  }

  rollSkill(skillKey, options = {}) {
    const skill = this.system.skills?.[skillKey];
    if (!skill) return null;
    const label = localize(TRAILS.skills[skillKey]);
    return rollAction(this, {
      title: format("TRAILS.Roll.SkillCheck", { skill: label }),
      band: localize("TRAILS.Hud.Band.Skill"),
      icon: "fa-solid fa-dice-d20",
      ability: skill.ability,
      allowAbility: true,
      pool: this.makePool(skill.dice, format("TRAILS.Source.Skill", { skill: label })),
      ...options
    });
  }

  /** 防御反应：速度 + 防御技能，消耗 5 活力，不可承担冒险，需严格高于攻击方。 */
  rollDefense(options = {}) {
    const fixed = this.isCharacter ? this.system.skills.defense.dice : this.system.combat.defense;
    const label = this.isCharacter
      ? format("TRAILS.Source.Skill", { skill: localize(TRAILS.skills.defense) })
      : localize("TRAILS.Npc.Defense");
    return rollAction(this, {
      title: localize("TRAILS.Roll.Defense"),
      band: localize("TRAILS.Hud.Band.Reaction"),
      icon: "fa-solid fa-shield-halved",
      ability: this.isCharacter ? "spd" : null,
      allowChances: false,
      reaction: true,
      cost: { resource: "vigor", amount: DEFENSE_VIGOR_COST },
      pool: this.makePool(fixed, label, { useAbilityDice: this.isCharacter }),
      ...options
    });
  }

  /** 抵抗反应：按侵袭性质选择属性 + 抵抗技能，消耗 5 魔力，不可承担冒险，需严格高于侵袭方。 */
  rollResistance(options = {}) {
    const fixed = this.isCharacter ? this.system.skills.resistance.dice : this.system.combat.resistance;
    const label = this.isCharacter
      ? format("TRAILS.Source.Skill", { skill: localize(TRAILS.skills.resistance) })
      : localize("TRAILS.Npc.Resistance");
    return rollAction(this, {
      title: localize("TRAILS.Roll.Resistance"),
      band: localize("TRAILS.Hud.Band.Reaction"),
      icon: "fa-solid fa-hand-sparkles",
      ability: this.isCharacter ? this.system.skills.resistance.ability : null,
      allowAbility: this.isCharacter,
      allowChances: false,
      reaction: true,
      cost: { resource: "mana", amount: RESISTANCE_MANA_COST },
      pool: this.makePool(fixed, label, { useAbilityDice: this.isCharacter }),
      ...options
    });
  }

  /**
   * 武器攻击或战技：对选中的目标逐一比较物防或魔防。
   * @param {Item} item
   */
  rollAttack(item, options = {}) {
    const sys = item.system;
    const isCraft = item.type === "craft";
    const defense = isCraft ? sys.targets : "guard";

    let fixed;
    let label;
    if (this.isCharacter) {
      fixed = this.system.skills[sys.skill]?.dice ?? 0;
      label = format("TRAILS.Source.Skill", { skill: localize(TRAILS.skills[sys.skill]) });
    } else {
      const magical = isCraft && (sys.craftType === "magical" || sys.targets === "ward");
      fixed = magical ? this.system.combat.assault : this.system.combat.attack;
      label = localize(magical ? "TRAILS.Npc.Assault" : "TRAILS.Npc.Attack");
    }

    const kind = localize(isCraft ? "TRAILS.Hud.Band.Craft" : "TRAILS.Hud.Band.Attack");
    const band = defense && defense !== "none"
      ? format("TRAILS.Hud.Band.VersusDefense", { kind, defense: localize(TRAILS.defenseTargets[defense]) })
      : kind;

    return rollAction(this, {
      title: item.name,
      band,
      icon: isCraft ? "fa-solid fa-wand-sparkles" : "fa-solid fa-khanda",
      item,
      defense,
      ability: this.isCharacter ? sys.ability : null,
      allowAbility: this.isCharacter,
      cost: isCraft ? { resource: sys.resource, amount: sys.cost } : null,
      offerDamage: true,
      pool: this.makePool(fixed, label, { useAbilityDice: this.isCharacter }),
      ...options
    });
  }

  rollDamage(item, options = {}) {
    return rollDamage(this, item, options);
  }

  /** 使用物品：武器与战技进行行动检定（V1.1：所有战技都需行动检定）；其他物品发卡片。 */
  async useItem(item, options = {}) {
    if (item.type === "weapon" || item.type === "craft") return this.rollAttack(item, options);
    return postItemCard(this, item);
  }

  /* -------------------------------------------- */
  /*  资源                                         */
  /* -------------------------------------------- */

  canSpend(resource, amount) {
    const current = this.system.resources?.[resource];
    if (!current) return true;
    if (current.value >= amount) return true;
    ui.notifications.warn(format("TRAILS.Notify.NotEnough", {
      resource: localize(TRAILS.resources[resource]), need: amount, have: current.value
    }));
    return false;
  }

  /** 扣除资源；活力耗尽时陷入气短状态。 */
  async spendResource(resource, amount) {
    const current = this.system.resources?.[resource];
    if (!current) return;
    const value = Math.max(0, current.value - amount);
    await this.update({ [`system.resources.${resource}.value`]: value });
    if (resource === "vigor" && value === 0 && typeof this.toggleStatusEffect === "function") {
      await this.toggleStatusEffect("winded", { active: true });
    }
  }

  /**
   * 承受伤害：伤害倍率 → 扣护甲等级（含掩护）→ 耐久 → 生命值，并在聊天栏留下可撤销的记录。
   * @param {number} amount 原始伤害
   * @param {{ignoreArmor?: boolean, armorBonus?: number, multiplier?: number}} [options]
   */
  async applyDamage(amount, { ignoreArmor = false, armorBonus = 0, multiplier = 1 } = {}) {
    const { durability, health } = this.system.resources;
    const raw = Math.max(0, Math.floor(amount * multiplier));
    const armorRank = ignoreArmor ? 0 : this.system.defenses.armorRank.value + armorBonus;
    const result = applyDamage({ durability: durability.value, health: health.value }, raw, armorRank);
    const wasWounded = this.statuses?.has("wounded") ?? false;
    await this.update({
      "system.resources.durability.value": result.durability,
      "system.resources.health.value": result.health
    });
    const addedStatuses = [];
    if (result.wounded && !wasWounded && typeof this.toggleStatusEffect === "function") {
      await this.toggleStatusEffect("wounded", { active: true });
      addedStatuses.push("wounded");
    }

    const notes = [];
    if (result.wounded && durability.value > 0) notes.push(localize("TRAILS.Damage.Wounded"));
    if (result.shock) notes.push(localize("TRAILS.Damage.Shock"));
    if (result.dead) notes.push(localize("TRAILS.Damage.Dead"));
    const detail = [];
    detail.push(multiplier === 1
      ? format("TRAILS.Damage.DetailRaw", { raw })
      : format("TRAILS.Damage.DetailMultiplied", { amount, multiplier: multiplier === 0.5 ? "½" : multiplier, raw }));
    detail.push(ignoreArmor
      ? localize("TRAILS.Damage.DetailIgnoreArmor")
      : format("TRAILS.Damage.DetailArmor", { absorbed: result.absorbed, armor: armorRank }));
    detail.push(format("TRAILS.Damage.DetailResources", {
      durabilityFrom: durability.value, durabilityTo: result.durability,
      healthFrom: health.value, healthTo: result.health
    }));

    const card = {
      img: this.img,
      headline: format("TRAILS.Damage.Headline", {
        name: `<strong>${Handlebars.escapeExpression(this.name)}</strong>`,
        net: `<span class="damage-number">${result.net}</span>`
      }),
      detail: detail.join(" · "),
      notes,
      undone: false
    };
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: await renderTemplate(templatePath("chat/damage-result.hbs"), card),
      flags: {
        [SYSTEM_ID]: {
          kind: "damageResult",
          actorUuid: this.uuid,
          before: { durability: durability.value, health: health.value },
          addedStatuses,
          card
        }
      }
    });
    return result;
  }

  /** 撤销一次伤害：恢复耐久与生命值，并移除这次伤害附加的状态。 */
  async undoDamage({ before, addedStatuses = [] }) {
    await this.update({
      "system.resources.durability.value": before.durability,
      "system.resources.health.value": before.health
    });
    for (const id of addedStatuses) {
      if (typeof this.toggleStatusEffect === "function") await this.toggleStatusEffect(id, { active: false });
    }
  }
}
