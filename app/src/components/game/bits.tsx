import { useBank } from "@/lib/store";
import type { ComponentType, ReactNode } from "react";
import { BookOpen, Crown, Diamond, ShieldCheck, Swords, Flag, Flame, Gem, Keyboard, Map as MapIcon, Medal, Mic, PenLine, Sprout, Star, Target, Timer, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Achievement } from "@/lib/game";
import type { Tone } from "@/lib/types";

export const ACH_ICON: Record<Achievement["icon"], ComponentType<{ className?: string }>> = {
  sprout: Sprout,
  book: BookOpen,
  trophy: Trophy,
  crown: Crown,
  flame: Flame,
  zap: Zap,
  target: Target,
  timer: Timer,
  pen: PenLine,
  medal: Medal,
  star: Star,
  gem: Gem,
  mic: Mic,
  keyboard: Keyboard,
  map: MapIcon,
  flag: Flag,
  diamond: Diamond,
  shield: ShieldCheck,
  swords: Swords,
};

/** Progress bar with a striped moving fill. */
export function Bar({
  value,
  max,
  className,
  fill = "bg-primary",
  label,
}: {
  value: number;
  max: number;
  className?: string;
  fill?: string;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={cn("h-2.5 overflow-hidden rounded-full bg-secondary", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
    >
      <div className={cn("bar-fill h-full rounded-full", fill)} style={{ width: pct + "%" }} />
    </div>
  );
}

/** Circular progress ring. */
export function Ring({
  value,
  max,
  size = 44,
  stroke = 5,
  color = "hsl(var(--xp))",
  children,
  className,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className={cn("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .7s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function LevelBadge({ level, size = "md", className }: { level: number; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = {
    sm: "h-8 w-8 text-sm rounded-[10px]",
    md: "h-12 w-12 text-lg rounded-[14px]",
    lg: "h-24 w-24 text-4xl rounded-[26px]",
  }[size];
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center bg-gradient-to-br from-primary to-[hsl(258_80%_62%)] font-extrabold text-white shadow-btn",
        s,
        className,
      )}
      aria-label={`等級 ${level}`}
    >
      <span className="tabular">{level}</span>
      <span className="absolute -bottom-1 rounded-md bg-xp px-1 text-[9px] font-extrabold leading-[14px] text-[#3a2600]">LV</span>
    </div>
  );
}

const TONE_CLS: Record<Tone, string> = {
  casual: "bg-casual-soft text-casual",
  neutral: "bg-neu-soft text-neu",
  formal: "bg-formal-soft text-formal",
};
const TONE_DOT: Record<Tone, string> = { casual: "bg-casual", neutral: "bg-neu", formal: "bg-formal" };

export function ToneTag({ tone, className }: { tone: Tone; className?: string }) {
  const { target } = useBank();
  return <span className={cn("rounded-md px-2 py-px text-xs font-bold", TONE_CLS[tone], className)}>{target.tones[tone]}</span>;
}
export function ToneDot({ tone }: { tone: Tone }) {
  return <span className={cn("h-2 w-2 rounded-full", TONE_DOT[tone])} />;
}

export function IconBtn({
  label,
  onClick,
  children,
  pressed,
  className,
  disabled,
}: {
  label: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  pressed?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-35",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function fmtTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
