import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Clock, Flame, Gem, Heart, HeartCrack, Infinity as InfinityIcon, RotateCcw, Shield, ShieldX, Snowflake, Target, Timer, Turtle, Volume2, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { shuffle } from "@/lib/data";
import { GEMS, STREAK_MIN, lastNDays, priceOf } from "@/lib/game";
import { confetti, speak } from "@/lib/fx";
import { grade, norm, similarity } from "@/lib/grade";
import { rulesFor, type Level, type Rules } from "@/lib/levels";
import { sfx } from "@/lib/sound";
import { useBank } from "@/lib/store";
import type { Item } from "@/lib/types";
import { fmtTime } from "./game/bits";

/* ---------- exercises ---------- */
type Kind = "pick-en" | "pick-zh" | "build" | "type" | "listen" | "cloze" | "spot" | "dictation";
interface ItemEx {
  key: string;
  kind: Kind;
  item: Item;
  options: Item[];
  tiles: { id: number; w: string }[];
  second: boolean;
  /** seconds allowed (0 = untimed) */
  limit: number;
  cloze?: { before: string; after: string; answer: string };
  spot?: { words: string[]; wrong: number; original: string };
}
type Ex = ItemEx | { key: string; kind: "pairs"; items: Item[]; limit: number };

const canTTS = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function tokens(en: string) {
  return en
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}_'’]+|[^\p{L}\p{N}_'’]+$/gu, ""))
    .filter((w) => w && /\w/.test(w));
}

const STOP = new Set("a an the to of and or but so is am are was were be i you we it this that in on at for with by as do my your our me".split(" "));
const lowerToks = (s: string) => tokens(s).map((w) => w.toLowerCase());

/** Rank other items by how easily they could be confused with this one. */
function confusable(item: Item, src: Item[]) {
  const mine = new Set(lowerToks(item.en));
  return src
    .map((x) => {
      const t = lowerToks(x.en);
      const overlap = t.filter((w) => mine.has(w)).length / Math.max(1, new Set([...t, ...mine]).size);
      const len = 1 - Math.min(1, Math.abs(x.en.length - item.en.length) / Math.max(item.en.length, 8));
      const score = overlap * 2 + len + (x.sec === item.sec ? 0.6 : 0) + similarity(x.en.toLowerCase(), item.en.toLowerCase()) + Math.random() * 0.35;
      return { x, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((r) => r.x);
}

/** Blank the phrase (or an inflected form of a single word) out of its example sentence. */
function makeCloze(item: Item): ItemEx["cloze"] | undefined {
  const ex = item.ex;
  if (!ex) return;
  const target = item.en.replace(/\.{3}|…/g, "").replace(/[\s,.!?;:—-]+$/g, "").trim();
  if (!target) return;
  const i = ex.toLowerCase().indexOf(target.toLowerCase());
  if (i >= 0 && ex.length - target.length >= 8) return { before: ex.slice(0, i), after: ex.slice(i + target.length), answer: ex.slice(i, i + target.length) };
  const words = tokens(target);
  if (words.length === 1 && target.length >= 4) {
    const stem = target.toLowerCase().replace(/e$/, "");
    const m = ex.match(new RegExp(`\\b(${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[a-z]{0,4})\\b`, "i"));
    if (m && m.index !== undefined) return { before: ex.slice(0, m.index), after: ex.slice(m.index + m[1].length), answer: m[1] };
  }
}

/** Swap one content word for a plausible wrong one; the player has to find it. */
function makeSpot(item: Item, src: Item[]): ItemEx["spot"] | undefined {
  const words = item.en.split(/\s+/).filter(Boolean);
  if (words.length < 4) return;
  const bare = (w: string) => w.replace(/^[^\p{L}\p{N}_'’]+|[^\p{L}\p{N}_'’]+$/gu, "");
  const idx = shuffle(words.map((_, i) => i)).find((i) => {
    const b = bare(words[i]).toLowerCase();
    return b.length >= 3 && !STOP.has(b) && /^[\p{L}'’]+$/u.test(b);
  });
  if (idx === undefined) return;
  const orig = bare(words[idx]);
  const have = new Set(words.map((w) => bare(w).toLowerCase()));
  for (const x of confusable(item, src).slice(0, 25))
    for (const w of shuffle(tokens(x.en))) {
      const lw = w.toLowerCase();
      if (lw.length >= 3 && !STOP.has(lw) && !have.has(lw) && /^[\p{L}'’]+$/u.test(w) && Math.abs(w.length - orig.length) <= 5) {
        const rep = /^[A-Z]/.test(orig) ? w[0].toUpperCase() + w.slice(1) : lw;
        const out = words.slice();
        out[idx] = words[idx].replace(orig, rep);
        return { words: out, wrong: idx, original: orig };
      }
    }
}

function timeLimit(kind: Ex["kind"], item: Item | null, rules: Rules) {
  if (!rules.timer) return 0;
  const strict = rules.grading === "strict";
  const chars = item ? item.en.length : 0;
  const clamp = (v: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, v)));
  switch (kind) {
    case "pick-en":
    case "pick-zh":
    case "spot":
      return strict ? 12 : 15;
    case "build":
      return clamp(12 + tokens(item!.en).length * 1.6, 15, 40);
    case "pairs":
      return 35;
    case "dictation":
      return clamp(15 + (item?.ex.length ?? 40) * 0.5, 25, 60);
    default:
      return strict ? clamp(8 + chars * 0.35, 12, 30) : clamp(12 + chars * 0.45, 15, 40);
  }
}

let exSeq = 0;
function makeEx(kind: Kind, item: Item, pool: Item[], second: boolean, level: Level, rules: Rules): ItemEx {
  const same = pool.filter((x) => x.id !== item.id && x.tab === item.tab);
  const src = same.length >= 3 ? same : pool.filter((x) => x.id !== item.id);
  const field = kind === "pick-zh" ? "zh" : "en";
  const seen = new Set([item[field]]);
  const options: Item[] = [];
  const ranked = level >= 2 ? confusable(item, src).slice(0, 10) : shuffle(src);
  for (const x of shuffle(ranked)) {
    if (options.length >= 3) break;
    if (!seen.has(x[field])) {
      seen.add(x[field]);
      options.push(x);
    }
  }
  let tiles: { id: number; w: string }[] = [];
  if (kind === "build") {
    const words = tokens(item.en);
    const lower = new Set(words.map((w) => w.toLowerCase()));
    const extra: string[] = [];
    const want = level >= 2 ? 6 : 3;
    const from = level >= 2 ? confusable(item, src).slice(0, 15) : shuffle(src);
    for (const x of from)
      for (const w of shuffle(tokens(x.en)))
        if (extra.length < want && !lower.has(w.toLowerCase()) && w.length > 1) {
          extra.push(w.toLowerCase());
          lower.add(w.toLowerCase());
        }
    tiles = shuffle([...words, ...extra]).map((w, i) => ({ id: i, w }));
  }
  const ex: ItemEx = { key: `${kind}-${item.id}-${++exSeq}`, kind, item, options: shuffle([...options, item]), tiles, second, limit: timeLimit(kind, item, rules) };
  if (kind === "cloze") ex.cloze = makeCloze(item);
  if (kind === "spot") ex.spot = makeSpot(item, src);
  // fall back when a sentence can't be turned into this exercise
  if ((kind === "cloze" && !ex.cloze) || (kind === "spot" && !ex.spot) || (kind === "dictation" && !item.ex)) {
    ex.kind = kind === "spot" ? "pick-en" : "type";
    ex.limit = timeLimit(ex.kind, item, rules);
  }
  return ex;
}

function pickWeighted<T>(opts: [T, number][]): T {
  const total = opts.reduce((s, o) => s + o[1], 0);
  let r = Math.random() * total;
  for (const [v, w] of opts) if ((r -= w) <= 0) return v;
  return opts[opts.length - 1][0];
}

function buildLesson(items: Item[], pool: Item[], level: Level, boss: boolean): Ex[] {
  const tts = canTTS();
  const rules = rulesFor(level, boss);
  const mk = (k: Kind, it: Item, second: boolean) => makeEx(k, it, pool, second, level, rules);
  const n = (it: Item) => tokens(it.en).length;
  const canDictate = (it: Item) => tts && !!it.ex && tokens(it.ex).length >= 4 && tokens(it.ex).length <= 20;
  const pairs = (its: Item[]): Ex[] => (its.length >= 3 ? [{ key: `pairs-${++exSeq}`, kind: "pairs", items: shuffle(its).slice(0, 5), limit: timeLimit("pairs", null, rules) }] : []);

  if (boss) {
    const picked = shuffle(items).slice(0, 10);
    const qs = picked.map((it) =>
      mk(
        pickWeighted<Kind>([
          ["cloze", makeCloze(it) ? 3 : 0],
          ["spot", n(it) >= 4 ? 2 : 0],
          ["build", n(it) >= 3 && n(it) <= 12 ? 2 : 0],
          ["listen", tts ? 2 : 0],
          ["type", 2],
        ]),
        it,
        true,
      ),
    );
    const dict = shuffle(picked.filter(canDictate)).slice(0, 2).map((it) => mk("dictation", it, true));
    return shuffle([...qs, ...dict]);
  }

  if (level === 3) {
    const pass1 = shuffle(items).map((it) => mk(makeCloze(it) ? "cloze" : "type", it, false));
    const pass2 = shuffle(items).map((it) => mk(tts && Math.random() < 0.5 ? "listen" : "type", it, true));
    const dict = shuffle(items.filter(canDictate)).slice(0, 2).map((it) => mk("dictation", it, true));
    return [...pass1, ...pass2, ...dict];
  }

  if (level === 2) {
    const pass1 = shuffle(items).map((it) =>
      mk(
        pickWeighted<Kind>([
          ["cloze", makeCloze(it) ? 4 : 0],
          ["spot", n(it) >= 4 ? 3 : 0],
          ["pick-en", 3],
        ]),
        it,
        false,
      ),
    );
    const pass2 = shuffle(items).map((it) => {
      const len = n(it);
      if (len >= 3 && len <= 12) return mk(tts && Math.random() < 0.3 ? "listen" : "build", it, true);
      return mk(tts && Math.random() < 0.35 ? "listen" : "type", it, true);
    });
    return [...pass1, ...pairs(items), ...pass2];
  }

  const pass1 = shuffle(items).map((it) => {
    const word = n(it) <= 3;
    const k: Kind = word ? (Math.random() < 0.6 ? "pick-zh" : "pick-en") : Math.random() < 0.65 ? "pick-en" : "pick-zh";
    return mk(k, it, false);
  });
  const pass2 = shuffle(items).map((it) => {
    const len = n(it);
    let k: Kind;
    if (len >= 3 && len <= 12) k = tts && Math.random() < 0.25 ? "listen" : "build";
    else k = tts && len <= 6 && Math.random() < 0.3 ? "listen" : "type";
    return mk(k, it, true);
  });
  return [...pass1, ...pairs(items), ...pass2];
}

const TITLE: Record<Ex["kind"], string> = {
  "pick-en": "選出正確的英文",
  "pick-zh": "這句是什麼意思？",
  build: "用字塊拼出英文",
  type: "用英文寫出來",
  listen: "聽聽看，寫下你聽到的英文",
  pairs: "把英文和中文配成對",
  cloze: "填入缺少的英文",
  spot: "找出用錯的那個字",
  dictation: "聽寫整句例句",
};

/* ---------- small pieces ---------- */
const bigBtn =
  "inline-flex min-w-[150px] items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[17px] font-extrabold uppercase tracking-wide transition-[transform,box-shadow,filter] active:translate-y-[3px] active:shadow-none disabled:pointer-events-none disabled:opacity-40";
const shadow = (v: string) => ({ boxShadow: `0 4px 0 0 color-mix(in srgb, hsl(var(${v})) 70%, black)` });

function Tile({ children, onClick, used, className }: { children: ReactNode; onClick?: () => void; used?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={used}
      className={cn(
        "rounded-xl border-2 border-b-4 bg-card px-3 py-2 text-[16px] font-semibold transition-transform active:translate-y-0.5 active:border-b-2",
        used && "border-transparent bg-secondary text-transparent shadow-none",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Choice({ k, text, sel, onClick, disabled, state }: { k: number; text: string; sel: boolean; onClick: () => void; disabled: boolean; state?: "right" | "wrong" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 rounded-2xl border-2 border-b-4 bg-card px-4 py-3.5 text-left text-[16px] font-semibold leading-snug transition-colors enabled:hover:bg-secondary",
        sel && !state && "border-primary bg-accent text-accent-foreground",
        state === "right" && "border-good bg-good-soft text-good",
        state === "wrong" && "animate-shake border-bad bg-bad-soft text-bad",
      )}
    >
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 text-[13px] font-extrabold text-muted-foreground", sel && "border-primary text-primary")}>{k}</span>
      <span>{text}</span>
    </button>
  );
}

function Pairs({ items, onDone }: { items: Item[]; onDone: () => void }) {
  const left = useMemo(() => shuffle(items), [items]);
  const right = useMemo(() => shuffle(items), [items]);
  const [sel, setSel] = useState<{ side: "l" | "r"; id: string } | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [bad, setBad] = useState<string[]>([]);
  const click = (side: "l" | "r", id: string) => {
    if (done.has(id)) return;
    if (!sel || sel.side === side) {
      sfx.tap();
      if (side === "l") speak(items.find((x) => x.id === id)!.en, items[0]?.language);
      return setSel({ side, id });
    }
    if (sel.id === id) {
      sfx.tap();
      const d = new Set(done);
      d.add(id);
      setDone(d);
      setSel(null);
      if (d.size === items.length) window.setTimeout(onDone, 350);
    } else {
      sfx.wrong();
      setBad([`${sel.side}${sel.id}`, `${side}${id}`]);
      setSel(null);
      window.setTimeout(() => setBad([]), 450);
    }
  };
  const btn = (side: "l" | "r", it: Item) => {
    const isDone = done.has(it.id);
    const isSel = sel?.side === side && sel.id === it.id;
    return (
      <button
        key={side + it.id}
        type="button"
        onClick={() => click(side, it.id)}
        disabled={isDone}
        className={cn(
          "min-h-[58px] rounded-2xl border-2 border-b-4 bg-card px-3 py-2 text-[15px] font-semibold leading-snug transition-all",
          isSel && "border-primary bg-accent text-accent-foreground",
          bad.includes(side + it.id) && "animate-shake border-bad bg-bad-soft text-bad",
          isDone && "scale-95 border-good/40 bg-good-soft text-good opacity-50",
        )}
      >
        {side === "l" ? it.en : it.zh}
      </button>
    );
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-3">{left.map((it) => btn("l", it))}</div>
      <div className="flex flex-col gap-3">{right.map((it) => btn("r", it))}</div>
    </div>
  );
}

/* ---------- lesson ---------- */
type Phase = "play" | "out" | "done" | "streak" | "failed";
interface Feedback {
  ok: boolean;
  note?: string;
}

export function Lesson({
  title,
  items,
  nodeId,
  review,
  level = 1,
  boss = false,
  onExit,
  onRetry,
}: {
  title: string;
  items: Item[];
  nodeId?: string;
  review?: boolean;
  level?: Level;
  boss?: boolean;
  onExit: () => void;
  onRetry?: () => void;
}) {
  const bank = useBank();
  const { items: all, hearts, perks, game, gain, addGems, loseHeart, setLearned, completeNode, bumpQuest, recordCombo, mistake, buy, award, streak } = bank;
  const rules = useMemo(() => rulesFor(level, boss), [level, boss]);
  const [queue, setQueue] = useState<Ex[]>(() => buildLesson(items, all, level, boss));
  const [solved, setSolved] = useState(0);
  const [phase, setPhase] = useState<Phase>(() => (rules.hearts && bank.game.settings.hearts && bank.hearts.n <= 0 ? "out" : "play"));
  const [fast, setFast] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [tick, setTick] = useState(() => Date.now());
  const [plays, setPlays] = useState(0);
  const pausedAt = useRef(0);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [built, setBuilt] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [stats, setStats] = useState({ right: 0, wrong: 0 });
  const [confirmExit, setConfirmExit] = useState(false);
  const [comboFlash, setComboFlash] = useState<number | null>(null);
  const [result, setResult] = useState<{ xp: number; gems: number; secs: number; acc: number; perfect: boolean } | null>(null);
  const retries = useRef(new Map<string, number>());
  const missed = useRef(new Set<string>());
  const t0 = useRef(Date.now());
  const todayAtStart = useRef(bank.todayXP);
  const inputRef = useRef<HTMLInputElement>(null);
  const contRef = useRef<HTMLButtonElement>(null);
  const ex = queue[0];
  const total = solved + queue.length;
  const heartsOn = rules.hearts && game.settings.hearts;
  const strict = rules.grading === "strict";
  const remaining = deadline ? Math.max(0, (deadline - tick) / 1000) : 0;

  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = o;
    };
  }, []);

  // reset answer state as soon as a new exercise comes up (during render, so stale tile ids never reach it)
  const [ansKey, setAnsKey] = useState<string | undefined>(undefined);
  if (ex && ansKey !== ex.key) {
    setAnsKey(ex.key);
    setPick(null);
    setBuilt([]);
    setText("");
    setPlays(0);
    const t = Date.now();
    setTick(t);
    setDeadline(ex.limit ? t + ex.limit * 1000 : 0);
  }

  const playLimit = strict || boss ? 2 : Infinity;
  const play = (txt: string, rate = 0.95) => {
    if (plays >= playLimit) return;
    setPlays((n) => n + 1);
    speak(txt, bank.language, rate);
  };

  // auto-play audio and focus the input for each new exercise
  useEffect(() => {
    if (!ex || ex.kind === "pairs") return;
    if (ex.kind === "listen") window.setTimeout(() => play(ex.item.en), 250);
    if (ex.kind === "dictation") window.setTimeout(() => play(ex.item.ex), 250);
    if (ex.kind === "pick-zh") window.setTimeout(() => speak(ex.item.en, ex.item.language), 250);
    window.setTimeout(() => (document.querySelector("[data-answer]") as HTMLElement | null)?.focus(), 60);
  }, [ex?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // per-question countdown; pauses while feedback or the leave dialog is showing
  const timeUpRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!deadline || fb || phase !== "play" || confirmExit) return;
    const t = window.setInterval(() => {
      const now = Date.now();
      setTick(now);
      if (now >= deadline) timeUpRef.current();
    }, 200);
    return () => window.clearInterval(t);
  }, [deadline, fb, phase, confirmExit]);
  useEffect(() => {
    if (confirmExit) pausedAt.current = Date.now();
    else if (pausedAt.current) {
      const d = Date.now() - pausedAt.current;
      pausedAt.current = 0;
      setDeadline((x) => (x ? x + d : x));
    }
  }, [confirmExit]);

  useEffect(() => {
    if (fb) contRef.current?.focus({ preventScroll: true });
  }, [fb]);

  const ready =
    !!ex &&
    !fb &&
    ex.kind !== "pairs" &&
    (ex.kind === "pick-en" || ex.kind === "pick-zh" || ex.kind === "spot" ? pick !== null : ex.kind === "build" ? built.length > 0 : text.trim().length > 0);

  /** Grade typed text according to the difficulty's rules. */
  function judge(typed: string, target: string, kind: Kind): { ok: boolean; note?: string } {
    const g = grade(typed, target, bank.language);
    const close = g.level === "perfect" || g.level === "close";
    if (rules.grading === "strict" && kind !== "dictation") {
      const ok = norm(typed, bank.language) === norm(target, bank.language);
      return { ok, note: !ok && close ? "傳奇模式要一字不差" : undefined };
    }
    if (rules.grading !== "lenient") {
      const ok = g.level === "perfect" || (g.level === "close" && g.score >= 0.9);
      return { ok, note: ok && g.level !== "perfect" ? "有個小錯字，注意拼法" : !ok && close ? `${rules.name}模式只容許一個小錯字` : undefined };
    }
    return { ok: close, note: close && g.level === "close" ? "差一點點，注意一下拼法" : undefined };
  }

  function answer(ok: boolean, note?: string) {
    if (!ex || ex.kind === "pairs") return;
    const it = ex.item;
    if (ok) {
      sfx.correct();
      const c = combo + 1;
      setCombo(c);
      setBestCombo((b) => Math.max(b, c));
      recordCombo(c);
      if (c === 5 || c === 10 || c === 15 || c === 20) {
        setComboFlash(c);
        window.setTimeout(() => sfx.combo(), 200);
        window.setTimeout(() => setComboFlash(null), 1600);
      }
      setStats((s) => ({ ...s, right: s.right + 1 }));
      if (ex.limit && remaining > ex.limit / 2) setFast((f) => f + 1);
      if (ex.second && !missed.current.has(it.id)) setLearned(it.id, true, null, false);
      if (review) mistake(it.id, -1);
      if (ex.kind === "type" || ex.kind === "listen" || ex.kind === "cloze" || ex.kind === "dictation") bumpQuest("write");
    } else {
      sfx.wrong();
      setCombo(0);
      setStats((s) => ({ ...s, wrong: s.wrong + 1 }));
      missed.current.add(it.id);
      mistake(it.id, 1);
      setLearned(it.id, false);
      if (rules.hearts) loseHeart();
      const r = retries.current.get(it.id) ?? 0;
      if (rules.retry && r < 2) {
        retries.current.set(it.id, r + 1);
        // spot/cloze can't always be regenerated identically; fall back to typing
        const k: Kind = ex.kind === "spot" || ex.kind === "cloze" || ex.kind === "dictation" ? "type" : ex.kind;
        setQueue((q) => [...q, makeEx(k, it, all, ex.second, level, rules)]);
      }
    }
    setFb({ ok, note });
  }

  function check() {
    if (!ex || ex.kind === "pairs" || fb) return;
    const it = ex.item;
    if (ex.kind === "pick-en" || ex.kind === "pick-zh") {
      if (pick === null) return;
      answer(ex.options[pick].id === it.id);
    } else if (ex.kind === "build") {
      const said = built.filter((i) => ex.tiles[i]).map((i) => ex.tiles[i].w).join(" ");
      answer(norm(said, bank.language) === norm(tokens(it.en).join(" "), bank.language));
    } else if (ex.kind === "spot") {
      if (pick === null || !ex.spot) return;
      answer(pick === ex.spot.wrong);
    } else if (ex.kind === "cloze" && ex.cloze) {
      const r = judge(text, ex.cloze.answer, "cloze");
      answer(r.ok, r.note);
    } else if (ex.kind === "dictation") {
      const r = judge(text, it.ex, "dictation");
      answer(r.ok, r.note);
    } else {
      const r = judge(text, it.en, ex.kind);
      answer(r.ok, r.note);
    }
  }

  function timeUp() {
    if (!ex || fb || phase !== "play") return;
    if (ex.kind === "pairs") {
      sfx.wrong();
      setCombo(0);
      setStats((s) => ({ ...s, wrong: s.wrong + 1 }));
      if (rules.hearts) loseHeart();
      advance(true);
      return;
    }
    answer(false, "時間到");
  }
  timeUpRef.current = timeUp;

  function skip() {
    if (!ex || fb) return;
    answer(false);
  }

  function finish() {
    const secs = Math.round((Date.now() - t0.current) / 1000);
    const perfect = stats.wrong === 0;
    const acc = Math.round((stats.right / Math.max(1, stats.right + stats.wrong)) * 100);
    const base = Math.round((stats.right * 2 + 10 + (perfect ? 5 : 0)) * rules.xp) + fast;
    const xp = gain(base, null, `+${base} XP ${boss ? "單元考通過" : "關卡完成"}`);
    const gems = review ? 0 : GEMS.lesson + (perfect ? GEMS.perfect : 0) + rules.gems;
    if (gems) window.setTimeout(() => addGems(gems), 400);
    if (nodeId) completeNode(nodeId, perfect, boss ? 1 : level);
    bumpQuest("lessons");
    if (level >= 2 || boss) bumpQuest("hard");
    if (level === 3 && !boss) bumpQuest("legend");
    if (boss) bumpQuest("boss");
    if (perfect) {
      bumpQuest("perfect");
      if (stats.right >= 5) award("perfect");
    }
    setResult({ xp, gems, secs, acc, perfect });
    setPhase("done");
    sfx.complete();
    confetti({ count: perfect ? 200 : 120 });
  }

  function advance(wasWrong: boolean) {
    const rest = queue.slice(1);
    setQueue(rest);
    setSolved((s) => s + 1);
    if (wasWrong && rules.mistakes !== null && stats.wrong + (ex?.kind === "pairs" ? 1 : 0) > rules.mistakes) {
      sfx.heart();
      setPhase("failed");
      return;
    }
    if (wasWrong && heartsOn && hearts.n <= 0) {
      setPhase("out");
      return;
    }
    if (!rest.length) finish();
  }

  function cont() {
    if (!fb) return;
    const wasWrong = !fb.ok;
    setFb(null);
    advance(wasWrong);
  }

  function pairsDone() {
    sfx.correct();
    setStats((s) => ({ ...s, right: s.right + 1 }));
    advance(false);
  }

  // keyboard: Enter checks / continues, 1–4 picks, Esc asks to leave
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape") {
      if (phase === "play") setConfirmExit((v) => !v);
      return;
    }
    if (phase !== "play" || confirmExit || !ex) return;
    const typing = /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName);
    if (e.key === "Enter") {
      if (e.target === contRef.current) return; // the focused 繼續 button handles it natively
      e.preventDefault();
      if (fb) cont();
      else if (ready) check();
      return;
    }
    if (!typing && !fb && (ex.kind === "pick-en" || ex.kind === "pick-zh") && /^[1-4]$/.test(e.key)) {
      const k = Number(e.key) - 1;
      if (ex.options[k]) {
        sfx.tap();
        setPick(k);
      }
    }
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => keyRef.current(e);
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, []);

  /* ---------- screens ---------- */
  if (phase === "done" && result) {
    const extended = todayAtStart.current < STREAK_MIN && todayAtStart.current + result.xp >= STREAK_MIN;
    return (
      <Screen>
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="relative grid h-36 w-36 animate-pop place-items-center rounded-full bg-xp-soft">
            <div className="grid h-24 w-24 place-items-center rounded-full bg-xp text-white" style={shadow("--xp")}>
              <Check className="h-14 w-14" strokeWidth={3} />
            </div>
          </div>
          <div>
            <h2 className="m-0 text-3xl font-extrabold text-xp">
              {boss ? "單元考通過！" : level === 3 ? "傳奇關卡通過！" : result.perfect ? "零失誤，完美過關！" : "關卡完成！"}
            </h2>
            <p className="m-0 mt-1 text-muted-foreground">
              {title}
              {(level > 1 || boss) && <span className={cn("ml-2 rounded-full px-2 py-0.5 text-xs font-extrabold text-white", boss ? "bg-bad" : level === 3 ? "bg-formal" : "bg-streak")}>{rules.name}・XP ×{rules.xp}</span>}
            </p>
          </div>
          <div className="grid w-full max-w-md grid-cols-3 gap-3">
            <Stat color="--xp" label="總 XP" icon={<Zap className="h-5 w-5" />} value={String(result.xp)} />
            <Stat color="--good" label="正確率" icon={<Target className="h-5 w-5" />} value={result.acc + "%"} />
            <Stat color="--primary" label="用時" icon={<Clock className="h-5 w-5" />} value={fmtTime(result.secs)} />
          </div>
          {fast > 0 && (
            <p className="m-0 flex items-center gap-1.5 font-extrabold text-good">
              <Timer className="h-5 w-5" /> 快答 {fast} 題（+{fast} XP）
            </p>
          )}
          {bestCombo >= 3 && (
            <p className="m-0 flex items-center gap-1.5 font-extrabold text-streak">
              <Flame className="h-5 w-5" /> 最高連續答對 {bestCombo} 題
            </p>
          )}
          {result.gems > 0 && (
            <p className="m-0 flex items-center gap-1.5 rounded-full bg-[hsl(199_89%_48%/.12)] px-4 py-1.5 font-extrabold text-[hsl(199_89%_40%)] dark:text-[hsl(199_89%_65%)]">
              <Gem className="h-5 w-5" /> +{result.gems} 寶石
            </p>
          )}
        </div>
        <Bottom>
          <span />
          <button autoFocus type="button" className={cn(bigBtn, "bg-good text-white")} style={shadow("--good")} onClick={() => (extended ? setPhase("streak") : onExit())}>
            繼續
          </button>
        </Bottom>
      </Screen>
    );
  }

  if (phase === "streak") {
    const week = lastNDays(game.days, 7);
    return (
      <Screen>
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative grid h-40 w-40 place-items-center">
            <Flame className="h-40 w-40 animate-pop fill-streak/90 text-streak" strokeWidth={1.2} />
            <span className="tabular absolute bottom-6 text-5xl font-extrabold text-white drop-shadow">{streak}</span>
          </div>
          <h2 className="m-0 text-3xl font-extrabold text-streak">連續學習 {streak} 天！</h2>
          <div className="flex gap-2 rounded-2xl bg-card p-3 shadow-card">
            {week.map((d) => {
              const hit = d.xp >= STREAK_MIN;
              const froze = game.frozen.includes(d.key);
              return (
                <div key={d.key} className="flex w-9 flex-col items-center gap-1">
                  <span className={cn("text-xs font-bold", d.today ? "text-streak" : "text-muted-foreground")}>{d.label}</span>
                  <span className={cn("grid h-8 w-8 place-items-center rounded-full", hit ? "bg-streak text-white" : froze ? "bg-[hsl(199_89%_48%)] text-white" : "bg-secondary")}>
                    {hit ? <Check className="h-4 w-4" strokeWidth={3} /> : froze ? <Snowflake className="h-4 w-4" /> : null}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="m-0 max-w-xs text-muted-foreground">明天再來練一關，火焰就不會熄滅。{game.freezes > 0 && `你還有 ${game.freezes} 個連勝凍結。`}</p>
        </div>
        <Bottom>
          <span />
          <button autoFocus type="button" className={cn(bigBtn, "bg-streak text-white")} style={shadow("--streak")} onClick={onExit}>
            繼續
          </button>
        </Bottom>
      </Screen>
    );
  }

  if (phase === "failed") {
    return (
      <Screen>
        <div className="flex flex-col items-center gap-5 text-center">
          <ShieldX className="h-28 w-28 animate-pop text-formal" strokeWidth={1.5} />
          <h2 className="m-0 text-3xl font-extrabold">{rules.name}挑戰失敗</h2>
          <p className="m-0 max-w-sm text-muted-foreground">
            錯了 {stats.wrong} 題，{rules.name}最多只能錯 {rules.mistakes} 題。答對 {stats.right} 題，再試一次會換一批題型。
          </p>
        </div>
        <Bottom>
          <button type="button" className={cn(bigBtn, "border-2 border-b-4 bg-card text-muted-foreground")} onClick={onExit}>
            離開
          </button>
          {onRetry && (
            <button autoFocus type="button" className={cn(bigBtn, "bg-formal text-white")} style={shadow("--formal")} onClick={onRetry}>
              <RotateCcw className="h-5 w-5" /> 再挑戰
            </button>
          )}
        </Bottom>
      </Screen>
    );
  }

  if (phase === "out") {
    return (
      <Screen>
        <div className="flex flex-col items-center gap-5 text-center">
          <HeartCrack className="h-28 w-28 animate-pop fill-bad/20 text-bad" strokeWidth={1.5} />
          <h2 className="m-0 text-3xl font-extrabold">生命用完了</h2>
          <p className="m-0 max-w-sm text-muted-foreground">
            每 {Math.round(perks.regenMs / 60000)} 分鐘恢復 1 顆{hearts.next ? `，下一顆約 ${Math.ceil(hearts.next / 60000)} 分鐘後恢復` : ""}。也可以用寶石馬上補滿，或到設定關掉生命制度。
          </p>
          <p className="m-0 flex items-center gap-1.5 font-extrabold text-[hsl(199_89%_40%)] dark:text-[hsl(199_89%_65%)]">
            <Gem className="h-5 w-5" /> 你有 {game.gems} 顆寶石
          </p>
        </div>
        <Bottom>
          <button type="button" className={cn(bigBtn, "border-2 border-b-4 bg-card text-muted-foreground")} onClick={onExit}>
            離開
          </button>
          <button
            type="button"
            disabled={game.gems < priceOf("refill", perks)}
            className={cn(bigBtn, "bg-bad text-white")}
            style={shadow("--bad")}
            onClick={() => {
              if (buy("refill")) {
                setPhase("play");
                if (!queue.length) finish();
              }
            }}
          >
            <Heart className="h-5 w-5 fill-current" /> {priceOf("refill", perks)} 寶石補滿
          </button>
        </Bottom>
      </Screen>
    );
  }

  /* ---------- play ---------- */
  const pct = total ? (solved / total) * 100 : 0;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={`關卡：${title}`}>
      <header className="mx-auto flex w-full max-w-[1000px] items-center gap-4 px-4 pb-2 pt-5">
        <button type="button" aria-label="離開關卡" onClick={() => setConfirmExit(true)} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-secondary">
          <X className="h-6 w-6" />
        </button>
        <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={cn("relative h-full rounded-full transition-[width] duration-500", combo >= 5 ? "bg-streak" : "bg-good")}
            style={{ width: `${Math.max(pct, 3)}%` }}
          >
            <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/35" />
          </div>
        </div>
        {level > 1 || boss ? (
          <span className={cn("hidden rounded-full px-2.5 py-0.5 text-xs font-extrabold text-white sm:inline-block", boss ? "bg-bad" : level === 3 ? "bg-formal" : "bg-streak")}>{rules.name}</span>
        ) : null}
        {rules.mistakes !== null ? (
          <span className="flex items-center gap-0.5" aria-label={`還能錯 ${Math.max(0, rules.mistakes - stats.wrong)} 題`} title="容錯次數">
            {Array.from({ length: rules.mistakes }, (_, i) => {
              const left = i < rules.mistakes! - stats.wrong;
              return left ? <Shield key={i} className="h-6 w-6 fill-formal/25 text-formal" /> : <ShieldX key={i} className="h-6 w-6 animate-pop text-muted-foreground/50" />;
            })}
          </span>
        ) : (
          <span key={hearts.n} className={cn("flex items-center gap-1 text-lg font-extrabold", heartsOn ? "text-bad" : "text-muted-foreground", heartsOn && hearts.n < perks.maxHearts && "animate-pop")} aria-label={heartsOn ? `剩 ${hearts.n} 顆生命` : "生命制度關閉"}>
            <Heart className={cn("h-6 w-6", heartsOn && "fill-bad")} />
            {heartsOn ? <span className="tabular">{hearts.n}</span> : <InfinityIcon className="h-5 w-5" />}
          </span>
        )}
      </header>
      <div className="relative mx-auto h-7 w-full max-w-[1000px] px-4">
        {ex && ex.limit > 0 && !fb && !comboFlash && (
          <div className="absolute inset-x-4 top-1.5 flex items-center gap-2 sm:left-[72px]" aria-label={`剩 ${Math.ceil(remaining)} 秒`}>
            <Timer className={cn("h-4 w-4 shrink-0", remaining <= 5 ? "animate-pulse text-bad" : "text-muted-foreground")} />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full transition-[width] duration-200 ease-linear", remaining / ex.limit > 0.5 ? "bg-good" : remaining / ex.limit > 0.25 ? "bg-xp" : "bg-bad")}
                style={{ width: `${(remaining / ex.limit) * 100}%` }}
              />
            </div>
            <span className={cn("tabular w-8 text-right text-sm font-extrabold", remaining <= 5 ? "text-bad" : "text-muted-foreground")}>{Math.ceil(remaining)}</span>
          </div>
        )}
        {comboFlash && (
          <p className="absolute inset-x-0 top-0 m-0 flex animate-pop justify-center">
            <span className="flex items-center gap-1 rounded-full bg-streak-soft px-3 py-0.5 text-sm font-extrabold text-streak">
              <Flame className="h-4 w-4" /> 連續答對 {comboFlash} 題！
            </span>
          </p>
        )}
      </div>

      <main className="flex-1 overflow-y-auto px-4 pb-40">
        {ex && (
          <div key={ex.key} className="mx-auto flex max-w-[620px] animate-rise flex-col gap-6 pt-4">
            <h2 className="m-0 text-[24px] font-extrabold sm:text-[28px]">{TITLE[ex.kind].replace("英文", bank.target.name)}</h2>
            {ex.kind === "pairs" ? (
              <Pairs items={ex.items} onDone={pairsDone} />
            ) : (
              <ExerciseBody
                ex={ex}
                fb={fb}
                pick={pick}
                setPick={setPick}
                built={built}
                setBuilt={setBuilt}
                text={text}
                setText={setText}
                inputRef={inputRef}
                playsLeft={playLimit === Infinity ? null : Math.max(0, playLimit - plays)}
                onPlay={(slow) => play(ex.kind === "dictation" ? ex.item.ex : ex.item.en, slow ? 0.6 : 0.95)}
                allowSlow={!strict && !boss}
              />
            )}
          </div>
        )}
      </main>

      {ex?.kind !== "pairs" && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 border-t-2 transition-colors",
            fb ? (fb.ok ? "border-transparent bg-good-soft" : "border-transparent bg-bad-soft") : "bg-background",
          )}
        >
          <div className="mx-auto flex max-w-[1000px] flex-wrap items-center justify-between gap-3 px-4 py-5">
            {fb ? (
              <div className={cn("flex min-w-0 flex-1 animate-rise items-center gap-3", fb.ok ? "text-good" : "text-bad")}>
                <span className={cn("hidden h-14 w-14 shrink-0 place-items-center rounded-full bg-card sm:grid")}>
                  {fb.ok ? <Check className="h-8 w-8" strokeWidth={3} /> : <X className="h-8 w-8" strokeWidth={3} />}
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-xl font-extrabold">{fb.ok ? (fb.note ? "算你對！" : ["答得好！", "太棒了！", "正確！", "很好！"][stats.right % 4]) : "正確答案："}</p>
                  {(!fb.ok || fb.note) && ex && (
                    <p className="m-0 font-semibold">
                      {ex.kind === "pick-zh"
                        ? ex.item.zh
                        : ex.kind === "cloze" && ex.cloze
                          ? ex.cloze.answer
                          : ex.kind === "spot" && ex.spot
                            ? `「${ex.spot.words[ex.spot.wrong].replace(/^[^\p{L}\p{N}_'’]+|[^\p{L}\p{N}_'’]+$/gu, "")}」應該是「${ex.spot.original}」`
                            : ex.kind === "dictation"
                              ? ex.item.ex
                              : ex.item.en}
                      {fb.note && <span className="ml-2 text-sm font-bold opacity-80">（{fb.note}）</span>}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <button type="button" onClick={skip} className={cn(bigBtn, "border-2 border-b-4 bg-card text-muted-foreground hover:bg-secondary")}>
                跳過
              </button>
            )}
            {fb ? (
              <button ref={contRef} type="button" onClick={cont} className={cn(bigBtn, fb.ok ? "bg-good text-white" : "bg-bad text-white")} style={shadow(fb.ok ? "--good" : "--bad")}>
                繼續
              </button>
            ) : (
              <button type="button" onClick={check} disabled={!ready} className={cn(bigBtn, "bg-good text-white")} style={shadow("--good")}>
                檢查
              </button>
            )}
          </div>
        </div>
      )}

      {confirmExit && (
        <div className="fixed inset-0 z-[60] grid place-items-end bg-[rgb(15_16_48/.5)] sm:place-items-center" onClick={() => setConfirmExit(false)}>
          <div className="w-full animate-rise rounded-t-3xl bg-card p-6 text-center sm:max-w-sm sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-labelledby="leave-t">
            <h3 id="leave-t" className="m-0 text-xl font-extrabold">等等，先別走！</h3>
            <p className="mb-5 mt-2 text-muted-foreground">現在離開，這一關的進度不會保存。</p>
            <button autoFocus type="button" className={cn(bigBtn, "w-full bg-primary text-primary-foreground")} style={shadow("--primary")} onClick={() => setConfirmExit(false)}>
              繼續學習
            </button>
            <button type="button" className="mt-3 w-full rounded-xl py-3 font-extrabold text-bad hover:bg-bad-soft" onClick={onExit}>
              結束關卡
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExerciseBody({
  ex,
  fb,
  pick,
  setPick,
  built,
  setBuilt,
  text,
  setText,
  inputRef,
  playsLeft,
  onPlay,
  allowSlow,
}: {
  playsLeft: number | null;
  onPlay: (slow: boolean) => void;
  allowSlow: boolean;
  ex: Extract<Ex, { kind: Kind }>;
  fb: Feedback | null;
  pick: number | null;
  setPick: (n: number) => void;
  built: number[];
  setBuilt: (b: number[]) => void;
  text: string;
  setText: (s: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { target } = useBank();
  const it = ex.item;
  const prompt = (
    <div className="flex items-start gap-3">
      {ex.kind === "pick-zh" && (
        <button type="button" onClick={() => speak(it.en, it.language)} aria-label="再聽一次" className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground" style={shadow("--primary")}>
          <Volume2 className="h-5 w-5" />
        </button>
      )}
      <p className="relative m-0 rounded-2xl border-2 bg-card px-4 py-3 text-[19px] font-semibold leading-snug">{ex.kind === "pick-zh" ? it.en : it.zh}</p>
    </div>
  );

  if (ex.kind === "pick-en" || ex.kind === "pick-zh") {
    return (
      <>
        {prompt}
        <div className="grid gap-3">
          {ex.options.map((o, k) => (
            <Choice
              key={o.id}
              k={k + 1}
              text={ex.kind === "pick-zh" ? o.zh : o.en}
              sel={pick === k}
              disabled={!!fb}
              state={fb ? (o.id === it.id ? (pick === k || !fb.ok ? "right" : undefined) : pick === k ? "wrong" : undefined) : undefined}
              onClick={() => {
                sfx.tap();
                setPick(k);
              }}
            />
          ))}
        </div>
      </>
    );
  }

  if (ex.kind === "build") {
    const used = new Set(built);
    return (
      <>
        {prompt}
        <div className="flex min-h-[124px] flex-wrap content-start gap-2 border-y-2 py-3" aria-label="你的句子">
          {built.filter((i) => ex.tiles[i]).map((i) => (
            <Tile
              key={i}
              onClick={() => {
                if (fb) return;
                sfx.tap();
                setBuilt(built.filter((x) => x !== i));
              }}
            >
              {ex.tiles[i].w}
            </Tile>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2" aria-label="字塊">
          {ex.tiles.map((t) => (
            <Tile
              key={t.id}
              used={used.has(t.id)}
              onClick={() => {
                if (fb) return;
                sfx.tap();
                setBuilt([...built, t.id]);
              }}
            >
              {t.w}
            </Tile>
          ))}
        </div>
      </>
    );
  }

  const answerInput = (placeholder: string, area = false) =>
    area ? (
      <textarea
        data-answer
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={!!fb}
        placeholder={placeholder}
        aria-label="你的答案"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        rows={3}
        className="w-full resize-none rounded-2xl border-2 bg-secondary px-4 py-3 text-[18px] font-semibold outline-none focus:border-primary focus:bg-card"
      />
    ) : (
      <input
        data-answer
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={!!fb}
        placeholder={placeholder}
        aria-label="你的答案"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="h-32 w-full rounded-2xl border-2 bg-secondary px-4 text-[18px] font-semibold outline-none focus:border-primary focus:bg-card sm:h-28"
      />
    );

  const player = (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => onPlay(false)}
        disabled={playsLeft === 0}
        aria-label="播放"
        className="grid h-24 w-24 place-items-center rounded-3xl bg-primary text-primary-foreground disabled:opacity-40"
        style={shadow("--primary")}
      >
        <Volume2 className="h-11 w-11" />
      </button>
      {allowSlow ? (
        <button type="button" onClick={() => onPlay(true)} aria-label="慢速播放" className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/80 text-primary-foreground" style={shadow("--primary")}>
          <Turtle className="h-7 w-7" />
        </button>
      ) : (
        <p className="m-0 text-sm font-bold text-muted-foreground">{playsLeft === null ? "" : playsLeft > 0 ? `還能播 ${playsLeft} 次，不能慢速` : "播放次數用完了"}</p>
      )}
    </div>
  );

  if (ex.kind === "cloze" && ex.cloze) {
    const c = ex.cloze;
    return (
      <>
        <p className="m-0 rounded-2xl border-2 bg-card px-4 py-3 text-[15px] font-semibold text-muted-foreground">提示：{it.zh}</p>
        <div className="rounded-2xl border-2 bg-card px-4 py-5 text-[20px] font-semibold leading-[2.4]">
          {c.before}
          <input
            data-answer
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            readOnly={!!fb}
            aria-label={`填入缺少的${target.name}`}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            style={{ width: `${Math.max(5, Math.min(26, c.answer.length + 2))}ch` }}
            className="mx-1 inline-block max-w-full rounded-lg border-b-4 border-primary bg-accent px-2 py-0.5 align-baseline text-[19px] font-bold text-accent-foreground outline-none"
          />
          {c.after}
        </div>
        <p className="m-0 text-sm font-semibold text-muted-foreground">
          缺了 {tokens(c.answer).length} 個字{allowSlow && `，第一個字母是「${c.answer.trim()[0]}」`}
        </p>
      </>
    );
  }

  if (ex.kind === "spot" && ex.spot) {
    const sp = ex.spot;
    return (
      <>
        <p className="m-0 rounded-2xl border-2 bg-card px-4 py-3 text-[19px] font-semibold leading-snug">{it.zh}</p>
        <p className="m-0 text-sm font-semibold text-muted-foreground">下面的{target.name}有一個字被換掉了，點出那個字。</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="句子">
          {sp.words.map((w, k) => {
            const state = fb ? (k === sp.wrong ? "right" : pick === k ? "wrong" : undefined) : undefined;
            return (
              <button
                key={k}
                type="button"
                disabled={!!fb}
                onClick={() => {
                  sfx.tap();
                  setPick(k);
                }}
                className={cn(
                  "rounded-xl border-2 border-b-4 bg-card px-3 py-2 text-[17px] font-semibold transition-colors enabled:hover:bg-secondary",
                  pick === k && !state && "border-primary bg-accent text-accent-foreground",
                  state === "right" && "border-good bg-good-soft text-good",
                  state === "wrong" && "animate-shake border-bad bg-bad-soft text-bad",
                )}
              >
                {w}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  if (ex.kind === "dictation") {
    return (
      <>
        {player}
        <p className="m-0 text-sm font-semibold text-muted-foreground">這是「{it.en.length > 40 ? it.en.slice(0, 40) + "…" : it.en}」的例句，把整句寫下來。</p>
        {answerInput(`輸入你聽到的整句${target.name}`, true)}
      </>
    );
  }

  // type / listen
  return (
    <>
      {ex.kind === "listen" ? player : prompt}
      {answerInput(ex.kind === "listen" ? `輸入你聽到的${target.name}` : `用${target.name}輸入`)}
    </>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background" role="dialog" aria-modal="true">
      <div className="flex flex-1 items-center justify-center px-4 pb-36 pt-10">{children}</div>
    </div>
  );
}

function Bottom({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t-2 bg-background">
      <div className="mx-auto flex max-w-[1000px] items-center justify-between gap-3 px-4 py-5">{children}</div>
    </div>
  );
}

function Stat({ color, label, icon, value }: { color: string; label: string; icon: ReactNode; value: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border-2 animate-pop" style={{ borderColor: `hsl(var(${color}))` }}>
      <p className="m-0 py-1 text-xs font-extrabold uppercase text-white" style={{ background: `hsl(var(${color}))` }}>
        {label}
      </p>
      <p className="m-0 flex items-center justify-center gap-1.5 bg-card py-3 text-xl font-extrabold" style={{ color: `hsl(var(${color}))` }}>
        {icon}
        <span className="tabular">{value}</span>
      </p>
    </div>
  );
}
