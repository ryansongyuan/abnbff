# Live Stock Refresh Design

## Goal

Keep the ABNB dashboard current while it is open, refreshing market data at most once per minute and preserving a usable page when the upstream market-data service is unavailable.

## User Experience

- Render the bundled last-known-good dataset immediately so the page never waits on the network before showing content.
- On initial page load, request fresh data from the site's own `/api/stock` endpoint.
- Repeat the request every 60 seconds while the page remains open.
- Replace the hero quote, update timestamp, annual charts, annual summary values, Top 3, and Bottom 3 from one atomic stock-data response.
- When the latest price changes, animate the old value upward and out while the new value enters from below. Add a brief red accent for an upward move and green accent for a downward move, matching the site's existing color convention.
- Do not animate when the value is unchanged or on the initial static render.
- Respect `prefers-reduced-motion` by replacing the transition with an immediate value update.
- If refreshing fails, keep the most recent successful data on screen and retain its market timestamp. Do not replace content with an error state or interrupt the user.

## Architecture

### Server data boundary

Add a server route at `/api/stock` that is the only browser-facing market-data boundary. It will:

1. Fetch ABNB historical daily data from the same Nasdaq source currently used to generate the bundled JSON.
2. Normalize the upstream response with the existing pure stock-data transformation.
3. Cache a successful normalized response for 60 seconds at the edge/runtime level.
4. Return the cached response during the cache window.
5. If the upstream request or normalization fails, return the bundled last-known-good dataset with an explicit stale indicator rather than failing the page.

The browser never calls Nasdaq directly. This avoids cross-origin failures, centralizes response validation, and prevents every visitor from independently hitting the upstream service.

### Shared stock-data module

Move the reusable normalization and transformation logic out of the Node-only CLI script into a runtime-safe module. The CLI generator and the server route will both consume the same function, preventing differences between build-time and live data.

The normalized response shape remains compatible with the existing UI and adds metadata:

```ts
type StockResponse = StockData & {
  fetchedAt: string;
  stale: boolean;
};
```

`updated` continues to represent the market date of the latest quote. `fetchedAt` represents when the site checked the upstream source. `stale` reports whether the bundled fallback was used.

### Client state and refresh lifecycle

Convert the page from a module-level static dataset to state initialized from the bundled JSON. A small refresh effect will:

- request `/api/stock` immediately after mount;
- schedule the next check every 60 seconds;
- cancel the timer and in-flight request on unmount;
- ignore malformed responses;
- update the entire dataset atomically after validation.

The year navigation and charts derive from current state, so adding a new calendar year to the response automatically adds its card and navigation item.

## Price Animation

Create a focused animated-price component for the hero quote. It receives the current price and previous price, derives direction, and controls a short two-layer number transition. The animation lasts roughly 450 ms and only runs after a successful refresh changes the numeric value.

The quote card receives a temporary direction class during the transition so its border/glow and sparkline endpoint echo the same red-up or green-down signal. The animation is visual only and does not delay committing the new stock dataset.

## Error Handling

- Upstream timeout: abort promptly and return the latest cached response; if no runtime cache exists, return bundled data as stale.
- Non-200 response, malformed JSON, missing trading rows, or invalid numeric values: treat as upstream failure and use the same fallback path.
- Client fetch failure: keep current state and retry on the next 60-second interval.
- Empty or partial current year: include only available trading days; future months remain visually empty.

## Caching and Freshness

- Server success responses are cached for 60 seconds.
- The client checks immediately on entry and every 60 seconds afterward.
- Concurrent visitors within the same cache window share the cached market response when supported by the runtime.
- Browser responses use cache headers that permit a 60-second shared cache while allowing stale data during brief revalidation failures.

This provides one-minute freshness without making every browser request directly dependent on Nasdaq availability. Nasdaq states that its displayed market information can be delayed and that real-time data products are separate offerings, so the UI will continue to show the exact market timestamp rather than claiming tick-level real time.

## Testing

- Unit-test the runtime-safe transformation with valid, empty, and malformed upstream fixtures.
- Route-test a successful live response, 60-second cache behavior, and bundled stale fallback.
- Component-test that a changed price triggers the correct direction and an unchanged price does not animate.
- Verify the full build and existing annual-card rendering tests.
- Browser-check initial rendering, a simulated refresh, reduced-motion behavior, console health, and responsive layouts.

## Scope

Included: automatic one-minute refresh while the page is open, first-load refresh, server caching, stale fallback, full dashboard data replacement, and hero price animation.

Excluded: tick-by-tick streaming, WebSockets, user-configurable intervals, notifications, trading actions, and guaranteed exchange-grade real-time quotes.
