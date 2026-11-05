import { actionPool } from "../rules/dice.mjs";

/** 先攻 = 1d20 + 先攻奖励骰（负伤时降一阶）。 */
export class TrailsCombatant extends Combatant {
  _getInitiativeFormula() {
    const system = this.actor?.system;
    if (!system) return super._getInitiativeFormula();
    return actionPool({ bonusDice: system.initiative?.dice ?? 0, challenges: system.wounded ? 1 : 0 }).formula;
  }
}
