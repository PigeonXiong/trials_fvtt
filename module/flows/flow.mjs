/**
 * 流程（Flow）：参考 Lancer 的 Flow 架构。
 *
 * 一次游戏操作（技能检定、攻击、伤害……）由若干个步骤（Step）依次组成：
 * 初始化数据 → 收集目标 → 弹出检定面板 → 掷骰 → 结算资源与命定 → 发出聊天卡片。
 * 每个步骤是一个 `async (state) => boolean|void` 函数，修改共享的 state；返回 false 时中止流程。
 *
 * 步骤按名称登记在 `flowSteps`（即 game.trails.flowSteps）中，模组可以替换某个步骤，
 * 或用 insertStepBefore / insertStepAfter 在流程中插入自己的步骤。
 * 每个流程开始和结束时分别触发 `trails.preFlow.<流程名>` 与 `trails.postFlow.<流程名>` 钩子。
 */
import { SYSTEM_ID } from "../config.mjs";

/** @type {Map<string, (state: FlowState) => Promise<boolean|void>>} */
export const flowSteps = new Map();

/**
 * @typedef {object} FlowState
 * @property {string} name        流程名
 * @property {Actor} actor
 * @property {Item|null} item
 * @property {string} currentStep
 * @property {object} data        各流程自己的数据
 */

export class Flow {
  /** 按顺序执行的步骤名。子类各自声明。 */
  static steps = [];

  /**
   * @param {Actor} actor
   * @param {object} [data]
   * @param {{item?: Item|null}} [options]
   */
  constructor(actor, data = {}, { item = null } = {}) {
    if (!actor) throw new TypeError(`${SYSTEM_ID} | Flow 需要一个角色`);
    /** @type {FlowState} */
    this.state = { name: this.constructor.name, actor, item, currentStep: "", data };
  }

  static insertStepBefore(key, newKey) {
    const index = this.steps.indexOf(key);
    if (index === -1) this.steps.push(newKey);
    else this.steps.splice(index, 0, newKey);
  }

  static insertStepAfter(key, newKey) {
    const index = this.steps.indexOf(key);
    if (index === -1) this.steps.push(newKey);
    else this.steps.splice(index + 1, 0, newKey);
  }

  static removeStep(key) {
    const index = this.steps.indexOf(key);
    if (index !== -1) this.steps.splice(index, 1);
  }

  /**
   * 依次执行所有步骤。
   * @returns {Promise<FlowState|null>} 完成时返回最终状态；被取消或出错时返回 null
   */
  async begin() {
    const name = this.constructor.name;
    Hooks.callAll(`trails.preFlow.${name}`, this);
    for (const key of this.constructor.steps) {
      this.state.currentStep = key;
      const step = flowSteps.get(key);
      if (!step) {
        ui.notifications.error(`${SYSTEM_ID} | 流程 ${name} 缺少步骤 ${key}`);
        Hooks.callAll(`trails.postFlow.${name}`, this, false);
        return null;
      }
      let result;
      try {
        result = await step(this.state);
      } catch (err) {
        console.error(`${SYSTEM_ID} | 流程 ${name} 在步骤 ${key} 出错`, err);
        ui.notifications.error(`${SYSTEM_ID} | ${err.message}`);
        result = false;
      }
      if (result === false) {
        Hooks.callAll(`trails.postFlow.${name}`, this, false);
        return null;
      }
    }
    Hooks.callAll(`trails.postFlow.${name}`, this, true);
    return this.state;
  }
}
