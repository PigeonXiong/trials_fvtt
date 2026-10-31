import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ABILITY_KEYS, SKILL_DEFAULT_ABILITY, RESOURCE_KEYS } from "../module/rules/character.mjs";
import { DIE_RANKS } from "../module/rules/dice.mjs";
import { TRAILS, STATUS_EFFECTS } from "../module/config.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
}

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const langs = Object.fromEntries(["cn", "en"].map(l => [l, new Set(flatten(JSON.parse(readFileSync(join(root, "lang", `${l}.json`), "utf8"))))]));

test("中英文语言文件键一致", () => {
  const onlyCn = [...langs.cn].filter(k => !langs.en.has(k));
  const onlyEn = [...langs.en].filter(k => !langs.cn.has(k));
  assert.deepEqual(onlyCn, [], "仅中文有");
  assert.deepEqual(onlyEn, [], "仅英文有");
});

test("代码与模板中引用的静态键都已翻译", () => {
  const files = [...walk(join(root, "module")), ...walk(join(root, "templates"))];
  const missing = new Set();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const [, key] of text.matchAll(/["'`]((?:TRAILS|TYPES)\.[A-Za-z0-9.]+[A-Za-z0-9])["'`]/g)) {
      if (!langs.cn.has(key)) missing.add(`${key} (${file.slice(root.length + 1)})`);
    }
  }
  assert.deepEqual([...missing], []);
});

test("配置生成的动态键都已翻译", () => {
  const configLabels = Object.values(TRAILS)
    .filter(v => v && typeof v === "object")
    .flatMap(v => Object.values(v))
    .filter(v => typeof v === "string" && v.startsWith("TRAILS."));
  const expected = [
    ...configLabels,
    ...STATUS_EFFECTS.map(s => s.name),
    ...ABILITY_KEYS.flatMap(k => [`TRAILS.Ability.${k}`, `TRAILS.AbilityAbbr.${k}`]),
    ...Object.keys(SKILL_DEFAULT_ABILITY).map(k => `TRAILS.Skill.${k}`),
    ...RESOURCE_KEYS.map(k => `TRAILS.Resource.${k}`),
    ...DIE_RANKS.map(r => `TRAILS.Rank.${r.key}`),
    ...["main", "combat", "inventory", "bio"].map(k => `TRAILS.Tab.${k}`),
    ...["natural20", "bursts", "chances"].map(k => `TRAILS.Destined.Reason.${k}`),
    ...["weapon", "armor", "craft", "quartz", "talent", "gear"].map(t => `TYPES.Item.${t}`),
    ...["character", "npc"].map(t => `TYPES.Actor.${t}`)
  ];
  assert.deepEqual(expected.filter(k => !langs.cn.has(k)), []);
});

test("system.json 声明的文件都存在", () => {
  const manifest = JSON.parse(readFileSync(join(root, "system.json"), "utf8"));
  const paths = [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map(l => l.path)];
  for (const path of paths) assert.ok(statSync(join(root, path)).isFile(), path);
});
