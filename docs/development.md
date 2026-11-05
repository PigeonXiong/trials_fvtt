# 开发说明

本文面向想修改或参与开发本系统的人。安装与使用请看 [README](../README.zh-CN.md)。

## 目录结构

```
system.json            系统清单
module/
  trails.mjs           入口：注册数据模型、文档类、角色卡、钩子
  config.mjs           CONFIG.TRAILS 常量与状态异常
  rules/               纯规则函数（无 Foundry 依赖，可在 Node 中测试）
    dice.mjs           骰池、升降阶、爆发、VS 与命定判定
    character.mjs      资源上限、移动力、伤害结算
    roll-config.mjs    检定面板的数据模型：来源汇总、骰池、掩护、逐目标 VS
  data/                TypeDataModel 数据结构（角色、NPC、各类物品）
  documents/           Actor / Item / Combatant 文档类
  flows/               检定流程（参考 Lancer 的 Flow：按名称登记的步骤，可插入或替换）
    flow.mjs           Flow 基类与步骤注册表 game.trails.flowSteps
    action-flow.mjs    行动检定：初始化 → 目标 → 面板 → 掷骰 → 资源 → 命定 → 卡片
    effect-flow.mjs    效应（伤害）检定
    common.mjs         目标、聊天卡片、命定等共用工具
  apps/roll-hud.mjs    右下角检定面板（无边框 ApplicationV2）
  dice/rolls.mjs       旧接口：rollAction / rollDamage / postItemCard，内部改为启动流程
  sheets/              ApplicationV2 角色卡与物品卡
  chat.mjs             聊天卡片按钮
  token-bars.mjs       Token 资源条的可见性与 Bar Brawl 默认布局
  migration.mjs        世界数据迁移（GM 载入世界时按版本执行）
  utils.mjs            v12 → v13 API 兼容层
templates/             Handlebars 模板
styles/trails.css      样式
lang/cn.json, en.json  语言文件
tests/                 Node 单元测试
docs/                  开发说明与规则取舍
.github/workflows/     推送版本标签时自动打包发布
```

## 本地开发环境（Windows）

1. 安装 Foundry VTT **v12**（12.343）。
2. 用目录联接把仓库挂到 Foundry 的数据目录。**目录名必须是 `trails-of-destiny`**，与 `system.json` 里的 `id` 一致。在 PowerShell 中执行：

   ```powershell
   New-Item -ItemType Junction -Path "$env:LOCALAPPDATA\FoundryVTT\Data\systems\trails-of-destiny" -Target "D:\TRPG\Trials_cn\Trials_fvtt"
   ```

   如果改过 Foundry 的数据路径，可以在启动界面的 Configuration 页查看「User Data Path」。
3. 重启 Foundry，用本系统新建一个测试世界。

> 通过目录联接挂载时，**不要在 Foundry 里卸载或更新本系统**：Foundry 会删除联接指向的源码目录。

## 开发循环

- **改规则逻辑**（`module/rules/`）：先写测试，然后运行 `npm test`，几秒钟出结果，不需要启动 Foundry。
- **改 CSS、模板、语言文件**：`system.json` 已开启 hotReload，保存后 Foundry 通常会自动刷新；通过目录联接挂载时偶尔不会触发，没反应就按 F5。
- **改其他 JS**：在浏览器中按 F5 重新加载世界。
- **排错**：按 F12 打开控制台，查看以 `trails-of-destiny |` 开头的日志和报错。可以在控制台直接调用 `game.trails.rules.dice.actionPool({bonusDice: 3})` 等规则函数。

```bash
npm install   # 只需一次，用于模板编译测试
npm test
```

## 扩展检定流程

流程步骤登记在 `game.trails.flowSteps` 中，可以在世界脚本或模组里替换或插入步骤，例如：

```js
const { ActionFlow } = game.trails.flows;
game.trails.flowSteps.set("announceAttack", async state => {
  ui.notifications.info(`${state.actor.name} 发起了 ${state.data.title}`);
});
ActionFlow.insertStepBefore("showActionHUD", "announceAttack");
```

每个流程开始与结束时会触发 `trails.preFlow.<流程名>` 与 `trails.postFlow.<流程名>` 钩子。

## 发布新版本

1. 修改 `system.json` 的 `version`（例如 `0.2.0`）并提交。
2. 推送同名标签：

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

3. GitHub Actions 会跑测试、打包 `trails-of-destiny.zip`，并发布带 `system.json` 的 Release。标签与 `version` 不一致时发布会失败。

## 手动验收清单

在测试世界中依次检查：

1. 新建角色，把属性改为耐力 15、决心 13、灵性 17 → 资源上限应为 耐久 28 / 生命 25 / 活力 35 / 魔力 33 / EP 220。
2. 点击技能名 → 右下角弹出检定面板。点冒险圆点、加减额外奖励骰／蓄势／挑战、取消勾选负伤，公式和骰阶应即时变化；填写 VS 后掷骰，聊天卡片应显示公式、总值（点击展开骰子明细）、成功／失败和爆发次数。
3. 新建武器（伤害值 2、普通品质、勾选加力量）→ 选中一个或多个目标 → 点 d20 图标攻击。面板下方应列出目标及其物防；为某个目标选「部分掩护」，其 VS 应 +3；在场景中取消选中目标，面板应同步移除。
4. 命中后点「掷伤害」→ 伤害面板应带入命中的目标和掩护（护甲 +5），「冒险转化」显示为蓄势 → 掷骰 → 在伤害卡片的目标行选倍率并点红色按钮，检查耐久和生命值的扣减、负伤状态图标；再点伤害记录上的撤销按钮，数值应恢复。
5. 防御反应应扣 5 活力，抵抗反应应扣 5 魔力，资源不足时会给出提示；反应面板中不能承担冒险，平局判为失败。
6. 角色处于命定时，面板的加值栏会出现「绽放命运：加骰」和「绽放命运：突破传奇」，两者只能选一个。选「加骰」后奖励骰 +3；选「突破传奇」后冒险被锁定为 3 点（VS +45）。掷骰后命定状态被消耗。命中后点「掷伤害」，伤害面板的骰阶条应延伸到 d100：3 点蓄势且无挑战时奖励骰为 d100，有负伤时只到 d20。
7. 在天赋上添加主动效果「system.abilities.str.value / 加 / 2」并拖给角色 → 力量 +2，奖励骰随之变化。
8. 战斗追踪器中掷先攻；角色负伤时，先攻的奖励骰应下降一级。
9. 启用 Bar Brawl，分别新建一个角色和一个 NPC 并拖到场景：角色 Token 上方为耐久、生命值（带数值），下方为活力｜魔力一排、导力能量一排；NPC 没有导力能量。以玩家身份登录时，应能看到所有 PC 的资源条，看不到 NPC 的资源条。
