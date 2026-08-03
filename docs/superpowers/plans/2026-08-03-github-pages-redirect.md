# GitHub Pages Redirect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a GitHub Pages entry page that redirects visitors to the existing live ABNB website.

**Architecture:** A standalone root `index.html` provides meta-refresh, JavaScript, and manual-link navigation to the canonical live site. A GitHub Actions workflow packages only that file and deploys it with GitHub's official Pages actions.

**Tech Stack:** HTML5, CSS, JavaScript, Node.js built-in test runner, GitHub Actions, GitHub Pages

## Global Constraints

- Redirect exactly to `https://stayalpha-abnb.jn34t34.chatgpt.site/`.
- Keep the existing Next/Vinext application and live-data API unchanged.
- Deploy only the static redirect entry page through GitHub Pages.
- Include a visible manual link when automatic navigation is unavailable.
- Prevent the redirect page from competing with the canonical live site in search results.

---

### Task 1: Redirect Entry Page

**Files:**
- Create: `tests/github-pages.test.mjs`
- Create: `index.html`
- Modify: `package.json`

**Interfaces:**
- Consumes: canonical URL `https://stayalpha-abnb.jn34t34.chatgpt.site/`
- Produces: root `index.html` suitable for a static Pages artifact

- [ ] **Step 1: Write the failing test**

Create `tests/github-pages.test.mjs` that reads `index.html` and asserts:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const destination = "https://stayalpha-abnb.jn34t34.chatgpt.site/";

test("GitHub Pages entry redirects and offers a manual canonical link", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /http-equiv=["']refresh["']/i);
  assert.ok(html.includes(`location.replace(${JSON.stringify(destination)})`));
  assert.match(html, new RegExp(`<a[^>]+href=["']${destination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i"));
  assert.match(html, /rel=["'][^"']*canonical[^"']*["']/i);
  assert.match(html, /noindex/i);
});
```

Append `tests/github-pages.test.mjs` to the existing `test` script in `package.json`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec node --test tests/github-pages.test.mjs`

Expected: FAIL with `ENOENT` because `index.html` does not exist.

- [ ] **Step 3: Write the minimal redirect page**

Create a standards-based HTML document with:

```html
<meta http-equiv="refresh" content="0; url=https://stayalpha-abnb.jn34t34.chatgpt.site/">
<link rel="canonical" href="https://stayalpha-abnb.jn34t34.chatgpt.site/">
<meta name="robots" content="noindex, follow">
<script>location.replace("https://stayalpha-abnb.jn34t34.chatgpt.site/");</script>
<a href="https://stayalpha-abnb.jn34t34.chatgpt.site/">Continue to ABNB Final Fight</a>
```

Wrap the link in an accessible dark fallback screen matching the site's black and pink visual language. Use inline CSS only so the entry file has no local asset dependencies.

- [ ] **Step 4: Run the focused and full tests**

Run: `pnpm exec node --test tests/github-pages.test.mjs`

Expected: 1 test passes.

Run: `pnpm test`

Expected: build succeeds and all tests pass.

- [ ] **Step 5: Commit**

```bash
git add index.html package.json tests/github-pages.test.mjs
git commit -m "Add GitHub Pages redirect entry"
```

### Task 2: Pages Deployment Workflow

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `tests/github-pages.test.mjs`

**Interfaces:**
- Consumes: root `index.html` from Task 1
- Produces: deployable GitHub Pages artifact and Pages deployment

- [ ] **Step 1: Extend the failing test**

Extend `tests/github-pages.test.mjs` to read `.github/workflows/pages.yml` and assert that it:

```js
assert.match(workflow, /actions\/configure-pages@v5/);
assert.match(workflow, /actions\/upload-pages-artifact@v3/);
assert.match(workflow, /actions\/deploy-pages@v4/);
assert.match(workflow, /path:\s*['"]?\.\/pages-dist['"]?/);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm exec node --test tests/github-pages.test.mjs`

Expected: FAIL with `ENOENT` because `.github/workflows/pages.yml` does not exist.

- [ ] **Step 3: Add the minimal official workflow**

Create `.github/workflows/pages.yml` with:

- `push` trigger for `main` and `workflow_dispatch`.
- `contents: read`, `pages: write`, and `id-token: write` permissions.
- A build job that creates `pages-dist`, copies `index.html`, configures Pages, and uploads `pages-dist`.
- A deploy job that uses the `github-pages` environment and `actions/deploy-pages@v4`.
- Concurrency group `pages` with cancellation enabled.

- [ ] **Step 4: Run full verification**

Run: `pnpm test`

Expected: build succeeds and all tests pass.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 5: Commit and publish**

```bash
git add .github/workflows/pages.yml tests/github-pages.test.mjs
git commit -m "Deploy redirect with GitHub Pages"
git push origin main
```

Use `gh api` to set the repository Pages build type to `workflow` if needed, then verify the Pages workflow run and report the published URL.
