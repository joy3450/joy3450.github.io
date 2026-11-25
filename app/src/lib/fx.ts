import { languages, type Language } from "./language";
/* Small visual-effects helpers: floating "+XP" labels, confetti, toasts, speech. */

export const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

type Listener<T> = (v: T) => void;
function bus<T>() {
  const ls = new Set<Listener<T>>();
  return {
    emit: (v: T) => ls.forEach((l) => l(v)),
    on: (l: Listener<T>) => {
      ls.add(l);
      return () => {
        ls.delete(l);
      };
    },
  };
}

export interface FloatEv {
  id: number;
  text: string;
  x: number;
  y: number;
  kind: "xp" | "combo" | "gem" | "heart";
}
export const floats = bus<FloatEv>();
let fid = 0;

/** Show "+N XP" rising from a point (viewport coords). Falls back to the HUD position. */
export function floatXP(amount: number, at?: { x: number; y: number } | null, label?: string) {
  if (amount <= 0) return;
  const hud = (document.getElementById("study-xp") ?? document.getElementById("hud-xp"))?.getBoundingClientRect();
  const x = at?.x ?? (hud ? hud.left + hud.width / 2 : innerWidth / 2);
  const y = at?.y ?? (hud ? hud.bottom + 8 : 80);
  floats.emit({ id: ++fid, text: label ?? `+${amount} XP`, x, y, kind: "xp" });
}

export function floatFx(text: string, kind: FloatEv["kind"], at?: { x: number; y: number } | null) {
  const hud = document.getElementById(kind === "gem" ? "hud-gem" : "hud-xp")?.getBoundingClientRect();
  const x = at?.x ?? (hud ? hud.left + hud.width / 2 : innerWidth / 2);
  const y = at?.y ?? (hud ? hud.bottom + 8 : 80);
  floats.emit({ id: ++fid, text, x, y, kind });
}

export function pointOf(e?: { currentTarget: EventTarget | null } | null) {
  const el = e?.currentTarget as HTMLElement | null;
  if (!el || !el.getBoundingClientRect) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top };
}

export const toasts = bus<{ id: number; text: string }>();
let tid = 0;
export function toast(text: string) {
  toasts.emit({ id: ++tid, text });
}

/* ---------- Confetti (canvas, no dependency) ---------- */
interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  w: number;
  h: number;
  c: string;
  life: number;
}
const COLORS = ["#4255ff", "#ffb020", "#12a26b", "#ff6b3d", "#9b6bff", "#2bc4e0"];
let canvas: HTMLCanvasElement | null = null;
let bits: Bit[] = [];
let raf = 0;

function loop() {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = devicePixelRatio || 1;
  if (canvas.width !== innerWidth * dpr || canvas.height !== innerHeight * dpr) {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  bits = bits.filter((b) => b.life > 0 && b.y < innerHeight + 40);
  for (const b of bits) {
    b.vy += 0.32;
    b.vx *= 0.985;
    b.x += b.vx;
    b.y += b.vy;
    b.r += b.vr;
    b.life -= 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, b.life / 40);
    ctx.translate(b.x, b.y);
    ctx.rotate(b.r);
    ctx.fillStyle = b.c;
    ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 2)) + 1);
    ctx.restore();
  }
  if (bits.length) raf = requestAnimationFrame(loop);
  else {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    raf = 0;
  }
}

export function confetti(opts: { x?: number; y?: number; count?: number; spread?: number } = {}) {
  if (reducedMotion()) return;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: "100",
    });
    document.body.appendChild(canvas);
  }
  const x = opts.x ?? innerWidth / 2;
  const y = opts.y ?? innerHeight / 3;
  const count = opts.count ?? 120;
  const spread = opts.spread ?? 1;
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * spread;
    const s = 6 + Math.random() * 9;
    bits.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      c: COLORS[i % COLORS.length],
      life: 110 + Math.random() * 50,
    });
  }
  if (!raf) raf = requestAnimationFrame(loop);
}

/* ---------- Speech & clipboard ---------- */
export function speak(text: string, language: Language = "en", rate = 0.95) {
  if (!("speechSynthesis" in window)) {
    toast("這個瀏覽器不支援朗讀");
    return;
  }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = languages[language].voice;
    u.rate = rate;
    const v = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase() === u.lang.toLowerCase());
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export async function copyText(text: string) {
  const short = text.length > 40 ? text.slice(0, 40) + "…" : text;
  try {
    await navigator.clipboard.writeText(text);
    toast("已複製：" + short);
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      toast(ok ? "已複製：" + short : "複製失敗，請手動選取");
    } catch {
      toast("複製失敗，請手動選取");
    }
  }
}
