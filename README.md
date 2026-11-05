<p align="center">
  <b>English</b> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a>
</p>

# The Legend of Heroes: Trails of Destiny — Foundry VTT System

![Foundry VTT v12](https://img.shields.io/badge/Foundry_VTT-v12-orange)

An unofficial Foundry VTT game system for the *The Legend of Heroes: Trails of Destiny* tabletop RPG (Promethium System). Terms and rules follow the Chinese translation (V1.1). The interface is available in Simplified Chinese and English.

## Features

- **Character and adversary sheets**: ability bonus dice, core skills, resource maximums, Guard, Ward, Armor Rank and movement are calculated automatically.
- **Roll HUD**: a panel pops up in the bottom-right corner when you roll. Adjust Chances, bonus dice, Charges and Challenges with buttons and see the final formula update live. Effect rolls such as damage use the same panel.
- **Targets and cover**: selected targets are listed automatically, each with its own cover setting, VS and hit result.
- **Damage**: applied to Armor Rank, then Durability, then Health. Wounded, Shock and death are handled automatically, and every damage entry can be undone.
- **Destined**: entering Destined is detected automatically, and both Bloom Destiny options (+Dice and Beyond Legendary) are supported.
- **Token resource bars**: PC bars are visible to everyone, NPC bars only to their owners. With [Bar Brawl](https://foundryvtt.com/packages/barbrawl) enabled, new actors get Durability, Health, Vigor, Mana and Orbal Energy bars out of the box.

## Installation

Requires Foundry VTT **v12** (tested on 12.343).

1. On the Foundry setup screen, open **Game Systems** → **Install System**.
2. Paste the link below into **Manifest URL** at the bottom of the window and click **Install**:

   ```
   https://github.com/PigeonXiong/trials_fvtt/releases/latest/download/system.json
   ```

3. When creating a world, choose **英雄传说：命之轨迹 TRPG（非官方）** as the game system.

You can also download `trails-of-destiny.zip` from [Releases](https://github.com/PigeonXiong/trials_fvtt/releases) and extract it to `Data/systems/trails-of-destiny` in your Foundry data folder.

### Recommended modules

| Module | Purpose |
| --- | --- |
| [Bar Brawl](https://foundryvtt.com/packages/barbrawl) | Multiple token resource bars (optional). On Foundry v12, use version 1.8.x |
| Translation: 中文 [Core] | Simplified Chinese for Foundry's core interface. On Foundry v12, install version 12.331 from this manifest URL: `https://github.com/fvtt-cn/foundry_chn/releases/download/12.331/module.json`, and do not update it afterwards |

To switch the interface language, go to **Game Settings** → **Configure Settings** → **Language** in your world.

## Getting started

1. Create a **Character** (PC) or an **Adversary / NPC** in the Actors directory. Resource maximums are calculated from the ability scores you enter.
2. Click a skill name or a weapon's dice icon on the sheet. The roll HUD opens in the bottom-right corner; adjust it and click **Roll**.
3. Select targets on the scene before attacking, and the HUD lists them with their VS. On a hit, click **Roll Damage** on the chat card, then apply the damage to targets from the damage card.

## Not yet implemented

Orbment building, casting Orbal Arts, area templates for Crafts, entry points for non-damage effect rolls such as healing, weapon and armor quality interactions, the Shock countdown, and compendium content. Reactions against attacks are rolled manually.

For how the system handles rules that are ambiguous in the rulebook, see [Rulings](docs/rulings.md) (in Simplified Chinese).

## Feedback and development

Bug reports and suggestions are welcome in [Issues](https://github.com/PigeonXiong/trials_fvtt/issues). The development environment, project structure, roll flow extension points and release process are described in the [development notes](docs/development.md) (in Simplified Chinese).

## Legal

This is an unofficial fan project. It is not affiliated with or endorsed by Nihon Falcom Corporation or Promethium Books LLC.

*The Legend of Heroes* series © Nihon Falcom Corporation. *The Legend of Heroes: Trails of Destiny* TRPG © Promethium Books LLC. This repository does not include rulebook text or official artwork; please obtain the rulebook through official channels.
