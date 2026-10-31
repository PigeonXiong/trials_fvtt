import { postItemCard } from "../dice/rolls.mjs";

export class TrailsItem extends Item {
  /** 从角色卡或快捷栏使用物品；无所属角色时只发布卡片。 */
  async use(options = {}) {
    if (this.actor) return this.actor.useItem(this, options);
    return postItemCard(null, this);
  }
}
