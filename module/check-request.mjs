/**
 * 检定请求：GM 指定检定类型与 VS，发到聊天栏；玩家点击卡片上的按钮，用自己的角色打开检定面板（VS 已填好），
 * 自行决定冒险、奖励骰等，掷骰后结果汇总回请求卡片。
 *
 * 参考 dnd5e 的 [[/check … request]] 与 PF2e 的 @Check[…]：
 * - GM 从场景控制栏（Token 工具）的「发起检定」打开对话框；宏可调用 game.trails.checkRequest.open()。
 * - 日志与聊天中的 @Check[运动|vs:15]{攀爬城墙}（或 @检定[…]）显示为检定链接：点击即用自己的角色检定；
 *   GM 另有一个喇叭按钮，把它作为请求发到聊天栏。
 * - 回应请求的行动卡片在 flags 中记下 requestId；请求卡片渲染时找出这些卡片，列出每个角色最新的结果。
 */
import { SYSTEM_ID, TRAILS } from "./config.mjs";
import {
  normalizeRequest, parseCheckArgs, requestAbility, collectResults, SKILL_KEYS
} from "./rules/check-request.mjs";
import { ABILITY_KEYS } from "./rules/character.mjs";
import { localize, format, renderTemplate, templatePath, FormDataExtendedImpl } from "./utils.mjs";

const REQUEST_KIND = "checkRequest";
const TOOL_NAME = "trailsCheckRequest";
const ENRICHER_PATTERN = /@(?:Check|检定|檢定)\[([^\]]+)\](?:\{([^}]*)\})?/gi;

/* -------------------------------------------- */
/*  文字                                         */
/* -------------------------------------------- */

/** 「运动检定」「运动检定（敏捷）」「力量检定」。 */
export function checkTitle(request) {
  if (request.type === "ability") {
    return format("TRAILS.Roll.AbilityCheck", { ability: localize(TRAILS.abilities[request.key]) });
  }
  const check = format("TRAILS.Roll.SkillCheck", { skill: localize(TRAILS.skills[request.key]) });
  if (!request.ability) return check;
  return format("TRAILS.Request.WithAbility", { check, ability: localize(TRAILS.abilities[request.ability]) });
}

/** 「运动检定 · VS 15」。 */
function checkSummary(request) {
  const title = checkTitle(request);
  return request.vs === null ? title : format("TRAILS.Request.WithVS", { check: title, vs: request.vs });
}

/** @Check 写法中可用的显示名：当前语言与英文后备翻译中的技能名、属性名与属性缩写。 */
function checkNames() {
  const tables = [game.i18n.translations, game.i18n._fallback].filter(Boolean);
  const names = key => tables
    .map(t => foundry.utils.getProperty(t, key))
    .filter(v => typeof v === "string");
  return {
    skills: Object.fromEntries(SKILL_KEYS.map(k => [k, names(TRAILS.skills[k])])),
    abilities: Object.fromEntries(ABILITY_KEYS.map(k => [k, [...names(TRAILS.abilities[k]), ...names(TRAILS.abilityAbbr[k])]]))
  };
}

/* -------------------------------------------- */
/*  掷骰                                         */
/* -------------------------------------------- */

/** 回应请求的角色：优先当前控制的、自己拥有的 Token，其次是用户配置中指定的角色。 */
export function requestActor() {
  const controlled = canvas?.tokens?.controlled.map(t => t.actor).find(a => a?.isOwner);
  if (controlled) return controlled;
  const character = game.user.character;
  return character?.isOwner ? character : null;
}

/**
 * 用一个角色进行请求的检定：打开检定面板（VS 已填入），玩家可以继续调整冒险、加值与 VS。
 * NPC 没有技能：技能检定改为对应属性的属性检定，标题仍写技能名。
 * @param {Actor} actor
 * @param {import("./rules/check-request.mjs").CheckRequest} request
 * @param {{requestId?: string|null, fastForward?: boolean}} [options]
 */
export function rollCheck(actor, request, { requestId = null, fastForward = false } = {}) {
  const kind = localize(request.type === "ability" ? "TRAILS.Hud.Band.Ability" : "TRAILS.Hud.Band.Skill");
  const options = {
    vs: request.vs,
    requestId,
    fastForward,
    band: request.label ? format("TRAILS.Request.RollBand", { kind, label: request.label }) : kind
  };
  if (request.type === "ability") return actor.rollAbility(request.key, options);
  if (actor.system.skills?.[request.key]) {
    if (request.ability) options.ability = request.ability;
    return actor.rollSkill(request.key, options);
  }
  return actor.rollAbility(requestAbility(request), { ...options, title: checkTitle(request) });
}

/** 从请求卡片或检定链接发起检定。 */
async function rollFor(request, { requestId = null, fastForward = false } = {}) {
  const actor = requestActor();
  if (!actor) return ui.notifications.warn(localize("TRAILS.Notify.SelectCharacter"));
  return rollCheck(actor, request, { requestId, fastForward });
}

/** 聊天卡片上「进行检定」按钮。 */
export function rollRequestedCheck(message, { fastForward = false } = {}) {
  const request = normalizeRequest(message.flags[SYSTEM_ID]?.request);
  if (!request) return ui.notifications.warn(localize("TRAILS.Notify.SourceMissing"));
  return rollFor(request, { requestId: message.id, fastForward });
}

/* -------------------------------------------- */
/*  发布请求                                     */
/* -------------------------------------------- */

/**
 * 把检定请求发到聊天栏。
 * @param {object} input 见 CheckRequest
 * @returns {Promise<ChatMessage|null>}
 */
export async function postCheckRequest(input) {
  const request = normalizeRequest(input);
  if (!request) {
    ui.notifications.warn(localize("TRAILS.Notify.InvalidCheck"));
    return null;
  }
  const content = await renderTemplate(templatePath("chat/check-request.hbs"), {
    title: checkTitle(request),
    label: request.label,
    vs: request.vs,
    hasVS: request.vs !== null
  });
  return ChatMessage.create({
    // 不用 getSpeaker()：GM 控制着 NPC 的 Token 时，请求不应以该 NPC 的名义发出。
    speaker: { scene: canvas?.scene?.id ?? null, actor: null, token: null, alias: game.user.name },
    content,
    flags: { [SYSTEM_ID]: { kind: REQUEST_KIND, request } }
  });
}

/**
 * 打开「发起检定」对话框，确认后发到聊天栏。
 * @param {object} [initial] 预填的检定请求
 */
export async function openCheckRequestDialog(initial = {}) {
  const preset = normalizeRequest(initial) ?? { type: "skill", key: SKILL_KEYS[0], ability: null, vs: null, label: "" };
  const locale = game.i18n.lang === "cn" ? "zh-Hans-CN" : game.i18n.lang;
  const byName = (a, b) => a.label.localeCompare(b.label, locale);
  const skills = SKILL_KEYS
    .map(key => ({ value: `skill:${key}`, label: localize(TRAILS.skills[key]), selected: preset.type === "skill" && preset.key === key }))
    .sort(byName);
  const checkAbilities = ABILITY_KEYS.map(key => ({
    value: `ability:${key}`, label: localize(TRAILS.abilities[key]), selected: preset.type === "ability" && preset.key === key
  }));
  const abilities = ABILITY_KEYS.map(key => ({ value: key, label: localize(TRAILS.abilities[key]), selected: preset.ability === key }));
  const content = await renderTemplate(templatePath("apps/check-request-dialog.hbs"), {
    skills, checkAbilities, abilities, vs: preset.vs, label: preset.label
  });

  const data = await foundry.applications.api.DialogV2.prompt({
    window: { title: localize("TRAILS.Request.DialogTitle"), icon: "fa-solid fa-bullhorn" },
    classes: ["trails", "trails-check-request-dialog"],
    position: { width: 440 },
    content,
    ok: {
      label: localize("TRAILS.Request.Post"),
      icon: "fa-solid fa-bullhorn",
      callback: (event, button) => new (FormDataExtendedImpl())(button.form).object
    },
    rejectClose: false
  });
  if (!data) return null;
  const [type, key] = String(data.check ?? "").split(":");
  return postCheckRequest({ type, key, ability: data.ability || null, vs: data.vs, label: data.label });
}

/* -------------------------------------------- */
/*  请求卡片上的结果                             */
/* -------------------------------------------- */

/** 回应某个请求的行动卡片 → 结果条目。看不到内容的卡片（暗骰等）只列出名字。 */
function resultEntries(requestId) {
  const entries = [];
  for (const m of game.messages) {
    const flags = m.flags?.[SYSTEM_ID];
    if (flags?.kind !== "action" || flags.requestId !== requestId) continue;
    const actor = flags.actorUuid ? fromUuidSync(flags.actorUuid) : null;
    const shown = m.visible && m.isContentVisible;
    entries.push({
      messageId: m.id,
      actorUuid: flags.actorUuid,
      actorName: m.speaker?.alias || actor?.name || "?",
      actorImg: actor?.img ?? "icons/svg/mystery-man.svg",
      total: shown ? (m.rolls[0]?.total ?? null) : null,
      success: shown ? (flags.success ?? null) : null,
      hidden: !shown,
      timestamp: m.timestamp ?? 0
    });
  }
  return collectResults(entries);
}

function resultItem(entry) {
  const li = document.createElement("li");
  const outcome = entry.hidden ? "hidden" : entry.success === true ? "success" : entry.success === false ? "failure" : "rolled";
  li.className = `request-result ${outcome}`;
  li.dataset.messageId = entry.messageId;

  const img = document.createElement("img");
  img.src = entry.actorImg;
  img.alt = "";
  const name = document.createElement("span");
  name.className = "result-name";
  name.textContent = entry.actorName;
  const total = document.createElement("span");
  total.className = "result-total";
  total.textContent = entry.total ?? "?";
  li.append(img, name, total);

  if (outcome !== "rolled") {
    const label = document.createElement("span");
    label.className = "result-outcome";
    label.textContent = localize({
      hidden: "TRAILS.Request.Hidden", success: "TRAILS.Roll.Success", failure: "TRAILS.Roll.Failure"
    }[outcome]);
    li.append(label);
  }
  return li;
}

/** 渲染请求卡片时填入结果列表；点击某一行滚动到那张检定卡片。 */
export function decorateRequestCard(message, root) {
  if (message.flags?.[SYSTEM_ID]?.kind !== REQUEST_KIND) return;
  const list = root.querySelector(".request-results");
  if (!list) return;
  const entries = resultEntries(message.id);
  list.replaceChildren(...entries.map(resultItem));
  list.hidden = !entries.length;
  for (const li of list.children) {
    li.addEventListener("click", () => {
      const target = document.querySelector(`#chat-log .message[data-message-id="${li.dataset.messageId}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
}

/** 有新的回应（或回应被删除）时，重新渲染对应的请求卡片。 */
function refreshRequest(message) {
  const requestId = message.flags?.[SYSTEM_ID]?.requestId;
  const request = requestId ? game.messages.get(requestId) : null;
  if (request) ui.chat?.updateMessage(request);
}

/* -------------------------------------------- */
/*  日志中的检定链接                             */
/* -------------------------------------------- */

function enrichCheck(match) {
  const request = parseCheckArgs(match[1], checkNames(), match[2] ?? "");
  if (!request) return null;
  const wrap = document.createElement("span");
  wrap.className = "trails-check-link";
  Object.assign(wrap.dataset, {
    type: request.type,
    key: request.key,
    ability: request.ability ?? "",
    vs: request.vs ?? "",
    label: request.label
  });

  const roll = document.createElement("a");
  roll.className = "check-roll";
  roll.dataset.checkAction = "roll";
  roll.dataset.tooltip = localize("TRAILS.Request.LinkRollHint");
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-dice-d20";
  const summary = checkSummary(request);
  const text = request.label ? format("TRAILS.Request.LinkLabel", { label: request.label, check: summary }) : summary;
  roll.append(icon, document.createTextNode(` ${text}`));
  wrap.append(roll);

  if (game.user.isGM) {
    const post = document.createElement("a");
    post.className = "check-post";
    post.dataset.checkAction = "post";
    post.dataset.tooltip = localize("TRAILS.Request.LinkPostHint");
    const bullhorn = document.createElement("i");
    bullhorn.className = "fa-solid fa-bullhorn";
    post.append(bullhorn);
    wrap.append(post);
  }
  return wrap;
}

function onCheckLinkClick(event) {
  const button = event.target.closest?.(".trails-check-link [data-check-action]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const d = button.closest(".trails-check-link").dataset;
  const request = normalizeRequest({ type: d.type, key: d.key, ability: d.ability || null, vs: d.vs, label: d.label });
  if (!request) return;
  if (button.dataset.checkAction === "post") return postCheckRequest(request);
  return rollFor(request, { fastForward: event.shiftKey });
}

/* -------------------------------------------- */
/*  注册                                         */
/* -------------------------------------------- */

/** 在 Token 工具栏中加入「发起检定」（仅 GM）。v12 的控件是数组，v13 起改为对象。 */
function addSceneControl(controls) {
  if (!game.user.isGM) return;
  const tool = {
    name: TOOL_NAME,
    title: "TRAILS.Request.Tool",
    icon: "fa-solid fa-bullhorn",
    button: true,
    visible: true
  };
  if (Array.isArray(controls)) {
    controls.find(c => c.name === "token")?.tools.push({ ...tool, onClick: () => openCheckRequestDialog() });
    return;
  }
  const tokens = controls?.tokens;
  if (tokens?.tools) {
    tokens.tools[TOOL_NAME] = { ...tool, order: Object.keys(tokens.tools).length, onChange: () => openCheckRequestDialog() };
  }
}

export function registerCheckRequests() {
  CONFIG.TextEditor.enrichers.push({ pattern: ENRICHER_PATTERN, enricher: enrichCheck });
  Hooks.on("getSceneControlButtons", addSceneControl);
  Hooks.on("createChatMessage", refreshRequest);
  Hooks.on("deleteChatMessage", refreshRequest);
  document.addEventListener("click", onCheckLinkClick);
}
