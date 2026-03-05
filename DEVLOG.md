# Building a Japanese Lyrics Parser with Claude — A Developer's Devlog

> How I built a full-stack AI-powered web app through conversational pair programming, and what I learned about collaborating with an LLM as a coding partner.

---

## Motivation

I came across a Bilibili creator ([卷心儿](https://space.bilibili.com/)) who posts beautifully formatted Japanese lyric breakdowns — hiragana annotations above every kanji, romaji below, Chinese translation, and a grammar card for each word. Doing this manually for every song is painstaking. I wanted to automate it into a web app.

The constraint I set for myself: build it entirely through a conversation with Claude. No pre-written boilerplate, no copying from previous projects — start from a README and a reference screenshot, and get to a working product purely through iterative back-and-forth.

---

## Phase 1: Briefing Claude with a Reference Image

The first thing I did was write a detailed README describing the project, embed the Bilibili reference screenshot in it, and tell Claude:

> "Read the README, understand the photo, ask me anything you're not sure about, then start building."

Claude asked three clarifying questions before writing a single line of code:

1. **Tech stack?** → Next.js 15
2. **Which AI API?** → Anthropic Claude
3. **Translation language — selector or fixed?** → Fixed Chinese

This upfront clarification step mattered. By the time Claude started scaffolding, it had a clear mental model of the end state. The initial output was a complete project skeleton: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, all four source layers (`types`, `api`, `components`, `hooks`), and a `.env.local.example`.

---

## Phase 2: The First Real Bug — JSON Parsing Failure

Once I wired up my API key and tested the parser, I got:

```
⚠ Failed to parse lyrics. Please try again.
```

I told Claude to debug it. The root cause turned out to be a subtle but serious problem: Claude (the AI being called *inside* the app) was returning Chinese text inside a JSON string, and that text contained unescaped double-quote characters. For example:

```json
"explanation": "意为"事情"，是..."
```

The inner `"事情"` broke JSON.parse at position 1042. Regular expression cleanup was fragile — it couldn't reliably distinguish structural quotes from content quotes in arbitrary Chinese text.

### The Fix: Switching to Tool Use

Instead of trying to parse Claude's free-text response, I switched the entire API integration to **Tool Use** (Anthropic's structured output feature). The idea is simple: instead of asking Claude to "return JSON", you define a typed schema as a tool and *force* Claude to call it. The SDK then gives you a native JavaScript object — no string parsing involved at all.

```typescript
const message = await client.messages.create({
  model: "claude-opus-4-6",
  tools: [TOOL],
  tool_choice: { type: "tool", name: "analyze_lyrics" }, // forced
  messages: [{ role: "user", content: lyrics }],
});

const toolUse = message.content.find((c) => c.type === "tool_use");
const { lines } = toolUse.input as { lines: ... };
```

With `tool_choice: { type: "tool", name: "..." }`, Claude has no option to respond with prose — it must populate the schema fields. This completely eliminated the JSON escaping problem.

There was one remaining edge case: even with tool use, Claude occasionally serialized array fields (`segments`, `grammarBreakdown`) as JSON *strings* rather than actual arrays. I added a defensive normalizer:

```typescript
function normalizeLineData(line: Record<string, unknown>): ParsedResult {
  for (const key of ["segments", "grammarBreakdown"] as const) {
    if (typeof line[key] === "string") {
      try { line[key] = JSON.parse(line[key] as string); }
      catch { line[key] = []; }
    }
  }
  return line as unknown as ParsedResult;
}
```

**Lesson:** When using LLMs to produce structured data, don't fight the text format — use the model's native structured output primitives. Tool Use / function calling is categorically more reliable than `JSON.parse(response.text)`.

---

## Phase 3: The Tool Schema Design

The schema I settled on captures everything needed to render a full lyric card. Per line:

```typescript
interface ParsedResult {
  originalText: string;        // original Japanese
  segments: Segment[];         // for ruby annotation
  fullRomaji: string;          // whole line in romaji
  chineseTranslation: string;  // contextual translation
  grammarBreakdown: GrammarUnit[];
}

interface Segment {
  text: string;
  hiragana: string | null; // null for pure kana — no annotation needed
  romaji: string;
}

interface GrammarUnit {
  text: string;
  hiragana: string;
  romaji: string;
  partOfSpeech: string;   // 名词/动词/助词...
  explanation: string;    // detailed Chinese explanation
}
```

The `hiragana: null` convention for pure kana segments is important — it lets the renderer skip the `<ruby>` wrapper for segments that don't need annotation, rather than showing a ruby annotation that mirrors the text itself.

### System Prompt Engineering

The system prompt does two things beyond basic instructions:

1. **Segment boundary rules** — telling Claude to split at natural morpheme boundaries, not character boundaries. This ensures `浮いている` is rendered as `<ruby>浮<rt>う</rt></ruby>いている` rather than annotating the trailing conjugation.

2. **Quote sanitization** — `Use 「」brackets for word meanings — never use ASCII double-quote characters`. This is a belt-and-suspenders precaution even with tool use, because explanation text goes into a string field that could still cause display issues if it contained stray quotes.

---

## Phase 4: Scaling to Full Songs

The initial implementation parsed one line at a time. I wanted to paste an entire song (~20 lines) and get everything back in one tap.

I described the requirement to Claude conversationally:

> "When I put the whole lyrics of a song, it only parses the first sentence. My real point is to parse the whole song in one single tap."

The changes were straightforward once the architecture was clear:

- Wrap the tool schema output in `{ lines: ParsedResult[] }` instead of a single object
- Raise `max_tokens` from `2048` to `16000` (a full song's analysis is verbose)
- Add blank-line filtering before sending (verse separators shouldn't become entries)
- Raise the input character limit to `5000`

```typescript
const nonEmptyLyrics = lyrics
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean)
  .join("\n");
```

This made a full J-pop song (≈20 lines) parseable in a single 20–40 second request.

---

## Phase 5: UI — Iterative Redesign

The UI went through several full rewrites. My approach throughout was to describe what I wanted visually and let Claude translate that into code. I never wrote a single CSS rule or JSX block directly.

### First Pass: Aurora Dark Theme

I asked for a "nice looking interface" and got:
- Aurora radial gradients (coral top-right, teal bottom-left) over `#07090e`
- White lyric cards with drop shadows and staggered `fadeInUp` animations
- Glass morphism sidebar with `backdropFilter: blur(24px)`
- Gradient title "歌詞解析" (coral → teal)

### Second Pass: Spec-Driven Dark Reconstruction

Later I provided a detailed design spec (inspired by modern code editor aesthetics) describing exact measurements, colors, and behaviors. Key decisions from that spec:

**Layout:**
- 52px sticky header (`position: fixed`, `z-index: 50`)
- Sidebar as `position: fixed` with `transform: translateX(0/-260px)` — not a width animation, which causes layout reflow. The main content area offsets with `margin-left: 260px / 0` transition instead.

**Color system:**
- Background: `#0f0f0f`
- Cards: `#1a1a1a` with `#2e2e2e` borders
- Grammar cards: `#141414` with `#272727` borders
- Japanese text: `#f0f0f0` (white, not coral — coral is reserved for UI accents)
- Furigana: orange `#f0956c` (matching the gradient title)
- Romaji: italic `#888`
- Translation: blue pill `rgba(74,158,255,0.1)` bg / `#4a9eff` text

**Grammar card left stripe:** uses a warm palette (`#EEC170`, `#F2A65A`, `#F58549`, `#585123`, `#772F1A`) mapped to parts of speech, providing visual scanning without bright colors clashing against the dark background.

### CSS Technique: Smooth Expand/Collapse Without `max-height` Jank

The grammar panel expand/collapse uses a CSS grid trick instead of the typical `max-height` approach:

```css
.grammar-grid-wrapper {
  display: grid;
  transition: grid-template-rows 0.28s ease, opacity 0.25s ease;
}
.grammar-grid-wrapper.open   { grid-template-rows: 1fr; opacity: 1; }
.grammar-grid-wrapper.closed { grid-template-rows: 0fr; opacity: 0; }
.grammar-grid-inner { overflow: hidden; }
```

The `max-height` approach has a well-known problem: the closing animation is slow if `max-height` is set much larger than the actual content. The grid trick transitions between exactly `0` and the natural content height, giving a smooth, tight animation in both directions.

---

## Phase 6: Saved Lyrics Feature

I described what I wanted in one message:

> "Add a save button. Basic functions: rename, delete, pin. List on the left side."

Claude designed the entire feature:

**`useSavedLyrics` hook** — all persistence logic encapsulated, separated from UI:

```typescript
const STORAGE_KEY = "jlp_saved_lyrics";

export function useSavedLyrics() {
  const [items, setItems] = useState<SavedLyric[]>([]);

  // hydrate from localStorage on mount
  useEffect(() => { /* ... */ }, []);

  const save    = (content: string, parsedResult?: ParsedResult[]) => { /* ... */ };
  const remove  = (id: string) => { /* ... */ };
  const rename  = (id: string, title: string) => { /* ... */ };
  const togglePin = (id: string) => { /* ... */ };

  // pinned first, both groups newest-first
  const sorted = [
    ...items.filter(i => i.pinned).sort((a, b) => b.savedAt - a.savedAt),
    ...items.filter(i => !i.pinned).sort((a, b) => b.savedAt - a.savedAt),
  ];

  return { saved: sorted, save, remove, rename, togglePin };
}
```

**Auto-title** — the first non-empty line of the lyrics becomes the entry title (truncated to 40 chars), so I never have to name anything manually.

**Parsed result persistence** — I later extended this to also save the `ParsedResult[]` alongside the raw lyrics text. Loading a saved entry now instantly restores the full analysis without a re-parse API call.

---

## Phase 7: Debugging Workflow

When things broke, my pattern was always:
1. Describe the symptom to Claude ("still getting parse error")
2. Claude would hypothesize the cause
3. I'd confirm or deny based on what I was seeing
4. Claude would produce a targeted fix

One example: after a code session, the dev server wouldn't start:
```
Cannot find module '../chunks/ssr/[turbopack]_runtime.js'
```
This was a stale `.next` cache from a previous Turbopack build conflicting with new chunks. Fix: `rm -rf .next`. Claude recognized the pattern immediately.

Another common issue was port conflicts when restarting the dev server. Claude would run `pkill -f "next dev"` and `lsof -ti tcp:3000 | xargs kill -9` to clear them.

---

## Architecture Summary

```
Browser
  └── page.tsx (client component)
        ├── useSavedLyrics (localStorage hook)
        ├── SavedLyricsSidebar
        ├── Input form → POST /api/parse
        └── LyricsDisplay
              └── LyricLineCard (×N lines)
                    └── GrammarCard (×M words)

Server
  └── /api/parse (Next.js Route Handler)
        └── Anthropic SDK
              └── claude-opus-4-6
                    └── Tool Use: analyze_lyrics
```

No database. No auth. No build-time data fetching. The only server-side work is proxying the Anthropic API call (to keep the API key out of the browser). Everything else is client-side React state and `localStorage`.

---

## What Made This Collaboration Work

### 1. Leading with constraints, not solutions
Rather than saying "write a function that does X", I'd describe the user-facing goal and let Claude pick the implementation. "Parse a full song in one tap" led to a better architecture than "change the schema to an array" would have.

### 2. Showing reference material
Giving Claude the Bilibili screenshot alongside the README produced a first-pass UI that was directionally correct. Visual references communicate proportions, hierarchy, and mood faster than text descriptions.

### 3. Iterating on specs, not diffs
For the UI redesign, I wrote a detailed spec (colors, heights, transitions, component behavior) rather than asking for incremental tweaks. Claude could then rebuild entire files coherently rather than layering patches.

### 4. Trusting the debugging loop
When something broke, I didn't try to fix it myself first — I described the symptom and let Claude trace the root cause. Claude's ability to hold the entire codebase in context and reason about where a `JSON.parse` failure at position 1042 was coming from saved a lot of time.

### 5. One concern at a time
Each message addressed one thing: "add save functionality", "make cards wider", "change the furigana color". Compound requests ("add save + redesign the header + fix the parse bug") tend to produce messier results.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 3 + inline styles |
| AI | Anthropic Claude `claude-opus-4-6` via Tool Use |
| Font | Noto Sans JP (Google Fonts, `preload: false`) |
| Storage | Browser `localStorage` |
| Deployment | — |

---

## Time Spent

The entire project — from blank directory to feature-complete dark-theme app — was built in a single extended conversation with Claude. No pre-written code was brought in. Every file was either generated or iterated through Claude's edits.

The conversation covered: initial scaffolding → first bug fix (Tool Use migration) → multi-line support → three UI redesigns → saved lyrics feature → dark theme reconstruction → incremental visual polish.
