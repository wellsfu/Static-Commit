# FF14 出團時間調查系統 — 完整設計規劃文件

版本：v2.0  
日期：2026-04-24  
狀態：規劃中

---

## 目錄

1. [專案概述](#一專案概述)
2. [技術架構](#二技術架構)
3. [資訊架構與路由](#三資訊架構與路由)
4. [資料結構](#四資料結構firebase)
5. [頁面設計規格](#五頁面設計規格)
   - 5-1 首頁
   - 5-2 填寫頁
   - 5-3 總覽頁
6. [互動行為完整規格](#六互動行為完整規格)
7. [視覺設計系統](#七視覺設計系統)
8. [HTML 結構模板](#八html-結構模板)
9. [CSS 完整規格](#九css-完整規格)
10. [JavaScript 邏輯規格](#十javascript-邏輯規格)
11. [Firebase 設定步驟](#十一firebase-設定步驟)
12. [GitHub Pages 部署步驟](#十二github-pages-部署步驟)
13. [功能優先級與開發順序](#十三功能優先級與開發順序)
14. [邊界情況與錯誤處理](#十四邊界情況與錯誤處理)
15. [待確認事項](#十五待確認事項)

---

## 一、專案概述

### 背景
固定 8 人 FF14 副本小隊，每週需要確認所有人可出團時間。  
現況：使用 Google 試算表手動填寫時間，格式不統一、操作不便、手機體驗差。

### 目標
- 每週讓 8 名成員各自填寫可出團時間
- 系統自動整合顯示最佳出團時段
- 操作以手機為主，最快 30 秒內填完一週

### 核心設計原則
| 原則 | 說明 |
|------|------|
| 速度優先 | 最快 30 秒完成填寫 |
| 手機優先 | 所有互動以手指操作設計 |
| 零學習成本 | 不需帳號、不需教學，點名字直接開始 |
| 即時可見 | 填完立刻看到全隊整合狀況 |
| 彈性兼顧 | 快速勾選為主，精確調整為輔 |

### 成員名單（固定）
```
小六（萬能）、松坂（騎士）、提姆髒髒（白）、丸子、
麻麻（）、小白（毒蛇）、三富（詩人）、Rich（召喚）
```

---

## 二、技術架構

### 技術選型
```
前端：HTML5 + CSS3 + Vanilla JavaScript（無框架依賴）
資料：Firebase Firestore（NoSQL 雲端資料庫）
託管：GitHub Pages（靜態網站）
```

### 架構示意
```
使用者瀏覽器
    │
    ├── 載入 GitHub Pages 靜態檔案（HTML/CSS/JS）
    │
    └── JavaScript 呼叫 Firebase SDK
            │
            └── Firebase Firestore（Google 雲端）
                    └── 資料即時同步到所有使用者
```

### 為何選擇這個組合
- **Vanilla JS**：無 build 工具，直接開啟 HTML 即可開發，部署零配置
- **Firebase Firestore**：
  - 免費方案（Spark Plan）足夠此規模（每日讀取 50,000 次、寫入 20,000 次）
  - 即時同步（一人填完，其他人不需重新整理）
  - 無需自架伺服器
- **GitHub Pages**：免費、與 git 版本控制整合、支援自訂網域

---

## 三、資訊架構與路由

### 頁面清單
| 路徑 | 檔案 | 說明 |
|------|------|------|
| `/` | `index.html` | 首頁，選擇身份入口 |
| `/fill.html?member=小六` | `fill.html` | 填寫頁，帶 member 參數 |
| `/overview.html` | `overview.html` | 總覽頁，隊長查看用 |

### 路由邏輯
- 所有頁面為靜態 HTML，不需伺服器路由
- 成員身份透過 URL query string 傳遞（`?member=小六`）
- 週期 ID 格式：`YYYY-WNN`（例：`2026-W18`），由 JavaScript 自動計算當週

### 週期計算規則
```javascript
// 以每週一為週期起點，格式為 "YYYY-WNN"
function getCurrentWeekId() {
  const now = new Date();
  const monday = getMonday(now);       // 取當週一
  const year = monday.getFullYear();
  const weekNum = getISOWeekNumber(monday);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

// 週期顯示字串（如 "4/27（一）– 5/3（日）"）
function getWeekLabel(weekId) { ... }
```

---

## 四、資料結構（Firebase）

### 完整 Schema

```
Firestore 根目錄
└── weeks/                              ← 集合
      └── "2026-W18"/                  ← 文件（週期ID）
            ├── meta （文件欄位）
            │     ├── startDate: "2026-04-27"
            │     ├── endDate:   "2026-05-03"
            │     └── createdAt: Timestamp
            │
            └── members/               ← 子集合
                  └── "小六"/          ← 文件（成員名稱）
                        ├── updatedAt: Timestamp
                        └── days/      ← 子集合
                              └── "2026-04-27"/   ← 文件（日期）
                                    ├── unavailable: false
                                    └── slots: [   ← Array
                                          {
                                            start: "20:00",
                                            end:   "24:00"
                                          },
                                          {
                                            start: "13:00",
                                            end:   "17:00"
                                          }
                                        ]
```

### 重要規則
- `slots` 為陣列，支援多個不連續時段（例如下午和晚間都有空）
- `unavailable: true` 時，`slots` 應為空陣列
- 時間格式一律為 `"HH:MM"` 字串，24小時制
- 跨夜時間（凌晨）以 25:00、26:00 表示（不換日）
- 每個成員每週資料：7個day文件，每文件約 100 bytes，總量極小

### Firebase Security Rules（資料庫安全規則）
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 任何人可讀取（查看總覽不需身份驗證）
    match /weeks/{weekId}/{document=**} {
      allow read: if true;
      // 寫入：僅允許成員名單內的身份
      allow write: if request.auth == null &&
        request.resource.data.keys().hasOnly(['updatedAt', 'days']) == false
        || true; // MVP 階段先全開，後續再收緊
    }
  }
}
```

> **MVP 說明**：初期不做身份驗證，任何人知道連結都可填寫。若需防冒充，後續可加入簡單 PIN 碼機制（P2）。

---

## 五、頁面設計規格

### 5-1. 首頁（index.html）

**用途**：選擇身份入口，同時顯示本週填寫進度

**版面（手機 375px 寬）：**
```
┌─────────────────────────┐
│                         │  ← padding-top: 48px
│       ⚔️               │  ← icon 40px
│   本週出團調查           │  ← h1 24px
│  4/27（一）– 5/3（日）   │  ← subtitle 14px, 灰色
│                         │
│  ──────────────────     │
│                         │
│  誰是你？               │  ← section label 12px 大寫
│                         │
│  ┌────────┐ ┌────────┐  │
│  │  小六   │ │  松坂   │  │  ← 成員按鈕 2欄
│  │  萬能   │ │  騎士   │  │
│  └────────┘ └────────┘  │
│  ┌────────┐ ┌────────┐  │
│  │提姆髒髒 │ │  丸子   │  │
│  │   白   │ │        │  │
│  └────────┘ └────────┘  │
│  ┌────────┐ ┌────────┐  │
│  │  麻麻   │ │  小白   │  │
│  │        │ │  毒蛇   │  │
│  └────────┘ └────────┘  │
│  ┌────────┐ ┌────────┐  │
│  │  三富   │ │  Rich  │  │
│  │  詩人   │ │  召喚   │  │
│  └────────┘ └────────┘  │
│                         │
│  ──────────────────     │
│                         │
│  填寫狀態               │  ← section label
│  ████████░░  6 / 8 人   │  ← progress bar
│  未填：麻麻、Rich        │  ← 14px 橘色提示
│                         │
│ ┌─────────────────────┐ │
│ │   📊 查看本週總覽    │ │  ← 次要CTA，outline樣式
│ └─────────────────────┘ │
│                         │
└─────────────────────────┘
```

**成員按鈕規格：**
- 尺寸：`calc(50% - 8px)` 寬，高度 72px
- 內容：名字（18px bold）+ 職業（12px 灰色副標）
- 已填寫者：右上角顯示 ✅ 徽章（16px），按鈕邊框變綠
- 點擊後：導向 `fill.html?member={name}&week={weekId}`

**進度條規格：**
- 寬度 100%，高度 8px，圓角 4px
- 背景色 `--muted`，填充色 `--primary`
- 動態更新（Firebase onSnapshot 即時監聽）

---

### 5-2. 填寫頁（fill.html）

**用途**：成員填寫本週7天的可出團時間

**頂部導航：**
```
┌─────────────────────────┐
│ ←  小六的出團時間        │  ← 左箭頭返回首頁，名字動態顯示
│    ●●●●○○○  4/7 天      │  ← 7個圓點，已填=實心，未填=空心
└─────────────────────────┘
```

**每日卡片結構（重複7次）：**
```
┌─────────────────────────┐
│ 4/27（週一）            │  ← 日期標題 16px bold，左對齊
│                         │
│ ┌─ 無法出團 ──────────┐ │
│ │  ○                  │ │  ← toggle，右側為圓形開關
│ └─────────────────────┘ │
│                         │
│  選擇時段               │  ← 12px label，僅在非"無法出團"時顯示
│ ┌──────────┐┌──────────┐│
│ │  下午場   ││  傍晚場   ││  ← 預設時段按鈕，2欄
│ │  13–18時 ││  18–20時 ││
│ └──────────┘└──────────┘│
│ ┌──────────┐┌──────────┐│
│ │  晚間場   ││  深夜場   ││
│ │  20–24時 ││  24–26時 ││  ← 已選中：深色背景+邊框
│ └──────────┘└──────────┘│
│                         │
│ ┌─ 時間微調 ──────────┐ │  ← 僅有選取時段後才展開顯示
│ │ 開始  ←  [20:00]  → │ │
│ │ 結束  ←  [24:00]  → │ │
│ └─────────────────────┘ │
│                         │
│  已選：20:00 – 24:00    │  ← 確認文字，橘色，多段以逗號分隔
└─────────────────────────┘
```

**底部送出區：**
```
┌─────────────────────────┐
│  ⚠️ 尚有 3 天未填寫      │  ← 警示（還有未填天數時顯示）
│                         │
│  ┌─────────────────────┐│
│  │     ✅  確認送出     ││  ← 主要CTA，56px高，全寬
│  └─────────────────────┘│
└─────────────────────────┘
```

**預設時段定義（寫死在 JS 常數中）：**
```javascript
const PRESET_SLOTS = [
  {
    id: "afternoon",
    label: "下午場",
    sub: "13–18時",
    start: "13:00",
    end: "18:00"
  },
  {
    id: "evening",
    label: "傍晚場",
    sub: "18–20時",
    start: "18:00",
    end: "20:00"
  },
  {
    id: "night",
    label: "晚間場",
    sub: "20–24時",
    start: "20:00",
    end: "24:00"
  },
  {
    id: "late",
    label: "深夜場",
    sub: "24–26時",
    start: "24:00",
    end: "26:00"
  }
];
```

---

### 5-3. 總覽頁（overview.html）

**用途**：隊長查看整合結果，找最佳出團時間

**版面：**
```
┌──────────────────────────────────┐
│ 本週出團總覽                      │
│ 4/27（一）– 5/3（日）             │
│ 已填：6 / 8　未填：麻麻、Rich      │
├───────────────────────────────────┤
│ ← 按住拖動查看 →                  │  ← 橫向可滾動
│                                   │
│      13 15 17 19 21 23 01 03      │  ← 時間軸（每格2小時）
│ 週一 ░░ ░░ ░░ ░░ ██ ██ ██ ░░     │
│ 週二 ░░ ░░ ░░ ▓▓ ▓▓ ██ ░░ ░░     │
│ 週三 ░░ ░░ ░░ ██ ██ ██ ██ ░░     │
│ 週四 ░░ ░░ ░░ ██ ██ ██ ██ ██     │  ← 最亮 = 最多人
│ 週五 ░░ ▓▓ ▓▓ ░░ ▓▓ ██ ░░ ░░     │
│ 週六 ░░ ░░ ▓▓ ▓▓ ▓▓ ░░ ░░ ░░     │
│ 週日 ░░ ░░ ░░ ▓▓ ██ ██ ░░ ░░     │
│                                   │
│ ████ 7-8人  ▓▓ 4-6人  ░░ 1-3人   │
├───────────────────────────────────┤
│ 點任一格查看詳情 ↓                │
│                                   │
│ 週四 21:00–22:00　　7人有空       │  ← 點格子後展開
│ ✅ 小六　✅ 松坂　✅ 提姆髒髒      │
│ ✅ 丸子　✅ 小白　✅ 三富　✅ Rich │
│ ❌ 麻麻（未填寫）                 │
└───────────────────────────────────┘
```

**熱力圖規格：**
- 橫軸：時間（13:00 – 26:00，每格代表 30 分鐘，共 26 格）
- 縱軸：週一至週日，共 7 列
- 每格計算方式：統計該時段有幾人的 slots 包含此時間點
- 格子尺寸：最小 32×32px，橫向可滾動

**色階定義：**
```
0 人 → #1A1A2E（幾乎與背景同色）
1–2人 → #2D2B55
3–4人 → #4A3F8A
5–6人 → #6B5FD4
7–8人 → #7B6CF6（最亮紫色）
```

---

## 六、互動行為完整規格

### 6-1. 無法出團 Toggle

| 事件 | 行為 |
|------|------|
| 點擊（OFF → ON） | Toggle 變紅色，下方「選擇時段」區塊以動畫淡出隱藏（opacity 0 + height 0，300ms ease），已選時段清空 |
| 點擊（ON → OFF） | Toggle 恢復，「選擇時段」區塊淡入顯示 |
| 狀態持久 | 每次操作立即更新本地狀態（不自動儲存，送出時才寫入 Firebase） |

### 6-2. 預設時段色塊

| 事件 | 行為 |
|------|------|
| 點擊（未選 → 選中） | 色塊背景變深色（`--primary`），邊框加亮，勾選圖示出現（右上角），微調區展開，「已選」文字更新 |
| 點擊（選中 → 未選） | 色塊恢復未選樣式，若無其他選中色塊則微調區收起 |
| 多選行為 | 可同時選多個色塊（例如「下午場」+「晚間場」），每個色塊各自有微調區 |
| 「傍晚場」+「晚間場」同時選 | 系統不自動合併，分別儲存為兩個 slot |

### 6-3. 時間微調

每個已選色塊底下展開一個微調行：

```
開始時間：  [←]  [20:00]  [→]
結束時間：  [←]  [24:00]  [→]
```

| 元件 | 行為 |
|------|------|
| `[←]` 按鈕 | 時間 -30 分鐘 |
| `[→]` 按鈕 | 時間 +30 分鐘 |
| 時間數字 `[20:00]` | 點擊後調用原生 `<input type="time">` 時間選擇器（彈出），選完後更新顯示 |
| 時間上限 | 開始時間最早 06:00，結束時間最晚 30:00（06:00 次日表示） |
| 驗證 | 若開始時間 ≥ 結束時間，箭頭按鈕禁用，數字顯示紅色 |
| 跨夜顯示 | 25:00 顯示為「01:00+1」或直接顯示 25:00（保持一致即可，以 25:00 為標準） |

**±30分鐘計算邏輯：**
```javascript
// 時間以分鐘數儲存（方便計算），顯示時轉回 HH:MM
function addMinutes(timeStr, delta) {
  const [h, m] = timeStr.split(':').map(Number);
  let total = h * 60 + m + delta;
  total = Math.max(6 * 60, Math.min(30 * 60, total)); // 限制範圍
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}
```

### 6-4. 送出按鈕

| 狀態 | 說明 |
|------|------|
| 正常可點 | 所有7天皆有資料（無法出團 or 至少一個時段） |
| 部分填寫 | 按鈕仍可點，但顯示「⚠️ 尚有 N 天未填」警示，點擊後彈出確認對話框「確定只送出已填的天數嗎？」 |
| 送出中 | 按鈕禁用，顯示 loading spinner |
| 送出成功 | 跳轉到確認頁（或顯示 inline 成功訊息），顯示「已記錄！目前 N/8 人完成」 |
| 送出失敗 | 顯示錯誤訊息「儲存失敗，請確認網路後重試」，按鈕恢復可點 |

### 6-5. 熱力圖點擊（總覽頁）

| 事件 | 行為 |
|------|------|
| 點擊格子 | 底部展開詳情面板（slide up，300ms） |
| 詳情內容 | 顯示該時段的所有成員狀態（✅有空 / ❌無法出團 / ⬜未填寫） |
| 再次點擊同格 | 收起詳情面板 |
| 點擊其他格 | 切換詳情到新格子 |

### 6-6. 頁面進度圓點（填寫頁頂部）

```
●●●●○○○  4/7 天
```
- 7 個圓點，對應7天
- 已有資料（無論無法出團或有時段）= 實心 ●（`--primary` 色）
- 無資料 = 空心 ○（`--muted` 色）
- 點擊圓點可快速捲動到對應日期卡片

---

## 七、視覺設計系統

### 7-1. 色彩變數（CSS Custom Properties）

```css
:root {
  /* === 背景 === */
  --bg-base:          #0F0F1A;   /* 主背景，深藍黑 */
  --bg-card:          #1A1A2E;   /* 卡片/區塊背景 */
  --bg-card-hover:    #222240;   /* 卡片 hover 狀態 */
  --bg-input:         #252545;   /* 輸入框背景 */

  /* === 主色 === */
  --primary:          #7B6CF6;   /* 主紫色（選中、CTA） */
  --primary-light:    #9D8FFF;   /* hover/focus 狀態 */
  --primary-dim:      #3D3480;   /* 選中色塊背景（較深） */

  /* === 狀態色 === */
  --success:          #4ADE80;   /* 有空、已完成 */
  --success-dim:      #166534;   /* 成功狀態背景 */
  --danger:           #EF4444;   /* 無法出團、錯誤 */
  --danger-dim:       #7F1D1D;   /* 危險狀態背景 */
  --warning:          #FACC15;   /* 警示 */
  --warning-dim:      #713F12;   /* 警示背景 */

  /* === 中性色 === */
  --muted:            #374151;   /* 未選/禁用 */
  --border:           #2D2D4A;   /* 邊框 */
  --divider:          #1F1F35;   /* 分隔線 */

  /* === 文字 === */
  --text-primary:     #F9FAFB;   /* 主要文字 */
  --text-secondary:   #9CA3AF;   /* 次要文字（副標、說明） */
  --text-muted:       #4B5563;   /* 更淡（時間軸標籤） */
  --text-danger:      #FCA5A5;   /* 錯誤文字 */

  /* === 熱力圖色階 === */
  --heat-0:           #1A1A2E;   /* 0人 */
  --heat-1:           #2D2B55;   /* 1–2人 */
  --heat-2:           #4A3F8A;   /* 3–4人 */
  --heat-3:           #6B5FD4;   /* 5–6人 */
  --heat-4:           #7B6CF6;   /* 7–8人（全員） */
}
```

### 7-2. 字型

```css
/* 引入字型（在 <head> 中） */
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">

body {
  font-family: 'Noto Sans TC', system-ui, -apple-system, sans-serif;
}

/* 時間數字必須等寬（對齊用） */
.time-value {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
  letter-spacing: 0.02em;
}
```

### 7-3. 字級系統

```css
--text-xs:   12px;   /* 標籤、徽章 */
--text-sm:   14px;   /* 次要文字、說明 */
--text-base: 16px;   /* 正文 */
--text-lg:   18px;   /* 強調文字、成員名 */
--text-xl:   24px;   /* 頁面標題 */
--text-2xl:  32px;   /* 大標題（首頁） */
```

### 7-4. 間距系統

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
```

### 7-5. 圓角

```css
--radius-sm:  6px;    /* 小元件（標籤、徽章） */
--radius-md:  10px;   /* 按鈕、輸入框 */
--radius-lg:  14px;   /* 卡片 */
--radius-xl:  20px;   /* 底部面板 */
--radius-full: 9999px; /* 膠囊形、圓點 */
```

### 7-6. 觸控規格

```css
/* 所有可點擊元素必須滿足最小觸控目標 */
.touchable {
  min-width:  48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 成員按鈕（首頁）*/
.member-btn {
  width: calc(50% - 6px);
  height: 72px;
}

/* 預設時段色塊 */
.preset-slot-btn {
  width: calc(50% - 6px);
  height: 64px;
}

/* 微調箭頭 */
.time-adj-btn {
  width:  48px;
  height: 48px;
}
```

### 7-7. 動畫

```css
/* 標準過渡 */
--transition-fast:   150ms ease;
--transition-base:   300ms ease;
--transition-slow:   500ms ease;

/* 展開/收起區塊 */
.collapsible {
  transition: opacity var(--transition-base),
              max-height var(--transition-base);
  overflow: hidden;
}
.collapsible.hidden {
  opacity: 0;
  max-height: 0;
}
.collapsible.visible {
  opacity: 1;
  max-height: 400px; /* 足夠大的值 */
}
```

---

## 八、HTML 結構模板

### 8-1. 共用 head 模板

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta name="theme-color" content="#0F0F1A">
  <title>出團調查 — FF14</title>

  <!-- 防止手機雙擊縮放 -->
  <meta name="format-detection" content="telephone=no">

  <!-- CSS -->
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/components.css">
  <link rel="stylesheet" href="css/[page].css">

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">
</head>
```

### 8-2. 首頁結構（index.html）

```html
<body>
  <main class="page-home">
    <!-- 頁首 -->
    <header class="home-header">
      <span class="home-icon">⚔️</span>
      <h1 class="home-title">本週出團調查</h1>
      <p class="home-subtitle" id="weekLabel">載入中...</p>
    </header>

    <!-- 成員選擇 -->
    <section class="section">
      <h2 class="section-label">誰是你？</h2>
      <div class="member-grid" id="memberGrid">
        <!-- 由 JS 動態生成 -->
      </div>
    </section>

    <!-- 填寫狀態 -->
    <section class="section">
      <div class="fill-status">
        <div class="fill-status__label">
          <span>填寫狀態</span>
          <span id="fillCount">0 / 8 人</span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar__fill" id="progressFill" style="width: 0%"></div>
        </div>
        <p class="fill-status__missing" id="missingMembers"></p>
      </div>
    </section>

    <!-- 總覽入口 -->
    <section class="section">
      <a href="overview.html" class="btn btn--outline btn--full">
        📊 查看本週總覽
      </a>
    </section>
  </main>

  <!-- Firebase SDK -->
  <script type="module" src="js/firebase.js"></script>
  <script type="module" src="js/index.js"></script>
</body>
```

### 8-3. 填寫頁結構（fill.html）

```html
<body>
  <!-- 頂部導航 -->
  <nav class="fill-nav">
    <a href="index.html" class="fill-nav__back">←</a>
    <span class="fill-nav__title" id="memberName">載入中...</span>
    <div class="fill-nav__dots" id="progressDots">
      <!-- 7個圓點，由JS生成 -->
    </div>
  </nav>

  <main class="page-fill">
    <!-- 日期卡片容器，由JS動態生成 -->
    <div id="dayCardsContainer"></div>

    <!-- 底部送出 -->
    <div class="submit-area">
      <p class="submit-warning" id="submitWarning"></p>
      <button class="btn btn--primary btn--full btn--lg" id="submitBtn">
        ✅ 確認送出
      </button>
    </div>
  </main>

  <script type="module" src="js/firebase.js"></script>
  <script type="module" src="js/fill.js"></script>
</body>
```

**JS 動態生成的日期卡片（每天一個）：**

```html
<!-- 以下為 JS 生成的 HTML 模板（template literal） -->
<article class="day-card" data-date="2026-04-27" id="day-2026-04-27">
  <h3 class="day-card__title">4/27（週一）</h3>

  <!-- 無法出團 -->
  <label class="unavailable-toggle">
    <span>無法出團</span>
    <div class="toggle-switch">
      <input type="checkbox" class="toggle-input" data-field="unavailable">
      <span class="toggle-thumb"></span>
    </div>
  </label>

  <!-- 時段選擇區（無法出團時隱藏） -->
  <div class="slot-section collapsible visible">
    <p class="slot-section__label">選擇時段（可多選）</p>

    <div class="preset-grid">
      <button class="preset-btn" data-slot-id="afternoon">
        <span class="preset-btn__name">下午場</span>
        <span class="preset-btn__time">13–18時</span>
        <span class="preset-btn__check">✓</span>
      </button>
      <button class="preset-btn" data-slot-id="evening">
        <span class="preset-btn__name">傍晚場</span>
        <span class="preset-btn__time">18–20時</span>
        <span class="preset-btn__check">✓</span>
      </button>
      <button class="preset-btn" data-slot-id="night">
        <span class="preset-btn__name">晚間場</span>
        <span class="preset-btn__time">20–24時</span>
        <span class="preset-btn__check">✓</span>
      </button>
      <button class="preset-btn" data-slot-id="late">
        <span class="preset-btn__name">深夜場</span>
        <span class="preset-btn__time">24–26時</span>
        <span class="preset-btn__check">✓</span>
      </button>
    </div>

    <!-- 微調區（選中時段後展開） -->
    <div class="adj-section collapsible hidden" id="adj-2026-04-27">
      <!-- 每個選中的時段各自一行微調，由JS動態插入 -->
      <!-- 範例： -->
      <div class="time-adj-row" data-slot-id="night">
        <span class="time-adj-row__label">晚間場</span>
        <div class="time-adj">
          <button class="time-adj-btn" data-field="start" data-delta="-30">←</button>
          <button class="time-value" data-field="start">20:00</button>
          <button class="time-adj-btn" data-field="start" data-delta="+30">→</button>
        </div>
        <span class="time-adj-row__sep">–</span>
        <div class="time-adj">
          <button class="time-adj-btn" data-field="end" data-delta="-30">←</button>
          <button class="time-value" data-field="end">24:00</button>
          <button class="time-adj-btn" data-field="end" data-delta="+30">→</button>
        </div>
      </div>
    </div>

    <!-- 已選摘要 -->
    <p class="slot-summary" id="summary-2026-04-27"></p>
  </div>
</article>
```

---

## 九、CSS 完整規格

### base.css

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-tap-highlight-color: transparent; /* 手機點擊無灰框 */
}

html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
}

body {
  background-color: var(--bg-base);
  color: var(--text-primary);
  font-family: 'Noto Sans TC', system-ui, sans-serif;
  min-height: 100dvh;             /* 手機動態視窗高度 */
  padding-bottom: env(safe-area-inset-bottom); /* iPhone 底部安全區 */
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  color: inherit;
}

img, svg {
  display: block;
  max-width: 100%;
}
```

### components.css（通用元件）

```css
/* === 容器 === */
.container {
  max-width: 480px;    /* 手機最大寬度限制 */
  margin: 0 auto;
  padding: 0 var(--space-4);
}

/* === 按鈕 === */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 500;
  transition: all var(--transition-fast);
  min-height: 48px;
  cursor: pointer;
}

.btn--primary {
  background: var(--primary);
  color: white;
}
.btn--primary:active {
  background: var(--primary-light);
  transform: scale(0.98);
}

.btn--outline {
  border: 1.5px solid var(--border);
  color: var(--text-secondary);
}
.btn--outline:active {
  border-color: var(--primary);
  color: var(--primary);
}

.btn--full   { width: 100%; }
.btn--lg     { min-height: 56px; font-size: var(--text-lg); }

/* === 進度條 === */
.progress-bar {
  height: 8px;
  background: var(--muted);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.progress-bar__fill {
  height: 100%;
  background: var(--primary);
  border-radius: var(--radius-full);
  transition: width var(--transition-base);
}

/* === 卡片 === */
.card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  border: 1px solid var(--border);
}

/* === Toggle 開關 === */
.toggle-switch {
  position: relative;
  width: 48px;
  height: 28px;
}
.toggle-input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}
.toggle-thumb {
  position: absolute;
  inset: 0;
  background: var(--muted);
  border-radius: var(--radius-full);
  transition: background var(--transition-fast);
  cursor: pointer;
}
.toggle-thumb::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  top: 4px;
  left: 4px;
  transition: transform var(--transition-fast);
}
.toggle-input:checked + .toggle-thumb {
  background: var(--danger);
}
.toggle-input:checked + .toggle-thumb::after {
  transform: translateX(20px);
}

/* === Section === */
.section {
  padding: var(--space-6) var(--space-4);
}
.section-label {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: var(--space-3);
}
```

---

## 十、JavaScript 邏輯規格

### 10-1. 常數定義（constants.js）

```javascript
export const MEMBERS = [
  { id: "小六",    name: "小六",    role: "萬能" },
  { id: "松坂",    name: "松坂",    role: "騎士" },
  { id: "提姆髒髒", name: "提姆髒髒", role: "白魔" },
  { id: "丸子",    name: "丸子",    role: "" },
  { id: "麻麻",    name: "麻麻",    role: "" },
  { id: "小白",    name: "小白",    role: "毒蛇" },
  { id: "三富",    name: "三富",    role: "詩人" },
  { id: "Rich",    name: "Rich",    role: "召喚" },
];

export const PRESET_SLOTS = [
  { id: "afternoon", label: "下午場", sub: "13–18時", start: "13:00", end: "18:00" },
  { id: "evening",   label: "傍晚場", sub: "18–20時", start: "18:00", end: "20:00" },
  { id: "night",     label: "晚間場", sub: "20–24時", start: "20:00", end: "24:00" },
  { id: "late",      label: "深夜場", sub: "24–26時", start: "24:00", end: "26:00" },
];

export const TIME_MIN = 6 * 60;   // 06:00 最早
export const TIME_MAX = 30 * 60;  // 30:00 最晚（凌晨6點）
export const TIME_STEP = 30;      // 每次微調30分鐘
```

### 10-2. 日期工具（utils.js）

```javascript
// 取得當週週一的日期
export function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // 週日要往回6天
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 產生週ID，格式 "2026-W18"
export function getWeekId(date = new Date()) {
  const monday = getMonday(date);
  const year = monday.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const weekNum = Math.ceil(
    ((monday - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

// 產生該週7天的日期陣列（週一到週日）
export function getWeekDates(weekId) {
  // 從 weekId 反推週一日期，返回7個 Date 物件
  // ...（實作細節）
  return dates; // [Date, Date, Date, Date, Date, Date, Date]
}

// 格式化日期顯示：Date → "4/27（週一）"
export function formatDateLabel(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  return `${month}/${day}（週${dayNames[date.getDay()]}）`;
}

// 時間字串轉分鐘數："20:30" → 1230
export function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// 分鐘數轉時間字串：1230 → "20:30"
export function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
```

### 10-3. Firebase 資料存取（data.js）

```javascript
import { db } from './firebase.js';
import { doc, getDoc, setDoc, collection, getDocs, onSnapshot, serverTimestamp }
  from 'firebase/firestore';

// 讀取特定成員特定週的所有日期資料
export async function getMemberWeekData(weekId, memberId) {
  const daysRef = collection(db, 'weeks', weekId, 'members', memberId, 'days');
  const snapshot = await getDocs(daysRef);
  const result = {};
  snapshot.forEach(doc => {
    result[doc.id] = doc.data(); // { unavailable, slots }
  });
  return result;
}

// 儲存成員填寫結果（整週一次寫入）
export async function saveMemberWeekData(weekId, memberId, daysData) {
  // daysData 格式：{ "2026-04-27": { unavailable: false, slots: [...] }, ... }
  const batch = [];
  for (const [date, data] of Object.entries(daysData)) {
    const dayRef = doc(db, 'weeks', weekId, 'members', memberId, 'days', date);
    batch.push(setDoc(dayRef, data));
  }
  // 更新 member 文件的 updatedAt
  const memberRef = doc(db, 'weeks', weekId, 'members', memberId);
  batch.push(setDoc(memberRef, { updatedAt: serverTimestamp() }, { merge: true }));
  await Promise.all(batch);
}

// 即時監聽所有成員填寫狀態（首頁用）
export function watchWeekStatus(weekId, callback) {
  const membersRef = collection(db, 'weeks', weekId, 'members');
  return onSnapshot(membersRef, snapshot => {
    const filledMembers = snapshot.docs.map(d => d.id);
    callback(filledMembers);
  });
}

// 讀取全週所有成員所有資料（總覽頁用）
export async function getFullWeekData(weekId) {
  // 返回格式：
  // {
  //   "小六": { "2026-04-27": { unavailable, slots }, ... },
  //   "松坂": { ... },
  //   ...
  // }
}
```

### 10-4. 熱力圖計算邏輯（overview.js）

```javascript
// 計算特定時間點（分鐘）有幾人可出團
function countAvailableAt(fullWeekData, dateStr, minutePoint) {
  let count = 0;
  for (const member of MEMBERS) {
    const dayData = fullWeekData[member.id]?.[dateStr];
    if (!dayData || dayData.unavailable) continue;
    for (const slot of dayData.slots) {
      const start = timeToMinutes(slot.start);
      const end = timeToMinutes(slot.end);
      if (minutePoint >= start && minutePoint < end) {
        count++;
        break;
      }
    }
  }
  return count;
}

// 建立熱力圖資料（二維陣列）
function buildHeatmapData(fullWeekData, weekDates) {
  const TIME_START = 13 * 60; // 13:00
  const TIME_END = 27 * 60;   // 27:00（凌晨3點）
  const CELL_MINUTES = 30;    // 每格30分鐘

  return weekDates.map(date => {
    const dateStr = formatDateISO(date);
    const row = [];
    for (let t = TIME_START; t < TIME_END; t += CELL_MINUTES) {
      row.push(countAvailableAt(fullWeekData, dateStr, t));
    }
    return row;
  });
}

// 人數 → 熱力色
function heatColor(count) {
  if (count === 0) return 'var(--heat-0)';
  if (count <= 2)  return 'var(--heat-1)';
  if (count <= 4)  return 'var(--heat-2)';
  if (count <= 6)  return 'var(--heat-3)';
  return 'var(--heat-4)';
}
```

---

## 十一、Firebase 設定步驟

### 步驟一：建立 Firebase 專案

1. 前往 [https://console.firebase.google.com](https://console.firebase.google.com)
2. 點「建立專案」→ 專案名稱輸入 `ff14-raid-scheduler`
3. 關閉 Google Analytics（非必要）→ 點「建立專案」

### 步驟二：啟用 Firestore

1. 左側選單 → 「建構」→「Firestore Database」
2. 點「建立資料庫」
3. 選「以測試模式啟動」（先開放讀寫，上線後再收緊）
4. 選擇區域：`asia-east1`（台灣最近）→ 完成

### 步驟三：取得 Web 設定

1. 專案主頁 → 點齒輪「專案設定」
2. 「您的應用程式」區塊 → 點 `</>` 網頁圖示
3. 應用程式暱稱：`raid-web` → 點「註冊應用程式」
4. 複製 `firebaseConfig` 物件（含 apiKey、authDomain 等）

### 步驟四：建立 firebase.js

```javascript
// js/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "ff14-raid-scheduler.firebaseapp.com",
  projectId:         "ff14-raid-scheduler",
  storageBucket:     "ff14-raid-scheduler.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

> **注意**：`apiKey` 是公開的，Firebase 的安全性靠 Security Rules 控制，不靠隱藏 apiKey。  
> 因此可以直接 commit 到 GitHub（公開 repo 亦可）。

### 步驟五：設定 Security Rules

Firestore 主控台 → 「規則」→ 貼上以下規則：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /weeks/{weekId}/{document=**} {
      allow read: if true;   // 任何人可讀
      allow write: if true;  // MVP 先全開（後續可加 PIN 碼驗證）
    }
  }
}
```

---

## 十二、GitHub Pages 部署步驟

### 步驟一：建立 Repository

```bash
# 在本機
mkdir raid-scheduler
cd raid-scheduler
git init
git remote add origin https://github.com/[你的帳號]/raid-scheduler.git
```

### 步驟二：檔案結構

```
raid-scheduler/
├── index.html
├── fill.html
├── overview.html
├── css/
│   ├── base.css
│   ├── components.css
│   ├── fill.css
│   └── overview.css
├── js/
│   ├── constants.js
│   ├── utils.js
│   ├── firebase.js       ← 填入 firebaseConfig
│   ├── data.js
│   ├── index.js
│   ├── fill.js
│   └── overview.js
└── assets/
    └── icon.svg
```

### 步驟三：推送並啟用 Pages

```bash
git add .
git commit -m "init raid scheduler"
git push -u origin main
```

1. GitHub → 你的 repo → 「Settings」→「Pages」
2. Source：選「Deploy from a branch」
3. Branch：選 `main` / `(root)` → 點「Save」
4. 等 1–2 分鐘後，網址顯示在頁面頂部

最終網址格式：`https://[帳號].github.io/raid-scheduler/`

---

## 十三、功能優先級與開發順序

### P0（MVP，必做）
- [ ] 首頁成員選擇 + 導向填寫頁
- [ ] 填寫頁：無法出團 toggle
- [ ] 填寫頁：預設時段色塊快選（可多選）
- [ ] 填寫頁：微調 ±30 分鐘
- [ ] 填寫頁：送出到 Firebase
- [ ] 首頁填寫狀態即時更新
- [ ] 總覽頁：熱力圖渲染

### P1（第二迭代）
- [ ] 填寫頁：點時間數字 → 精確輸入（原生 time picker）
- [ ] 總覽頁：點格子查看誰有空
- [ ] 首頁：已填成員按鈕加 ✅ 徽章
- [ ] 填寫頁：進度圓點點擊捲動
- [ ] 填寫頁：送出後跳確認畫面
- [ ] 填寫後可返回修改（覆蓋寫入）

### P2（後續增強）
- [ ] 隊長可標記「本週出團時間」並顯示公告
- [ ] 簡易 PIN 碼防止冒充（每人設一組4位數）
- [ ] 每週自動建立新週期（或由隊長手動開啟）
- [ ] 歷史出團紀錄查看

### 開發時程建議

```
Day 1：靜態骨架
  → 三頁 HTML 完成，CSS 視覺正確（無邏輯）
  → 在瀏覽器開啟確認手機版面

Day 2：填寫互動
  → 預設時段選取邏輯
  → 微調邏輯（±30分鐘）
  → 無法出團 toggle

Day 3：Firebase 整合
  → 設定 Firebase 專案
  → 實作 data.js 讀寫
  → 填寫頁送出功能

Day 4：首頁 + 總覽頁
  → 首頁即時狀態監聽
  → 熱力圖渲染

Day 5：測試與修正
  → 部署 GitHub Pages
  → 實際手機測試（多人同時填寫）
  → 修 bug
```

---

## 十四、邊界情況與錯誤處理

| 情況 | 處理方式 |
|------|---------|
| 部分天數未填就點送出 | 彈出確認「確定送出未完整的填寫？未填日期將視為『待定』」|
| 開始時間 ≥ 結束時間 | 顯示紅色錯誤文字「結束時間必須晚於開始時間」，禁用送出 |
| Firebase 連線失敗 | 顯示「無法連線，請確認網路後重試」，保留本地填寫狀態 |
| 成員重複送出（修改） | 覆蓋寫入，顯示「已更新你的回覆」 |
| 手機字體縮放 | `viewport` 設 `maximum-scale=1.0` 防止表單自動縮放 |
| iPhone 底部 Home Bar | `padding-bottom: env(safe-area-inset-bottom)` |
| 跨午夜時間顯示 | 25:00 顯示為「25:00」，不轉換成「01:00+1」（避免混淆） |
| 「傍晚場」結束 = 「晚間場」開始 | 視為兩個獨立時段，不合併（計算時連續視為有效） |
| 空週（無任何人填寫） | 熱力圖全灰，顯示「本週尚無人填寫」提示 |
| 全員無法出團某天 | 熱力圖該日全灰，點擊顯示「全員無法出團」 |

---

## 十五、待確認事項

在開始實作前，需請隊長確認以下項目：

- [ ] **週期起算日**：目前規劃以週一為起點，是否正確？
- [ ] **顯示時間範圍**：熱力圖規劃顯示 13:00–27:00，是否符合實際需求？
- [ ] **跨夜表示法**：凌晨時段用 25:00/26:00 表示，成員是否都能理解？
- [ ] **修改機制**：填寫後是否需要可以回來修改？（P1 功能，預設支援）
- [ ] **Firebase 帳號**：由誰建立並持有 Firebase 專案？
- [ ] **GitHub repo 存放**：公開 repo 還是私有 repo？（Pages 免費版需公開）
- [ ] **防冒充機制**：MVP 階段是否接受無身份驗證（任何人知道連結都可填）？
- [ ] **通知機制**：隊長確定出團時間後，如何通知其他人？（目前規劃 P2，可先用手動截圖分享）
