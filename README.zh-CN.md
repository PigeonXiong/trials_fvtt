<p align="center">
  <a href="README.md">English</a> · <b>简体中文</b> · <a href="README.zh-TW.md">繁體中文</a>
</p>

# 英雄传说：命之轨迹 TRPG — Foundry VTT 系统

![Foundry VTT v12](https://img.shields.io/badge/Foundry_VTT-v12-orange)

《英雄传说：命之轨迹》TRPG（*The Legend of Heroes: Trails of Destiny*，Promethium System）的非官方 Foundry VTT 游戏系统。术语与规则以中文译本 V1.1 为准，界面提供简体中文与英文。

## 功能

- **角色卡与敌手卡**：属性奖励骰、核心技能、资源上限、物防、魔防、护甲等级与移动力自动计算。
- **检定面板**：发起检定后在画面右下角弹出，用按钮调整冒险、奖励骰、蓄势与挑战，最终公式实时预览；伤害等效应检定使用同一面板。
- **目标与掩护**：自动带入选中的目标，可逐个设置掩护，并显示各自的 VS 与命中结果。
- **伤害结算**：按护甲 → 耐久 → 生命值扣减，自动处理负伤、休克与死亡，可一键撤销。
- **命定**：自动判定进入命定，支持「绽放命运」的加骰与突破传奇。
- **Token 资源条**：PC 的资源条对所有人可见，NPC 只对拥有者可见；启用 [Bar Brawl](https://foundryvtt.com/packages/barbrawl) 后，新建角色自动配好耐久、生命值、活力、魔力与导力能量。

## 安装

需要 Foundry VTT **v12**（已在 12.343 测试）。

1. 在 Foundry 启动界面打开「游戏系统」→「安装系统」。
2. 在窗口底部的「清单地址」中粘贴下面的链接，点「安装」：

   ```
   https://github.com/PigeonXiong/trials_fvtt/releases/latest/download/system.json
   ```

3. 新建世界时，游戏系统选择「The Legend of Heroes: Trails of Destiny (Unofficial)」。

也可以在 [Releases](https://github.com/PigeonXiong/trials_fvtt/releases) 页面下载 `trails-of-destiny.zip`，解压到 Foundry 数据目录的 `Data/systems/trails-of-destiny`。

### 推荐模组

| 模组 | 用途 |
| --- | --- |
| Translation: 中文 [Core] | Foundry 核心界面的简体中文翻译。Foundry v12 请用清单地址安装 12.331 版：`https://github.com/fvtt-cn/foundry_chn/releases/download/12.331/module.json`，安装后不要点「更新」 |
| [Bar Brawl](https://foundryvtt.com/packages/barbrawl) | 多条 Token 资源条（可选）。Foundry v12 请使用 1.8.x 版本 |

安装后进入世界，在「游戏设定」→「配置设定」→「语言」中选择中文。

## 快速上手

1. 在角色目录新建「角色」（PC）或「敌手 / NPC」，填写属性后资源上限会自动计算。
2. 点击角色卡上的技能名或武器的骰子图标，右下角会弹出检定面板；调整后点「掷骰」。
3. 攻击前在场景中选中目标，面板会列出目标并计算 VS。命中后点聊天卡片上的「掷伤害」，再在伤害卡片上把伤害应用到目标。

## 尚未实现

导力器构筑、导力魔法施放、战技范围模板、治疗等非伤害的效应检定入口、武器与护甲的品质克制、休克倒计时、合集包内容。反应与攻击的对抗需要手动发起。

规则书中表述不明确的地方，本系统的处理方式见 [规则取舍](docs/rulings.md)。

## 反馈与参与开发

欢迎在 [Issues](https://github.com/PigeonXiong/trials_fvtt/issues) 报告问题或提出建议。开发环境、目录结构、检定流程的扩展方式与发布流程见 [开发说明](docs/development.md)。

## 声明

本项目是粉丝制作的非官方作品，与 Nihon Falcom Corporation、Promethium Books LLC 无关，也未获得其认可。

《英雄传说》系列 © Nihon Falcom Corporation。*The Legend of Heroes: Trails of Destiny* TRPG © Promethium Books LLC。本仓库不包含规则书文本与官方美术资源，请通过正规渠道获取规则书。
