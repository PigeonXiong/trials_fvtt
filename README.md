# 英雄传说：命之轨迹 TRPG — Foundry VTT 系统（非官方）

《The Legend of Heroes: Trails of Destiny》（Promethium System）的饭制自动化系统，目标版本 **Foundry VTT v12**（已按 12.343 的 API 编写）。

> 非官方项目。请勿把规则书原文、插图打包进本仓库或公开的合集包。

## 当前功能（0.1.0）

| 模块 | 内容 |
| --- | --- |
| 角色卡 | 九项属性及其加值骰（15 起 +1，每 5 点 +1；低于 5 记 1 个挑战）；21 项核心技能（可改用属性、填写技能加值骰）；耐久、生命值、耐力、魔力、导力能量上限自动计算（含每级成长与额外加成）；防护、抗护、护甲等级、行动数、移动力自动计算；命定开关 |
| NPC 卡 | 按怪物数据块录入：等阶、危险度、战斗数值（攻击、袭击、防御、抵抗……均为已含属性的加值骰）、资源、奖励 |
| 物品 | 武器、护甲、战技、结晶回路、天赋、道具；物品上的主动效果会转移给持有者（用于天赋加属性等） |
| 检定 | 1d20 + N 个加值骰（d10 起，按充能和挑战升降阶，最低 d4，最高 d20）；加值骰掷出最大值时爆发，无限连爆；机会每个 +15 VS，并给效果骰 +1 充能；负伤自动降一阶 |
| 战斗 | 选中单个目标时自动读取其防护或抗护作为 VS；攻击命中后显示「掷伤害」按钮，承担的机会会转为伤害加值骰的充能；「应用伤害」先扣护甲，再扣耐久，溢出部分转入生命值，并处理负伤、休克和死亡；防御反应消耗 5 耐力，抵抗反应消耗 5 魔力；战技自动扣除消耗 |
| 命定 | 动作骰掷出 20、单次检定爆发 3 颗加值骰、承担 3 个机会并成功，满足任一条件时自动进入命定状态 |
| 其他 | 先攻 = 1d20 + 先攻加值骰；22 种状态异常；把物品拖到快捷栏会生成宏；中英文界面 |

尚未实现：导力器构筑（准备从 `../Orbment_web/js/rules.js` 移植）、魔法（Arts）施放、战技范围模板、反应与攻击的自动对抗、合集包内容。

## 目录结构

```
system.json            系统清单
module/
  trails.mjs           入口：注册数据模型、文档类、角色卡、钩子
  config.mjs           CONFIG.TRAILS 常量与状态异常
  rules/               纯规则函数（无 Foundry 依赖，可在 Node 中测试）
    dice.mjs           骰池、升降阶、爆发、VS 与命定判定
    character.mjs      资源上限、移动力、伤害结算
  data/                TypeDataModel 数据结构（角色、NPC、各类物品）
  documents/           Actor / Item / Combatant 文档类
  dice/rolls.mjs       检定对话框、聊天卡片、伤害骰
  sheets/              ApplicationV2 角色卡与物品卡
  chat.mjs             聊天卡片按钮
  utils.mjs            v12 → v13 API 兼容层
templates/             Handlebars 模板
styles/trails.css      样式
lang/cn.json, en.json  语言文件
tests/                 Node 单元测试
```

## 接入 Foundry（Windows）

1. 在 foundryvtt.com 的 Purchased Licenses 页面，从版本下拉框选择 **Version 12**（12.343），下载并安装，首次启动时输入授权码。
2. 用目录联接把本仓库挂到 Foundry 的数据目录。**目录名必须是 `trails-of-destiny`**，与 `system.json` 里的 `id` 一致。在 PowerShell 中执行：

   ```powershell
   New-Item -ItemType Junction -Path "$env:LOCALAPPDATA\FoundryVTT\Data\systems\trails-of-destiny" -Target "D:\TRPG\Trials_cn\Trials_fvtt"
   ```

   如果你改过 Foundry 的数据路径，可以在启动界面的 Configuration 页查看「User Data Path」。
3. 重启 Foundry，Game Systems 列表中会出现「英雄传说：命之轨迹 TRPG（非官方）」。用它新建一个测试世界。
4. 在 Configure Settings → Language 中选择「中文（简体）」并重新加载，本系统的界面会变成中文。Foundry 核心界面需要另装简体中文翻译模块才会变成中文。

## 开发循环

- **改规则逻辑**（`module/rules/`）：先写测试，然后运行 `npm test`，几秒钟出结果，不需要启动 Foundry。
- **改 CSS、模板、语言文件**：`system.json` 已开启 hotReload，保存后 Foundry 会自动刷新。
- **改其他 JS**：在浏览器中按 F5 重新加载世界。
- **排错**：按 F12 打开控制台，查看以 `trails-of-destiny |` 开头的日志和报错。可以在控制台直接调用 `game.trails.rules.dice.actionPool({bonusDice: 3})` 等规则函数。

```bash
npm install   # 只需一次，用于模板编译测试
npm test
```

## 手动验收清单

在测试世界中依次检查：

1. 新建角色，把属性改为体魄 15、意志 13、灵魂 17 → 资源上限应为 耐久 28 / 生命 25 / 耐力 35 / 魔力 33 / EP 220。
2. 点击技能名 → 弹出对话框 → 掷骰，聊天卡片应显示骰池、VS 判定和爆发次数。
3. 新建武器（伤害值 2、普通品质、勾选加力量）→ 点 d20 图标攻击。选中一个 NPC 作为目标时，VS 应自动填为该 NPC 的防护值。
4. 命中后点「掷伤害」→ 选中 NPC 的 Token → 点「应用伤害」，检查耐久和生命值的扣减，以及负伤状态图标。
5. 防御反应应扣 5 耐力，抵抗反应应扣 5 魔力，资源不足时会给出提示。
6. 在天赋上添加主动效果「system.abilities.str.value / 加 / 2」并拖给角色 → 力量 +2，加值骰随之变化。
7. 战斗追踪器中掷先攻；角色负伤时，先攻的加值骰应降一阶。

## 规则存疑处

- 原书「魔力每级成长」缺少数字，暂按 4 处理（`module/rules/character.mjs` 中的 `PER_LEVEL`）。
- 属性加值表中「1-5 挑战 / 5-14 无」区间重叠；参照怪物数据块（属性 5 记 +0），按「低于 5 记挑战」处理。
- 核心技能的默认属性由本系统指定，规则书原文是由 GM 按情境决定，在角色卡上可以逐项修改。
