"use client";

import { useMemo, useState } from "react";

type YearData = {
  year: number;
  change: number;
  open: number;
  close: number;
  low: number;
  high: number;
  volume: string;
  prices: number[];
  top: { price: number; date: string }[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const YEARS: YearData[] = [
  {
    year: 2025, change: -4.8, open: 132.18, close: 125.84, low: 100.54, high: 163.93, volume: "876M",
    prices: [132, 141, 119, 122, 127, 132, 143, 126, 118, 121, 130, 126],
    top: [{ price: 163.93, date: "Feb 14" }, { price: 160.10, date: "Feb 13" }, { price: 158.72, date: "Feb 18" }],
  },
  {
    year: 2024, change: 12.7, open: 136.14, close: 131.41, low: 110.38, high: 170.10, volume: "1.06B",
    prices: [145, 157, 165, 158, 145, 151, 139, 117, 127, 136, 137, 131],
    top: [{ price: 170.10, date: "Mar 21" }, { price: 168.95, date: "Mar 22" }, { price: 166.99, date: "Mar 20" }],
  },
  {
    year: 2023, change: 59.4, open: 85.50, close: 136.14, low: 81.91, high: 154.95, volume: "1.25B",
    prices: [106, 124, 119, 120, 112, 128, 152, 132, 137, 119, 126, 136],
    top: [{ price: 154.95, date: "Jul 31" }, { price: 153.33, date: "Jul 28" }, { price: 152.37, date: "Aug 01" }],
  },
  {
    year: 2022, change: -48.7, open: 166.49, close: 85.50, low: 81.91, high: 191.73, volume: "1.48B",
    prices: [155, 165, 173, 153, 120, 89, 110, 115, 105, 113, 97, 86],
    top: [{ price: 191.73, date: "Feb 16" }, { price: 190.00, date: "Feb 15" }, { price: 186.64, date: "Feb 17" }],
  },
  {
    year: 2021, change: 13.4, open: 147.00, close: 166.49, low: 129.71, high: 216.84, volume: "1.71B",
    prices: [183, 206, 189, 172, 140, 153, 145, 155, 168, 170, 193, 166],
    top: [{ price: 216.84, date: "Feb 11" }, { price: 215.40, date: "Feb 12" }, { price: 212.68, date: "Nov 17" }],
  },
];

function MiniChart({ data }: { data: YearData }) {
  const [active, setActive] = useState<number | null>(null);
  const width = 760;
  const height = 254;
  const pad = 18;
  const min = Math.min(...data.prices) - 8;
  const max = Math.max(...data.prices) + 8;
  const pts = data.prices.map((price, i) => ({
    price,
    x: pad + (i * (width - pad * 2)) / (data.prices.length - 1),
    y: pad + ((max - price) * (height - pad * 2)) / (max - min),
  }));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const area = `${line} L${pts.at(-1)!.x},${height} L${pts[0].x},${height} Z`;

  return (
    <div className="chart-wrap" onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${data.year} ABNB monthly price chart`}>
        <defs>
          <linearGradient id={`fill-${data.year}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff385c" stopOpacity=".26" />
            <stop offset="100%" stopColor="#ff385c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((n) => <line key={n} className="grid-line" x1="0" x2={width} y1={34 + n * 58} y2={34 + n * 58} />)}
        <path d={area} fill={`url(#fill-${data.year})`} />
        <path d={line} className="price-line" />
        {pts.map((p, i) => (
          <g key={i}>
            <rect className="hit" x={p.x - 28} y="0" width="56" height={height} onMouseEnter={() => setActive(i)} onTouchStart={() => setActive(i)} />
            {active === i && <>
              <line className="crosshair" x1={p.x} x2={p.x} y1="0" y2={height} />
              <circle className="point" cx={p.x} cy={p.y} r="5" />
            </>}
          </g>
        ))}
      </svg>
      {active !== null && (
        <div className="tooltip" style={{ left: `${(pts[active].x / width) * 100}%`, top: `${(pts[active].y / height) * 100}%` }}>
          <span>{MONTHS[active]} {data.year}</span>
          <strong>${pts[active].price.toFixed(2)}</strong>
        </div>
      )}
      <div className="months">{MONTHS.map((m) => <span key={m}>{m}</span>)}</div>
    </div>
  );
}

function YearCard({ data, index }: { data: YearData; index: number }) {
  return (
    <article className="year-card" style={{ "--delay": `${index * 60}ms` } as React.CSSProperties}>
      <div className="card-head">
        <div>
          <span className="eyebrow">YEAR IN REVIEW</span>
          <div className="year-row"><h2>{data.year}</h2><span className={data.change >= 0 ? "change up" : "change down"}>{data.change >= 0 ? "↗" : "↘"} {Math.abs(data.change)}%</span></div>
        </div>
        <div className="range"><span>Annual range</span><strong>${data.low.toFixed(2)} — ${data.high.toFixed(2)}</strong></div>
      </div>
      <div className="card-body">
        <div className="chart-panel">
          <MiniChart data={data} />
          <div className="stats">
            <div><span>Open</span><strong>${data.open.toFixed(2)}</strong></div>
            <div><span>Close</span><strong>${data.close.toFixed(2)}</strong></div>
            <div><span>Volume</span><strong>{data.volume}</strong></div>
          </div>
        </div>
        <aside className="top-panel">
          <div className="top-title"><span>Peak prices</span><small>TOP 3</small></div>
          {data.top.map((item, i) => (
            <div className="peak" key={item.date}>
              <span className="rank">0{i + 1}</span>
              <div><strong>${item.price.toFixed(2)}</strong><span>{item.date}, {data.year}</span></div>
            </div>
          ))}
        </aside>
      </div>
    </article>
  );
}

export default function Home() {
  const [visible, setVisible] = useState(3);
  const shown = useMemo(() => YEARS.slice(0, visible), [visible]);
  return (
    <main>
      <nav>
        <a className="brand" href="#top" aria-label="StayAlpha home"><span className="brand-mark">A</span><span>STAY<span>ALPHA</span></span></a>
        <div className="nav-center"><a className="active" href="#history">Overview</a><a href="#history">History</a><a href="#about">About</a></div>
        <button className="watch"><span>＋</span> Watchlist</button>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="ticker"><span className="ticker-icon">A</span><div><b>Airbnb, Inc.</b><span>NASDAQ · ABNB</span></div></div>
          <h1>Years of travel.<br /><em>One clear view.</em></h1>
          <p>Explore Airbnb’s stock journey, one year at a time. Compare momentum, spot annual peaks, and see the long view without the noise.</p>
        </div>
        <div className="quote">
          <div className="live"><i /> MARKET CLOSED</div>
          <div className="quote-line"><strong>$125.84</strong><span className="down">−2.18 · 1.70%</span></div>
          <div className="quote-meta"><span>Sample snapshot</span><span>USD</span></div>
          <div className="spark">
            <svg viewBox="0 0 300 60"><path d="M0 12 C25 8 37 25 55 22 S89 9 105 18 S139 46 157 37 S195 27 211 41 S247 28 265 35 S285 50 300 44" /></svg>
          </div>
        </div>
      </section>

      <section className="section-head" id="history">
        <div><span className="eyebrow">HISTORICAL PERFORMANCE</span><h2>The annual tape</h2></div>
        <p>Monthly snapshots · Hover the line for details</p>
      </section>

      <section className="cards">
        {shown.map((data, i) => <YearCard key={data.year} data={data} index={i} />)}
      </section>

      {visible < YEARS.length && <button className="load" onClick={() => setVisible(YEARS.length)}>View full history <span>↓</span></button>}

      <footer id="about">
        <div className="brand"><span className="brand-mark">A</span><span>STAY<span>ALPHA</span></span></div>
        <p>ABNB, year by year.</p>
        <span>Demo data · Not financial advice</span>
      </footer>
    </main>
  );
}
