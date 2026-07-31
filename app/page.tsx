"use client";

import { useEffect, useState } from "react";
import stockData from "./abnb-data.json";

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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS = stockData.years as YearData[];

function parseDate(value: string) {
  const [month, day, year] = value.split("/").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parseDate(value));
}

function MiniChart({ data }: { data: YearData }) {
  const [active, setActive] = useState<number | null>(null);
  const width = 760;
  const height = 254;
  const pad = 18;
  const min = Math.min(...data.days.map((day) => day.price)) - 6;
  const max = Math.max(...data.days.map((day) => day.price)) + 6;
  const start = Date.UTC(data.year, 0, 1);
  const end = Date.UTC(data.year + 1, 0, 1);
  const pts = data.days.map((day) => {
    const price = day.price;
    return {
      ...day,
      x: pad + ((parseDate(day.date).getTime() - start) / (end - start)) * (width - pad * 2),
      y: pad + ((max - price) * (height - pad * 2)) / (max - min),
    };
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const area = `${line} L${pts.at(-1)!.x},${height} L${pts[0].x},${height} Z`;

  return (
    <div className="chart-wrap" onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${data.year} ABNB daily closing price chart`}>
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
            <rect className="hit" x={p.x - 3} y="0" width="6" height={height} onMouseEnter={() => setActive(i)} onTouchStart={() => setActive(i)} />
            {active === i && <>
              <line className="crosshair" x1={p.x} x2={p.x} y1="0" y2={height} />
              <circle className="point" cx={p.x} cy={p.y} r="5" />
            </>}
          </g>
        ))}
      </svg>
      {active !== null && (
        <div className="tooltip" style={{ left: `${(pts[active].x / width) * 100}%`, top: `${(pts[active].y / height) * 100}%` }}>
          <span>{formatDate(pts[active].date)}</span>
          <strong>${pts[active].price.toFixed(2)}</strong>
        </div>
      )}
      <div className="months">{MONTHS.map((m) => <span key={m}>{m}</span>)}</div>
    </div>
  );
}

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
      {items.map((item, i) => (
        <div className="price-extreme" key={`${item.date}-${item.price}`}>
          <span className="rank">0{i + 1}</span>
          <div><strong>${item.price.toFixed(2)}</strong><span>{formatDate(item.date)}</span></div>
        </div>
      ))}
    </section>
  );
}

function YearCard({ data, index }: { data: YearData; index: number }) {
  return (
    <article id={`year-${data.year}`} className="year-card" style={{ "--delay": `${index * 60}ms` } as React.CSSProperties}>
      <div className="card-head">
        <div className="year-summary">
          <span className="eyebrow">YEAR IN REVIEW</span>
          <div className="year-row"><h2>{data.year}</h2><span className={data.change >= 0 ? "change up" : "change down"}>{data.change >= 0 ? "↗" : "↘"} {Math.abs(data.change).toFixed(1)}%</span></div>
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
        <aside className="extremes-panel">
          <PriceRanking title="Peak prices" badge="TOP 3" items={data.top} tone="peak" />
          <PriceRanking title="Lowest prices" badge="BOTTOM 3" items={data.bottom} tone="bottom" />
        </aside>
      </div>
    </article>
  );
}

export default function Home() {
  const [activeYear, setActiveYear] = useState(YEARS[0].year);
  const latestDays = YEARS[0].days.slice(-35);
  const sparkMin = Math.min(...latestDays.map((day) => day.price));
  const sparkMax = Math.max(...latestDays.map((day) => day.price));
  const sparkPath = latestDays.map((day, index) => {
    const x = (index / (latestDays.length - 1)) * 300;
    const y = 8 + ((sparkMax - day.price) / (sparkMax - sparkMin)) * 44;
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const deltaClass = stockData.delta >= 0 ? "up-text" : "down";
  const deltaSign = stockData.delta >= 0 ? "+" : "−";

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveYear(Number(visible.target.id.replace("year-", "")));
      },
      { rootMargin: "-95px 0px -55% 0px", threshold: [0.05, 0.2, 0.5] },
    );
    YEARS.forEach(({ year }) => {
      const element = document.getElementById(`year-${year}`);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <main>
      <nav>
        <a className="brand" href="#top" aria-label="ABNB Final Fight home"><span className="brand-name">ABNB <span>FINAL FIGHT</span></span></a>
        <div className="nav-center">
          {YEARS.map((item) => <a className={activeYear === item.year ? "active" : ""} href={`#year-${item.year}`} key={item.year}>{item.year}</a>)}
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="ticker"><img className="ticker-logo" src="/airbnb-logo.png" alt="Airbnb logo" /><div><b>Airbnb, Inc.</b><span>NASDAQ · ABNB</span></div></div>
          <h1>Latest close.<br /><em>${stockData.latest.toFixed(2)}</em></h1>
        </div>
        <div className="quote">
          <div className="live"><i /> MARKET CLOSED</div>
          <div className="quote-line"><strong>${stockData.latest.toFixed(2)}</strong><span className={deltaClass}>{deltaSign}{Math.abs(stockData.delta).toFixed(2)} · {Math.abs(stockData.deltaPercent).toFixed(2)}%</span></div>
          <div className="quote-meta"><span>Nasdaq · {formatDate(stockData.updated)}</span><span>USD</span></div>
          <div className="spark">
            <svg viewBox="0 0 300 60"><path d={sparkPath} /></svg>
          </div>
        </div>
      </section>

      <section className="section-head" id="history">
        <div><span className="eyebrow">HISTORICAL PERFORMANCE</span><h2>The annual tape</h2></div>
        <p>Daily closes · Hover the line for details</p>
      </section>

      <section className="cards">
        {YEARS.map((data, i) => <YearCard key={data.year} data={data} index={i} />)}
      </section>

      <footer>A Ryan Website.</footer>
    </main>
  );
}
