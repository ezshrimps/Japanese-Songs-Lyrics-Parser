# 日本語歌詞解析 — Japanese Lyrics Parser

> Inspired by Bilibili creator [卷心儿](https://space.bilibili.com/). Powered by Claude AI.

A web application that takes Japanese song lyrics as input and produces a full linguistic breakdown — hiragana ruby annotations, romaji transcription, Chinese translation, and per-word grammar analysis — for every line of the song.

![Reference design](https://github.com/user-attachments/assets/a2d71c9f-0ead-4db5-9755-7956eef767e0)

---

## Features

### 1. Full-Song Parsing in One Tap

Paste any number of lyric lines into the input box and click **解析歌词**. The app sends the entire input to Claude AI in a single request and returns an analysis for every non-empty line simultaneously. There is no need to parse one line at a time.

- Supports up to 5 000 characters of input (a typical full-length J-pop song)
- Blank lines between verses are automatically ignored
- Processing a full song (≈ 20 lines) takes approximately 20 – 40 seconds

---

### 2. Hiragana Ruby Annotations

For each lyric line, every kanji character (or kanji-containing word) is displayed with its hiragana reading rendered directly above it using HTML `<ruby>` elements — the same style used in Japanese textbooks and furigana dictionaries.

- Kanji → hiragana reading shown above in teal
- Pure hiragana / katakana segments → displayed as-is with no annotation
- Conjugated verb stems are correctly split from their inflectional endings (e.g. `浮` gets `う`, the trailing `いている` is shown without annotation)

---

### 3. Romaji Transcription

Below the ruby-annotated Japanese text, the full romanisation of the lyric line is displayed in italics. This follows standard Hepburn romanisation and covers the entire line as a continuous string, making it easy to read aloud without knowing kana.

---

### 4. Chinese Translation

Each lyric line is accompanied by a natural Chinese translation displayed in a styled pill beneath the romaji. The translation is generated in context — Claude understands the poetic and idiomatic meaning of the line rather than translating word-for-word.

---

### 5. Per-Word Grammar Breakdown

Below each lyric line is an expandable grammar section containing one card per grammatical unit. Each card shows:

| Field | Description |
|---|---|
| **Colour stripe** | Visual indicator of the word's part of speech |
| **Part-of-speech badge** | 名词 / 动词 / 助词 / 形容词 / 副词 / 数词 / 接续助词, etc. |
| **Surface form** | The word as it appears in the lyrics |
| **Hiragana · Romaji** | Reading and romanisation of the unit |
| **Chinese explanation** | Meaning and, for conjugated forms, a detailed breakdown of the conjugation pattern (base form → conjugation type → grammatical function) |

**Part-of-speech colour coding:**

| Category | Colour |
|---|---|
| 名词 (Noun) | Coral |
| 动词 (Verb) | Blue |
| 助词 / 接续助词 (Particle) | Teal |
| 形容词 (Adjective) | Purple |
| 副词 (Adverb) | Green |
| 数词 (Numeral) | Amber |

The grammar grid uses a responsive auto-fill layout and adjusts the number of columns to fit the screen width.

---

### 6. Expand / Collapse Grammar Section

Each lyric card has a toggle button labelled **语法解析** that shows or hides the grammar breakdown for that line. The panel opens and closes with a smooth CSS animation. Grammar is expanded by default.

- The toggle button displays the item count (e.g. `6 项`)
- The chevron icon rotates to indicate open/closed state
- All lines can be individually toggled independently of each other

---

### 7. Save Lyrics

Click **保存** (or the save button next to the parse button) to save the current textarea contents to your browser's local storage. Saved entries persist between sessions with no account or sign-in required.

- The title is automatically set to the first non-empty line of the lyrics (up to 40 characters)
- After saving, the button briefly shows **✓ 已保存** as confirmation

---

### 8. Saved Lyrics Sidebar

The left sidebar lists all saved lyrics entries. Features:

#### Load
Click any entry title to instantly load that lyric back into the input textarea, clearing the current result.

#### Pin / Unpin
Click the pin icon on any entry to promote it to the **置顶** (Pinned) section at the top of the list. Pinned entries are visually distinguished with a coral pin icon and a subtle warm background. Click again to unpin.

#### Rename
Click the pencil icon to edit the title of any saved entry inline. Press **Enter** to confirm or **Esc** to cancel. The sidebar item transforms into a focused text input; clicking away also commits the change.

#### Delete
Click the trash icon to permanently remove a saved entry from local storage.

All three actions (pin, rename, delete) appear on hover over each sidebar item and use individual icon buttons with their own hover states.

---

### 9. Collapsible Sidebar

A panel-toggle button in the top-right of the header slides the sidebar in and out with a 300 ms transition, giving the main content area more horizontal space when needed.

---

### 10. Example Chips

Below the textarea, four example lyric lines are provided as clickable chips. Clicking any chip fills the textarea with that example, ready to parse with a single click.

---

### 11. Keyboard Shortcut

Press **⌘ + Enter** (macOS) or **Ctrl + Enter** (Windows / Linux) while the textarea is focused to trigger parsing without reaching for the mouse.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS 3 + inline styles |
| AI | Anthropic Claude (`claude-opus-4-6`) via tool use |
| Font | Noto Sans JP (Google Fonts) |
| Storage | Browser `localStorage` |

---

## Getting Started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Installation

```bash
git clone <repo-url>
cd Japanese-Songs-Lyrics-Parser
npm install
```

### Environment

Copy the example env file and add your key:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main page (layout, input form, results)
│   ├── layout.tsx            # Root layout with Noto Sans JP font
│   ├── globals.css           # Tailwind base + ruby/animation styles
│   └── api/parse/
│       └── route.ts          # POST /api/parse — calls Claude AI
├── components/
│   ├── LyricsDisplay.tsx     # Renders the array of parsed line cards
│   ├── LyricLineCard.tsx     # Single lyric line card (ruby + romaji + translation + grammar)
│   ├── GrammarCard.tsx       # Single grammar unit card with POS colouring
│   └── SavedLyricsSidebar.tsx# Left sidebar with saved lyrics list
├── hooks/
│   └── useSavedLyrics.ts     # localStorage persistence hook (save/rename/pin/delete)
└── types/
    └── index.ts              # Shared TypeScript interfaces
```

---

## How It Works

1. The user pastes lyrics into the textarea and clicks **解析歌词**.
2. The Next.js API route filters blank lines and sends the text to Claude using **tool use** — Claude is forced to fill a typed JSON schema rather than returning free text, which guarantees valid structured output.
3. Claude returns one analysis object per lyric line, each containing: `segments` (for ruby rendering), `fullRomaji`, `chineseTranslation`, and `grammarBreakdown`.
4. The frontend renders each line as a card with animated staggered fade-in. Grammar cards are colour-coded by part of speech.

---

## Notes

- Saved lyrics are stored in `localStorage` under the key `jlp_saved_lyrics` and never leave the browser.
- The `.env.local` file is git-ignored — your API key is never committed.
- For songs longer than ≈ 30 lines, consider splitting into verses to stay within Claude's recommended context for a single request.
