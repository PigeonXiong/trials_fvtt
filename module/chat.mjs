import { SYSTEM_ID } from "./config.mjs";
import { localize } from "./utils.mjs";

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
  const button = event.currentTarget;
  const flags = message.flags[SYSTEM_ID] ?? {};
  button.disabled = true;
  try {
    switch (button.dataset.trailsAction) {
      case "damage": return await onRollDamage(flags);
      case "applyDamage": return await onApplyDamage(message, { ignoreArmor: event.shiftKey });
    }
  } finally {
    button.disabled = false;
  }
}

async function onRollDamage(flags) {
  const actor = flags.actorUuid ? await fromUuid(flags.actorUuid) : null;
  const item = flags.itemUuid ? await fromUuid(flags.itemUuid) : null;
  if (!actor || !item) return ui.notifications.warn(localize("TRAILS.Notify.SourceMissing"));
  if (!actor.isOwner) return ui.notifications.warn(localize("TRAILS.Notify.NotOwner"));
  return actor.rollDamage(item, { chances: flags.chances ?? 0 });
}

/** 把伤害应用到当前选中的 Token；按住 Shift 点击则无视护甲。 */
async function onApplyDamage(message, options) {
  const total = message.rolls[0]?.total ?? 0;
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
