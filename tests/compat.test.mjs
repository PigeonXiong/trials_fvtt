import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/* v12 的全局 class（DocumentSheetConfig、FormDataExtended、FilePicker……）不在 globalThis 上，只有函数声明在。 */
const ALLOWED_GLOBALTHIS = new Set(["renderTemplate", "loadTemplates"]);

test("模块代码不通过 globalThis 访问 v12 的全局类", () => {
  const offending = [];
  for (const file of walk(join(root, "module"))) {
    const text = readFileSync(file, "utf8");
    for (const [, name] of text.matchAll(/globalThis\.([A-Za-z_$][\w$]*)/g)) {
      if (!ALLOWED_GLOBALTHIS.has(name)) offending.push(`${relative(root, file)}: globalThis.${name}`);
    }
  }
  assert.deepEqual(offending, []);
});
