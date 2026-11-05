/**
 * 世界数据迁移。每次新增迁移步骤时递增 MIGRATION_VERSION，GM 下次载入世界时自动执行。
 */
import { SYSTEM_ID } from "./config.mjs";
import { tokenBarPatch, barBrawlActive } from "./token-bars.mjs";
import { format } from "./utils.mjs";

export const MIGRATION_VERSION = 1;
const SETTING = "migrationVersion";

export function registerMigrationSetting() {
  game.settings.register(SYSTEM_ID, SETTING, {
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });
}

/** 只由当前在线的那位 GM 执行，避免多名 GM 同时写入。 */
export async function migrateWorld() {
  const activeGM = game.users.activeGM;
  if (!game.user.isGM || (activeGM && activeGM !== game.user)) return;
  const from = game.settings.get(SYSTEM_ID, SETTING) ?? 0;
  if (from >= MIGRATION_VERSION) return;
  try {
    if (from < 1) await migrateTokenBars();
    await game.settings.set(SYSTEM_ID, SETTING, MIGRATION_VERSION);
  } catch (err) {
    console.error(`${SYSTEM_ID} | 迁移失败`, err);
  }
}

/**
 * v1：已有角色的原型 Token 与场景中的 Token 统一资源条可见性
 * （PC 对所有人始终显示，NPC 对拥有者始终显示）。只改可见性，不改布局。
 */
export async function migrateTokenBars() {
  const brawlActive = barBrawlActive();
  const actorUpdates = game.actors.map(actor => ({
    _id: actor.id,
    prototypeToken: tokenBarPatch(actor.type, actor.prototypeToken.toObject(), { brawlActive })
  }));
  if (actorUpdates.length) await Actor.updateDocuments(actorUpdates);

  let tokens = 0;
  for (const scene of game.scenes) {
    const updates = [];
    for (const token of scene.tokens) {
      const type = token.actor?.type;
      if (!type) continue;
      updates.push({ _id: token.id, ...tokenBarPatch(type, token.toObject(), { brawlActive }) });
    }
    if (!updates.length) continue;
    await scene.updateEmbeddedDocuments("Token", updates);
    tokens += updates.length;
  }

  if (actorUpdates.length || tokens) {
    ui.notifications.info(format("TRAILS.Notify.TokenBarsMigrated", { actors: actorUpdates.length, tokens }));
  }
}
