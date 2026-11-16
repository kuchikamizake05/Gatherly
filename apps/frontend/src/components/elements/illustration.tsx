import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Ilustrasi state: tiket geometris + titik kuning.
 * Diterjemahkan dari komponen "Ilustrasi / *" di pita 02 Design system (200 x 140, radius 32).
 */

export type IllustrationName =
  | "no-results"
  | "not-found"
  | "failed-load"
  | "no-tickets"
  | "nothing-saved"
  | "no-events"
  | "waiting"
  | "verifying"
  | "preparing"
  | "success"
  | "failed"
  | "expired";

const c = (token: string) => `var(--${token})`;

type Line = { x: number; y: number; w: number; fill: string; rx?: number };

/** Tiket dengan dua takik di sisi, garis perforasi, dan garis teks. */
function Ticket({
  x,
  y,
  rotate = 0,
  w = 112,
  tone = "solid",
  notchFill,
  perfX = 76,
  lines = [],
}: {
  x: number;
  y: number;
  rotate?: number;
  w?: number;
  tone?: "solid" | "muted";
  notchFill: string;
  perfX?: number;
  lines?: Line[];
}) {
  const ink = tone === "solid" ? c("foreground") : c("neutral-400");
  const perf = tone === "solid" ? c("border-strong") : c("neutral-300");
  const edge = (side: "l" | "r") =>
    side === "l"
      ? "M0 25 A9 9 0 0 1 0 43 L0 41.02 A7.02 7.02 0 0 0 0 26.98 Z"
      : `M${w} 43 A9 9 0 0 1 ${w} 25 L${w} 26.98 A7.02 7.02 0 0 0 ${w} 41.02 Z`;
  return (
    <g transform={`translate(${x} ${y})${rotate ? ` rotate(${rotate})` : ""}`}>
      <rect width={w} height={68} rx={14} fill={tone === "solid" ? "#FFFFFF" : c("neutral-50")} stroke={ink} strokeWidth={2} />
      <circle cx={0} cy={34} r={9} fill={notchFill} />
      <circle cx={w} cy={34} r={9} fill={notchFill} />
      <path d={edge("l")} fill={ink} />
      <path d={edge("r")} fill={ink} />
      {[10, 21, 32, 43, 54].map((py) => (
        <rect key={py} x={perfX} y={py} width={2} height={6} rx={1} fill={perf} />
      ))}
      {lines.map((l, i) => (
        <rect key={i} x={l.x} y={l.y} width={l.w} height={6} rx={l.rx ?? 3} fill={l.fill} />
      ))}
    </g>
  );
}

const textLines = (rx = 3): Line[] => [
  { x: 16, y: 18, w: 44, fill: c("foreground"), rx },
  { x: 16, y: 32, w: 28, fill: c("border-strong"), rx },
];

const HEART =
  "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z";

const ART: Record<IllustrationName, { bg: string; draw: (bg: string) => ReactNode }> = {
  "no-results": {
    bg: "surface-2",
    draw: (bg) => (
      <>
        <Ticket x={30} y={44} notchFill={bg} lines={textLines()} />
        <circle cx={139} cy={45} r={27} fill="#FFDD33" fillOpacity={0.4} stroke={c("foreground")} strokeWidth={4} />
        <rect x={156} y={64} width={26} height={9} rx={4} fill={c("foreground")} transform="rotate(45 156 64)" />
      </>
    ),
  },
  "not-found": {
    bg: "surface-2",
    draw: (bg) => (
      <>
        <Ticket x={30} y={44} tone="muted" notchFill={bg} />
        <circle cx={148} cy={38} r={24} fill={c("primary")} stroke={c("foreground")} strokeWidth={2} />
        <text x={148} y={38} textAnchor="middle" dominantBaseline="central" fontSize={26} fontWeight={800} fill={c("foreground")} fontFamily="var(--font-manrope), sans-serif">
          ?
        </text>
      </>
    ),
  },
  "failed-load": {
    bg: "danger-tint",
    draw: (bg) => (
      <>
        <Ticket x={44} y={22} notchFill={bg} lines={textLines()} />
        <rect x={24} y={108} width={62} height={6} rx={3} fill={c("foreground")} />
        <rect x={82} y={100} width={16} height={22} rx={5} fill={c("foreground")} />
        <rect x={112} y={100} width={16} height={22} rx={5} fill={c("background")} stroke={c("foreground")} strokeWidth={2} />
        <rect x={128} y={108} width={50} height={6} rx={3} fill={c("foreground")} />
        <rect x={100} y={92} width={8} height={3} rx={1.5} fill={c("danger")} transform="rotate(-60 100 92)" />
        <rect x={104} y={120} width={8} height={3} rx={1.5} fill={c("danger")} transform="rotate(60 104 120)" />
      </>
    ),
  },
  "no-tickets": {
    bg: "primary-tint",
    draw: (bg) => (
      <>
        <Ticket x={40} y={50} rotate={6} tone="muted" notchFill={bg} />
        <Ticket x={50} y={32} rotate={-6} notchFill={bg} lines={textLines()} />
        <circle cx={163} cy={31} r={13} fill={c("primary")} stroke={c("foreground")} strokeWidth={2} />
      </>
    ),
  },
  "nothing-saved": {
    bg: "danger-tint",
    draw: (bg) => (
      <>
        <Ticket x={40} y={44} rotate={-4} notchFill={bg} lines={textLines()} />
        <circle cx={152} cy={38} r={24} fill={c("background")} stroke={c("foreground")} strokeWidth={2} />
        <path d={HEART} transform="translate(141 27) scale(0.9167)" fill={c("danger")} />
      </>
    ),
  },
  "no-events": {
    bg: "surface-2",
    draw: (bg) => (
      <>
        <Ticket x={40} y={44} tone="muted" notchFill={bg} />
        <circle cx={151} cy={33} r={15} fill={c("primary")} stroke={c("foreground")} strokeWidth={2} />
      </>
    ),
  },
  waiting: {
    bg: "warning-tint",
    draw: (bg) => (
      <>
        <Ticket x={34} y={46} rotate={-8} notchFill={bg} lines={textLines(2)} />
        <circle cx={144} cy={44} r={28} fill={c("primary")} stroke={c("foreground")} strokeWidth={2} />
        <rect x={142} y={26} width={4} height={20} rx={2} fill={c("foreground")} />
        <rect x={142} y={42} width={16} height={4} rx={2} fill={c("foreground")} />
      </>
    ),
  },
  verifying: {
    bg: "info-tint",
    draw: (bg) => (
      <>
        <defs>
          <linearGradient id="illu-verifying-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFDD33" stopOpacity={0} />
            <stop offset="1" stopColor="#FFDD33" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <Ticket x={44} y={30} notchFill={bg} lines={textLines(2)} />
        <rect x={30} y={44} width={140} height={14} fill="url(#illu-verifying-glow)" />
        <rect x={30} y={58} width={140} height={6} rx={3} fill={c("primary")} />
        <circle cx={86.5} cy={116.5} r={4.5} fill={c("foreground")} />
        <circle cx={100.5} cy={116.5} r={4.5} fill={c("foreground")} fillOpacity={0.5} />
        <circle cx={114.5} cy={116.5} r={4.5} fill={c("foreground")} fillOpacity={0.2} />
      </>
    ),
  },
  preparing: {
    bg: "success-tint",
    draw: (bg) => (
      <>
        <Ticket x={44} y={26} notchFill={bg} lines={textLines(2)} />
        <rect x={24} y={84} width={152} height={40} rx={14} fill={c("foreground")} />
        <rect x={40} y={84} width={120} height={6} rx={3} fill={c("neutral-700")} />
        <circle cx={153} cy={105} r={5} fill={c("primary")} />
      </>
    ),
  },
  success: {
    bg: "primary-tint",
    draw: (bg) => (
      <>
        <Ticket x={44} y={40} notchFill={bg} lines={textLines(2)} />
        <circle cx={147} cy={41} r={17} fill={c("primary")} stroke={c("foreground")} strokeWidth={2} />
        <rect x={139} y={40} width={8} height={3} rx={1.5} fill={c("foreground")} transform="rotate(45 139 40)" />
        <rect x={143} y={44} width={14} height={3} rx={1.5} fill={c("foreground")} transform="rotate(-45 143 44)" />
        <circle cx={30} cy={26} r={4} fill={c("foreground")} />
        <circle cx={59} cy={17} r={3} fill={c("primary")} />
        <circle cx={106.5} cy={18.5} r={2.5} fill={c("success")} />
        <circle cx={173.5} cy={75.5} r={3.5} fill={c("foreground")} />
        <circle cx={25} cy={111} r={3} fill={c("success")} />
        <circle cx={180} cy={116} r={4} fill={c("primary")} />
        <rect x={38} y={34} width={12} height={4} rx={2} fill={c("success")} transform="rotate(-30 38 34)" />
        <rect x={160} y={92} width={12} height={4} rx={2} fill={c("foreground")} transform="rotate(25 160 92)" />
        <rect x={92} y={120} width={12} height={4} rx={2} fill={c("primary")} transform="rotate(-15 92 120)" />
      </>
    ),
  },
  failed: {
    bg: "danger-tint",
    draw: (bg) => (
      <>
        <Ticket x={10} y={50} rotate={-12} w={74} perfX={50} notchFill={bg} lines={[{ x: 14, y: 18, w: 36, fill: c("foreground"), rx: 2 }]} />
        <Ticket x={116} y={26} rotate={12} w={74} perfX={50} notchFill={bg} lines={[{ x: 14, y: 18, w: 30, fill: c("border-strong"), rx: 2 }]} />
        <rect x={96} y={50} width={8} height={3} rx={1.5} fill={c("danger")} transform="rotate(-30 96 50)" />
        <rect x={100} y={70} width={8} height={3} rx={1.5} fill={c("danger")} transform="rotate(20 100 70)" />
        <rect x={94} y={88} width={8} height={3} rx={1.5} fill={c("danger")} transform="rotate(-25 94 88)" />
      </>
    ),
  },
  expired: {
    bg: "surface-2",
    draw: (bg) => (
      <>
        <Ticket
          x={44}
          y={40}
          tone="muted"
          notchFill={bg}
         
          lines={[
            { x: 16, y: 18, w: 44, fill: c("neutral-300"), rx: 2 },
            { x: 16, y: 32, w: 28, fill: c("neutral-200"), rx: 2 },
          ]}
        />
        <circle cx={168} cy={24} r={14} fill="none" stroke={c("neutral-400")} strokeWidth={2} />
      </>
    ),
  },
};

export function Illustration({ name, className }: { name: IllustrationName; className?: string }) {
  const art = ART[name];
  const bg = c(art.bg);
  const clipId = `illu-clip-${name}`;
  return (
    <svg viewBox="0 0 200 140" aria-hidden="true" className={cn("h-auto w-[200px] max-w-full shrink-0", className)}>
      <defs>
        <clipPath id={clipId}>
          <rect width={200} height={140} rx={32} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width={200} height={140} fill={bg} />
        {art.draw(bg)}
      </g>
    </svg>
  );
}
