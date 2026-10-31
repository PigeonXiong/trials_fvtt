import { SYSTEM_PATH } from "./config.mjs";

/*
 * v12 → v13 的 API 迁移兼容层：v13 把若干全局对象移入了命名空间。
 * 统一从这里取，日后升级时只改这一处。
 */

export const renderTemplate = (...args) =>
  (foundry.applications.handlebars?.renderTemplate ?? globalThis.renderTemplate)(...args);

export const loadTemplates = (...args) =>
  (foundry.applications.handlebars?.loadTemplates ?? globalThis.loadTemplates)(...args);

export const TextEditorImpl = () => foundry.applications.ux?.TextEditor?.implementation ?? globalThis.TextEditor;

export const FormDataExtendedImpl = () => foundry.applications.ux?.FormDataExtended ?? globalThis.FormDataExtended;

export const templatePath = path => `${SYSTEM_PATH}/templates/${path}`;

export const localize = key => game.i18n.localize(key);

export const format = (key, data) => game.i18n.format(key, data);

/** 解析富文本中的链接、骰式等，供显示用。 */
export async function enrich(html, options = {}) {
  if (!html) return "";
  return TextEditorImpl().enrichHTML(html, { async: true, ...options });
}
