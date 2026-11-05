import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = join(root, "templates");

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const templates = walk(templateRoot).filter(f => f.endsWith(".hbs"));

test("所有模板都能通过 Handlebars 编译", () => {
  for (const file of templates) {
    assert.doesNotThrow(() => Handlebars.precompile(readFileSync(file, "utf8")), relative(root, file));
  }
});

test("模板中引用的局部模板都存在", () => {
  for (const file of templates) {
    const text = readFileSync(file, "utf8");
    for (const [, path] of text.matchAll(/\{\{>\s*"systems\/trails-of-destiny\/([^"]+)"/g)) {
      assert.ok(existsSync(join(root, path)), `${relative(root, file)} → ${path}`);
    }
  }
});

test("模板不使用 disabled 类（核心样式会让其无法点击）", () => {
  for (const file of templates) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /class="[^"]*\bdisabled\b(?!\}\})/, relative(root, file));
  }
});

test("ApplicationV2 的每个 PARTS 模板只有一个根元素", () => {
  const parts = templates.filter(f => /actor[\\/][^\\/]+\.hbs$|item[\\/]item-sheet\.hbs$/.test(f));
  for (const file of parts) {
    const html = readFileSync(file, "utf8").replace(/\{\{!--[\s\S]*?--\}\}/g, "").trim();
    const opening = html.match(/^<([a-z]+)/)?.[1];
    assert.ok(opening, `${relative(root, file)} 应以元素开头`);
    assert.ok(html.endsWith(`</${opening}>`), `${relative(root, file)} 应以 </${opening}> 结尾`);
  }
});
