import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Brain, ClipboardCheck, Flame, Lightbulb, Mic, PenLine, Puzzle, RotateCcw, Square, Star, Timer, Volume2, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { shuffle } from "@/lib/data";
import { XP, comboBonus } from "@/lib/game";
import { confetti, pointOf, speak, toast } from "@/lib/fx";
import { bestOf, grade, hintOf, type GradeResult } from "@/lib/grade";
import { speechSupported, useSpeech } from "@/lib/speech";
import { useBank } from "@/lib/store";
import type { Item, StudyMode, TabKey } from "@/lib/types";
import { IconBtn, ToneTag, fmtTime } from "./game/bits";

const btn =
  "inline-flex flex-1 basis-40 items-center justify-center gap-2 rounded-xl border-2 px-5 py-3.5 text-[17px] font-bold transition-[background-color,transform,box-shadow] active:translate-y-px active:shadow-none";
const btnPrimary = cn(btn, "border-primary bg-primary text-primary-foreground shadow-btn hover:bg-primary-hover");
const btnGood = cn(btn, "border-good bg-good text-white shadow-btn hover:brightness-105");
const btnPlain = cn(btn, "bg-card shadow-btn hover:bg-secondary");

/* ---------- Shell ---------- */
function Shell({
  mode,
  i,
  n,
  combo,
  xp,
  onExit,
  children,
  extra,
  count,
}: {
  count?: string;
  mode: StudyMode;
  i: number;
  n: number;
  combo: number;
  xp: number;
  onExit: () => void;
  children: ReactNode;
  extra?: ReactNode;
}) {
  const label = count ?? `${Math.min(i + 1, n)} / ${n}`;
  const meta = {
    learn: { name: "學習", Icon: Brain },
    write: { name: "默寫", Icon: PenLine },
    test: { name: "測驗", Icon: ClipboardCheck },
    match: { name: "配對", Icon: Puzzle },
  }[mode];
  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-auto bg-background" role="dialog" aria-modal="true" aria-label={meta.name}>
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-3 px-4">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-primary text-primary-foreground">
            <meta.Icon className="h-5 w-5" />
          </span>
          <span className="text-[17px] font-extrabold">{meta.name}</span>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {extra}
            {combo >= 2 && (
              <span key={combo} className="flex animate-pop items-center gap-1 rounded-full bg-streak-soft px-2.5 py-1 text-sm font-extrabold text-streak">
                <Flame className="h-4 w-4 animate-flicker" />
                <span className="tabular">{combo} 連擊</span>
              </span>
            )}
            <span id="study-xp" className="flex items-center gap-1 rounded-full bg-xp-soft px-2.5 py-1 text-sm font-extrabold text-[hsl(30_100%_30%)] dark:text-xp">
              <Zap className="h-4 w-4" />
              <span className="tabular">+{xp}</span>
            </span>
            {n > 0 && (
              <span className="tabular hidden text-sm font-bold text-muted-foreground sm:inline">
                {label}
              </span>
            )}
            <IconBtn label="離開 (Esc)" onClick={onExit}>
              <X className="h-5 w-5" />
            </IconBtn>
          </div>
        </div>
        <div className="h-1.5 bg-secondary">
          <div className="bar-fill h-full bg-primary" style={{ width: (n ? (i / n) * 100 : 0) + "%" }} />
        </div>
      </header>
      <div className="mx-auto w-full max-w-[760px] flex-1 px-4 pb-12 pt-8">{children}</div>
    </div>
  );
}

function useKeys(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      ref.current(e);
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, []);
}

function Stars({ n }: { n: number }) {
  return (
    <div className="flex items-end justify-center gap-2" aria-label={`${n} 顆星`}>
      {[0, 1, 2].map((k) => (
        <Star
          key={k}
          className={cn("animate-pop", k === 1 ? "h-16 w-16" : "h-12 w-12", k < n ? "fill-xp text-xp" : "fill-secondary text-secondary")}
          style={{ animationDelay: 0.15 + k * 0.18 + "s" }}
        />
      ))}
    </div>
  );
}

function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v}</>;
}

function Result({
  stars,
  title,
  stats,
  xp,
  children,
  actions,
}: {
  stars: number;
  title: string;
  stats: [number | string, string][];
  xp: number;
  children?: ReactNode;
  actions: ReactNode;
}) {
  useEffect(() => {
    if (stars >= 2) confetti({ count: stars === 3 ? 180 : 90 });
  }, [stars]);
  return (
    <div className="flex animate-rise flex-col items-center gap-5 rounded-3xl bg-card px-5 py-8 text-center shadow-lift sm:px-8">
      <Stars n={stars} />
      <h2 className="m-0 text-2xl font-extrabold sm:text-3xl">{title}</h2>
      <p className="m-0 flex items-center gap-1.5 rounded-full bg-xp-soft px-4 py-1.5 text-lg font-extrabold text-[hsl(30_100%_30%)] dark:text-xp">
        <Zap className="h-5 w-5" />
        +<CountUp to={xp} /> XP
      </p>
      <div className="grid w-full grid-cols-3 gap-2">
        {stats.map(([v, l]) => (
          <div key={l} className="rounded-xl bg-secondary px-3 py-2.5 text-left">
            <b className="tabular block text-2xl font-extrabold">{v}</b>
            <span className="text-[13px] font-semibold text-muted-foreground">{l}</span>
          </div>
        ))}
      </div>
      {children}
      <div className="flex w-full flex-wrap gap-2.5">{actions}</div>
    </div>
  );
}

function Empty({ onExit }: { onExit: () => void }) {
  return (
    <div className="rounded-2xl bg-card px-4 py-12 text-center shadow-card">
      <p className="m-0 text-muted-foreground">目前的篩選條件下沒有句子可以練。</p>
      <button type="button" className={cn(btnPlain, "mt-5 flex-none")} onClick={onExit}>
        回到首頁
      </button>
    </div>
  );
}

function QLabel({ it }: { it: Item }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-muted-foreground">
      <span>{it.sec || "我的句子"}</span>
      <ToneTag tone={it.tone} />
    </div>
  );
}

/* ---------- Learn ---------- */
function Learn({ pool, onExit }: { pool: Item[]; onExit: () => void }) {
  const { target, setLearned, gain, recordCombo } = useBank();
  const [round, setRound] = useState(0);
  const deck = useMemo(() => shuffle(pool), [pool, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [known, setKnown] = useState(0);
  const [combo, setCombo] = useState(0);
  const [xp, setXp] = useState(0);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const n = deck.length;
  const it = deck[i];

  const restart = () => {
    setRound((r) => r + 1);
    setFlash(null);
    setI(0);
    setShown(false);
    setKnown(0);
    setCombo(0);
    setXp(0);
  };
  const answer = (knew: boolean, at?: { x: number; y: number } | null) => {
    if (!it || flash) return;
    let amt: number;
    if (knew) {
      setLearned(it.id, true, null, false);
      const c = combo + 1;
      setCombo(c);
      recordCombo(c);
      amt = XP.learnKnew + comboBonus(c);
      setKnown((k) => k + 1);
      gain(amt, at, c >= 3 ? `+${amt} XP · ${c} 連擊` : undefined);
    } else {
      setLearned(it.id, false);
      setCombo(0);
      amt = XP.learnAgain;
      gain(amt, at);
    }
    setXp((x) => x + amt);
    setFlash(knew ? "good" : "bad");
    window.setTimeout(() => {
      setFlash(null);
      setShown(false);
      setI((v) => v + 1);
    }, 320);
  };

  useKeys((e) => {
    if (e.key === "Escape") return onExit();
    if (i >= n || flash) return;
    if (!shown && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      setShown(true);
    } else if (shown && e.key === "ArrowLeft") {
      e.preventDefault();
      answer(false);
    } else if (shown && e.key === "ArrowRight") {
      e.preventDefault();
      answer(true);
    }
  });

  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus({ preventScroll: true }), [i, shown]);

  let body: ReactNode;
  if (!n) body = <Empty onExit={onExit} />;
  else if (i >= n) {
    const ratio = known / n;
    body = (
      <Result
        stars={ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1}
        title={known === n ? "全部都記得，太強了" : "這一輪練完了"}
        xp={xp}
        stats={[
          [n, "題"],
          [known, "記得"],
          [n - known, "還不熟"],
        ]}
        actions={
          <>
            <button ref={first} type="button" className={btnPrimary} onClick={restart}>
              <RotateCcw className="h-5 w-5" /> 再練一輪
            </button>
            <button type="button" className={btnPlain} onClick={onExit}>
              回到首頁
            </button>
          </>
        }
      />
    );
  } else
    body = (
      <>
        <div
          key={i}
          className={cn(
            "flex flex-col gap-5 rounded-3xl border-2 border-transparent bg-card p-6 shadow-lift transition-colors sm:p-8",
            flash === "good" && "border-good bg-good-soft",
            flash === "bad" && "animate-shake border-bad",
            !flash && "animate-rise",
          )}
        >
          <QLabel it={it} />
          <div>
            <p className="m-0 text-[13px] font-extrabold text-muted-foreground">中文</p>
            <p className="m-0 mt-1 text-balance text-[24px] font-bold leading-snug sm:text-[28px]">{it.zh}</p>
          </div>
          {shown && (
            <div className="animate-rise border-t-2 border-background pt-4">
              <div className="flex items-center gap-1">
                <p className="m-0 text-[21px] font-bold">{it.en}</p>
                <IconBtn label={`朗讀${target.name}`} onClick={() => speak(it.en, it.language)}>
                  <Volume2 className="h-5 w-5" />
                </IconBtn>
              </div>
              {it.ex && <p className="m-0 mt-1.5 text-muted-foreground">{it.ex}</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-2.5">
            {!shown ? (
              <button ref={first} type="button" className={btnPrimary} onClick={() => setShown(true)}>
                顯示答案
              </button>
            ) : (
              <>
                <button ref={first} type="button" className={btnPlain} onClick={(e) => answer(false, pointOf(e))}>
                  還不熟 <span className="text-sm font-extrabold text-muted-foreground">+{XP.learnAgain}</span>
                </button>
                <button type="button" className={btnGood} onClick={(e) => answer(true, pointOf(e))}>
                  記得了 <span className="text-sm font-extrabold opacity-85">+{XP.learnKnew + comboBonus(combo + 1)}</span>
                </button>
              </>
            )}
          </div>
        </div>
        <p className="m-0 mt-4 hidden text-center text-[13px] text-muted-foreground sm:block">
          <Kbd>空白鍵</Kbd> 顯示答案　<Kbd>←</Kbd> 還不熟　<Kbd>→</Kbd> 記得了　<Kbd>Esc</Kbd> 離開　・　連續記得 3 題以上有連擊加成
        </p>
      </>
    );

  return (
    <Shell mode="learn" i={i} n={n} combo={combo} xp={xp} onExit={onExit}>
      {body}
    </Shell>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-[5px] border border-b-2 bg-card px-1.5 font-sans text-xs font-bold">{children}</kbd>;
}

/* ---------- Test ---------- */
function Test({ pool, all, onExit }: { pool: Item[]; all: Item[]; onExit: () => void }) {
  const { target, gain, recordCombo, award, setLearned } = useBank();
  const [round, setRound] = useState(0);
  const deck = useMemo(() => shuffle(pool), [pool, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(-1);
  const [right, setRight] = useState(0);
  const [misses, setMisses] = useState<Item[]>([]);
  const [combo, setCombo] = useState(0);
  const [xp, setXp] = useState(0);
  const [marked, setMarked] = useState(false);
  const n = deck.length;
  const it = deck[i];

  const opts = useMemo(() => {
    if (!it) return [];
    let src = all.filter((x) => x.tab === it.tab && x.en !== it.en);
    if (src.length < 3) src = all.filter((x) => x.en !== it.en);
    const seen = new Set([it.en]);
    const picks: Item[] = [];
    for (const x of shuffle(src)) {
      if (picks.length >= 3) break;
      if (!seen.has(x.en)) {
        seen.add(x.en);
        picks.push(x);
      }
    }
    return shuffle([...picks, it]);
  }, [it, all]);

  const restart = () => {
    setRound((r) => r + 1);
    setI(0);
    setPicked(-1);
    setRight(0);
    setMisses([]);
    setCombo(0);
    setXp(0);
    setMarked(false);
  };
  const pick = (k: number, at?: { x: number; y: number } | null) => {
    if (picked !== -1 || !opts[k]) return;
    setPicked(k);
    if (opts[k] === it) {
      const c = combo + 1;
      setCombo(c);
      recordCombo(c);
      setRight((r) => r + 1);
      const amt = XP.testRight + comboBonus(c);
      setXp((x) => x + amt);
      gain(amt, at, c >= 3 ? `+${amt} XP · ${c} 連擊` : undefined);
    } else {
      setCombo(0);
      setMisses((m) => [...m, it]);
    }
  };
  const next = () => {
    if (picked === -1) return;
    const done = i + 1 >= n;
    if (done && n >= 5 && misses.length === 0 && opts[picked] === it) award("perfect");
    setI((v) => v + 1);
    setPicked(-1);
  };

  useKeys((e) => {
    if (e.key === "Escape") return onExit();
    if (i >= n) return;
    if (/^[1-4]$/.test(e.key)) {
      e.preventDefault();
      pick(Number(e.key) - 1);
    } else if (e.key === "Enter" && picked !== -1) {
      e.preventDefault();
      next();
    }
  });

  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => nextRef.current?.focus({ preventScroll: true }), [picked, i]);

  let body: ReactNode;
  if (!n) body = <Empty onExit={onExit} />;
  else if (i >= n) {
    const ratio = right / n;
    body = (
      <Result
        stars={ratio === 1 ? 3 : ratio >= 0.7 ? 2 : 1}
        title={`答對 ${right} / ${n}`}
        xp={xp}
        stats={[
          [Math.round(ratio * 100) + "%", "正確率"],
          [right, "答對"],
          [n - right, "答錯"],
        ]}
        actions={
          <>
            {misses.length > 0 && (
              <button
                type="button"
                className={btnPlain}
                disabled={marked}
                onClick={() => {
                  misses.forEach((m) => setLearned(m.id, false));
                  setMarked(true);
                  toast("已標成還不熟");
                }}
              >
                {marked ? "已標成還不熟" : "答錯的標成還不熟"}
              </button>
            )}
            <button ref={nextRef} type="button" className={btnPrimary} onClick={restart}>
              <RotateCcw className="h-5 w-5" /> 再測一次
            </button>
            <button type="button" className={btnPlain} onClick={onExit}>
              回到首頁
            </button>
          </>
        }
      >
        {misses.length > 0 && (
          <div className="flex w-full flex-col gap-2 text-left">
            <p className="m-0 text-[13px] font-extrabold text-muted-foreground">答錯的題目</p>
            {misses.map((m) => (
              <div key={m.id} className="rounded-xl bg-secondary px-4 py-2.5">
                <b className="block">{m.en}</b>
                <span className="text-muted-foreground">{m.zh}</span>
              </div>
            ))}
          </div>
        )}
      </Result>
    );
  } else {
    const ok = picked !== -1 && opts[picked] === it;
    body = (
      <>
        <div key={i} className={cn("flex flex-col gap-5 rounded-3xl bg-card p-6 shadow-lift sm:p-8", picked !== -1 && !ok ? "animate-shake" : "animate-rise")}>
          <QLabel it={it} />
          <div>
            <p className="m-0 text-[13px] font-extrabold text-muted-foreground">選出對應的{target.name}</p>
            <p className="m-0 mt-1 text-balance text-[24px] font-bold leading-snug sm:text-[28px]">{it.zh}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {opts.map((o, k) => {
              const isRight = picked !== -1 && o === it;
              const isWrong = picked === k && o !== it;
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={picked !== -1}
                  onClick={(e) => pick(k, pointOf(e))}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-2 bg-card px-4 py-3.5 text-left font-semibold leading-snug transition-colors enabled:hover:border-primary",
                    isRight && "animate-pop border-good bg-good-soft",
                    isWrong && "border-bad bg-bad-soft",
                    picked !== -1 && !isRight && !isWrong && "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-[13px] font-extrabold text-muted-foreground",
                      isRight && "bg-good text-white",
                      isWrong && "bg-bad text-white",
                    )}
                  >
                    {k + 1}
                  </span>
                  <span>{o.en}</span>
                </button>
              );
            })}
          </div>
          {picked !== -1 && (
            <>
              <p className={cn("m-0 font-bold", ok ? "text-good" : "text-bad")}>
                {ok ? (combo >= 3 ? `答對了！${combo} 連擊 🔥` : "答對了！") : "差一點，正確答案是綠色那個。"}
              </p>
              <div className="flex">
                <button ref={nextRef} type="button" className={btnPrimary} onClick={next}>
                  {i + 1 >= n ? "看結果" : "下一題"}
                </button>
              </div>
            </>
          )}
        </div>
        <p className="m-0 mt-4 hidden text-center text-[13px] text-muted-foreground sm:block">
          <Kbd>1</Kbd>–<Kbd>4</Kbd> 選答案　<Kbd>Enter</Kbd> 下一題　<Kbd>Esc</Kbd> 離開
        </p>
      </>
    );
  }

  return (
    <Shell mode="test" i={i} n={n} combo={combo} xp={xp} onExit={onExit}>
      {body}
    </Shell>
  );
}

/* ---------- Write (type or speak, graded leniently) ---------- */
const LEVEL_UI: Record<GradeResult["level"], { title: string; cls: string; ok: boolean }> = {
  perfect: { title: "完美！", cls: "border-good bg-good-soft text-good", ok: true },
  close: { title: "很接近，算你對", cls: "border-good bg-good-soft text-good", ok: true },
  partial: { title: "差一些，看看漏了哪裡", cls: "border-xp bg-xp-soft text-[hsl(30_100%_30%)] dark:text-xp", ok: false },
  miss: { title: "再加油", cls: "border-bad bg-bad-soft text-bad", ok: false },
};

interface WriteResult {
  g: GradeResult;
  text: string;
  spoken: boolean;
  skipped: boolean;
  counted: boolean;
}

function Write({ pool, onExit }: { pool: Item[]; onExit: () => void }) {
  const { target, setLearned, gain, recordCombo, award, bumpQuest } = useBank();
  const [round, setRound] = useState(0);
  const deck = useMemo(() => shuffle(pool), [pool, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [input, setInput] = useState("");
  const [hint, setHint] = useState(false);
  const [res, setRes] = useState<WriteResult | null>(null);
  const [tally, setTally] = useState({ perfect: 0, close: 0, wrong: 0 });
  const [misses, setMisses] = useState<Item[]>([]);
  const [combo, setCombo] = useState(0);
  const [xp, setXp] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const canSpeak = useMemo(speechSupported, []);
  const n = deck.length;
  const it = deck[i];

  const finish = (g: GradeResult, text: string, spoken: boolean) => {
    if (!it || res) return;
    const ok = LEVEL_UI[g.level].ok;
    const at = (() => {
      const r = inputRef.current?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top } : null;
    })();
    if (ok) {
      const c = combo + 1;
      setCombo(c);
      recordCombo(c);
      let amt: number = g.level === "perfect" ? XP.writePerfect : XP.writeClose;
      if (hint) amt = Math.ceil(amt / 2);
      amt += comboBonus(c);
      setXp((x) => x + amt);
      gain(amt, at, c >= 3 ? `+${amt} XP · ${c} 連擊` : undefined);
      setLearned(it.id, true, null, false);
      bumpQuest("write");
      if (spoken) award("speak");
      setTally((t) => ({ ...t, [g.level]: t[g.level as "perfect" | "close"] + 1 }));
    } else {
      setCombo(0);
      setLearned(it.id, false);
      setTally((t) => ({ ...t, wrong: t.wrong + 1 }));
      setMisses((m) => [...m, it]);
    }
    setRes({ g, text, spoken, skipped: false, counted: ok });
  };

  const submit = (text: string) => {
    if (!it || res || !text.trim()) return;
    finish(grade(text, it.en, it.language), text, false);
  };

  const speech = useSpeech(target.voice, (alts) => {
    if (!it || res) return;
    const b = bestOf(alts, it.en, it.language);
    if (!b) return;
    setInput(b.text);
    finish(b.g, b.text, true);
  });

  const skip = () => {
    if (!it || res) return;
    speech.stop();
    setCombo(0);
    setLearned(it.id, false);
    setTally((t) => ({ ...t, wrong: t.wrong + 1 }));
    setMisses((m) => [...m, it]);
    setRes({ g: grade("", it.en), text: "", spoken: false, skipped: true, counted: false });
  };

  const override = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!it || !res || res.counted) return;
    const amt = XP.writeOverride;
    setXp((x) => x + amt);
    gain(amt, pointOf(e));
    setLearned(it.id, true, null, false);
    setTally((t) => ({ ...t, close: t.close + 1, wrong: t.wrong - 1 }));
    setMisses((m) => m.filter((x) => x.id !== it.id));
    setRes({ ...res, counted: true });
  };

  const next = () => {
    if (!res) return;
    if (i + 1 >= n && n >= 5 && tally.perfect === n) award("flawless");
    setI((v) => v + 1);
    setInput("");
    setHint(false);
    setRes(null);
  };

  const restart = () => {
    setRound((r) => r + 1);
    setI(0);
    setInput("");
    setHint(false);
    setRes(null);
    setTally({ perfect: 0, close: 0, wrong: 0 });
    setMisses([]);
    setCombo(0);
    setXp(0);
  };

  useEffect(() => {
    if (res) nextRef.current?.focus({ preventScroll: true });
    else inputRef.current?.focus({ preventScroll: true });
  }, [res, i]);

  useKeys((e) => {
    if (e.key === "Escape") {
      if (speech.listening) speech.stop();
      else onExit();
    }
  });

  let body: ReactNode;
  if (!n) body = <Empty onExit={onExit} />;
  else if (i >= n) {
    const right = tally.perfect + tally.close;
    const ratio = right / n;
    body = (
      <Result
        stars={ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1}
        title={tally.perfect === n ? "全部完美，一字不差" : `答對 ${right} / ${n}`}
        xp={xp}
        stats={[
          [tally.perfect, "完美"],
          [tally.close, "接近"],
          [tally.wrong, "答錯"],
        ]}
        actions={
          <>
            <button ref={nextRef} type="button" className={btnPrimary} onClick={restart}>
              <RotateCcw className="h-5 w-5" /> 再寫一輪
            </button>
            <button type="button" className={btnPlain} onClick={onExit}>
              回到首頁
            </button>
          </>
        }
      >
        {misses.length > 0 && (
          <div className="flex w-full flex-col gap-2 text-left">
            <p className="m-0 text-[13px] font-extrabold text-muted-foreground">要再練的（已標成還不熟）</p>
            {misses.map((m) => (
              <div key={m.id} className="rounded-xl bg-secondary px-4 py-2.5">
                <b className="block">{m.en}</b>
                <span className="text-muted-foreground">{m.zh}</span>
              </div>
            ))}
          </div>
        )}
      </Result>
    );
  } else {
    const ui = res ? LEVEL_UI[res.g.level] : null;
    body = (
      <>
        <div key={i} className={cn("flex flex-col gap-5 rounded-3xl bg-card p-6 shadow-lift sm:p-8", res && !res.counted ? "animate-shake" : "animate-rise")}>
          <QLabel it={it} />
          <div>
            <p className="m-0 text-[13px] font-extrabold text-muted-foreground">用{target.name}寫出來或說出來</p>
            <p className="m-0 mt-1 text-balance text-[24px] font-bold leading-snug sm:text-[28px]">{it.zh}</p>
          </div>

          {hint && !res && (
            <p className="m-0 animate-rise rounded-xl bg-secondary px-4 py-2.5 font-mono text-[17px] tracking-[.12em] text-muted-foreground" aria-label="提示">
              {hintOf(it.en)}
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="flex flex-col gap-3"
          >
            <div className="relative">
              <input
                ref={inputRef}
                value={speech.listening ? speech.interim : input}
                onChange={(e) => setInput(e.target.value)}
                readOnly={!!res || speech.listening}
                placeholder={speech.listening ? "正在聽……說完停一下就會送出" : `輸入${target.name}，按 Enter 送出`}
                aria-label="你的答案"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className={cn(
                  "h-14 w-full rounded-xl border-2 bg-secondary px-4 text-[17px] font-semibold outline-none transition-colors focus:border-primary focus:bg-card",
                  canSpeak && "pr-16",
                  res && ui?.cls,
                  speech.listening && "border-bad bg-card",
                )}
              />
              {canSpeak && !res && (
                <button
                  type="button"
                  onClick={() => (speech.listening ? speech.stop() : speech.start())}
                  aria-label={speech.listening ? "停止錄音" : "用說的回答"}
                  title={speech.listening ? "停止錄音" : "用說的回答"}
                  className={cn(
                    "absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full transition-colors",
                    speech.listening ? "bg-bad text-white" : "bg-card text-primary shadow-card hover:bg-accent",
                  )}
                >
                  {speech.listening && <span className="absolute inset-0 animate-ping rounded-full bg-bad/40" aria-hidden="true" />}
                  {speech.listening ? <Square className="relative h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
                </button>
              )}
            </div>
            {!res && (
              <div className="flex flex-wrap gap-2.5">
                <button type="button" className={cn(btnPlain, "flex-none basis-auto px-4 py-2.5 text-[15px]")} onClick={() => setHint(true)} disabled={hint}>
                  <Lightbulb className="h-4 w-4" /> 提示 <span className="text-xs font-extrabold text-muted-foreground">XP 減半</span>
                </button>
                <button type="button" className={cn(btnPlain, "flex-none basis-auto px-4 py-2.5 text-[15px]")} onClick={skip}>
                  不知道
                </button>
                <button type="submit" className={cn(btnPrimary, "py-2.5 text-[15px]")} disabled={!input.trim() || speech.listening}>
                  送出
                </button>
              </div>
            )}
          </form>

          {res && ui && (
            <div className="flex animate-rise flex-col gap-3">
              <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 px-4 py-2.5 font-extrabold", res.skipped ? "border-border bg-secondary text-muted-foreground" : res.counted && !ui.ok ? LEVEL_UI.close.cls : ui.cls)}>
                <span>{res.skipped ? "沒關係，看一下答案" : res.counted && !ui.ok ? "好，算你對" : ui.title}</span>
                {!res.skipped && (
                  <span className="tabular text-sm font-bold opacity-80">
                    {res.spoken && "🎤 "}相似度 {Math.round(res.g.score * 100)}%
                  </span>
                )}
              </div>
              <div>
                <p className="m-0 text-[13px] font-extrabold text-muted-foreground">正確答案{res.g.level !== "perfect" && !res.skipped && "（標色的是你漏掉或不一樣的字）"}</p>
                <div className="mt-1 flex items-center gap-1">
                  <p className="m-0 text-[20px] font-bold leading-snug">
                    {res.g.words.map((w, k) => (
                      <span key={k}>
                        <span className={cn(w.hit === false && !res.skipped && "rounded bg-xp-soft px-0.5 text-[hsl(30_100%_30%)] underline decoration-xp decoration-2 underline-offset-4 dark:text-xp")}>{w.text}</span>{" "}
                      </span>
                    ))}
                  </p>
                  <IconBtn label={`朗讀${target.name}`} onClick={() => speak(it.en, it.language)}>
                    <Volume2 className="h-5 w-5" />
                  </IconBtn>
                </div>
                {it.ex && <p className="m-0 mt-1 text-muted-foreground">{it.ex}</p>}
              </div>
              <div className="flex flex-wrap gap-2.5">
                {!res.counted && !res.skipped && (
                  <button type="button" className={btnPlain} onClick={override}>
                    其實我答對了 <span className="text-sm font-extrabold text-muted-foreground">+{XP.writeOverride}</span>
                  </button>
                )}
                <button ref={nextRef} type="button" className={btnPrimary} onClick={next}>
                  {i + 1 >= n ? "看結果" : "下一題"}
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="m-0 mt-4 hidden text-center text-[13px] text-muted-foreground sm:block">
          {target.name === "英文" ? "大小寫、標點、縮寫、英美拼法和小錯字都不扣分" : "大小寫與標點不影響評分，也容許小錯字"}　<Kbd>Enter</Kbd> 送出／下一題　<Kbd>Esc</Kbd> 離開
        </p>
        {!canSpeak && <p className="m-0 mt-2 text-center text-[13px] text-muted-foreground">這個瀏覽器不支援語音輸入，用 Chrome、Edge 或 Safari 就能用說的。</p>}
      </>
    );
  }

  return (
    <Shell mode="write" i={i} n={n} combo={combo} xp={xp} onExit={onExit}>
      {body}
    </Shell>
  );
}

/* ---------- Match ---------- */
interface Tile {
  key: string;
  id: string;
  text: string;
  lang: "en" | "zh";
}
const PAIRS = 6;

function Match({ pool, all, tab, onExit }: { pool: Item[]; all: Item[]; tab: TabKey; onExit: () => void }) {
  const { gain, recordMatch, award, bestMatch, target } = useBank();
  const [round, setRound] = useState(0);
  const src = pool.length >= 3 ? pool : all.filter((x) => x.tab === tab);
  const tiles = useMemo(() => {
    const picks = shuffle(src).slice(0, PAIRS);
    return shuffle(
      picks.flatMap<Tile>((p) => [
        { key: p.id + "-en", id: p.id, text: p.en, lang: "en" },
        { key: p.id + "-zh", id: p.id, text: p.zh, lang: "zh" },
      ]),
    );
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps
  const pairs = tiles.length / 2;
  const [sel, setSel] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string[]>([]);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [end, setEnd] = useState<number | null>(null);
  const [xp, setXp] = useState(0);
  const [prevBest] = useState(bestMatch(tab));
  const matched = gone.size / 2;
  const done = pairs > 0 && matched === pairs;

  useEffect(() => {
    if (start == null || end != null) return;
    const t = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(t);
  }, [start, end]);

  const elapsed = start == null ? 0 : ((end ?? now) - start) / 1000 + penalty;

  const restart = () => {
    setRound((r) => r + 1);
    setSel(null);
    setGone(new Set());
    setWrong([]);
    setStart(null);
    setEnd(null);
    setPenalty(0);
    setXp(0);
  };

  const click = (t: Tile, e: React.MouseEvent<HTMLButtonElement>) => {
    if (gone.has(t.key) || done) return;
    if (start == null) {
      const s = performance.now();
      setStart(s);
      setNow(s);
    }
    if (!sel) return setSel(t.key);
    if (sel === t.key) return setSel(null);
    const a = tiles.find((x) => x.key === sel)!;
    if (a.id === t.id && a.lang !== t.lang) {
      const g = new Set(gone);
      g.add(a.key);
      g.add(t.key);
      setGone(g);
      setSel(null);
      setXp((x) => x + XP.matchPair);
      gain(XP.matchPair, pointOf(e));
      if (g.size / 2 === pairs) {
        const fin = performance.now();
        setEnd(fin);
        const secs = Math.round(((fin - (start ?? fin)) / 1000 + penalty) * 10) / 10;
        const bonus = Math.max(0, Math.round((60 - secs) / 3));
        if (bonus) {
          setXp((x) => x + bonus);
          window.setTimeout(() => gain(bonus, null, `+${bonus} XP 速度加成`), 350);
        }
        recordMatch(tab, secs);
        if (secs <= 30) award("fast");
      }
    } else {
      setWrong([a.key, t.key]);
      setPenalty((p) => p + 1);
      setSel(null);
      window.setTimeout(() => setWrong([]), 450);
    }
  };

  useKeys((e) => {
    if (e.key === "Escape") onExit();
  });

  const timer = (
    <span className="tabular flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-sm font-extrabold">
      <Timer className="h-4 w-4" />
      {elapsed.toFixed(1)}s
    </span>
  );

  let body: ReactNode;
  if (pairs < 2) body = <Empty onExit={onExit} />;
  else if (done && end != null) {
    const secs = Math.round(elapsed * 10) / 10;
    const isBest = prevBest == null || secs < prevBest;
    body = (
      <Result
        stars={secs <= 30 ? 3 : secs <= 50 ? 2 : 1}
        title={isBest ? `新紀錄！${secs} 秒` : `完成！${secs} 秒`}
        xp={xp}
        stats={[
          [pairs, "組"],
          [penalty, "配錯 (+1s)"],
          [prevBest != null ? fmtTime(Math.min(prevBest, secs)) : fmtTime(secs), "最佳時間"],
        ]}
        actions={
          <>
            <button type="button" className={btnPrimary} onClick={restart} autoFocus>
              <RotateCcw className="h-5 w-5" /> 再玩一次
            </button>
            <button type="button" className={btnPlain} onClick={onExit}>
              回到首頁
            </button>
          </>
        }
      />
    );
  } else
    body = (
      <>
        <p className="m-0 mb-4 text-center font-semibold text-muted-foreground">
          {start == null ? `點一張卡開始計時，把${target.name}和中文配成一對。配錯會加 1 秒。` : `已配對 ${matched} / ${pairs}`}
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          {tiles.map((t) => {
            const isGone = gone.has(t.key);
            const isSel = sel === t.key;
            const isWrong = wrong.includes(t.key);
            return (
              <button
                key={t.key}
                type="button"
                disabled={isGone}
                aria-pressed={isSel}
                onClick={(e) => click(t, e)}
                className={cn(
                  "flex min-h-[96px] items-center justify-center rounded-xl border-2 bg-card p-3 text-center font-semibold leading-snug shadow-card transition-all duration-300 sm:min-h-[112px]",
                  t.lang === "en" ? "text-[15px]" : "text-[15px] sm:text-base",
                  !isGone && "hover:-translate-y-0.5 hover:border-primary hover:shadow-lift",
                  isSel && "-translate-y-0.5 border-primary bg-accent shadow-lift",
                  isWrong && "animate-shake border-bad bg-bad-soft",
                  isGone && "pointer-events-none scale-75 border-good bg-good-soft opacity-0",
                )}
              >
                {t.text}
              </button>
            );
          })}
        </div>
      </>
    );

  return (
    <Shell mode="match" i={matched} n={pairs} combo={0} xp={xp} onExit={onExit} extra={timer} count={`${matched} / ${pairs}`}>
      {body}
    </Shell>
  );
}

export function Study({ mode, pool, tab, onExit }: { mode: StudyMode; pool: Item[]; tab: TabKey; onExit: () => void }) {
  const { items } = useBank();
  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = o;
    };
  }, []);
  if (mode === "learn") return <Learn pool={pool} onExit={onExit} />;
  if (mode === "write") return <Write pool={pool} onExit={onExit} />;
  if (mode === "test") return <Test pool={pool} all={items} onExit={onExit} />;
  return <Match pool={pool} all={items} tab={tab} onExit={onExit} />;
}
