import { localize, FilePickerImpl } from "../utils.mjs";

/*
 * 角色卡与物品卡共用的动作处理器。均以 sheet 实例为 this 调用（ApplicationV2 actions 约定）。
 */

export async function onEditImage(event, target) {
  if (!this.isEditable) return;
  const picker = new (FilePickerImpl())({
    type: "image",
    current: this.document.img,
    callback: path => this.document.update({ img: path })
  });
  return picker.browse();
}

/* -------------------------------------------- */
/*  主动效果                                     */
/* -------------------------------------------- */

function effectFromTarget(sheet, target) {
  const { effectId, parentId } = target.closest("[data-effect-id]").dataset;
  const doc = sheet.document;
  const parent = parentId && parentId !== doc.id ? doc.items?.get(parentId) : doc;
  return parent?.effects.get(effectId);
}

export async function onCreateEffect() {
  return ActiveEffect.implementation.create({
    name: localize("TRAILS.Effect.New"),
    img: "icons/svg/aura.svg",
    origin: this.document.uuid
  }, { parent: this.document });
}

export async function onEditEffect(event, target) {
  return effectFromTarget(this, target)?.sheet.render(true);
}

export async function onDeleteEffect(event, target) {
  return effectFromTarget(this, target)?.deleteDialog();
}

export async function onToggleEffect(event, target) {
  const effect = effectFromTarget(this, target);
  return effect?.update({ disabled: !effect.disabled });
}

/** 整理效果列表供模板使用；actor 会包含物品转移来的效果。 */
export function prepareEffects(document) {
  const effects = document.allApplicableEffects ? Array.from(document.allApplicableEffects()) : Array.from(document.effects);
  return effects.map(effect => ({
    id: effect.id,
    parentId: effect.parent?.id,
    name: effect.name,
    img: effect.img,
    disabled: effect.disabled,
    source: effect.parent === document ? "" : effect.parent?.name ?? "",
    canDelete: effect.parent === document
  }));
}

export const effectActions = {
  createEffect: onCreateEffect,
  editEffect: onEditEffect,
  deleteEffect: onDeleteEffect,
  toggleEffect: onToggleEffect
};
