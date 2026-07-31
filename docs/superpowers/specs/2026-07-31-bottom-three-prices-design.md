# Bottom 3 Prices Design

## Goal

Add a lowest-price ranking beside the existing Peak prices ranking in every annual ABNB card, using the same real Nasdaq daily data and visual language.

## Data

- Extend each annual record with `bottom`, containing exactly three entries.
- Calculate entries from the daily low field, not the closing price.
- Sort ascending so rank 01 is the lowest intraday price of the year.
- Preserve the trading date associated with each value.
- Keep the current `top` calculation unchanged.
- Generate both lists whenever `scripts/build-stock-data.mjs` refreshes `app/abnb-data.json`.

## Layout

### Desktop

- Keep the chart as the primary left region.
- Expand the right-side market-extremes region into two equal columns.
- Place `Peak prices / TOP 3` first and `Lowest prices / BOTTOM 3` second.
- Use the existing rank, price, date, separators, typography, and spacing.
- Give Bottom 3 a subdued cool accent so it is distinguishable without competing with the Airbnb red.

### Tablet

- Move the market-extremes region below the chart.
- Keep Peak 3 and Bottom 3 side by side.

### Mobile

- Stack Peak 3 above Bottom 3.
- Keep each price row full width and retain the existing readable date size.

## Component Structure

- Add `bottom` to `YearData`.
- Extract the repeated ranking markup into a small `PriceRanking` component.
- Render two `PriceRanking` instances inside a shared `extremes-panel`.
- Keep `YearCard` responsible only for composing the chart, statistics, and rankings.

## Testing

- Add a data-generation test that verifies every year has three Bottom 3 entries.
- Verify Bottom 3 is sorted from lowest to highest.
- Verify each displayed value and date comes from the source year’s daily-low rows.
- Run the complete test suite and production build before publishing.

## Acceptance Criteria

- Every year from 2021 through 2026 displays both Top 3 and Bottom 3.
- Bottom 3 values use real intraday lows rather than closes.
- Desktop, tablet, and mobile layouts remain readable without horizontal overflow.
- Existing chart interaction, sticky year navigation, annual statistics, and Peak 3 values continue to work.
