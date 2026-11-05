import test from "node:test";
import assert from "node:assert/strict";
import {
  DISPLAY_MODES, BRAWL_VISIBILITY, displayBarsFor, brawlVisibilityFor, brawlBarsFor,
  prototypeTokenDefaults, tokenBarPatch
} from "../module/token-bars.mjs";

/**
 * 按 Bar Brawl 1.8 的排布规则（rendering.js 的 calculateWidth / calculatePosition）
 * 在 100×100 的 token 上模拟每条资源条的位置，条高 10。
 */
function layout(bars, size = 100, height = 10) {
  const reserved = { "top-inner": 0, "bottom-inner": 0 };
  const placed = {};
  for (const bar of Object.values(bars).sort((a, b) => a.order - b.order)) {
    const indent = (bar.indentLeft + bar.indentRight) / 100;
    const width = size - indent * size;
    const x = (bar.indentLeft / 100) * size;
    const y = bar.position === "top-inner"
      ? reserved["top-inner"]
      : size - reserved["bottom-inner"] - height;
    if (!bar.shareHeight) reserved[bar.position] += height;
    placed[bar.attribute.split(".").pop()] = { x, y, width };
  }
  return placed;
}

test("核心资源条：PC 对所有人始终显示，NPC 对拥有者始终显示", () => {
  assert.equal(displayBarsFor("character"), DISPLAY_MODES.ALWAYS);
  assert.equal(displayBarsFor("npc"), DISPLAY_MODES.OWNER);
});

test("Bar Brawl 可见性：PC 所有人可见，NPC 仅拥有者", () => {
  assert.deepEqual(brawlVisibilityFor("character"), {
    gmVisibility: BRAWL_VISIBILITY.INHERIT, ownerVisibility: BRAWL_VISIBILITY.ALWAYS, otherVisibility: BRAWL_VISIBILITY.ALWAYS
  });
  assert.deepEqual(brawlVisibilityFor("npc"), {
    gmVisibility: BRAWL_VISIBILITY.INHERIT, ownerVisibility: BRAWL_VISIBILITY.ALWAYS, otherVisibility: BRAWL_VISIBILITY.NONE
  });
});

test("PC 全套五条，NPC 没有导力能量；bar1/bar2 对应核心的耐久与生命值", () => {
  const pc = brawlBarsFor("character");
  const npc = brawlBarsFor("npc");
  assert.deepEqual(Object.values(pc).map(b => b.attribute).sort(), [
    "resources.durability", "resources.ep", "resources.health", "resources.mana", "resources.vigor"
  ]);
  assert.ok(!Object.values(npc).some(b => b.attribute === "resources.ep"));
  assert.equal(pc.bar1.attribute, "resources.durability");
  assert.equal(pc.bar2.attribute, "resources.health");
  for (const [id, bar] of Object.entries(pc)) assert.equal(bar.id, id);
});

test("布局：耐久在最上，生命值其下；活力左、魔力右同排；导力能量在最下排", () => {
  const p = layout(brawlBarsFor("character"));
  assert.equal(p.durability.y, 0);
  assert.equal(p.health.y, 10);
  assert.equal(p.ep.y, 90);
  assert.equal(p.ep.width, 100);
  assert.equal(p.vigor.y, 80);
  assert.equal(p.mana.y, 80);
  assert.ok(p.vigor.x < p.mana.x);
  assert.ok(p.vigor.x + p.vigor.width <= p.mana.x, "两条不重叠");
  assert.equal(p.durability.width, 100);
});

test("NPC 没有导力能量时，活力/魔力那一排落到最底", () => {
  const p = layout(brawlBarsFor("npc"));
  assert.equal(p.vigor.y, 90);
  assert.equal(p.mana.y, 90);
});

test("只有耐久和生命值显示数值", () => {
  const pc = brawlBarsFor("character");
  const shown = Object.values(pc).filter(b => b.style === "fraction").map(b => b.attribute).sort();
  assert.deepEqual(shown, ["resources.durability", "resources.health"]);
  for (const bar of Object.values(pc)) {
    if (bar.style !== "fraction") assert.equal(bar.style, "none");
    assert.equal(bar.label, "");
  }
});

test("新建角色的默认值：未启用 Bar Brawl 时只设可见性", () => {
  assert.deepEqual(prototypeTokenDefaults("npc", {}), { "prototypeToken.displayBars": DISPLAY_MODES.OWNER });
  const withBrawl = prototypeTokenDefaults("character", {}, { brawlActive: true });
  assert.equal(withBrawl["prototypeToken.displayBars"], DISPLAY_MODES.ALWAYS);
  assert.equal(Object.keys(withBrawl["prototypeToken.flags.barbrawl.resourceBars"]).length, 5);
});

test("复制或导入的角色保留原有设置", () => {
  const data = { prototypeToken: { displayBars: 20, flags: { barbrawl: { resourceBars: { bar1: {} } } } } };
  assert.deepEqual(prototypeTokenDefaults("character", data, { brawlActive: true }), {});
});

test("迁移补丁：只改已有条的可见性", () => {
  const source = {
    displayBars: 50,
    bar1: { attribute: "resources.durability" },
    flags: { barbrawl: { resourceBars: { bar1: { id: "bar1", position: "bottom-inner" }, bar3: { id: "bar3" } } } }
  };
  const patch = tokenBarPatch("npc", source, { brawlActive: true });
  assert.equal(patch.displayBars, DISPLAY_MODES.OWNER);
  assert.deepEqual(patch.flags.barbrawl.resourceBars, {
    bar1: { id: "bar1", ownerVisibility: 50, otherVisibility: 0 },
    bar3: { id: "bar3", ownerVisibility: 50, otherVisibility: 0 }
  });
});

test("迁移补丁：启用 Bar Brawl 时为缺少记录的核心条补上明确的可见性", () => {
  const source = { displayBars: 50, bar1: { attribute: "resources.durability" }, bar2: { attribute: "resources.health" } };
  const patch = tokenBarPatch("npc", source, { brawlActive: true });
  const { bar1, bar2 } = patch.flags.barbrawl.resourceBars;
  assert.equal(bar1.attribute, "resources.durability");
  assert.equal(bar2.attribute, "resources.health");
  assert.equal(bar1.otherVisibility, BRAWL_VISIBILITY.NONE);
  assert.equal(bar2.ownerVisibility, BRAWL_VISIBILITY.ALWAYS);
  assert.deepEqual(tokenBarPatch("character", source), { displayBars: DISPLAY_MODES.ALWAYS }, "未启用时只改核心可见性");
});
