import { SYSTEM_ID } from "./config.mjs";
import { coverArmorBonus } from "./rules/roll-config.mjs";
import { targetActor } from "./flows/common.mjs";
import { localize, renderTemplate, templatePath } from "./utils.mjs";

/** 为聊天卡片上的按钮绑定事件（v12 用 renderChatMessage，v13 起改为 renderChatMessageHTML）。 */
export function registerChatListeners() {
  const hook = (game.release?.generation ?? 12) >= 13 ? "renderChatMessageHTML" : "renderChatMessage";
  Hooks.on(hook, (message, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    for (const button of root.querySelectorAll("[data-trails-action]")) {
      button.addEventListener("click", event => onChatButton(event, message));
    }
  });
}

async function onChatButton(event, message) {
  event.preventDefault();
  event.stopPropagation();
  const button = event.currentTarget;
  const flags = message.flags[SYSTEM_ID] ?? {};
  button.disabled = true;
  try {
    switch (button.dataset.trailsAction) {
      case "damage": return await onRollDamage(flags);
      case "applyDamage": return await onApplyDamage(message, { ignoreArmor: event.shiftKey });
      case "applyTargetDamage": return await onApplyTargetDamage(message, button, { ignoreArmor: event.shiftKey });
      case "undoDamage": return await onUndoDamage(message);
    }
  } finally {
    button.disabled = false;
  }
}

/** 从行动卡片发起伤害流程：承担的冒险转为蓄势，命中的目标带入伤害面板。 */
async function onRollDamage(flags) {
  const actor = flags.actorUuid ? await fromUuid(flags.actorUuid) : null;
  const item = flags.itemUuid ? await fromUuid(flags.itemUuid) : null;
  if (!actor || !item) return ui.notifications.warn(localize("TRAILS.Notify.SourceMissing"));
  if (!actor.isOwner) return ui.notifications.warn(localize("TRAILS.Notify.NotOwner"));
  const targets = (flags.targets ?? []).filter(t => t.success);
  return actor.rollDamage(item, { chances: flags.chances ?? 0, beyondLegendary: !!flags.beyondLegendary, targets });
}

function damageTotal(message) {
  return message.rolls[0]?.total ?? 0;
}

/** 把伤害应用到当前选中的 Token；按住 Shift 点击则无视护甲。 */
async function onApplyDamage(message, options) {
  const total = damageTotal(message);
  const actors = new Set(canvas.tokens?.controlled.map(t => t.actor).filter(Boolean) ?? []);
  if (!actors.size) return ui.notifications.warn(localize("TRAILS.Notify.SelectToken"));
  for (const actor of actors) {
    if (!actor.isOwner) {
      ui.notifications.warn(`${actor.name}：${localize("TRAILS.Notify.NotOwner")}`);
      continue;
    }
    await actor.applyDamage(total, options);
  }
}

/** 卡片上逐目标应用：使用该目标行的倍率与掩护护甲加值。 */
async function onApplyTargetDamage(message, button, { ignoreArmor }) {
  const flags = message.flags[SYSTEM_ID] ?? {};
  const entry = flags.targets?.[Number(button.dataset.index)];
  if (!entry) return;
  const actor = targetActor(entry);
  if (!actor) return ui.notifications.warn(localize("TRAILS.Notify.SourceMissing"));
  if (!actor.isOwner) return ui.notifications.warn(`${actor.name}：${localize("TRAILS.Notify.NotOwner")}`);
  const multiplier = Number(button.closest("li")?.querySelector(".damage-multiplier")?.value) || 1;
  await actor.applyDamage(damageTotal(message), { ignoreArmor, multiplier, armorBonus: coverArmorBonus(entry.cover) });
}

/** 撤销伤害记录，并把记录卡片标为「已撤销」。 */
async function onUndoDamage(message) {
  const flags = message.flags[SYSTEM_ID] ?? {};
  if (flags.kind !== "damageResult" || flags.undone) return;
  const actor = flags.actorUuid ? await fromUuid(flags.actorUuid) : null;
  if (!actor) return ui.notifications.warn(localize("TRAILS.Notify.SourceMissing"));
  if (!actor.isOwner) return ui.notifications.warn(`${actor.name}：${localize("TRAILS.Notify.NotOwner")}`);
  await actor.undoDamage(flags);
  if (message.canUserModify(game.user, "update")) {
    const content = await renderTemplate(templatePath("chat/damage-result.hbs"), { ...flags.card, undone: true });
    await message.update({ content, [`flags.${SYSTEM_ID}.undone`]: true });
  }
}
