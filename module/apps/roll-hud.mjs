/**
 * 检定面板：贴在聊天栏左侧、画面右下角弹出的无边框卡片（参考 Lancer 的 SlidingHUD + AccDiffHUD）。
 * 玩家用复选框和加减按钮调整奖励骰、蓄势、挑战、冒险与逐目标掩护，公式即时更新；点「掷骰」后交回流程。
 */
import {
  applyToggles, buildActionPool, buildEffectPool, rankLadder, clampAdjust, targetVS,
  coverArmorBonus, toggleSource, forcedChances, COVER, COVER_KEYS
} from "../rules/roll-config.mjs";
import { CHANCE_VS, MAX_CHANCES, MAX_BONUS_FACES, DEFAULT_BONUS_FACES } from "../rules/dice.mjs";
import { TRAILS } from "../config.mjs";
import { templatePath, localize } from "../utils.mjs";
import { sourceEffect, isHindrance, currentTargets } from "../flows/common.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const ZONE_ID = "trails-hud-zone";
const COVER_ICONS = {
  none: "fa-regular fa-circle",
  light: "fa-solid fa-leaf",
  partial: "fa-solid fa-shield-halved",
  full: "fa-solid fa-shield"
};
const MAX_CHIPS = 10;

/** 面板容器：固定在画面底部、聊天栏左侧。 */
function hudZone() {
  let zone = document.getElementById(ZONE_ID);
  if (!zone) {
    zone = document.createElement("div");
    zone.id = ZONE_ID;
    zone.className = "trails-hud-zone";
    document.body.append(zone);
  }
  placeZone(zone);
  return zone;
}

function placeZone(zone = document.getElementById(ZONE_ID)) {
  if (!zone) return;
  const sidebar = document.getElementById("sidebar");
  const left = sidebar?.getBoundingClientRect().left ?? window.innerWidth;
  zone.style.right = `${Math.max(0, window.innerWidth - left) + 8}px`;
}

Hooks.on("collapseSidebar", () => setTimeout(placeZone, 250));
window.addEventListener("resize", () => placeZone());

export class RollHud extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} config 流程中的面板数据（会被直接修改）
   * @param {(result: object|null) => void} resolve
   */
  constructor(config, resolve, options = {}) {
    super(options);
    this.config = config;
    this.#resolve = resolve;
  }

  static DEFAULT_OPTIONS = {
    classes: ["trails", "trails-hud"],
    tag: "div",
    window: { frame: false, positioned: false },
    actions: {
      adjust: RollHud.#onAdjust,
      setChances: RollHud.#onSetChances,
      toggleSource: RollHud.#onToggleSource,
      setCover: RollHud.#onSetCover,
      removeTarget: RollHud.#onRemoveTarget,
      roll: RollHud.#onRoll,
      cancel: RollHud.#onCancel
    }
  };

  static PARTS = {
    body: { template: templatePath("hud/roll-hud.hbs") }
  };

  /** 每种面板（action / effect）同时只开一个。 */
  static #open = new Map();

  /**
   * 打开面板并等待玩家确认。
   * @param {object} config
   * @returns {Promise<object|null>} 掷骰时为 config；取消时为 null
   */
  static prompt(config) {
    RollHud.#open.get(config.kind)?.close();
    return new Promise(resolve => {
      const app = new RollHud(config, resolve);
      RollHud.#open.set(config.kind, app);
      app.render({ force: true });
    });
  }

  #resolve;
  #targetHook = null;

  _insertElement(element) {
    const zone = hudZone();
    const existing = document.getElementById(element.id);
    if (existing) existing.replaceWith(element);
    else zone.prepend(element);
  }

  /* -------------------------------------------- */
  /*  渲染                                         */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const c = this.config;
    c.sources = applyToggles(c.getSources(c.ability), c.toggles);
    const isAction = c.kind === "action";
    const forced = isAction && c.allowChances ? forcedChances(c.sources) : null;
    c.chancesLocked = forced !== null;
    if (c.chancesLocked) c.chances = forced;
    const pool = isAction ? buildActionPool(c) : buildEffectPool(c);

    const sources = c.sources.map(s => ({ ...s, effect: sourceEffect(s) }));
    const chips = [];
    if (isAction) chips.push({ faces: 20, cls: "action" });
    else for (let i = 0; i < Math.min(pool.effectDice, MAX_CHIPS); i++) chips.push({ faces: pool.effectFaces, cls: "effect" });
    const bonusShown = Math.min(pool.dice, MAX_CHIPS);
    for (let i = 0; i < bonusShown; i++) chips.push({ faces: pool.faces, cls: `bonus d${pool.faces}` });
    const hiddenChips = (isAction ? 0 : Math.max(0, pool.effectDice - MAX_CHIPS)) + (pool.dice - bonusShown);

    const chances = c.allowChances ? c.chances : 0;
    const targets = c.targets.map((t, index) => {
      const entry = { ...t, index };
      if (isAction) {
        const value = t[c.defense];
        entry.defenseValue = value;
        entry.vs = value === null || value === undefined ? null : targetVS({ defenseValue: value, defense: c.defense, cover: t.cover, chances });
      } else {
        entry.armorBonus = coverArmorBonus(t.cover);
        entry.armorTotal = (t.armorRank ?? 0) + entry.armorBonus;
      }
      entry.covers = COVER_KEYS.map(key => ({
        key,
        icon: COVER_ICONS[key],
        label: localize(`TRAILS.Cover.Short.${key}`),
        tooltip: `${localize(`TRAILS.Cover.${key}`)}：${localize(`TRAILS.Cover.Hint.${key}`)}`,
        active: t.cover === key
      }));
      return entry;
    });

    const showTargets = isAction ? ["guard", "ward"].includes(c.defense) : true;
    return {
      c,
      isAction,
      pool,
      chips,
      hiddenChips,
      ladder: rankLadder(pool.faces, DEFAULT_BONUS_FACES, isAction ? MAX_BONUS_FACES : pool.maxFaces),
      mythicCap: !isAction && pool.maxFaces > MAX_BONUS_FACES,
      boosts: sources.filter(s => !isHindrance(s)),
      hindrances: sources.filter(isHindrance),
      chancePips: Array.from({ length: MAX_CHANCES }, (_, i) => ({ n: i + 1, active: i < chances })),
      chanceVS: chances * CHANCE_VS,
      chances,
      counters: this.#counters(),
      showTargets,
      targets,
      defenseLabel: c.defense && c.defense !== "none" ? localize(TRAILS.defenseTargets[c.defense]) : "",
      showManualVS: isAction && !targets.length,
      vsPlaceholder: c.reaction ? "TRAILS.Hud.ReactionVSPlaceholder" : "TRAILS.Roll.VSPlaceholder",
      abilityChoices: c.abilityChoices,
      rollModes: Object.fromEntries(Object.entries(CONFIG.Dice.rollModes)
        .map(([key, mode]) => [key, typeof mode === "string" ? mode : mode.label]))
    };
  }

  #counters() {
    const c = this.config;
    const list = [];
    if (c.kind === "effect") list.push({ field: "effectDice", label: "TRAILS.Hud.EffectDice", value: c.effectDice });
    list.push(
      { field: "extraDice", label: "TRAILS.Hud.ExtraDice", value: c.extraDice },
      { field: "charges", label: "TRAILS.Roll.Charges", value: c.charges },
      { field: "challenges", label: "TRAILS.Roll.Challenges", value: c.challenges },
      { field: "flat", label: "TRAILS.Roll.Flat", value: c.flat }
    );
    return list;
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    if (this.config.trackTargets) {
      this.#targetHook = Hooks.on("targetToken", (user) => {
        if (user !== game.user) return;
        this.config.targets = currentTargets(this.config.targets);
        this.render();
      });
    }
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const el = this.element;
    el.querySelector("[name=ability]")?.addEventListener("change", event => {
      this.config.ability = event.currentTarget.value;
      this.render();
    });
    el.querySelector("[name=vs]")?.addEventListener("change", event => {
      const raw = event.currentTarget.value.trim();
      this.config.vs = raw === "" ? null : clampAdjust("vs", raw);
      this.render();
    });
    el.querySelector("[name=rollMode]")?.addEventListener("change", event => {
      this.config.rollMode = event.currentTarget.value;
    });
    placeZone();
  }

  async _onClose(options) {
    if (this.#targetHook !== null) Hooks.off("targetToken", this.#targetHook);
    if (RollHud.#open.get(this.config.kind) === this) RollHud.#open.delete(this.config.kind);
    this.#finish(null);
    return super._onClose(options);
  }

  #finish(result) {
    const resolve = this.#resolve;
    this.#resolve = null;
    resolve?.(result);
  }

  /* -------------------------------------------- */
  /*  操作                                         */
  /* -------------------------------------------- */

  static #onAdjust(event, target) {
    const field = target.dataset.field;
    const delta = Number(target.dataset.delta) || 0;
    this.config[field] = clampAdjust(field, (this.config[field] ?? 0) + delta);
    this.render();
  }

  /** 点亮第 n 个冒险点；再次点击最高的那个则熄灭它。 */
  static #onSetChances(event, target) {
    if (this.config.chancesLocked) return;
    const n = Number(target.dataset.value) || 0;
    this.config.chances = clampAdjust("chances", this.config.chances === n ? n - 1 : n);
    this.render();
  }

  static #onToggleSource(event, target) {
    const c = this.config;
    const id = target.dataset.source;
    const source = c.sources.find(s => s.id === id);
    if (!source || source.locked) return;
    // 取消「突破传奇」后冒险恢复为可调，但保留当前点数（由 _prepareContext 重新计算锁定状态）
    c.toggles = toggleSource(c.sources, c.toggles, id);
    this.render();
  }

  static #onSetCover(event, target) {
    const entry = this.config.targets[Number(target.dataset.index)];
    if (!entry || !(target.dataset.cover in COVER)) return;
    entry.cover = target.dataset.cover;
    this.render();
  }

  static #onRemoveTarget(event, target) {
    const entry = this.config.targets[Number(target.dataset.index)];
    if (!entry) return;
    const token = fromUuidSync(entry.tokenUuid)?.object;
    if (token?.isTargeted) token.setTarget(false, { releaseOthers: false });
    else {
      this.config.targets.splice(Number(target.dataset.index), 1);
      this.render();
    }
  }

  static #onRoll() {
    this.#finish(this.config);
    this.close();
  }

  static #onCancel() {
    this.close();
  }
}
