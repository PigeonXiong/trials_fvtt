import { applyDamage, DEFENSE_VIGOR_COST, RESISTANCE_MANA_COST } from "../rules/character.mjs";
import { CharacterData } from "../data/actor-models.mjs";
import { rollAction, rollDamage, postItemCard } from "../dice/rolls.mjs";
import { TRAILS } from "../config.mjs";
import { localize, format } from "../utils.mjs";

export class TrailsActor extends Actor {
  async _preCreate(data, options, user) {
    if ((await super._preCreate(data, options, user)) === false) return false;
    if (this.type !== "character") return;
    const updates = {
      "prototypeToken.actorLink": true,
      "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY,
      "prototypeToken.sight.enabled": true
    };
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

  /** 自动挑战：负伤与过低的属性。 */
  autoChallenges(abilityKey) {
    const warnings = [];
    let challenges = 0;
    if (this.system.wounded) {
      challenges += 1;
      warnings.push(localize("TRAILS.Roll.WoundedTag"));
    }
    const ability = abilityKey ? this.system.abilities[abilityKey] : null;
    if (ability?.challenges) {
      challenges += ability.challenges;
      warnings.push(format("TRAILS.Roll.LowAbilityTag", { ability: localize(TRAILS.abilities[abilityKey]) }));
    }
    return { challenges, warnings };
  }

  /**
   * 生成骰池函数：固定奖励骰 + 所选属性的奖励骰。
   * @param {number} fixedDice 技能、战斗数值等固定奖励骰
   * @param {string[]} fixedNotes 对话框中显示的说明
   * @param {{useAbilityDice?: boolean}} [options] NPC 的战斗数值已含属性，不再叠加
   */
  makePool(fixedDice, fixedNotes = [], { useAbilityDice = true } = {}) {
    return abilityKey => {
      const ability = abilityKey ? this.system.abilities[abilityKey] : null;
      const { challenges, warnings } = this.autoChallenges(abilityKey);
      const abilityDice = useAbilityDice ? (ability?.dice ?? 0) : 0;
      const notes = [...fixedNotes];
      if (ability && useAbilityDice) {
        notes.push(format("TRAILS.Roll.AbilityNote", { ability: localize(TRAILS.abilities[abilityKey]), n: abilityDice }));
      }
      notes.push(...warnings);
      return { dice: fixedDice + abilityDice, challenges, notes, warnings };
    };
  }

  /** 当前唯一选中目标的物防/魔防。 */
  targetDefense(defense) {
    if (!defense || defense === "none") return { vs: null, subtitle: "" };
    const targets = Array.from(game.user.targets);
    if (targets.length !== 1) return { vs: null, subtitle: "" };
    const target = targets[0].actor;
    const vs = target?.system.defenses?.[defense]?.value ?? null;
    if (vs === null) return { vs: null, subtitle: "" };
    return {
      vs,
      subtitle: format("TRAILS.Roll.TargetSubtitle", {
        name: targets[0].name, defense: localize(TRAILS.defenseTargets[defense]), vs
      })
    };
  }

  /* -------------------------------------------- */
  /*  检定                                         */
  /* -------------------------------------------- */

  rollAbility(abilityKey, options = {}) {
    return rollAction(this, {
      title: format("TRAILS.Roll.AbilityCheck", { ability: localize(TRAILS.abilities[abilityKey]) }),
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
      ability: skill.ability,
      allowAbility: true,
      pool: this.makePool(skill.dice, [format("TRAILS.Roll.SkillNote", { skill: label, n: skill.dice })]),
      ...options
    });
  }

  /** 防御反应：速度 + 防御技能，消耗 5 活力，不可承担冒险。 */
  rollDefense(options = {}) {
    const fixed = this.isCharacter ? this.system.skills.defense.dice : this.system.combat.defense;
    return rollAction(this, {
      title: localize("TRAILS.Roll.Defense"),
      ability: this.isCharacter ? "spd" : null,
      allowChances: false,
      cost: { resource: "vigor", amount: DEFENSE_VIGOR_COST },
      pool: this.makePool(fixed, [format("TRAILS.Roll.FixedNote", { n: fixed })], { useAbilityDice: this.isCharacter }),
      ...options
    });
  }

  /** 抵抗反应：按侵袭性质选择属性 + 抵抗技能，消耗 5 魔力，不可承担冒险。 */
  rollResistance(options = {}) {
    const fixed = this.isCharacter ? this.system.skills.resistance.dice : this.system.combat.resistance;
    return rollAction(this, {
      title: localize("TRAILS.Roll.Resistance"),
      ability: this.isCharacter ? this.system.skills.resistance.ability : null,
      allowAbility: this.isCharacter,
      allowChances: false,
      cost: { resource: "mana", amount: RESISTANCE_MANA_COST },
      pool: this.makePool(fixed, [format("TRAILS.Roll.FixedNote", { n: fixed })], { useAbilityDice: this.isCharacter }),
      ...options
    });
  }

  /**
   * 武器攻击或带命中检定的战技。
   * @param {Item} item
   */
  rollAttack(item, options = {}) {
    const sys = item.system;
    const isCraft = item.type === "craft";
    const defense = isCraft ? sys.targets : "guard";
    const { vs, subtitle } = this.targetDefense(defense);

    let fixed;
    let note;
    if (this.isCharacter) {
      fixed = this.system.skills[sys.skill]?.dice ?? 0;
      note = format("TRAILS.Roll.SkillNote", { skill: localize(TRAILS.skills[sys.skill]), n: fixed });
    } else {
      const magical = isCraft && (sys.craftType === "magical" || sys.targets === "ward");
      fixed = magical ? this.system.combat.assault : this.system.combat.attack;
      note = format("TRAILS.Roll.FixedNote", { n: fixed });
    }

    return rollAction(this, {
      title: item.name,
      subtitle,
      item,
      vs,
      ability: this.isCharacter ? sys.ability : null,
      allowAbility: this.isCharacter,
      cost: isCraft ? { resource: sys.resource, amount: sys.cost } : null,
      offerDamage: true,
      pool: this.makePool(fixed, [note], { useAbilityDice: this.isCharacter }),
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
   * 承受伤害：扣护甲 → 耐久 → 生命值，并在聊天栏记录结果。
   * @param {number} amount 原始伤害
   * @param {{ignoreArmor?: boolean}} [options]
   */
  async applyDamage(amount, { ignoreArmor = false } = {}) {
    const { durability, health } = this.system.resources;
    const armorRank = ignoreArmor ? 0 : this.system.defenses.armorRank.value;
    const result = applyDamage({ durability: durability.value, health: health.value }, amount, armorRank);
    await this.update({
      "system.resources.durability.value": result.durability,
      "system.resources.health.value": result.health
    });
    if (result.wounded && typeof this.toggleStatusEffect === "function") {
      await this.toggleStatusEffect("wounded", { active: true });
    }

    const lines = [format("TRAILS.Damage.Summary", {
      name: this.name, net: result.net, absorbed: result.absorbed,
      durabilityFrom: durability.value, durabilityTo: result.durability,
      healthFrom: health.value, healthTo: result.health
    })];
    if (result.wounded && durability.value > 0) lines.push(localize("TRAILS.Damage.Wounded"));
    if (result.shock) lines.push(localize("TRAILS.Damage.Shock"));
    if (result.dead) lines.push(localize("TRAILS.Damage.Dead"));
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="trails chat-card damage-result">${lines.map(l => `<p>${l}</p>`).join("")}</div>`
    });
    return result;
  }
}
