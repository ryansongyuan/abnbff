# Bottom 3 Prices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-data Bottom 3 price ranking beside Peak prices in every annual ABNB card.

**Architecture:** Refactor the stock-data generator into an importable pure transformation plus its existing CLI wrapper, then derive both yearly high and low rankings from Nasdaq intraday values. Extract the repeated ranking UI into a reusable component and compose two ranking columns within the existing annual card.

**Tech Stack:** Node.js built-in test runner, React 19, TypeScript, CSS Grid, vinext/Vite, Sites hosting.

## Global Constraints

- Bottom 3 uses the daily intraday `low` field, never closing prices.
- Rank 01 is the lowest price, followed by ascending values.
- Every year from 2021 through 2026 shows exactly three entries.
- Desktop shows Peak 3 and Bottom 3 side by side; tablet keeps them side by side below the chart; mobile stacks Peak 3 above Bottom 3.
- Existing chart interaction, sticky navigation, annual statistics, and Peak 3 behavior remain unchanged.

---

### Task 1: Generate and Test Bottom 3 Data

**Files:**
- Create: `tests/stock-data.test.mjs`
- Modify: `scripts/build-stock-data.mjs`
- Regenerate: `app/abnb-data.json`

**Interfaces:**
- Produces: `buildStockData(source: NasdaqResponse, yearsToInclude?: number[]): StockData`
- Produces: `StockData.years[].bottom: Array<{ price: number; date: string }>`

- [ ] **Step 1: Write the failing data-generation test**

Create a complete two-year Nasdaq fixture with five daily rows and assert independently derived literal Bottom 3 results:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { buildStockData } from "../scripts/build-stock-data.mjs";

const source = {
  data: {
    tradesTable: {
      rows: [
        { date: "01/05/2026", close: "$15.00", open: "$14.00", high: "$16.00", low: "$13.00", volume: "100" },
        { date: "01/04/2026", close: "$14.00", open: "$13.00", high: "$15.00", low: "$9.00", volume: "100" },
        { date: "01/03/2026", close: "$13.00", open: "$12.00", high: "$14.00", low: "$11.00", volume: "100" },
        { date: "01/02/2026", close: "$12.00", open: "$11.00", high: "$13.00", low: "$8.00", volume: "100" },
        { date: "01/01/2026", close: "$11.00", open: "$10.00", high: "$12.00", low: "$10.00", volume: "100" },
      ],
    },
  },
};

test("buildStockData ranks the three lowest intraday prices in ascending order", () => {
  const result = buildStockData(source, [2026]);
  assert.deepEqual(result.years[0].bottom, [
    { price: 8, date: "01/02/2026" },
    { price: 9, date: "01/04/2026" },
    { price: 10, date: "01/01/2026" },
  ]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/stock-data.test.mjs
```

Expected: FAIL because `buildStockData` is not exported or `bottom` is missing.

- [ ] **Step 3: Refactor the generator and add Bottom 3**

Expose the pure transformation while preserving CLI behavior:

```js
export function buildStockData(source, yearsToInclude = [2026, 2025, 2024, 2023, 2022, 2021]) {
  const rows = normalizeRows(source);
  const years = yearsToInclude.map((year) => {
    const days = rows.filter((row) => Number(row.date.slice(-4)) === year);
    const top = [...days]
      .sort((a, b) => b.high - a.high)
      .slice(0, 3)
      .map((day) => ({ price: day.high, date: day.date }));
    const bottom = [...days]
      .sort((a, b) => a.low - b.low)
      .slice(0, 3)
      .map((day) => ({ price: day.low, date: day.date }));

    const first = days[0];
    const last = days.at(-1);
    return {
      year,
      change: ((last.close - first.open) / first.open) * 100,
      open: first.open,
      close: last.close,
      low: Math.min(...days.map((day) => day.low)),
      high: Math.max(...days.map((day) => day.high)),
      volume: fmtVolume(days.reduce((sum, day) => sum + day.volume, 0)),
      days: days.map(({ date, close }) => ({ date, price: close })),
      top,
      bottom,
    };
  });

  const latest = rows.at(-1);
  const previous = rows.at(-2);
  const delta = latest.close - previous.close;
  return {
    source: "Nasdaq",
    updated: latest.date,
    latest: latest.close,
    delta,
    deltaPercent: (delta / previous.close) * 100,
    years,
  };
}
```

Keep `fs.writeFileSync(output, JSON.stringify(buildStockData(source)))` in the CLI path.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test tests/stock-data.test.mjs
```

Expected: PASS, 1 test, 0 failures.

- [ ] **Step 5: Regenerate production stock data**

Run:

```bash
node scripts/build-stock-data.mjs /private/tmp/abnb-nasdaq.json app/abnb-data.json
```

Then inspect every year:

```bash
node -e 'const d=require("./app/abnb-data.json"); console.log(d.years.map(y=>[y.year,y.bottom]))'
```

Expected: six years, each with three ascending Bottom 3 entries.

- [ ] **Step 6: Commit the data task**

```bash
git add scripts/build-stock-data.mjs tests/stock-data.test.mjs app/abnb-data.json
git commit -m "Add tested Bottom 3 stock data"
```

---

### Task 2: Render Responsive Peak and Bottom Rankings

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `YearData.bottom: Array<{ price: number; date: string }>`
- Produces: `PriceRanking({ title, badge, items, tone })`

- [ ] **Step 1: Add Bottom 3 to the page data type**

```ts
type PricePoint = { price: number; date: string };

type YearData = {
  year: number;
  change: number;
  open: number;
  close: number;
  low: number;
  high: number;
  volume: string;
  days: { date: string; price: number }[];
  top: PricePoint[];
  bottom: PricePoint[];
};
```

- [ ] **Step 2: Extract the repeated ranking component**

```tsx
function PriceRanking({
  title,
  badge,
  items,
  tone,
}: {
  title: string;
  badge: string;
  items: PricePoint[];
  tone: "peak" | "bottom";
}) {
  return (
    <section className={`price-ranking ${tone}`}>
      <div className="ranking-title"><span>{title}</span><small>{badge}</small></div>
      {items.map((item, index) => (
        <div className="price-extreme" key={`${item.date}-${item.price}`}>
          <span className="rank">0{index + 1}</span>
          <div><strong>${item.price.toFixed(2)}</strong><span>{formatDate(item.date)}</span></div>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Compose both rankings in each YearCard**

Replace the existing single aside:

```tsx
<aside className="extremes-panel">
  <PriceRanking title="Peak prices" badge="TOP 3" items={data.top} tone="peak" />
  <PriceRanking title="Lowest prices" badge="BOTTOM 3" items={data.bottom} tone="bottom" />
</aside>
```

- [ ] **Step 4: Implement desktop, tablet, and mobile grids**

Desktop:

```css
.card-body { grid-template-columns: minmax(0, 1fr) minmax(440px, .72fr); }
.extremes-panel { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.price-ranking { padding: 27px 25px; }
.price-ranking + .price-ranking { border-left: 1px solid var(--line); }
.price-ranking.bottom .ranking-title small { color: #7aa2ff; }
```

Tablet below the existing `max-width: 900px` breakpoint:

```css
.extremes-panel { grid-template-columns: repeat(2, minmax(0, 1fr)); }
```

Mobile below the existing `max-width: 600px` breakpoint:

```css
.extremes-panel { grid-template-columns: 1fr; }
.price-ranking + .price-ranking { border-left: 0; border-top: 1px solid var(--line); }
```

- [ ] **Step 5: Run focused data test and production build**

Run:

```bash
node --test tests/stock-data.test.mjs
pnpm run build
```

Expected: focused test passes and build exits 0.

- [ ] **Step 6: Commit the UI task**

```bash
git add app/page.tsx app/globals.css
git commit -m "Render responsive Peak and Bottom price rankings"
```

---

### Task 3: Final Verification and Private Deployment

**Files:**
- Verify: `app/abnb-data.json`
- Verify: `app/page.tsx`
- Verify: `app/globals.css`
- Package: `/private/tmp/abnb-final-fight-bottom-three.tar.gz`

**Interfaces:**
- Consumes: completed Task 1 and Task 2 commits.
- Produces: saved and privately deployed Sites version.

- [ ] **Step 1: Run fresh verification**

```bash
node --test tests/stock-data.test.mjs
pnpm run build
git status --short
```

Expected: 1 test passes, build exits 0, and only intentional plan-tracking changes remain.

- [ ] **Step 2: Push exact source commit**

Create a short-lived Sites source credential and push the current `main` HEAD without persisting the token.

- [ ] **Step 3: Package the exact build**

```bash
/Users/ryan/.codex/plugins/cache/openai-bundled/sites/0.1.33/scripts/package-site.sh \
  /Users/ryan/Desktop/abnb-stock-tracker \
  /private/tmp/abnb-final-fight-bottom-three.tar.gz
```

- [ ] **Step 4: Save and deploy privately**

Save one Sites version with the pushed HEAD SHA and package, deploy that saved version privately, and poll until terminal status.

- [ ] **Step 5: Open the successful deployment**

Open the returned production URL in the current Codex task and report the URL plus the visible Bottom 3 behavior.
