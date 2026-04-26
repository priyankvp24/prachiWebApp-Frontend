import React, { useState, useRef, useEffect } from 'react';
import './GardenApp.css';

const PHASE = { SETUP: 'setup', GROWING: 'growing', COMPLETE: 'complete', DEAD: 'dead' };
const GROW_C = 2 * Math.PI * 128;

// ── Isometric grid ─────────────────────────────────────────────────────────────
const ISO_POSITIONS = [
  [2,1],[3,1],[2,2],[3,2],[1,1],[4,1],
  [1,2],[4,2],[2,0],[3,0],[0,1],[5,1],
  [0,2],[5,2],[1,0],[4,0],[0,0],[5,0],
  [2,3],[3,3],[1,3],[4,3],[0,3],[5,3],
];
// DX=40, DY=20 — wide enough so trees fit within cells without heavy overlap
const isoXY = (col, row) => ({
  x: 310 + (col - row) * 40,
  y: 100 + (col + row + 1) * 20,
});
const sr = (seed, mod) => ((seed * 1664525 + 1013904223) >>> 0) % mod;

// ── Shared helpers ─────────────────────────────────────────────────────────────
const PETAL = ['#ff8fab','#c77dff','#ffd166','#84c5f4','#ff9f1c','#f4a261','#a8e6cf','#ffb3c6'];

// A single petal-based flower
function Blossom({ cx, cy, pr, ci, seed, n = 5, rot = 0 }) {
  const pc = PETAL[ci % PETAL.length];
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const a  = (i / n) * Math.PI * 2 + rot;
        const px = cx + Math.cos(a) * pr * 1.6;
        const py = cy + Math.sin(a) * pr * 1.6;
        return (
          <ellipse key={i} cx={px} cy={py}
            rx={pr * 1.0} ry={pr * 0.55}
            fill={pc}
            transform={`rotate(${(a*180/Math.PI)+90},${px},${py})`}
            opacity="0.95"
          />
        );
      })}
      <circle cx={cx} cy={cy} r={pr * 0.85} fill="#ffe066" />
      <circle cx={cx} cy={cy} r={pr * 0.42} fill="#d4a020" opacity="0.9" />
    </g>
  );
}

// ── Platform ──────────────────────────────────────────────────────────────────
function Platform() {
  return (
    <g>
      {/* Left dirt wall — W(150,180) S(390,300) */}
      <polygon points="150,180 390,300 390,340 150,220" fill="#a07828" />
      <polygon points="150,180 390,300 390,330 150,210" fill="#c09040" />
      <polygon points="150,180 390,300 390,320 150,200" fill="#d8a852" />
      {/* Right dirt wall — S(390,300) E(550,220) */}
      <polygon points="390,300 550,220 550,260 390,340" fill="#785018" />
      <polygon points="390,300 550,220 550,250 390,330" fill="#8c6028" />
      {/* Grass top face — N(310,100) E(550,220) S(390,300) W(150,180) */}
      <polygon points="310,100 550,220 390,300 150,180" fill="#5ec244" />
      {/* Ridge highlight edges */}
      <polyline points="310,100 550,220" fill="none" stroke="#78d858" strokeWidth="3.5" opacity="0.7" />
      <polyline points="310,100 150,180" fill="none" stroke="#78d858" strokeWidth="3.5" opacity="0.7" />
      {/* Inner lighter patch */}
      <polygon points="310,100 390,140 350,180 270,140" fill="#6ed04a" opacity="0.25" />
      {/* Grass shadow edges */}
      <polyline points="150,180 390,300" fill="none" stroke="#44a02c" strokeWidth="1.5" opacity="0.4" />
      <polyline points="390,300 550,220" fill="none" stroke="#44a02c" strokeWidth="1.5" opacity="0.4" />
    </g>
  );
}

// ── 1. TallPine — dark pine, 4 overlapping tiers, total ~66px ────────────────
function TallPine({ x, y, seed }) {
  // tiers: [apex_y, base_y, halfWidth, fillColor, lightColor]
  // Trees grow upward from y=0 (negative = up in SVG)
  const TRUNK_H = 10;
  const tiers = [
    [-66, -48, 21, '#155018', '#1c6422'],   // tip tier
    [-54, -34, 17, '#1c6422', '#267a2c'],
    [-42, -18, 20, '#267a2c', '#349438'],
    [-28,  -TRUNK_H, 22, '#349438', '#44aa44'],  // bottom tier rests on trunk top
  ];
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx="7" cy="5" rx="16" ry="6" fill="rgba(0,0,0,0.20)" />
      <rect x="-3" y={-TRUNK_H} width="6" height={TRUNK_H} rx="2" fill="#8B5E2A" />
      <rect x="-1" y={-TRUNK_H} width="2" height={TRUNK_H} rx="1" fill="#A87040" opacity="0.5" />
      {/* Draw bottom tier first, tip last (painter's order) */}
      {[...tiers].reverse().map(([ay, by, hw, fill, lightFill], i) => (
        <g key={i}>
          {/* Full triangle */}
          <polygon points={`0,${ay} ${-hw},${by} ${hw},${by}`} fill={fill} />
          {/* Left-face lighter overlay (simulates light from upper-left) */}
          <polygon points={`0,${ay} ${-hw},${by} 0,${by}`} fill={lightFill} opacity="0.55" />
          {/* Crisp bottom edge */}
          <line x1={-hw} y1={by} x2={hw} y2={by} stroke={fill} strokeWidth="0.8" opacity="0.6" />
        </g>
      ))}
    </g>
  );
}

// ── 2. MedPine — brighter/lighter pine, same 4-tier structure, ~62px ─────────
function MedPine({ x, y, seed }) {
  const TRUNK_H = 9;
  const tiers = [
    [-62, -45, 20, '#226624', '#2e8030'],
    [-50, -31, 16, '#2e8030', '#3a9c3e'],
    [-39, -17, 19, '#3a9c3e', '#4ab44e'],
    [-26, -TRUNK_H, 21, '#4ab44e', '#5cc85e'],
  ];
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx="7" cy="5" rx="15" ry="5.5" fill="rgba(0,0,0,0.18)" />
      <rect x="-3.5" y={-TRUNK_H} width="7" height={TRUNK_H} rx="2" fill="#8B5E2A" />
      <rect x="-1.2" y={-TRUNK_H} width="2" height={TRUNK_H} rx="1" fill="#A87040" opacity="0.45" />
      {[...tiers].reverse().map(([ay, by, hw, fill, lightFill], i) => (
        <g key={i}>
          <polygon points={`0,${ay} ${-hw},${by} ${hw},${by}`} fill={fill} />
          <polygon points={`0,${ay} ${-hw},${by} 0,${by}`} fill={lightFill} opacity="0.50" />
          <line x1={-hw} y1={by} x2={hw} y2={by} stroke={fill} strokeWidth="0.7" opacity="0.5" />
        </g>
      ))}
    </g>
  );
}

// ── 3. RoundTree — dome canopy with scattered berries & flowers, ~64px ────────
function RoundTree({ x, y, seed }) {
  const gid = `rt${seed}`;
  const ci  = sr(seed, PETAL.length);
  const R   = 17;
  const TH  = 8;
  const CY  = -(TH + R);
  const rot = (sr(seed, 120)) * Math.PI / 60;
  const berryColor = PETAL[sr(seed, PETAL.length)];
  // Berries clustered on the lit (upper-left) side
  const berries = [
    [-R*0.50, CY - R*0.30], [-R*0.20, CY - R*0.58],
    [-R*0.68, CY + R*0.08], [ R*0.28, CY - R*0.48],
    [ R*0.44, CY - R*0.15], [-R*0.10, CY - R*0.72],
  ];

  return (
    <g transform={`translate(${x},${y})`}>
      <defs>
        {/* Radial gradient: focal point upper-left (lit), darkens toward lower-right (shadow) */}
        <radialGradient id={gid} gradientUnits="userSpaceOnUse"
          cx={-R*0.28} cy={CY - R*0.38} r={R*1.35}
          fx={-R*0.42} fy={CY - R*0.54}>
          <stop offset="0%"   stopColor="#8ee05a" />
          <stop offset="25%"  stopColor="#42a83e" />
          <stop offset="60%"  stopColor="#1e6820" />
          <stop offset="100%" stopColor="#0b2e0e" />
        </radialGradient>
      </defs>
      <ellipse cx="6" cy="4" rx="14" ry="5" fill="rgba(0,0,0,0.22)" />
      <rect x="-3.5" y={-TH} width="7" height={TH} rx="2" fill="#8B5E2A" />
      <rect x="-1.2" y={-TH} width="2.5" height={TH} rx="1" fill="#A87040" opacity="0.45" />
      {/* Single sphere with realistic gradient */}
      <circle cx="0" cy={CY} r={R} fill={`url(#${gid})`} />
      {/* Soft specular highlight */}
      <ellipse cx={-R*0.32} cy={CY - R*0.42} rx={R*0.22} ry={R*0.15}
        fill="white" opacity="0.18"
        transform={`rotate(-35,${-R*0.32},${CY - R*0.42})`} />
      {berries.map(([bx, by], i) => (
        <circle key={i} cx={bx} cy={by} r="2.0" fill={berryColor} opacity="0.88" />
      ))}
      <Blossom cx={R*0.08} cy={CY - R*0.72} pr={3.2} ci={ci} seed={seed} n={5} rot={rot} />
    </g>
  );
}

// ── 4. FlowerBush — compact dome, dominant petal flowers, ~60px ──────────────
function FlowerBush({ x, y, seed }) {
  const ci  = sr(seed, PETAL.length);
  const ci2 = (ci + 3) % PETAL.length;
  const R   = 15;
  const TH  = 5;
  const CY  = -(TH + R);
  const rot = (sr(seed, 100)) * Math.PI / 50;

  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx="5" cy="3" rx="12" ry="4.5" fill="rgba(0,0,0,0.18)" />
      <rect x="-2.5" y={-TH} width="5" height={TH} rx="1.5" fill="#8B5E2A" />
      {/* Dome */}
      <circle cx="0"       cy={CY}          r={R}       fill="#1a6e1e" />
      <circle cx={-R*0.45} cy={CY - R*0.20} r={R*0.80}  fill="#268228" />
      <circle cx={ R*0.38} cy={CY - R*0.16} r={R*0.72}  fill="#248024" />
      <circle cx={-R*0.12} cy={CY - R*0.48} r={R*0.58}  fill="#349838" />
      <circle cx={ R*0.08} cy={CY - R*0.58} r={R*0.40}  fill="#44ae48" />
      <circle cx={-R*0.55} cy={CY - R*0.26} r={R*0.24}  fill="#58c05c" opacity="0.42" />
      {/* Blossoms — large and prominent */}
      <Blossom cx={-R*0.72} cy={CY - R*0.10} pr={3.0} ci={ci}  seed={seed}   n={5} rot={rot} />
      <Blossom cx={ R*0.68} cy={CY - R*0.30} pr={2.8} ci={ci2} seed={seed+1} n={5} rot={rot+1.3} />
      <Blossom cx={-R*0.15} cy={CY - R*0.75} pr={2.7} ci={ci}  seed={seed+2} n={6} rot={rot+0.6} />
      <Blossom cx={ R*0.48} cy={CY + R*0.10} pr={2.4} ci={ci2} seed={seed+3} n={5} rot={rot+2.0} />
    </g>
  );
}

// ── 5. SmallBush — small but NOT tiny, ~55px with flowers ────────────────────
function SmallBush({ x, y, seed }) {
  const ci  = sr(seed, PETAL.length);
  const ci2 = (ci + 2) % PETAL.length;
  const R   = 13;
  const TH  = 3;
  const CY  = -(TH + R);
  const rot = (sr(seed, 80)) * Math.PI / 40;

  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx="4" cy="3" rx="10" ry="4" fill="rgba(0,0,0,0.17)" />
      <rect x="-2" y={-TH} width="4" height={TH} rx="1.2" fill="#8B5E2A" />
      {/* Dome */}
      <circle cx="0"       cy={CY}          r={R}       fill="#1e7022" />
      <circle cx={-R*0.44} cy={CY - R*0.20} r={R*0.78}  fill="#288c2c" />
      <circle cx={ R*0.36} cy={CY - R*0.16} r={R*0.70}  fill="#248428" />
      <circle cx={-R*0.10} cy={CY - R*0.48} r={R*0.55}  fill="#349c38" />
      <circle cx={-R*0.55} cy={CY - R*0.25} r={R*0.22}  fill="#50c054" opacity="0.40" />
      {/* Blossoms */}
      <Blossom cx={-R*0.70} cy={CY - R*0.08} pr={2.6} ci={ci}  seed={seed}   n={5} rot={rot} />
      <Blossom cx={ R*0.65} cy={CY - R*0.28} pr={2.4} ci={ci2} seed={seed+1} n={5} rot={rot+1.1} />
      <Blossom cx={-R*0.08} cy={CY - R*0.72} pr={2.2} ci={ci}  seed={seed+2} n={5} rot={rot+0.5} />
    </g>
  );
}

function IsoTree({ x, y, minutes, seed }) {
  if (minutes >= 50) return <TallPine   x={x} y={y} seed={seed} />;
  if (minutes >= 25) return <MedPine    x={x} y={y} seed={seed} />;
  if (minutes >= 10) return <RoundTree  x={x} y={y} seed={seed} />;
  if (minutes >= 4)  return <FlowerBush x={x} y={y} seed={seed} />;
  return                    <SmallBush  x={x} y={y} seed={seed} />;
}

// ── Ground flowers ─────────────────────────────────────────────────────────────
function GroundFlowers({ count }) {
  if (count < 4) return null;
  const spots = [
    [1.5,1.6],[3.6,0.5],[0.5,2.4],[4.6,2.5],[2.5,3.5],[0.8,0.8],
  ].slice(0, Math.min(count - 3, 6));
  return (
    <>
      {spots.map(([col, row], i) => {
        const { x, y } = isoXY(col, row);
        return (
          <g key={i} transform={`translate(${x},${y})`}>
            <line x1="0" y1="0" x2="-1" y2="-10" stroke="#3a9c3a" strokeWidth="1.6" strokeLinecap="round" />
            <Blossom cx={-1} cy={-14} pr={3.0} ci={i % PETAL.length} seed={i*113} n={5} rot={i*0.9} />
          </g>
        );
      })}
    </>
  );
}

// ── Isometric forest ──────────────────────────────────────────────────────────
function IsometricForest({ forest }) {
  const items = forest
    .slice(0, ISO_POSITIONS.length)
    .map((tree, i) => {
      const [col, row] = ISO_POSITIONS[i];
      const base = isoXY(col, row);
      // Seeded jitter so each tree sits naturally off-center in its cell
      const jx = (sr(tree.id, 25) - 12);          // –12 … +12 px
      const jy = (sr(tree.id * 7, 13) - 6);        // –6  … +6  px
      return { tree, col, row, x: base.x + jx, y: base.y + jy };
    })
    .sort((a, b) => (a.col + a.row) - (b.col + b.row));

  return (
    <svg viewBox="0 0 700 360" className="iso-forest-svg">
      <Platform />
      <GroundFlowers count={forest.length} />
      {items.map(({ tree, x, y }) => (
        <IsoTree key={tree.id} x={x} y={y} minutes={tree.minutes} seed={tree.id} />
      ))}
    </svg>
  );
}

// ── Demo forest — one of each type, spread across the platform ────────────────
const DEMO_FOREST = [
  { id: 10001, minutes: 65 },   // TallPine    → pos [2,1]
  { id: 10002, minutes: 60 },   // TallPine    → pos [3,1]
  { id: 10003, minutes: 38 },   // MedPine     → pos [2,2]
  { id: 10004, minutes: 30 },   // MedPine     → pos [3,2]
  { id: 10005, minutes: 20 },   // RoundTree   → pos [1,1]
  { id: 10006, minutes: 15 },   // RoundTree   → pos [4,1]
  { id: 10007, minutes: 12 },   // RoundTree   → pos [1,2]
  { id: 10008, minutes: 8  },   // FlowerBush  → pos [4,2]
  { id: 10009, minutes: 6  },   // FlowerBush  → pos [2,0]
  { id: 10010, minutes: 3  },   // SmallBush   → pos [3,0]
  { id: 10011, minutes: 2  },   // SmallBush   → pos [0,1]
];

// ── Other scenes (unchanged) ──────────────────────────────────────────────────
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
  const circleRef    = useRef(null);
  const totalTimeRef = useRef(0);
  const SETUP_R = 80;
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
    const newTree = { id: Date.now(), minutes: Math.round(totalTimeRef.current / 60) };
    setForest(prev => {
      const updated = [...prev, newTree];
      localStorage.setItem('garden_forest', JSON.stringify(updated));
      return updated;
    });
    setPhase(PHASE.COMPLETE);
  }, [phase, timeLeft]);

  useEffect(() => {
    if (phase !== PHASE.GROWING) return;
    const onVis = () => { if (document.hidden) killTree(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [phase]);

  const killTree = () => {
    setPhase(PHASE.DEAD);
    fetch('/api/notify/tree-died', { method: 'POST' }).catch(() => {});
  };

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

  const setupProgress = (selectedTime / 120) * SETUP_C;
  const indAngle = (selectedTime / 120) * 2 * Math.PI;
  const indX = 100 + SETUP_R * Math.cos(indAngle);
  const indY = 100 + SETUP_R * Math.sin(indAngle);
  const fmt  = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const totalMinutes = forest.reduce((s, t) => s + t.minutes, 0);

  return (
    <div className="garden-app" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>

      {phase === PHASE.SETUP && (
        <div className="gphase">
          <h2 className="gphase-title">Plant a Tree</h2>
          <p className="gphase-sub">Drag to set your focus time</p>
          <div className="setup-ring-wrapper">
            <svg ref={circleRef} className="setup-ring-svg" width="200" height="200" onMouseDown={handleMouseDown}>
              <circle cx="100" cy="100" r={SETUP_R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="12" />
              <circle cx="100" cy="100" r={SETUP_R} fill="none" stroke="white" strokeWidth="12"
                strokeLinecap="round" strokeDasharray={SETUP_C} strokeDashoffset={SETUP_C - setupProgress}
                style={{ transition: isDragging ? 'none' : 'stroke-dashoffset 0.1s' }} />
              <circle cx={indX} cy={indY} r="9" fill="white" stroke="#40916c" strokeWidth="2" style={{ cursor: 'grab' }} />
            </svg>
            <div className="ring-label">
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

      {/* Tree gallery — always visible */}
      <div className="forest-section">
        <h3 className="forest-title">Tree Gallery</h3>
        <div className="iso-forest-wrap">
          <IsometricForest forest={DEMO_FOREST} />
        </div>
      </div>

      {/* Real forest */}
      {forest.length > 0 && (
        <div className="forest-section">
          <h3 className="forest-title">My Forest</h3>
          <div className="iso-forest-wrap">
            <IsometricForest forest={forest} />
          </div>
          <div className="forest-stats-bar">
            <span className="fstat"><span className="fstat-val">{totalMinutes}</span> mins</span>
            <span className="fstat-dot" />
            <span className="fstat"><span className="fstat-val">{forest.length}</span> 🌲</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default GardenApp;
