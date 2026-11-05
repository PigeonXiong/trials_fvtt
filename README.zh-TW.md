<p align="center">
  <a href="README.md">简体中文</a> · <a href="README.en.md">English</a> · <b>繁體中文</b>
</p>

# 英雄傳說：命之軌跡 TRPG — Foundry VTT 系統

![Foundry VTT v12](https://img.shields.io/badge/Foundry_VTT-v12-orange)

《英雄傳說：命之軌跡》TRPG（*The Legend of Heroes: Trails of Destiny*，Promethium System）的非官方 Foundry VTT 遊戲系統。術語與規則以中文譯本 V1.1 為準，介面目前提供簡體中文與英文。

## 功能

- **角色卡與敵手卡**：屬性獎勵骰、核心技能、資源上限、物防、魔防、護甲等級與移動力自動計算。
- **檢定面板**：發起檢定後於畫面右下角彈出，用按鈕調整冒險、獎勵骰、蓄勢與挑戰，最終公式即時預覽；傷害等效應檢定使用同一面板。
- **目標與掩護**：自動帶入選取的目標，可逐一設定掩護，並顯示各自的 VS 與命中結果。
- **傷害結算**：依護甲 → 耐久 → 生命值扣減，自動處理負傷、休克與死亡，可一鍵復原。
- **命定**：自動判定進入命定，支援「綻放命運」的加骰與突破傳奇。
- **Token 資源條**：PC 的資源條對所有人可見，NPC 只對擁有者可見；啟用 [Bar Brawl](https://foundryvtt.com/packages/barbrawl) 後，新建角色自動配置耐久、生命值、活力、魔力與導力能量。

## 安裝

需要 Foundry VTT **v12**（已於 12.343 測試）。

1. 在 Foundry 啟動畫面開啟「遊戲系統（Game Systems）」→「安裝系統（Install System）」。
2. 在視窗底部的「清單網址（Manifest URL）」貼上下列連結，按「安裝（Install）」：

   ```
   https://github.com/PigeonXiong/trials_fvtt/releases/latest/download/system.json
   ```

3. 建立世界時，遊戲系統選擇「英雄传说：命之轨迹 TRPG（非官方）」。

也可以在 [Releases](https://github.com/PigeonXiong/trials_fvtt/releases) 頁面下載 `trails-of-destiny.zip`，解壓縮到 Foundry 資料目錄的 `Data/systems/trails-of-destiny`。

### 推薦模組

| 模組 | 用途 |
| --- | --- |
| [Bar Brawl](https://foundryvtt.com/packages/barbrawl) | 多條 Token 資源條（選用）。Foundry v12 請使用 1.8.x 版本 |
| Translation: 中文 [Core] | Foundry 核心介面的簡體中文翻譯。Foundry v12 請以清單網址安裝 12.331 版：`https://github.com/fvtt-cn/foundry_chn/releases/download/12.331/module.json`，安裝後不要按「更新」 |

進入世界後，可在「遊戲設定（Game Settings）」→「設定選項（Configure Settings）」→「語言（Language）」切換介面語言。

## 快速上手

1. 在角色目錄建立「角色」（PC）或「敵手 / NPC」，填寫屬性後資源上限會自動計算。
2. 點擊角色卡上的技能名稱或武器的骰子圖示，右下角會彈出檢定面板；調整後按「掷骰」（Roll）。
3. 攻擊前在場景中選取目標，面板會列出目標並計算 VS。命中後按聊天卡片上的「掷伤害」（Roll Damage），再於傷害卡片上將傷害套用到目標。

## 尚未實作

導力器構築、導力魔法施放、戰技範圍模板、治療等非傷害的效應檢定入口、武器與護甲的品質克制、休克倒數、合集包內容。反應與攻擊的對抗需要手動發起。

規則書中表述不明確之處，本系統的處理方式見[規則取捨](docs/rulings.md)（簡體中文）。

## 回饋與參與開發

歡迎在 [Issues](https://github.com/PigeonXiong/trials_fvtt/issues) 回報問題或提出建議。開發環境、目錄結構、檢定流程的擴充方式與發布流程見[開發說明](docs/development.md)（簡體中文）。

## 聲明

本專案為粉絲製作的非官方作品，與 Nihon Falcom Corporation、Promethium Books LLC 無關，亦未獲其認可。

《英雄傳說》系列 © Nihon Falcom Corporation。*The Legend of Heroes: Trails of Destiny* TRPG © Promethium Books LLC。本儲存庫不包含規則書文字與官方美術資源，請透過正規管道取得規則書。
