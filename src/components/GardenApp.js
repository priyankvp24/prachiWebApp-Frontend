import React, { useState, useRef, useEffect } from 'react';
import './GardenApp.css';

const PHASE = { SETUP: 'setup', GROWING: 'growing', COMPLETE: 'complete', DEAD: 'dead' };
const GROW_C = 2 * Math.PI * 128;

// Returns the UTC timestamp for midnight of the current day in NYC time
const nycMidnightMs = () => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // "YYYY-MM-DD"
  const utcProxy = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const nycProxy = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return new Date(dateStr + 'T00:00:00Z').getTime() + (utcProxy - nycProxy);
};

const TIME_FILTERS = [
  { key: '7d',   label: 'Week',     ms: 7   * 86400000 },
  { key: '14d',  label: '2 Weeks',  ms: 14  * 86400000 },
  { key: '30d',  label: 'Month',    ms: 30  * 86400000 },
  { key: '180d', label: '6 Months', ms: 180 * 86400000 },
  { key: '365d', label: 'Year',     ms: 365 * 86400000 },
  { key: 'all',  label: 'All Time', ms: null },
];

// ── Isometric grid ─────────────────────────────────────────────────────────────
const DX = 40, DY = 20;
// N apex is always fixed so the forest feels anchored at the top-center
const GRID_OX = 310, GRID_OY = 100;

const sr = (seed, mod) => ((seed * 1664525 + 1013904223) >>> 0) % mod;

// Compute platform corners + fill positions for `count` trees.
// Both COLS and ROWS grow together (≈√count) so the diamond expands in all
// four isometric directions equally — not just downward.
function buildForestLayout(count) {
  const SIDE = Math.max(5, Math.ceil(Math.sqrt(count + 1)));
  const COLS = SIDE, ROWS = SIDE;
  const OX = GRID_OX, OY = GRID_OY;

  const isoPos = (col, row) => ({
    x: OX + (col - row) * DX,
    y: OY + (col + row + 1) * DY,
  });

  // Platform diamond corners — symmetric when COLS === ROWS
  const N = { x: OX,                      y: OY };
  const E = { x: OX + COLS * DX,          y: OY + COLS * DY };
  const S = { x: OX,                      y: OY + (COLS + ROWS) * DY }; // COLS-ROWS=0
  const W = { x: OX - ROWS * DX,          y: OY + ROWS * DY };

  // Fill from grid center outward so early trees land in the prime center spots
  const allPos = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      allPos.push([c, r]);
  const cC = (COLS - 1) / 2, rC = (ROWS - 1) / 2;
  allPos.sort((a, b) => {
    const da = (a[0] - cC) ** 2 + (a[1] - rC) ** 2;
    const db = (b[0] - cC) ** 2 + (b[1] - rC) ** 2;
    return da - db;
  });

  // ViewBox: 100 px padding each side, platform always centered at x=310
  const PAD = 100;
  const vbX = W.x - PAD;
  const vbW = (E.x - W.x) + 2 * PAD;
  const vbH = S.y + 80;

  return { COLS, ROWS, isoPos, N, E, S, W, positions: allPos, vbX, vbW, vbH };
}

// ── Platform ──────────────────────────────────────────────────────────────────
function Platform({ N, E, S, W }) {
  const D = 40; // dirt wall depth
  const pt = (pts) => pts.map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <g>
      {/* Left dirt wall */}
      <polygon points={pt([[W.x,W.y],[S.x,S.y],[S.x,S.y+D],[W.x,W.y+D]])} fill="#a07828" />
      <polygon points={pt([[W.x,W.y],[S.x,S.y],[S.x,S.y+D-10],[W.x,W.y+D-10]])} fill="#c09040" />
      <polygon points={pt([[W.x,W.y],[S.x,S.y],[S.x,S.y+D-20],[W.x,W.y+D-20]])} fill="#d8a852" />
      {/* Right dirt wall */}
      <polygon points={pt([[S.x,S.y],[E.x,E.y],[E.x,E.y+D],[S.x,S.y+D]])} fill="#785018" />
      <polygon points={pt([[S.x,S.y],[E.x,E.y],[E.x,E.y+D-10],[S.x,S.y+D-10]])} fill="#8c6028" />
      {/* Grass top face */}
      <polygon points={pt([[N.x,N.y],[E.x,E.y],[S.x,S.y],[W.x,W.y]])} fill="#5ec244" />
      {/* Highlight edges */}
      <polyline points={pt([[N.x,N.y],[E.x,E.y]])} fill="none" stroke="#78d858" strokeWidth="3.5" opacity="0.7" />
      <polyline points={pt([[N.x,N.y],[W.x,W.y]])} fill="none" stroke="#78d858" strokeWidth="3.5" opacity="0.7" />
      {/* Inner lighter patch (quarter-diamond highlight) */}
      <polygon points={pt([[N.x,N.y],[(N.x+E.x)/2,(N.y+E.y)/2],[(N.x+S.x)/2,(N.y+S.y)/2],[(N.x+W.x)/2,(N.y+W.y)/2]])} fill="#6ed04a" opacity="0.25" />
      {/* Shadow edges */}
      <polyline points={pt([[W.x,W.y],[S.x,S.y]])} fill="none" stroke="#44a02c" strokeWidth="1.5" opacity="0.4" />
      <polyline points={pt([[S.x,S.y],[E.x,E.y]])} fill="none" stroke="#44a02c" strokeWidth="1.5" opacity="0.4" />
    </g>
  );
}

// ── OakTree — scales from sapling to full oak based on minutes ────────────────
function OakTree({ x, y, minutes, seed }) {
  const sc = 0.6 + Math.min(minutes, 60) / 60 * 0.8; // 0.6 (sapling) → 1.4 (full grown)
  const R  = 18 * sc;
  const TH = 10 * sc;
  const TW = 5.5 * sc;
  const [c1, c2, c3] = minutes >= 40
    ? ['#173d1a', '#215224', '#2d6a30']
    : minutes >= 15
    ? ['#1e5220', '#2a6e2c', '#388838']
    : ['#257228', '#348234', '#44a044'];
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx={R*0.35} cy={R*0.22} rx={R*0.88} ry={R*0.34} fill="rgba(0,0,0,0.22)" />
      <rect x={-TW/2} y={-TH} width={TW} height={TH+1} rx={TW*0.35} fill="#6b4220" />
      <rect x={-TW*0.12} y={-TH} width={TW*0.28} height={TH} rx={TW*0.12} fill="#8a5c30" opacity="0.5" />
      {/* Crown — overlapping circles forming irregular wide oak canopy */}
      <circle cx={ 0}       cy={-TH-R*0.55} r={R}       fill={c1} />
      <circle cx={-R*0.80}  cy={-TH-R*0.25} r={R*0.82}  fill={c1} />
      <circle cx={ R*0.75}  cy={-TH-R*0.22} r={R*0.78}  fill={c1} />
      <circle cx={-R*0.42}  cy={-TH-R*1.10} r={R*0.74}  fill={c2} />
      <circle cx={ R*0.38}  cy={-TH-R*1.08} r={R*0.70}  fill={c2} />
      <circle cx={ 0}       cy={-TH-R*1.32} r={R*0.58}  fill={c3} />
      <circle cx={-R*0.18}  cy={-TH-R*0.75} r={R*0.65}  fill={c3} />
      <ellipse cx={-R*0.28} cy={-TH-R*1.15} rx={R*0.24} ry={R*0.17}
        fill="white" opacity="0.12" transform={`rotate(-30,${-R*0.28},${-TH-R*1.15})`} />
    </g>
  );
}

// ── DeadIsoTree — bare oak skeleton for abandoned sessions ────────────────────
function DeadIsoTree({ x, y, seed }) {
  const lean = (sr(seed, 7) - 3) * 0.8;
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx="5" cy="3" rx="9" ry="3.5" fill="rgba(0,0,0,0.15)" />
      <line x1="0" y1="0" x2={lean} y2="-38" stroke="#3a2010" strokeWidth="4.5" strokeLinecap="round" />
      <line x1={lean*0.55} y1="-22" x2={lean*0.55-13} y2="-34" stroke="#3a2010" strokeWidth="3" strokeLinecap="round" />
      <line x1={lean*0.55} y1="-22" x2={lean*0.55+11} y2="-32" stroke="#3a2010" strokeWidth="3" strokeLinecap="round" />
      <line x1={lean*0.80} y1="-31" x2={lean*0.80-8}  y2="-42" stroke="#3a2010" strokeWidth="2" strokeLinecap="round" />
      <line x1={lean*0.80} y1="-31" x2={lean*0.80+7}  y2="-40" stroke="#3a2010" strokeWidth="2" strokeLinecap="round" />
      <line x1={lean*0.55-13} y1="-34" x2={lean*0.55-16} y2="-40" stroke="#3a2010" strokeWidth="1.5" strokeLinecap="round" />
      <line x1={lean*0.55+11} y1="-32" x2={lean*0.55+14} y2="-38" stroke="#3a2010" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  );
}

function IsoTree({ x, y, minutes, seed, dead }) {
  if (dead) return <DeadIsoTree x={x} y={y} seed={seed} />;
  return <OakTree x={x} y={y} minutes={minutes} seed={seed} />;
}

// ── Tree info popup ───────────────────────────────────────────────────────────
function TreePopup({ popup, onClose }) {
  const { tree, x, y } = popup;

  const fmtDate = (ts) => new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  const fmtDur = (min) => {
    if (min === 0) return 'less than a minute';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };

  const pw = 210;
  const left = Math.max(8, Math.min(x - pw / 2, window.innerWidth - pw - 8));
  const top  = Math.max(8, y - 175);

  return (
    <div className="tree-popup-overlay" onClick={onClose}>
      <div className="tree-popup" style={{ left, top }} onClick={e => e.stopPropagation()}>
        <button className="tree-popup-close" onClick={onClose}>×</button>
        <div className="tree-popup-tree">
          {tree.dead ? (
            <svg width="52" height="58" viewBox="-26 -50 52 60" overflow="visible">
              <DeadIsoTree x={0} y={0} seed={tree.id} />
            </svg>
          ) : (
            <svg width="68" height="72" viewBox="-38 -68 76 80" overflow="visible">
              <OakTree x={0} y={0} minutes={tree.minutes} seed={tree.id} />
            </svg>
          )}
        </div>
        <div className="tree-popup-rows">
          {tree.dead ? (
            <>
              <div className="tree-popup-row">
                <span className="tree-popup-key">Died</span>
                <span className="tree-popup-val">{fmtDate(tree.id)}</span>
              </div>
              <div className="tree-popup-row">
                <span className="tree-popup-key">Studied for</span>
                <span className="tree-popup-val">{fmtDur(tree.minutes)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="tree-popup-row">
                <span className="tree-popup-key">Planted</span>
                <span className="tree-popup-val">{fmtDate(tree.id)}</span>
              </div>
              <div className="tree-popup-row">
                <span className="tree-popup-key">Session</span>
                <span className="tree-popup-val">{fmtDur(tree.minutes)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Isometric forest ──────────────────────────────────────────────────────────
function IsometricForest({ forest, onTreeClick }) {
  const { positions, isoPos, N, E, S, W, vbX, vbW, vbH } = buildForestLayout(forest.length);

  const items = forest
    .map((tree, i) => {
      const [col, row] = positions[i];
      const base = isoPos(col, row);
      const jx = (sr(tree.id, 25) - 12);   // –12 … +12 px natural scatter
      const jy = (sr(tree.id * 7, 13) - 6); // –6  … +6  px
      return { tree, col, row, x: base.x + jx, y: base.y + jy };
    })
    .sort((a, b) => (a.col + a.row) - (b.col + b.row)); // painter's order

  return (
    <svg viewBox={`${vbX} 0 ${vbW} ${vbH}`} className="iso-forest-svg">
      <Platform N={N} E={E} S={S} W={W} />
      {items.map(({ tree, x, y }) => (
        <g
          key={tree.id}
          style={{ cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); onTreeClick(tree, e.clientX, e.clientY); }}
        >
          <IsoTree x={x} y={y} minutes={tree.minutes} seed={tree.id} dead={tree.dead} />
          <ellipse cx={x} cy={y - 18} rx={22} ry={30} fill="transparent" />
        </g>
      ))}
    </svg>
  );
}

// ── Daily view ───────────────────────────────────────────────────────────────
function DayTimeline({ trees, dayKey }) {
  const getNycMinuteOfDay = (ts) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(new Date(ts));
    const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0');
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0');
    return h * 60 + m;
  };

  const clipId = `tl-${dayKey}`;
  const W = 1440, B = 40; // W = minutes in a day, B = bar height in SVG units

  return (
    <svg className="day-timeline-svg" viewBox={`0 0 ${W} 58`} preserveAspectRatio="none">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={W} height={B} rx="5" />
        </clipPath>
      </defs>
      {/* Untracked background */}
      <rect x="0" y="0" width={W} height={B} rx="5" fill="rgba(255,255,255,0.08)" />
      {/* Session blocks — width in SVG units = minutes, so 1 unit = 1 minute */}
      <g clipPath={`url(#${clipId})`}>
        {trees.map(tree => {
          const end   = getNycMinuteOfDay(tree.id);
          const start = Math.max(0, end - tree.minutes);
          return (
            <rect
              key={tree.id}
              x={start} y="0"
              width={Math.max(end - start, 4)}
              height={B}
              fill={tree.dead ? '#c04030' : '#4ec86a'}
              opacity="0.88"
            />
          );
        })}
      </g>
      {/* Hourly dividers — heavier every 6 hours */}
      {Array.from({ length: 23 }, (_, i) => i + 1).map(h => (
        <line
          key={h}
          x1={h * 60} y1="0" x2={h * 60} y2={B}
          stroke="rgba(0,0,0,0.18)"
          strokeWidth={h % 6 === 0 ? 3 : 1.5}
        />
      ))}
      {/* Labels at 12a, 6a, 12p, 6p, 12a */}
      {[0, 6, 12, 18, 24].map(h => (
        <text
          key={h}
          x={h * 60} y="55"
          textAnchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}
          fontSize="11"
          fill="rgba(255,255,255,0.28)"
          fontFamily="Poppins,sans-serif"
        >
          {h === 0 || h === 24 ? '12a' : h === 12 ? '12p' : `${h < 12 ? h : h - 12}${h < 12 ? 'a' : 'p'}`}
        </text>
      ))}
    </svg>
  );
}

function DailyView({ forest, onTreeClick }) {
  const toKey = (ts) =>
    new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  const groups = {};
  for (const tree of forest) {
    const k = toKey(tree.id);
    (groups[k] = groups[k] || []).push(tree);
  }

  const todayKey     = toKey(Date.now());
  const yesterdayKey = toKey(Date.now() - 86400000);

  const fmtLabel = (key) => {
    if (key === todayKey)     return 'Today';
    if (key === yesterdayKey) return 'Yesterday';
    return new Date(key + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  };

  const days = Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));

  return (
    <div className="daily-view">
      {days.map(([key, trees]) => {
        const mins = trees.reduce((s, t) => s + t.minutes, 0);
        const live = trees.filter(t => !t.dead).length;
        const dead = trees.filter(t =>  t.dead).length;
        return (
          <div key={key} className="daily-card">
            <div className="daily-card-header">
              <span className="daily-date">{fmtLabel(key)}</span>
              <span className="daily-meta">
                <span className="daily-meta-val">{mins}</span> min
                {live > 0 && <><span className="daily-meta-dot">·</span>{live} 🌳</>}
                {dead > 0 && <><span className="daily-meta-dot">·</span>{dead} 🥀</>}
              </span>
            </div>
            <DayTimeline trees={trees} dayKey={key} />
            <div className="daily-trees-row">
              {trees.map(tree => (
                <div
                  key={tree.id}
                  className="daily-tree-item"
                  onClick={(e) => onTreeClick(tree, e.clientX, e.clientY)}
                >
                  <svg width="36" height="44" viewBox="-22 -50 44 58" overflow="visible">
                    {tree.dead
                      ? <DeadIsoTree x={0} y={0} seed={tree.id} />
                      : <OakTree x={0} y={0} minutes={tree.minutes} seed={tree.id} />
                    }
                  </svg>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Other scenes ─────────────────────────────────────────────────────────────
function ForestGrowingScene({ progress }) {
  const isSeedling = progress < 0.12;
  const sp = isSeedling ? progress / 0.12 : 1;
  const tp = isSeedling ? 0.04 : Math.max(0.04, (progress - 0.12) / 0.88);
  return (
    <svg viewBox="0 0 280 280" className="forest-growing-svg">
      <defs><clipPath id="creamClip"><circle cx="140" cy="140" r="110" /></clipPath></defs>
      <circle cx="140" cy="140" r="128" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
      <circle cx="140" cy="140" r="128" fill="none" stroke="#b5e853" strokeWidth="10"
        strokeLinecap="round" strokeDasharray={GROW_C} strokeDashoffset={(1 - progress) * GROW_C}
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 1s linear' }} />
      <circle cx="140" cy="140" r="110" fill="#f5e8c0" />
      <ellipse cx="140" cy="252" rx="122" ry="82" fill="#7B4A2A" clipPath="url(#creamClip)" />
      <ellipse cx="140" cy="238" rx="106" ry="62" fill="#9B6A4A" clipPath="url(#creamClip)" />
      <ellipse cx="140" cy="226" rx="88"  ry="42" fill="#A87955" clipPath="url(#creamClip)" />
      {isSeedling && (
        <g transform="translate(140,178)">
          <line x1="0" y1="0" x2="0" y2={-30*sp} stroke="#5a8a2a" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="-12" cy={-20*sp} rx={12*sp} ry={7*sp} fill="#6ab33e" transform={`rotate(-35,-12,${-20*sp})`} />
          <ellipse cx="12"  cy={-20*sp} rx={12*sp} ry={7*sp} fill="#7bc44f" transform={`rotate(35,12,${-20*sp})`} />
        </g>
      )}
      {!isSeedling && (
        <g transform={`translate(140,178) scale(${tp})`}>
          <rect x="-7" y="-38" width="14" height="38" rx="2" fill="#6d4c41" />
          <polygon points="0,-70 -42,-33 42,-33" fill="#2d6a4f" />
          <polygon points="0,-90 -35,-56 35,-56" fill="#40916c" />
          <polygon points="0,-108 -28,-73 28,-73" fill="#52b788" />
          <polygon points="0,-122 -22,-90 22,-90" fill="#74c69d" />
        </g>
      )}
    </svg>
  );
}

function CompleteScene() {
  return (
    <svg viewBox="0 0 240 200" className="garden-scene-svg">
      <rect x="0" y="158" width="240" height="42" fill="#1b2e1b" />
      <path d="M0,158 Q15,150 30,156 Q45,162 60,154 Q75,146 90,153 Q105,160 120,153 Q135,146 150,153 Q165,160 180,154 Q195,148 210,154 Q225,160 240,156 L240,162 L0,162 Z" fill="#2d6a4f" />
      <rect x="113" y="115" width="14" height="47" rx="3" fill="#6d4c41" />
      <polygon points="120,72  80,130 160,130" fill="#2d6a4f" />
      <polygon points="120,52  82,108 158,108" fill="#40916c" />
      <polygon points="120,34  85,88  155,88"  fill="#52b788" />
      <polygon points="120,18  88,65  152,65"  fill="#74c69d" />
      <line x1="62" y1="162" x2="62" y2="152" stroke="#2d6a4f" strokeWidth="1.5" />
      <circle cx="62" cy="149" r="3.5" fill="#ffd166" /><circle cx="56" cy="146" r="3" fill="#ffd166" />
      <circle cx="68" cy="146" r="3" fill="#ffd166" /><circle cx="62" cy="149" r="2" fill="#cf9c00" />
      <line x1="182" y1="162" x2="182" y2="152" stroke="#2d6a4f" strokeWidth="1.5" />
      <circle cx="182" cy="149" r="3.5" fill="#ea75af" /><circle cx="176" cy="146" r="3" fill="#ea75af" />
      <circle cx="188" cy="146" r="3" fill="#ea75af" /><circle cx="182" cy="149" r="2" fill="white" opacity="0.7" />
    </svg>
  );
}

function DeadScene() {
  return (
    <svg viewBox="0 0 240 200" className="garden-scene-svg">
      <rect x="0" y="158" width="240" height="42" fill="#120d0a" />
      <path d="M0,158 Q20,153 45,158 Q70,163 95,156 Q120,149 145,156 Q170,163 195,157 Q215,151 240,158 L240,162 L0,162 Z" fill="#251a0e" />
      <rect x="113" y="115" width="14" height="47" rx="3" fill="#2e1f0f" />
      <path d="M120,115 Q119,88 120,55" stroke="#2e1f0f" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M119,132 Q96,118 78,106" stroke="#2e1f0f" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M121,132 Q144,118 162,106" stroke="#2e1f0f" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M119,98 Q104,84 96,70" stroke="#2e1f0f" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M121,98 Q136,84 144,70" stroke="#2e1f0f" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M120,55 Q114,44 110,36" stroke="#2e1f0f" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M120,55 Q126,44 130,36" stroke="#2e1f0f" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ── Main GardenApp ────────────────────────────────────────────────────────────
function GardenApp() {
  const [phase, setPhase]               = useState(PHASE.SETUP);
  const [selectedTime, setSelectedTime] = useState(0);
  const [timeLeft, setTimeLeft]         = useState(0);
  const [isDragging, setIsDragging]     = useState(false);
  const [forest, setForest]             = useState(() => {
    try { return JSON.parse(localStorage.getItem('garden_forest') || '[]'); }
    catch { return []; }
  });
  const [timeFilter, setTimeFilter]     = useState('all');
  const [view, setView]                 = useState('forest');
  const [popup, setPopup]               = useState(null);
  const circleRef    = useRef(null);
  const totalTimeRef = useRef(0);
  const timeLeftRef  = useRef(0);
  const killTreeRef  = useRef(null);
  const SETUP_R = 90;
  const SETUP_C = 2 * Math.PI * SETUP_R;

  const progress = totalTimeRef.current > 0
    ? (totalTimeRef.current - timeLeft) / totalTimeRef.current : 0;

  useEffect(() => {
    if (phase !== PHASE.GROWING || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(tl => tl - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]);

  useEffect(() => {
    if (phase !== PHASE.GROWING || timeLeft !== 0 || totalTimeRef.current === 0) return;
    const minutes = Math.round(totalTimeRef.current / 60);
    const newTree = { id: Date.now(), minutes };
    const midnight      = nycMidnightMs();
    const plantedToday  = forest.filter(t => !t.dead && t.id >= midnight).length;
    const ordinal       = plantedToday + 1;
    setForest(prev => {
      const updated = [...prev, newTree];
      localStorage.setItem('garden_forest', JSON.stringify(updated));
      return updated;
    });
    fetch('/api/notify/tree-planted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes, ordinal }),
    }).catch(() => {});
    setPhase(PHASE.COMPLETE);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft]);

  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  useEffect(() => {
    if (phase !== PHASE.GROWING) return;
    const onVis = () => { if (document.hidden) killTreeRef.current?.(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [phase]);

  const killTree = () => {
    const elapsedMinutes = Math.max(0, Math.round((totalTimeRef.current - timeLeftRef.current) / 60));
    const deadTree = { id: Date.now(), minutes: elapsedMinutes, dead: true };
    const midnight  = nycMidnightMs();
    const deadToday = forest.filter(t => t.dead && t.id >= midnight).length;
    const ordinal   = deadToday + 1;
    setForest(prev => {
      const updated = [...prev, deadTree];
      localStorage.setItem('garden_forest', JSON.stringify(updated));
      return updated;
    });
    setPhase(PHASE.DEAD);
    fetch('/api/notify/tree-died', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes: elapsedMinutes, ordinal }),
    }).catch(() => {});
  };
  killTreeRef.current = killTree;

  const startSession = () => {
    if (selectedTime < 1) return;
    totalTimeRef.current = selectedTime * 60;
    setTimeLeft(selectedTime * 60);
    setPhase(PHASE.GROWING);
  };
  const resetToSetup = () => { totalTimeRef.current = 0; setTimeLeft(0); setPhase(PHASE.SETUP); };

  const updateTime = (clientX, clientY) => {
    if (!circleRef.current) return;
    const rect = circleRef.current.getBoundingClientRect();
    const angle = Math.atan2(clientY - (rect.top + rect.height/2), clientX - (rect.left + rect.width/2)) * (180/Math.PI) + 90;
    setSelectedTime(Math.max(0, Math.min(120, Math.round((((angle%360)+360)%360)/360*120))));
  };
  const handleMouseDown = (e) => { setIsDragging(true); updateTime(e.clientX, e.clientY); };
  const handleMouseMove = (e) => { if (isDragging) updateTime(e.clientX, e.clientY); };
  const handleMouseUp   = () => setIsDragging(false);

  const handleTouchStart = (e) => { e.preventDefault(); setIsDragging(true); updateTime(e.touches[0].clientX, e.touches[0].clientY); };
  const handleTouchMove  = (e) => { e.preventDefault(); if (isDragging) updateTime(e.touches[0].clientX, e.touches[0].clientY); };
  const handleTouchEnd   = () => setIsDragging(false);

  const setupProgress = (selectedTime / 120) * SETUP_C;
  const indAngle = (selectedTime / 120) * 2 * Math.PI;
  const indX = 110 + SETUP_R * Math.cos(indAngle);
  const indY = 110 + SETUP_R * Math.sin(indAngle);
  const fmt  = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const totalMinutes = forest.reduce((s, t) => s + t.minutes, 0);

  const activeDef      = TIME_FILTERS.find(f => f.key === timeFilter);
  const cutoff         = activeDef.ms ? Date.now() - activeDef.ms : 0;
  const filteredForest = forest.filter(t => t.id >= cutoff);
  const filteredMins   = filteredForest.reduce((s, t) => s + t.minutes, 0);
  const filteredLive   = filteredForest.filter(t => !t.dead).length;
  const filteredDead   = filteredForest.filter(t =>  t.dead).length;

  return (
    <div className="garden-app" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {popup && <TreePopup popup={popup} onClose={() => setPopup(null)} />}

      {phase === PHASE.SETUP && (
        <div className="gphase">
          <h2 className="gphase-title">Plant a Tree</h2>
          <p className="gphase-sub">Drag to set your focus time</p>
          <div className="setup-ring-wrapper">
            <svg ref={circleRef} className="setup-ring-svg" width="220" height="220"
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}>
              <circle cx="110" cy="110" r={SETUP_R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="12" />
              <circle cx="110" cy="110" r={SETUP_R} fill="none" stroke="white" strokeWidth="12"
                strokeLinecap="round" strokeDasharray={SETUP_C} strokeDashoffset={SETUP_C - setupProgress}
                style={{ transition: isDragging ? 'none' : 'stroke-dashoffset 0.1s' }} />
              <circle cx={indX} cy={indY} r="9" fill="white" stroke="#40916c" strokeWidth="2" style={{ cursor: 'grab' }} />
            </svg>
            <div className="ring-label">
              <svg width="100" height="95" viewBox="-50 -78 100 95" style={{ overflow: 'visible', display: 'block' }}>
                {selectedTime > 0
                  ? <OakTree x={0} y={0} minutes={selectedTime} seed={42} />
                  : <text x="0" y="-20" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.45)" fontFamily="'Poppins',sans-serif">drag to set</text>
                }
              </svg>
              <span className="ring-minutes">{selectedTime}</span>
              <span className="ring-unit">min</span>
            </div>
          </div>
          <button className="btn-plant" onClick={startSession} disabled={selectedTime === 0}>🌱 Plant</button>
        </div>
      )}

      {phase === PHASE.GROWING && (
        <div className="gphase">
          <p className="grow-tagline">Put down your phone.</p>
          <ForestGrowingScene progress={progress} />
          <div className="countdown">{fmt(timeLeft)}</div>
          <button className="btn-giveup" onClick={killTree}>Give Up</button>
        </div>
      )}

      {phase === PHASE.COMPLETE && (
        <div className="gphase">
          <h2 className="gphase-title success">🎉 Tree Grown!</h2>
          <p className="gphase-sub">Your tree has been planted in your forest</p>
          <CompleteScene />
          <div className="stats-display">
            <div className="stat-item">
              <span className="stat-value">{forest.length}</span>
              <span className="stat-label">{forest.length === 1 ? 'tree' : 'trees'} grown</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-value">{totalMinutes}</span>
              <span className="stat-label">minutes focused</span>
            </div>
          </div>
          <button className="btn-plant" onClick={resetToSetup}>Plant Another</button>
        </div>
      )}

      {phase === PHASE.DEAD && (
        <div className="gphase">
          <h2 className="gphase-title dead">Your tree died 🥀</h2>
          <p className="gphase-sub">You left the page or gave up</p>
          <DeadScene />
          <button className="btn-plant" onClick={resetToSetup}>Try Again</button>
        </div>
      )}

      <div className="forest-section">
        <h3 className="forest-title">My Forest</h3>
        {forest.length === 0 ? (
          <p className="forest-empty">No trees yet — complete a session to grow your first oak.</p>
        ) : (
          <>
            <div className="view-toggle">
              <button className={`view-tab${view === 'forest' ? ' active' : ''}`} onClick={() => setView('forest')}>Forest</button>
              <button className={`view-tab${view === 'daily'  ? ' active' : ''}`} onClick={() => setView('daily')}>Daily</button>
            </div>

            <div className="forest-filter-bar">
              {TIME_FILTERS.map(f => (
                <button
                  key={f.key}
                  className={`filter-pill${timeFilter === f.key ? ' active' : ''}`}
                  onClick={() => setTimeFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredForest.length === 0 ? (
              <p className="forest-empty">No trees in this period.</p>
            ) : view === 'forest' ? (
              <div className="iso-forest-wrap">
                <IsometricForest
                  forest={filteredForest}
                  onTreeClick={(tree, x, y) => setPopup({ tree, x, y })}
                />
              </div>
            ) : (
              <DailyView
                forest={filteredForest}
                onTreeClick={(tree, x, y) => setPopup({ tree, x, y })}
              />
            )}

            <div className="forest-stats-bar">
              <span className="fstat"><span className="fstat-val">{filteredMins}</span> mins</span>
              <span className="fstat-dot" />
              <span className="fstat"><span className="fstat-val">{filteredLive}</span> 🌳</span>
              {filteredDead > 0 && (
                <>
                  <span className="fstat-dot" />
                  <span className="fstat"><span className="fstat-val">{filteredDead}</span> 🥀</span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default GardenApp;
