import test from "node:test";
import assert from "node:assert/strict";

// Flow 只在运行时用到 Foundry 的 Hooks 与 ui；这里给出最小替身。
const calls = [];
globalThis.Hooks = { callAll: (name, ...args) => calls.push([name, args.at(-1)]) };
globalThis.ui = { notifications: { error: msg => calls.push(["error", msg]) } };

const { Flow, flowSteps } = await import("../module/flows/flow.mjs");

class DemoFlow extends Flow {
  static steps = ["a", "b"];
}

test("步骤可以插入、移除，并按顺序执行", async () => {
  DemoFlow.insertStepAfter("a", "a2");
  DemoFlow.insertStepBefore("a", "a0");
  DemoFlow.insertStepAfter("missing", "z");
  assert.deepEqual(DemoFlow.steps, ["a0", "a", "a2", "b", "z"]);
  DemoFlow.removeStep("z");
  DemoFlow.removeStep("missing");
  assert.deepEqual(DemoFlow.steps, ["a0", "a", "a2", "b"]);
  assert.deepEqual(Flow.steps, [], "子类的步骤表不影响基类");

  for (const key of DemoFlow.steps) flowSteps.set(key, async state => { state.data.order.push(key); });
  calls.length = 0;
  const state = await new DemoFlow({ name: "actor" }, { order: [] }).begin();
  assert.deepEqual(state.data.order, ["a0", "a", "a2", "b"]);
  assert.deepEqual(calls, [["trails.preFlow.DemoFlow", calls[0][1]], ["trails.postFlow.DemoFlow", true]]);
});

test("步骤返回 false 或抛错时中止流程", async () => {
  flowSteps.set("a", async () => false);
  const order = [];
  flowSteps.set("b", async () => { order.push("b"); });
  calls.length = 0;
  assert.equal(await new DemoFlow({}, { order: [] }).begin(), null);
  assert.deepEqual(order, []);
  assert.deepEqual(calls.at(-1), ["trails.postFlow.DemoFlow", false]);

  flowSteps.set("a", async () => { throw new Error("boom"); });
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(await new DemoFlow({}, { order: [] }).begin(), null);
  } finally {
    console.error = originalError;
  }
  assert.ok(calls.some(([name, msg]) => name === "error" && String(msg).includes("boom")));
});

test("缺少步骤时报错并中止", async () => {
  flowSteps.set("a", async () => {});
  flowSteps.delete("a2");
  calls.length = 0;
  assert.equal(await new DemoFlow({}, { order: [] }).begin(), null);
  const errors = calls.filter(([name]) => name === "error").map(([, msg]) => String(msg));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /a2/);
});

test("Flow 需要角色", () => {
  assert.throws(() => new DemoFlow(null));
});
