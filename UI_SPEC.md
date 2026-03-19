# 虾学日语歌 · UI 与功能完整规格文档

> 版本 v1.0 · 2026-03-17
> 用途：微信小程序迁移参考，完整描述当前 Web 端所有 UI 细节与交互逻辑

---

## 目录

1. [全局设计系统](#1-全局设计系统)
2. [整体布局结构](#2-整体布局结构)
3. [顶部导航栏（Header）](#3-顶部导航栏)
4. [左侧边栏（Sidebar）](#4-左侧边栏)
5. [主内容区](#5-主内容区)
6. [新建歌曲弹窗（Input Modal）](#6-新建歌曲弹窗)
   - 6a. 搜索歌曲标签页
   - 6b. 粘贴歌词标签页
7. [歌词解析结果区](#7-歌词解析结果区)
8. [歌词行卡片（LyricLineCard）](#8-歌词行卡片)
9. [语法解析卡片（GrammarCard）](#9-语法解析卡片)
10. [音频播放器](#10-音频播放器)
11. [欢迎弹窗（Welcome Modal）](#11-欢迎弹窗)
12. [积分兑换弹窗（Redeem Modal）](#12-积分兑换弹窗)
13. [数据流与状态管理](#13-数据流与状态管理)
14. [积分系统逻辑](#14-积分系统逻辑)
15. [本地存储结构](#15-本地存储结构)
16. [动画与过渡规格](#16-动画与过渡规格)
17. [字体与文字排版](#17-字体与文字排版)
18. [API 接口说明](#18-api-接口说明)

---

## 1. 全局设计系统

### 1.1 颜色系统

| 用途 | 颜色值 | 说明 |
|------|--------|------|
| 页面背景 | `#0f0f0f` | 最深黑色 |
| 卡片背景 | `#1a1a1a` | 内容卡片 |
| 侧边栏背景 | `#111111` | 比页面稍亮 |
| 语法卡片背景 | `#141414` | 语法区块 |
| 输入框背景 | `#111111` | 同侧边栏 |
| 语法子背景 | `#161616` | 侧边栏语法项 |
| 悬停背景 | `#1c1c1c` | 语法卡片 hover |
| 次级悬停 | `#1e1e1e` | 侧边栏项 hover |
| 强调悬停 | `#252525` | 按钮/示例 hover |
| 活跃行背景 | `#1f1d18` | 当前播放行背景 |
| 主边框 | `#2e2e2e` | 卡片/分割线 |
| 次级边框 | `#2a2a2a` | 内部分割线 |
| 三级边框 | `#272727` | 语法卡片边框 |
| 四级边框 | `#252525` | 搜索结果项边框 |
| 活跃边框 | `rgba(238,193,112,0.45)` | 当前播放行边框 |

**主题色：**

| 颜色名 | 色值 | 用途 |
|--------|------|------|
| Coral（珊瑚红） | `#E8634A` | 主按钮、Logo、强调 |
| 深珊瑚红 | `#cf4f38` | 主按钮渐变结束色 |
| 珊瑚橙 | `#f0956c` | 进度条、振假名（furigana）|
| 琥珀黄 | `#EEC170` | 当前行高亮、积分标志 |
| 青色 | `#38BCD4` | 搜索按钮、链接、输入聚焦、"输入歌词"标签 |
| 主文字 | `#f0f0f0` | 正文、歌词文字 |
| 次文字 | `#aaa` | 次级内容 |
| 暗文字 | `#888` | 罗马字、说明文字 |
| 占位符色 | `#666` | 表单占位符 |
| 禁用文字 | `#555` | 禁用状态、分割线文字 |
| 极暗文字 | `#444` | 时间戳、辅助信息 |
| 最暗文字 | `#333` | 行号、字符计数 |
| 活跃侧边栏项 | `#EEC170` | 当前歌曲名、▶ 图标 |
| 置顶边框 | `#e85d4a` | 置顶项左侧竖线 |
| 置顶背景 | `rgba(232,93,74,0.06)` | 置顶项背景 |

**词性颜色（POS Color Map）：**

| 词性 | 颜色 |
|------|------|
| 动词 | `#4A90E8`（蓝） |
| 名词 | `#E8634A`（珊瑚红） |
| 形容词 / 形容动词 | `#9B59B6`（紫） |
| 副词 | `#27AE60`（绿） |
| 数词 | `#E67E22`（橙） |
| 助词 / 接续词 | `#38BCD4`（青） |
| 感叹词 | `#E8634A`（珊瑚红） |
| 其他（默认） | `#EEC170`（琥珀黄） |

词性标签背景色 = 对应颜色 + `22`（16进制，约 13% 透明度）。

---

### 1.2 投影与光效

| 场景 | 样式 |
|------|------|
| 主按钮默认阴影 | `0 3px 16px rgba(232,99,74,0.3)` |
| 主按钮 hover 阴影 | `0 4px 22px rgba(232,99,74,0.45)` |
| 当前播放行光晕 | `0 0 0 1px rgba(238,193,112,0.15), 0 4px 24px rgba(238,193,112,0.08)` |

---

### 1.3 圆角规格

| 元素 | 圆角 |
|------|------|
| 主卡片（歌词行、欢迎弹窗） | `rounded-xl`（12px） |
| 侧边栏项 | 8px |
| 输入框 | `rounded-xl`（12px） |
| 小按钮/标签 | `rounded-lg`（8px）|
| 胶囊型积分 / 词性标签 | `rounded-full` 或 4px |
| 弹窗容器 | `rounded-2xl`（16px）|
| 播放按钮 | `rounded-md`（6px） |
| 行号播放按钮 | 22×22px，`rounded-md` |

---

## 2. 整体布局结构

```
┌─────────────────────────────────────────────────────────┐
│                     Header (52px 固定)                   │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ Sidebar  │              Main Content Area              │
│ (260px)  │         (padLeft: 0 or 260px)               │
│  固定     │              可垂直滚动                      │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

- **Header**：`position: fixed`，`z-index: 50`，高度 52px，全宽，`background: #0f0f0f`，底部 `border-bottom: 1px solid #2e2e2e`
- **Sidebar**：`position: fixed`，`z-index: 40`，`top: 52px`，`width: 260px`，`height: calc(100vh - 52px)`，可通过 translateX 滑入滑出
- **Main**：`margin-left` 随 sidebar 展开状态在 0 和 260px 之间切换（`transition-all duration-300`），`padding-top: 52px`，最大内容宽度 `max-w-4xl`，水平内边距 `px-6`，垂直内边距 `py-10`

---

## 3. 顶部导航栏

### 3.1 布局

`flex items-center justify-between px-5`，左侧内容 + 右侧内容。

### 3.2 左侧内容（flex 横排）

**① Logo 区**（flex items-center gap-2.5）：
- ♪ 图标：`color: #E8634A`，`font-size: 18px`
- 文字 "歌词解析"：`font-semibold`，`font-size: 1rem`，`color: #f0f0f0`

**② 「+ 新建」按钮**：
- 文字：`text-xs`，`px-3 py-1`，`rounded-lg`
- 默认：`background: transparent`，`border: 1px solid rgba(232,99,74,0.4)`，`color: #E8634A`
- Hover：`background: rgba(232,99,74,0.1)`，`border-color: rgba(232,99,74,0.6)`
- 点击：打开「新建歌曲弹窗」

### 3.3 右侧内容（flex items-center gap-2）

从左到右排列：

**① 积分显示胶囊**（仅 `credits !== null` 时显示）：
- 形态：`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold`
- 内容：⭐ 图标（宽10px五角星）+ 积分数字
- 未登录时：显示 `{n} / 5`（每日5次免费限额）
- 已登录时：显示 Supabase 余额，如 `48`（无 `/5` 后缀）
- 积分 ≤ 3 时：背景 `rgba(232,99,74,0.1)`，边框 `rgba(232,99,74,0.25)`，文字 `#E8634A`（红色警告）
- 积分 > 3 时：背景 `rgba(238,193,112,0.08)`，边框 `rgba(238,193,112,0.2)`，文字 `#EEC170`（琥珀黄）
- Tooltip：`title="账户积分余额（每行AI解析消耗1积分）"` 或 `"每日免费AI语法解析次数"`

**② 「兑换」按钮**（仅已登录时显示）：
- `text-xs px-2.5 py-1 rounded-lg`
- 默认：`background: transparent`，`border: 1px solid #2e2e2e`，`color: #555`
- Hover：`border-color: #444`，`color: #aaa`
- 点击：打开积分兑换弹窗

**③ 用户头像按钮 / 登录按钮**：
- 已登录：`<UserButton>`（Clerk 组件），头像 28×28px 圆形
- 未登录：「登录 / 注册」按钮
  - `text-xs px-3 py-1 rounded-lg`
  - 默认：`background: rgba(232,99,74,0.1)`，`border: 1px solid rgba(232,99,74,0.35)`，`color: #E8634A`
  - Hover：`background: rgba(232,99,74,0.18)`
  - 点击：弹出 Clerk 登录模态框

---

## 4. 左侧边栏

### 4.1 整体结构

`position: fixed`，`top: 52px`，`width: 260px`，`height: calc(100vh - 52px)`
`background: #111111`，`border-right: 1px solid #2e2e2e`
三段式布局：Header 区 + Tabs + 滚动列表区

**折叠动画**：`transform: translateX(0)` / `translateX(-260px)`，`transition-transform duration-300`
主内容区同步通过 `margin-left: 260 / 0` + `transition-all duration-300` 响应

**折叠后**：左侧边缘显示一个小「展开」触发器条：
- 位置：`top: 52+12=64px`，`left: 0`，`width: 20px`，`height: 32px`
- 样式：`background: #1a1a1a`，`border: 1px solid #2e2e2e`（左侧无边框），右侧圆角 6px
- 内含向右的 chevron 图标（`color: #444`）
- Hover：`color: #aaa`，`background: #252525`

### 4.2 Sidebar Header（折叠控制）

- 文字 "收藏"：`text-[11px] font-bold tracking-[0.18em] uppercase color:#555`
- 右侧收起按钮（sidebar panel 图标）：24×24px，`color: #444`
- 收起按钮 Hover：`color: #888`，`background: rgba(255,255,255,0.06)`

### 4.3 标签页切换

两个标签：**歌曲列表** / **语法列表**

- 标签文字：`text-[11px] font-medium`
- 活跃标签：`color: #f0f0f0`，底部有 `height: 1px, background: #EEC170` 的 active 指示线（绝对定位）
- 非活跃标签：`color: #555`
- 数量徽章：活跃时 `background: rgba(238,193,112,0.15) color:#EEC170`；非活跃时 `background: rgba(255,255,255,0.06) color:#444`
- Tab 分割线：`border-bottom: 1px solid #2a2a2a`

### 4.4 歌曲列表 Tab

**「新建歌曲」按钮**（始终置顶）：
- 全宽，`mx-2`，`rounded-lg`，`flex items-center gap-2 px-3 py-2.5`
- 文字：`text-[13px] font-semibold`，`color: #E8634A`
- 背景：`rgba(232,99,74,0.06)`，`border: 1px dashed rgba(232,99,74,0.25)`
- Hover：`background: rgba(232,99,74,0.12)`，`border-color: rgba(232,99,74,0.45)`

**空状态**：`"暂无保存的歌词"` `text-[11px] color:#333` 居中

**置顶区（Pinned）**：
- 区域标题："置顶"，`text-[9px] font-bold tracking-[0.18em] uppercase color:rgba(232,93,74,0.4)`
- 置顶项下方若有未置顶项，中间有 `height: 1px background: #222` 分割线

**歌曲列表项（SidebarItem）**：

背景规则：
- 活跃（当前歌曲）：`background: rgba(238,193,112,0.07)`，`border-left: 2px solid #EEC170`
- 置顶但非活跃：`background: rgba(232,93,74,0.06)`，`border-left: 2px solid #e85d4a`
- Hover（非活跃）：`background: #1e1e1e`，`border-left: 2px solid transparent`
- 普通：`background: transparent`，`border-left: 2px solid transparent`

内容（横排）：
- 左侧图标：活跃时显示 `▶`（color: #EEC170，font-size: 9px）；置顶非活跃时显示图钉图标（color: #e85d4a，filled）
- 标题文字：`text-[13px] truncate`，活跃 `color: #EEC170`；置顶非活跃 `color: rgba(255,255,255,0.82)`；普通 `color: #aaa`
- ♪ 音符图标（仅有对位时间轴时显示）：`color: #EEC170`，`font-size: 10px`，`opacity: 0.7`，title="已保存对位时间轴"
- 右侧操作按钮组（group-hover 时 opacity-100，平时 opacity-0）：
  - **图钉按钮**：`p-1 rounded`，置顶时 `color: #e85d4a`，未置顶 `color: rgba(255,255,255,0.3)`；Hover `background: rgba(255,255,255,0.08)`
  - **编辑按钮**：`p-1 rounded`，`color: rgba(255,255,255,0.3)`；Hover `background: rgba(255,255,255,0.08)`
  - **删除按钮**：`p-1 rounded`，`color: rgba(232,93,74,0.6)`；Hover `background: rgba(232,93,74,0.1)`

**重命名行内编辑**（点击编辑按钮后）：
- 输入框替换标题文字：`flex-1 min-w-0 text-sm bg-transparent outline-none`，`color: rgba(255,255,255,0.9)`
- 底部下划线：`border-bottom: 1.5px solid rgba(56,188,212,0.5) padding-bottom: 2px`
- 失焦/回车：提交；Escape：取消

### 4.5 语法列表 Tab

**空状态**：`★`（opacity: 0.1，font-size: 24px）+ 提示文字 `"点击语法卡片上的星标收藏"` `text-[11px] color:#333`

**导出 CSV 按钮**（有内容时显示）：
- 全宽，`py-1.5 rounded-lg`
- `background: rgba(56,188,212,0.08)`，`border: 1px solid rgba(56,188,212,0.2)`，`color: #38BCD4`
- 图标 + 文字：`"导出 CSV ({n} 条)"`
- Hover：`background: rgba(56,188,212,0.15)`
- 功能：生成 UTF-8 BOM CSV 文件并下载，列：词、读音、罗马字、原型、词性、解释、出处

**语法收藏项（GrammarItem）**：
- `mx-2 mb-1 rounded-lg overflow-hidden`
- `background: #161616`，`border-left: 3px solid {posColor}`
- 内容（`px-3 py-2.5`）：
  - 词本体：`text-base font-bold color:#f0f0f0`
  - 词性徽章：`text-[10px] font-semibold px-1.5 py-0.5 rounded`，背景/颜色同 GrammarCard
  - 读音：`text-[11px] color:#555` 平假名 · 罗马字
  - 出处行（歌词原文）：`text-[11px] color:#444 truncate`
- 右侧删除按钮（group-hover 显示）：`color: rgba(232,93,74,0.6)` Hover `background: rgba(232,93,74,0.1)`

---

## 5. 主内容区

### 5.1 页面标题

```
虾学日语歌 ShrimpLyricsParser
```

- 字体：`text-4xl font-black tracking-tight leading-snug`
- 渐变色：`linear-gradient(100deg, #E8634A 0%, #f0956c 45%, #38BCD4 100%)`，`-webkit-background-clip: text`，`-webkit-text-fill-color: transparent`
- 副标题：`"Japanese Lyrics Parser"`，`text-[10px] tracking-[0.22em] uppercase color:#444`

### 5.2 错误提示条

仅在解析出错时显示，`animate-fade-in`：
- `rounded-xl px-4 py-3 mb-6 flex items-center gap-3`
- `background: rgba(239,68,68,0.08)`，`border: 1px solid rgba(239,68,68,0.18)`，`color: #fca5a5`
- 左侧 info 圆圈图标（16px） + 错误文字 `text-sm`

### 5.3 空状态

无解析结果时显示：
- `flex flex-col items-center justify-center py-24 gap-5`
- 提示文字：`"← 从左侧选择已保存的歌曲，或点击「新建歌曲」开始"`，`text-sm color:#444`
- 「新建歌曲」CTA 按钮（同主按钮样式，带 + 图标）

---

## 6. 新建歌曲弹窗

### 6.1 弹窗容器

遮罩层：`fixed inset-0 z-[60]`，`background: rgba(0,0,0,0.6)`，点击遮罩关闭
内容框：`w-full max-w-2xl mx-4 rounded-2xl`，`background: #1a1a1a`，`border: 1px solid #2e2e2e`

**弹窗 Header**：
- `flex items-center justify-between px-6 pt-5 pb-0`
- ♪ 图标（coral，14px） + "新建歌曲"文字（`font-semibold color:#f0f0f0`）
- 关闭 × 按钮：`text-lg color:#555`，Hover `color:#aaa`

**标签页**（搜索歌曲 / 粘贴歌词）：
- `flex gap-0 px-6 pt-3 pb-0 border-bottom: 1px solid #2a2a2a`
- 每个 Tab：`px-4 py-2 text-sm font-medium`
- 活跃 Tab：`color: #f0f0f0`，`border-bottom: 2px solid #E8634A`（负外边距 `-1px` 使其与分割线重叠）
- 非活跃 Tab：`color: #555`，`border-bottom: 2px solid transparent`
- 搜索图标 + "搜索歌曲"；编辑图标 + "粘贴歌词"

**弹窗内容区**：`px-6 pb-6 pt-5`

---

### 6a. 搜索歌曲标签页（LrcSearchPanel）

**搜索栏**（flex gap-2）：
- 输入框：`flex-1 rounded-lg px-3 py-2 text-sm`，`background: #111`，`border: 1px solid #2e2e2e`，`color: #f0f0f0`，`caret-color: #38BCD4`
  - 聚焦时 border 变为 `#38BCD4`；失焦恢复 `#2e2e2e`
  - 占位符：`"搜索日语歌曲名 / 歌手…"`
  - 自动 autoFocus
- 搜索按钮：`px-4 py-2 rounded-lg text-sm font-semibold`，`background: #38BCD4`，`color: #0f0f0f`
  - 搜索中显示 Spinner（白色14px），否则显示搜索放大镜图标
  - `disabled` 时 `opacity-40`

**搜索结果列表**（最大高度 `max-h-72`，可滚动）：

每个结果行（按钮）：
- `flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left`
- 默认：`background: #111`，`border: 1px solid #252525`
- Hover：`background: #1a1a1a`，`border-color: #3a3a3a`
- `disabled`（有歌曲正在加载中）时 `opacity-50`

左侧（信息）：
- 歌曲名：`text-sm font-semibold truncate color:#f0f0f0`
- 艺术家 · 专辑：`text-xs truncate color:#666`

右侧（元信息，`flex items-center gap-2 shrink-0`）：
- **「时间轴」徽章**（仅有 syncedLyrics 时显示）：`text-[10px] font-bold px-1.5 py-0.5 rounded`，`background: rgba(56,188,212,0.12)`，`color: #38BCD4`，`border: 1px solid rgba(56,188,212,0.25)`
- 时长：`text-[11px] font-mono color:#444`，格式 `m:ss`
- 加载指示：该行加载中显示 Spinner，否则显示 `>` chevron（`color: #555`）

**空结果状态**：`"没有找到结果，换个关键词试试"` `text-sm text-center py-4 color:#555`

**初始提示**（搜索前）：`"数据来源：LRCLIB · 带「时间轴」标记的曲目可跳过音频上传直接同步播放"` `text-xs color:#444`

**点击歌曲后的流程**：
1. 调用 `/api/parse` 传 `lines` 数组（免费，不扣积分）
2. 有 syncedLyrics → 解析 LRC 时间戳 → 有 timestamps 数据
3. 无 syncedLyrics → 用 plainLyrics 逐行
4. 成功后关闭弹窗，主区域显示解析结果，并带时间轴数据

---

### 6b. 粘贴歌词标签页

**歌词输入卡片**：
- 外框：`rounded-xl overflow-hidden`，`background: #1a1a1a`，`border: 1px solid #2e2e2e`
- 顶部标签："输入歌词"，`text-[10px] font-bold tracking-widest uppercase color:#38BCD4 opacity:0.6`，`px-4 pt-4 pb-1`

**Textarea**：
- `w-full resize-none outline-none px-4 pb-8`，`background: #111111`，`color: #f0f0f0`
- `font-size: 1rem`，`line-height: 1.8`，`caret-color: #38BCD4`
- `min-height: 140px`，`rows: 6`
- 占位符（多行）：`"输入日语歌词……支持多行整首歌曲\n\n例：..."`
- 最大字符数：20,000（前端硬限制；API 限制 2,000）
- `⌘↵` / `Ctrl+↵` 快捷键提交

**字符计数器**（绝对定位于 textarea 右下角）：
- `absolute bottom-2 right-3 text-[10px] font-mono pointer-events-none`
- 格式：`{current}/{MAX}`（`{current}/20000`）
- 颜色：超过 90% 时 `#E8634A`，否则 `#333`

**示例芯片列表**（textarea 下方，`border-top: 1px solid #252525`）：
- 前导文字："试试："`text-[10px] pt-3 color:#444`
- 4 个示例按钮，`text-xs rounded-full`，`padding: 3px 10px`，`margin-top: 0.75rem`
- 默认：`background: #171717`，`border: 1px solid #2e2e2e`，`color: #555`
- Hover：`background: #252525`，`color: #aaa`，`border-color: #444`
- 点击：直接填充 textarea
- 示例内容：`"♪ {歌词}"`（前缀 ♪ 图标）

**按钮行**（`flex items-center justify-between gap-3 mt-3`）：

**左侧「保存」按钮**（ghost 样式）：
- `flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium`
- 默认：`background: transparent`，`border: 1px solid #2e2e2e`，`color: #666`
- Hover（有内容时）：`border-color: #444`，`color: #aaa`
- 已保存反馈状态：`border: 1px solid rgba(56,188,212,0.4)`，`color: #38BCD4`，图标变成 ✓，文字变"已保存"（持续2秒后恢复）
- `disabled`（无内容）时 `opacity-30 cursor-not-allowed`

**右侧「解析歌词」按钮**（主按钮）：
- `flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white`
- `background: linear-gradient(135deg, #e8634a 0%, #cf4f38 100%)`
- 默认阴影：`0 3px 16px rgba(232,99,74,0.3)`；Hover 阴影：`0 4px 22px rgba(232,99,74,0.45)`
- 文字："解析歌词 ⌘↵"
- 右侧积分徽章：`background: rgba(255,255,255,0.15)`，`color: rgba(255,255,255,0.8)`，内容 `★ −1`
- 加载中：替换为 Spinner + "解析中……"
- `disabled`（加载中或无内容）时 `opacity-40 cursor-not-allowed`

**进度条**（解析进行中显示，`animate-fade-in`）：
- 文字区：左侧状态文字 + 右侧百分比（`color: #f0956c font-mono text-[11px]`）
- 状态文字阶段：
  - `< 30%`："正在分析歌词…"
  - `30–65%`："正在解析语法…"
  - `65–100%`："即将完成…"
  - `= 100%`："解析完成 ✓"
- 进度条轨道：`height: 3px`，`background: #1e1e1e`，`rounded-full`
- 进度条填充：`background: linear-gradient(90deg, #772F1A, #E8634A, #f0956c, #EEC170)`
- 发光：`box-shadow: 0 0 6px rgba(240,149,108,0.45)`
- 过渡：进度变化时 `transition: width 0.12s linear`；到达 100% 时 `transition: width 0.3s ease`
- 进度算法：指数衰减曲线 `90 * (1 - e^(-elapsed/tau))`，tau 根据行数动态调整

---

## 7. 歌词解析结果区

### 7.1 结果区 Header

分割线 + 文字 + 分割线：
- 两侧各一条 `h-px flex-1 background:#2e2e2e`
- 中间文字："解析结果 · {n} 行"，`text-[10px] font-semibold tracking-[0.18em] uppercase color:#444`

### 7.2 音频工具栏（有 result 时显示）

**第一行**（flex items-center gap-3）：

**模型选择下拉框**：
- `text-xs rounded-lg px-2 py-2`，`background: #171717`，`border: 1px solid #2e2e2e`，`color: #666`
- 选项：tiny · 最快 / base · 快 / small · 均衡 / **medium · 推荐**（默认） / large-v2 · 最准
- 对位中时 `disabled opacity-40`

**上传音频按钮**（label 包裹 hidden input）：
- `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer`
- 默认：`background: transparent`，`border: 1px solid #2e2e2e`
- 颜色：有音频时 `color: #EEC170`；无音频时 `color: #555`
- Hover：`border-color: #444`，`color: #aaa`
- 文字：对位中 `"对位中…"`；有音频 `"重新上传音频"`；无音频 `"上传音频对位"`
- 音符图标（13px）
- 接受 `accept="audio/*"`

**对位中提示**（对位进行时）：
- `Spinner` + `"正在对位歌词…"`，`text-[11px] flex items-center gap-1.5 color:#666`

**对位完成提示**：
- `"✓ 已对位 {n} 行"`，`text-[11px] color:#585123`

**第二行**（有 audioUrl 时）：音频播放器组件（见第10节）

### 7.3 歌词卡片列表

`flex flex-col gap-4`，卡片间距 16px
每张卡片：入场动画 `animate-fade-up`，延迟 `index * 55ms`

---

## 8. 歌词行卡片（LyricLineCard）

### 8.1 卡片容器

- `animate-fade-up rounded-xl overflow-hidden relative transition-all duration-300`
- 普通状态：`background: #1a1a1a`，`border: 1px solid #2e2e2e`
- 活跃状态（当前播放行）：
  - `background: #1f1d18`
  - `border: 1px solid rgba(238,193,112,0.45)`
  - `box-shadow: 0 0 0 1px rgba(238,193,112,0.15), 0 4px 24px rgba(238,193,112,0.08)`

### 8.2 行号徽章

- 绝对定位：`absolute top-3 left-3`
- `font-mono text-[10px] color:#333`
- 格式：两位数补零，如 `01`、`09`、`12`

### 8.3 时间戳 + 播放按钮（右上角，仅有 timestamp 时显示）

- `absolute top-2.5 right-3 flex items-center gap-1.5`
- 时间文字：`text-[10px] font-mono color:#444`，格式 `m:ss`
- 播放/暂停按钮：22×22px，`rounded-md`
  - 默认：`background: rgba(255,255,255,0.05)`，`border: 1px solid #2e2e2e`，`color: #555`
  - 活跃行：`background: rgba(238,193,112,0.2)`，`border: 1px solid rgba(238,193,112,0.4)`，`color: #EEC170`
  - Hover：`background: rgba(238,193,112,0.15)`，`color: #EEC170`
  - 播放状态图标：8px 播放三角形；暂停状态图标：8px 两个矩形

### 8.4 歌词主体区

- `px-8 pt-10 pb-8 text-center`
- 点击整个区域可触发播放（`cursor: pointer` when `onPlay` exists）

**① 振假名文字（Ruby Text）**

- 外层：`font-black leading-loose mb-4 flex flex-wrap justify-center`
- 字体大小：`font-size: clamp(1.5rem, 4vw, 2.4rem)`（响应式，最小24px，最大~38px）
- 每个 Segment 渲染为：
  - 有振假名：`<ruby>汉字<rt>假名</rt></ruby>`
  - 无振假名：`<span>文字</span>`
- `<rt>` 样式：`font-size: 13px`，`font-weight: 400`，`color: #f0956c`（珊瑚橙），`letter-spacing: 0.04em`，`ruby-align: center`
- 普通文字颜色：`#f0f0f0`

**高亮联动**（鼠标悬停 GrammarCard 时）：
- 与该语法单元文字匹配的字符变色：`color: #EEC170`，`background: rgba(238,193,112,0.08)`，`border-radius: 2px`
- 过渡：`transition: color 0.15s ease, background 0.15s ease`
- 高亮算法：在完整行文字中查找所有匹配位置（支持多处出现），高亮对应字符索引集合

**② 罗马字**

- `italic mb-5`，`font-size: 13px`，`color: #888`，`letter-spacing: 0.04em`
- 各 Segment 的 romaji 用空格拼接

**③ 中文翻译**

- `font-black leading-loose`，`font-size: clamp(1.1rem, 3vw, 1.8rem)`，`color: #EEC170`
- 初始来自解析结果，加载语法时可能被 AI 翻译更新

### 8.5 语法解析按钮区

**未加载状态**（grammar === null）：

整行按钮：`w-full flex items-center justify-between px-5 py-3`，`border-top: 1px solid #2a2a2a`

- 左侧内容：
  - 加载中：Spinner（12px）+ `"AI 解析中…"`
  - 无积分：`"今日积分已用完"`（color: #444，disabled）
  - 有错误：错误文字（color: #e85d4a）
  - 正常：✦ 五角星图标 + `"AI 解析语法"`
  - 颜色：无积分 `#444`；有错误 `#e85d4a`；正常 `#EEC170`

- 右侧积分标签（非无积分且非加载中时显示）：
  - `text-[11px] font-bold px-2 py-0.5 rounded-full`
  - `background: rgba(238,193,112,0.12)`，`border: 1px solid rgba(238,193,112,0.25)`，`color: #EEC170`
  - 内容：`★ −1 积分`

- Hover（非禁用）：`background: rgba(238,193,112,0.04)`
- `disabled`：`opacity-40 cursor-not-allowed`

**点击行为**：
1. grammar 为 null → 开始加载，setExpanded(true)，调 `/api/grammar`
2. grammar 已有数据 → 切换展开/收起
3. noCredits → 什么都不做（disabled）

**已加载状态**（grammar 有数据）：

收缩/展开切换按钮：`w-full flex items-center justify-between px-5 py-2.5`，`border-top: 1px solid #2a2a2a`

- 左侧：chevron 图标（展开时 rotate 180deg，过渡 300ms）+ `"语法解析"`，`text-xs font-medium color:#555`
- 右侧计数徽章：`text-[10px] font-semibold px-1.5 py-0.5 rounded`，`background: #222`，`color: #555`，`border: 1px solid #2e2e2e`
  - 内容：有错误显示 `"额度已用完"`；正常显示 `"{n} 项"`

- Hover：`background: #222`

### 8.6 语法卡片网格

- CSS Grid collapse 动画（无 max-height jank）：
  - 展开：`.grammar-grid-wrapper.open { grid-template-rows: 1fr; opacity: 1; }`
  - 收起：`.grammar-grid-wrapper.closed { grid-template-rows: 0fr; opacity: 0; }`
  - 过渡：`grid-template-rows 0.28s ease, opacity 0.25s ease`
  - 内层 `.grammar-grid-inner { overflow: hidden; }`

- 网格容器：`grid gap-3`，`grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))`
- 容器内边距：`p-4`，`border-top: 1px solid #252525`

---

## 9. 语法解析卡片（GrammarCard）

### 9.1 卡片容器

- `grammar-card relative flex overflow-hidden rounded-xl`
- `background: #141414`，`border: 1px solid #272727`，`border-left: 3px solid {posColor}`
- Hover（CSS 类 `.grammar-card:hover`）：`background: #1c1c1c !important`，`transform: translateY(-1px)`
- 过渡：`background 150ms ease, transform 150ms ease`

### 9.2 收藏（星标）按钮

- 绝对定位：`absolute top-1.5 right-1.5`
- 图标：12×12 五角星
- 未收藏：`color: #333`，Hover `color: #888`
- 已收藏：`color: #EEC170`，图标填充

### 9.3 卡片内容（`flex flex-col gap-1.5 p-3 pr-6 flex-1 min-w-0`）

**① 词性标签**：`self-start text-[10px] font-semibold px-1.5 py-0.5 rounded`，背景/颜色见 POS 颜色表

**② 词本体**：`text-xl font-bold leading-tight color:#f0f0f0`

**③ 读音行**：`text-[11px] color:#555`
- 平假名 · 罗马字（· 颜色 opacity 50%，罗马字 color: #444）

**④ 原型行**（仅有 baseForm 时显示）：
- `text-[11px] color:#444`
- 格式："原型 {baseForm}"（baseForm color: #666）

**⑤ 分割线**：`height: 1px background: #222`

**⑥ 解释**：`text-xs leading-relaxed color:#888`，中文解释文字

### 9.4 鼠标悬停联动

- `onMouseEnter`：触发父组件回调，将该语法单元的文字 text 设为 `hoveredText`
- `onMouseLeave`：清空 `hoveredText`
- 连锁效果：歌词行中对应字符高亮显示（见 8.4 高亮联动）

---

## 10. 音频播放器

### 10.1 播放器容器

- `rounded-xl flex items-center gap-3 px-4 py-2.5 animate-fade-in`
- `background: #1a1a1a`，`border: 1px solid #2e2e2e`

### 10.2 播放/暂停按钮

- 32×32px，`rounded-md flex-shrink-0`
- `background: rgba(238,193,112,0.12)`，`border: 1px solid rgba(238,193,112,0.3)`，`color: #EEC170`
- Hover：`background: rgba(238,193,112,0.2)`
- 图标：播放三角（10px）/ 暂停两矩形（10px）

### 10.3 当前时间

- `text-[11px] font-mono flex-shrink-0`，`color: #666`，`min-width: 36px`
- 格式：`m:ss`

### 10.4 进度条

- `flex-1 relative h-1 rounded-full background: #2e2e2e`
- 填充条：`background: linear-gradient(90deg, #E8634A, #EEC170)`，宽度 = `currentTime/duration * 100%`
- 拖拽：透明 `input[type=range]` 绝对定位覆盖，触发 `onSeek`

### 10.5 总时长

- `text-[11px] font-mono flex-shrink-0`，`color: #444`，`min-width: 36px text-right`

### 10.6 播放逻辑

**全曲播放模式**（点击播放器按钮）：
- 切换整曲播放/暂停
- 不锁定到特定行

**片段播放模式**（点击歌词行的播放按钮）：
- 跳转到该行时间戳起点
- 播放到该行终点自动停止（setTimeout）
- 再次点击同一行：
  - 播放中 → 暂停
  - 已暂停（且在该行终点内）→ 继续播放
  - 活跃行指示器（activeLineIndex）更新，触发歌词行卡片高亮

**音频对位（WhisperX）**：
- 上传音频文件后若无时间轴 → 自动调用 `/api/align`
- 对位期间显示 `"正在对位歌词…"` + Spinner
- 对位完成 → `timestamps` 状态更新，卡片右上角出现播放按钮

---

## 11. 欢迎弹窗（Welcome Modal）

**触发**：首次访问（`localStorage` 无 `"jlp_welcomed"` 键）

**遮罩**：`fixed inset-0 z-[60]`，`background: rgba(0,0,0,0.75)`（比输入弹窗更暗）

**内容框**：`rounded-2xl w-full max-w-lg mx-4`，`background: #1a1a1a`，`border: 1px solid #2e2e2e`，`padding: 40px`

**内容结构**：
1. ♪ 图标（24px，color: #E8634A，居中）
2. 标题 "虾学日语歌"：`text-3xl font-black text-center`，渐变色 `#E8634A → #38BCD4`
3. 副标题 "ShrimpLyricsParser"：`text-sm tracking-widest text-center mb-8 color:#444`
4. 功能介绍列表（3条，flex flex-col gap-3）：
   - 📖 + "粘贴或搜索日文原版歌词，自动标注假名与罗马字"
   - ✦ + "按需解析语法，点击展开深度学习（每日20次免费）"
   - 🎵 + "上传音频，实现逐句跟练"
   - 图标：`font-size: 15px flex-shrink-0 margin-top: 1px`；文字：`text-sm color:#888`
5. 分割线：`height: 1px background: #2a2a2a margin: 0 0 24px`
6. 提示文字："建议在网上搜索歌曲名 + 歌词，找到日文原版歌词后粘贴进来" `text-xs text-center mb-6 color:#555`
7. 「开始使用 →」按钮（全宽，主按钮样式）
8. 底部提示："已有保存的歌曲？直接从左侧列表选择" `text-xs text-center mt-3 color:#444`

**关闭行为**：点击「开始使用」→ `localStorage.setItem("jlp_welcomed", "1")` → 关闭欢迎弹窗 → 打开「新建歌曲」弹窗

---

## 12. 积分兑换弹窗（Redeem Modal）

**触发**：点击 Header 右侧「兑换」按钮（仅登录用户可见）

**遮罩**：`fixed inset-0 z-[70]`（高于其他弹窗），`background: rgba(0,0,0,0.7)`，点击关闭

**内容框**：`w-full max-w-sm mx-4 rounded-2xl`，`background: #1a1a1a`，`border: 1px solid #2e2e2e`，`padding: 32px`

**Header**：
- 左侧："兑换激活码" `font-bold text-base color:#f0f0f0` + "输入格式：XUE-XXXXX-XXXXX" `text-xs mt-0.5 color:#555`
- 右侧：× 关闭按钮

**表单（兑换前）**：

激活码输入框：
- `w-full px-4 py-3 rounded-xl`，`background: #111`，`font-mono text-sm tracking-wider`
- 默认 border `#2e2e2e`；有错误时 `rgba(232,99,74,0.5)`；聚焦时 `#444`
- 自动 `toUpperCase()`，autoFocus

错误提示：`text-xs color:#e85d4a`

提交按钮："立即兑换"，全宽主按钮样式，加载中显示 "兑换中…"

**成功状态（兑换后）**：
- 🎉 emoji（font-size: 3rem，居中）
- "成功兑换 {n} 积分"（积分数字 `color: #EEC170`）
- "当前余额：{balance} 积分"（`text-sm color:#666`）
- 「确定」按钮（关闭弹窗）

---

## 13. 数据流与状态管理

### 13.1 主页面（page.tsx）核心状态

| 状态变量 | 类型 | 说明 |
|----------|------|------|
| `lyrics` | string | textarea 当前文字 |
| `result` | `ParsedResult[] \| null` | 当前解析结果 |
| `isLoading` | boolean | 解析请求进行中 |
| `error` | `string \| null` | 错误信息 |
| `credits` | `number \| null` | 积分显示值 |
| `timestamps` | `LineTimestamp[] \| null` | 对位时间轴 |
| `audioUrl` | `string \| null` | 当前音频 Blob URL |
| `currentTime` | number | 播放器当前时间（秒） |
| `duration` | number | 音频总时长（秒） |
| `isPlaying` | boolean | 是否正在播放 |
| `isAligning` | boolean | WhisperX 对位进行中 |
| `activeLineIndex` | `number \| null` | 当前播放/活跃行索引 |
| `alignModel` | string | 对位模型选择 |
| `sidebarOpen` | boolean | 侧边栏展开状态 |
| `inputModalOpen` | boolean | 新建弹窗状态 |
| `inputTab` | `"paste" \| "search"` | 弹窗标签页 |
| `showWelcome` | boolean | 欢迎弹窗状态 |
| `redeemOpen` | boolean | 兑换弹窗状态 |
| `currentSavedId` | `string \| null` | 当前歌曲在 localStorage 中的 ID |

### 13.2 数据流向

```
用户输入歌词
    ↓
POST /api/parse (lyrics: string)
    ↓ Gemini 分行 + Kuromoji 标注
ParsedResult[]
    ↓
setResult() → 渲染歌词卡片
    ↓ save() → localStorage
侧边栏列表更新

用户点击语法解析
    ↓
POST /api/grammar (line, lineIndex, totalLines)
    ↓ 积分检查 → Gemini 解析
{ units: GrammarUnit[], translation: string }
    ↓
setGrammar() → 展开语法网格
onCreditsChange() → 更新 Header 积分数

用户上传音频
    ↓ (如无时间轴)
POST /api/align (FormData: audio + lyrics + kana + duration + model)
    ↓ WhisperX Replicate
LineTimestamp[]
    ↓
setTimestamps() → 歌词卡片出现播放按钮
```

---

## 14. 积分系统逻辑

### 14.1 未登录访客

- 每日 IP 限制：5 次（存 Node.js 内存）
- 每次调用 `/api/grammar` 成功消耗 1 次
- `/api/parse` Path B（原始歌词）消耗 1 次
- Header 显示：`{n} / 5`

### 14.2 已登录用户（Clerk + Supabase）

- 注册时 webhook 自动发放 50 积分
- 积分存储于 Supabase `user_credits` 表
- 每行语法解析消耗 1 积分（需扣非免费行）
- Header 显示：Supabase 余额（无 / 后缀）

### 14.3 30% 免费规则

```
freeThreshold = ceil(totalLines * 0.3)
isFree = lineIndex < freeThreshold
```

- 例：40 行歌曲 → 前 12 行（index 0-11）免费
- 免费行：不消耗任何积分，直接解析
- 付费行：
  - 已登录 → 扣 Supabase 积分
  - 未登录 → 扣 IP 每日配额

### 14.4 积分不足时的 UI 表现

| 状态 | 语法按钮文字 | 颜色 | 操作 |
|------|-------------|------|------|
| 有积分 | "AI 解析语法" | #EEC170 | 可点击 |
| 无积分（已登录） | "积分不足，请兑换激活码充值 ✦" | #444 | 禁用 |
| 无积分（未登录） | "今日积分已用完" | #444 | 禁用 |
| 解析出错（可重试免费） | "解析异常，点击免费重试 ↺" | #e85d4a | 可再次点击不扣积分 |
| 解析出错（一般） | "解析失败，点击重试" | #e85d4a | 可再次点击（扣积分）|

---

## 15. 本地存储结构

### 15.1 已保存歌曲（`jlp_saved_lyrics`）

```typescript
interface SavedLyric {
  id: string;           // nanoid，如 "abc123"
  title: string;        // 自动提取第一行 or 手动重命名
  content: string;      // 原始歌词文字
  parsedResult?: ParsedResult[];  // 解析结果（含语法数据）
  timestamps?: LineTimestamp[];   // 对位时间轴
  pinned: boolean;      // 是否置顶
  savedAt: number;      // Date.now() 时间戳
}
```

- 排序：置顶在前，各区域内按 savedAt 倒序（最新在前）
- 标题自动提取：取第一行非空文字
- 语法数据持久化：加载后会 `updateParsedResult()` 保存到对应歌曲记录

### 15.2 已收藏语法（`jlp_saved_grammar`）

```typescript
interface SavedGrammar {
  id: string;           // `{text}|{hiragana}|{partOfSpeech}`
  unit: GrammarUnit;    // 语法单元完整数据
  sourceLine: string;   // 歌词原文（用于 CSV 导出中的「出处」列）
  savedAt: number;      // 时间戳
}
```

### 15.3 欢迎弹窗标记

- key：`"jlp_welcomed"`，value：`"1"`

---

## 16. 动画与过渡规格

### 16.1 入场动画

| 名称 | keyframes | duration | easing | 用途 |
|------|-----------|----------|--------|------|
| `fadeInUp` | `opacity: 0, translateY(12px) → opacity: 1, translateY(0)` | 0.38s | `cubic-bezier(0.22, 1, 0.36, 1)` | 歌词卡片、主容器 |
| `fadeIn` | `opacity: 0 → 1` | 0.25s | `ease` | 音频播放器、进度条 |

- 歌词卡片交错延迟：每张卡片 `animation-delay = index * 55ms`
- 初始状态 `opacity: 0`（由 `forwards` fill mode 保持最终帧）

### 16.2 UI 过渡

| 元素 | 属性 | Duration | Easing |
|------|------|----------|--------|
| 侧边栏滑入/出 | `transform` | 300ms | default |
| 主内容 marginLeft | 所有属性 | 300ms | default |
| 语法区域展开 | `grid-template-rows` | 280ms | `ease` |
| 语法区域淡入 | `opacity` | 250ms | `ease` |
| 语法卡片 hover | `background, transform` | 150ms | `ease` |
| 按钮颜色/背景 | `background, color, border, box-shadow` | 150ms | default |
| 播放按钮图标 | `transform` (旋转chevron) | 300ms | default |
| 卡片活跃状态 | `background, border, box-shadow` | 300ms | default |

---

## 17. 字体与文字排版

### 17.1 字体

- **主字体**：Noto Sans JP（Google Fonts）
- 字重：400（Regular）、500（Medium）、700（Bold）、900（Black）
- `font-display: swap`，`preload: false`（CJK 大字体，避免阻塞渲染）
- `lang="ja"` 设置在 `<html>` 上

### 17.2 关键字号

| 元素 | 字号 |
|------|------|
| 页面主标题 | `text-4xl`（36px） |
| 歌词主文字 | `clamp(1.5rem, 4vw, 2.4rem)` |
| 中文翻译 | `clamp(1.1rem, 3vw, 1.8rem)` |
| 语法卡片词本体 | `text-xl`（20px） |
| 侧边栏标题项 | `text-[13px]` |
| 罗马字 | 13px |
| 振假名(rt) | 13px |
| 语法标签文字 | `text-[10px]` |
| 行号 | `text-[10px] font-mono` |
| 积分胶囊 | `text-[11px]` |
| 辅助说明 | `text-xs`（12px）|

---

## 18. API 接口说明

### 18.1 POST `/api/parse`

解析歌词为带振假名的结构化数据。

**请求体 A（已有分行，来自 LRC 搜索，免费）**：
```json
{ "lines": ["日语歌词第一行", "第二行", ...] }
```

**请求体 B（原始文字，需Gemini分行，消耗1积分）**：
```json
{ "lyrics": "多行日语歌词文字..." }
```

**返回**：`ParsedResult[]`

```typescript
interface ParsedResult {
  originalText: string;       // 原始文字
  kana: string;               // 完整平假名读音（音频对位用）
  segments: Segment[];        // 分词结果
  fullRomaji: string;         // 完整罗马字（空格分隔）
  chineseTranslation: string; // 中文翻译（初始为空）
  grammarBreakdown: GrammarUnit[]; // 语法数据（初始为空数组）
}

interface Segment {
  text: string;               // 原始文字（汉字/假名/符号）
  hiragana: string | null;    // 振假名（仅含汉字时有值）
  romaji: string;             // 罗马字读音
}
```

**响应头**：`X-Credits-Remaining`, `X-Credits-Limit`

---

### 18.2 POST `/api/grammar`

AI 语法解析单行歌词。

**请求体**：
```json
{
  "line": "日语歌词一行",
  "lineIndex": 5,      // 行索引（0开始），用于30%免费判断
  "totalLines": 40     // 总行数，用于30%免费判断
}
```

**返回**：
```json
{
  "units": [GrammarUnit, ...],
  "translation": "中文翻译"
}
```

```typescript
interface GrammarUnit {
  text: string;         // 词本体
  hiragana: string;     // 平假名
  romaji: string;       // 罗马字
  partOfSpeech: string; // 词性（名词/动词/助词等）
  explanation: string;  // 中文解释
  baseForm?: string;    // 原型（动词/形容词等变形词）
}
```

**错误响应**：
- 429：积分不足（`{ error: "...", }` + `X-Credits-Remaining: 0`）
- 503：AI 返回空（`{ error: "...", retryFree: true }`）— 此时不扣积分
- 500：服务器错误

**响应头**：`X-Credits-Remaining`，已登录时无 `X-Credits-Limit`，未登录时有

---

### 18.3 GET `/api/credits`

获取当前用户积分。

**返回**：
```json
{ "remaining": 48, "limit": null, "authenticated": true }
// 或
{ "remaining": 3, "limit": 5, "authenticated": false }
```

---

### 18.4 POST `/api/redeem`

兑换激活码（需登录）。

**请求体**：`{ "code": "XUE-XXXXX-XXXXX" }`

**返回**：`{ "credits": 100, "newBalance": 148 }`

**错误**：401 未登录 / 404 码无效 / 409 已被使用

---

### 18.5 GET `/api/lrclib`

搜索歌词数据库代理。

**参数**：`?q={keyword}` 搜索 / `?id={id}` 按ID获取

**返回**：`LrcTrack[]`

```typescript
interface LrcTrack {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;         // 秒
  syncedLyrics: string | null; // "[mm:ss.xx] 歌词" 格式
  plainLyrics: string | null;  // 纯文字歌词
}
```

---

### 18.6 POST `/api/align`

音频歌词对位（WhisperX via Replicate）。

**请求体**：FormData
- `audio`: 音频文件（File）
- `lyrics`: JSON string (`string[]`) — 歌词行
- `kana`: JSON string (`string[]`) — 对应平假名
- `duration`: string — 音频时长秒数
- `model`: `"tiny" | "base" | "small" | "medium" | "large-v2"`

**返回**：`{ timestamps: LineTimestamp[] }`

```typescript
interface LineTimestamp {
  lineIndex: number;  // 0-based
  startTime: number;  // 秒（小数）
  endTime: number;    // 秒（小数）
}
```

---

### 18.7 POST `/api/webhooks/clerk`

Clerk webhook（内部，不由前端调用）。

- 监听 `user.created` 事件
- 在 Supabase `user_credits` 插入初始余额 50
- 在 `credit_transactions` 记录 `reason: "signup_bonus"`
- 通过 svix 验证签名

---

## 附录：微信小程序迁移注意事项

### A. 布局适配

| Web 端 | 小程序适配建议 |
|--------|---------------|
| 固定 Header（52px） | `position: fixed` 顶部导航栏，用小程序自定义 navigationBar |
| 固定左侧 Sidebar | 改为底部 TabBar 或抽屉式 Drawer（从左侧滑出） |
| max-w-4xl 居中内容 | 全宽布局，左右 padding 约 16rpx |
| position: fixed 弹窗 | 小程序使用 `wx.showModal` 或自定义 Modal 组件 |

### B. 功能适配

| 功能 | 迁移方案 |
|------|---------|
| Clerk 认证 | 改用微信 OAuth（`wx.login` + 后端换取 unionId） |
| Ruby HTML 标签 | 小程序暂不支持 `<ruby>`，需自行用 view+text 叠加实现振假名 |
| localStorage | 改用 `wx.setStorageSync` / `wx.getStorageSync` |
| audio API | 使用小程序 `wx.createInnerAudioContext()` |
| 文件上传 | 使用 `wx.chooseMedia` + `wx.uploadFile` |
| CSS grid collapse | 小程序支持 CSS Grid，但动画需用 height 或 opacity 替代 |
| Hover 状态 | 小程序无 hover 伪类，改用 `bindtouchstart/bindtouchend` 模拟 |
| CSV 下载 | 小程序无法直接下载，改为分享到微信或提供复制文本功能 |

### C. 振假名渲染（重点）

Web 端使用 HTML `<ruby>` 原生标签，小程序需手动实现：

```
┌─────────────────────────────────────┐
│  あ い う え お（ruby text，13px，珊瑚橙）  │
│  愛 し い（主文字，24-38px，白色）         │
└─────────────────────────────────────┘
```

推荐实现：每个 Segment 用 view（flex-direction: column）包裹：上方 text（振假名，对齐 center）+ 下方 text（原字）

### D. 字体

- Noto Sans JP 无法通过 Google Fonts 在小程序中加载
- 建议使用系统默认 CJK 字体（iOS: PingFang SC，Android: Noto Sans CJK）
- 或将必要字重子集化后放入小程序包（注意 2MB 包大小限制）

---

*文档结束 · 由 Claude Code 基于源码生成 · 2026-03-17*
