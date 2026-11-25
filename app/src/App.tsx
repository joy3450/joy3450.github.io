import { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, Brain, ClipboardCheck, Crown, Flame, Gem, Heart, Layers, Map as MapIcon, Medal, PenLine, Menu, Moon, Plus, Puzzle, Search, Sun, Target, Trophy } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { TABS, tabName } from "@/lib/data";
import { XP } from "@/lib/game";
import { speechSupported } from "@/lib/speech";
import { useBank } from "@/lib/store";
import type { Filters, Item, StudyMode, TabKey } from "@/lib/types";
import { Bar, LevelBadge, Ring, fmtTime } from "@/components/game/bits";
import { FxLayer } from "@/components/game/FxLayer";
import { FilterChips, LeftNav, secId } from "@/components/LeftNav";
import { PlayerPanel } from "@/components/PlayerPanel";
import { Flashcards } from "@/components/Flashcards";
import { TermList } from "@/components/TermList";
import { Study } from "@/components/Study";
import { AddDialog } from "@/components/AddDialog";
import { Lesson } from "@/components/Lesson";
import { Grammar } from "@/components/Grammar";
import { PathView } from "@/components/PathView";
import type { Level } from "@/lib/levels";

const LS_PREFS = "phraseBank.prefs";
interface Prefs {
  front?: "zh" | "en";
  theme?: "dark" | "light";
  view?: "path" | "library" | "grammar" | "practice";
}
function readPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(LS_PREFS) || "{}") as Prefs;
  } catch {
    return {};
  }
}
function writePrefs(p: Prefs) {
  try {
    localStorage.setItem(LS_PREFS, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function norm(s: string) {
  return s.toLowerCase();
}

/* ---------- Top bar HUD ---------- */
function Hud({ onOpen }: { onOpen: () => void }) {
  const { lvl, streak, todayXP, game, hearts, boostLeft } = useBank();
  return (
    <button
      type="button"
      onClick={onOpen}
      id="hud-xp"
      aria-label={`等級 ${lvl.level}，${lvl.into}/${lvl.need} XP，連續 ${streak} 天，${game.gems} 顆寶石，今日 ${todayXP}/${game.goal} XP。查看進度`}
      className="flex shrink-0 items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-secondary sm:gap-3 xl:pointer-events-none xl:pr-3"
    >
      <LevelBadge key={game.xp} level={lvl.level} size="sm" className={cn("hidden sm:grid", game.xp > 0 && "animate-glow")} />
      <span className="hidden w-[120px] flex-col gap-1 text-left md:flex">
        <span className="tabular flex justify-between text-[11px] font-extrabold leading-none text-muted-foreground">
          <span>XP</span>
          <span>
            {lvl.into}/{lvl.need}
          </span>
        </span>
        <Bar value={lvl.into} max={lvl.need} fill={boostLeft ? "bg-streak" : "bg-xp"} className="h-2" />
      </span>
      <span className={cn("flex items-center gap-0.5 text-sm font-extrabold", streak ? "text-streak" : "text-muted-foreground")}>
        <Flame className={cn("h-5 w-5", streak > 0 && "fill-streak/25")} />
        <span className="tabular">{streak}</span>
      </span>
      <span id="hud-gem" className="flex items-center gap-0.5 text-sm font-extrabold text-[hsl(199_89%_40%)] dark:text-[hsl(199_89%_65%)]">
        <Gem className="h-5 w-5" />
        <span className="tabular">{game.gems}</span>
      </span>
      <span className={cn("flex items-center gap-0.5 text-sm font-extrabold", game.settings.hearts ? "text-bad" : "text-muted-foreground")}>
        <Heart className={cn("h-5 w-5", game.settings.hearts && "fill-bad")} />
        <span className="tabular">{game.settings.hearts ? hearts.n : "∞"}</span>
      </span>
      <Ring value={todayXP} max={game.goal} size={30} stroke={4} color={todayXP >= game.goal ? "hsl(var(--good))" : "hsl(var(--xp))"} className="hidden 2xl:grid">
        <Target className="h-3.5 w-3.5 text-muted-foreground" />
      </Ring>
    </button>
  );
}

/* ---------- Milestone bar for the current set ---------- */
function Milestones({ done, total }: { done: number; total: number }) {
  const pct = total ? (done / total) * 100 : 0;
  const marks = [
    { at: 25, Icon: Medal, cls: "text-[#b87333]", name: "銅" },
    { at: 50, Icon: Medal, cls: "text-[#9aa4b5]", name: "銀" },
    { at: 75, Icon: Trophy, cls: "text-xp", name: "金" },
    { at: 100, Icon: Crown, cls: "text-xp", name: "制霸" },
  ];
  const next = marks.find((m) => pct < m.at);
  const need = next ? Math.ceil((next.at / 100) * total) - done : 0;
  return (
    <div className="rounded-2xl bg-card px-5 pb-4 pt-4 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 font-extrabold">這組進度</p>
        <p className="m-0 text-sm font-semibold text-muted-foreground">
          {next ? (
            <>
              再學會 <b className="tabular text-foreground">{need}</b> 句拿到「{next.name}」
            </>
          ) : (
            "全部學會了，這組被你制霸！"
          )}
        </p>
      </div>
      <div className="relative mb-7 mt-4">
        <Bar value={done} max={total} className="h-3.5" fill="bg-good" label="這組學會比例" />
        {marks.map((m) => {
          const hit = pct >= m.at;
          return (
            <div key={m.at} className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `min(${m.at}%, calc(100% - 14px))` }}>
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full border-[3px] border-card shadow-card transition-transform",
                  hit ? "scale-110 bg-card" : "bg-secondary",
                )}
                title={`${m.at}%：${m.name}`}
              >
                <m.Icon className={cn("h-4 w-4", hit ? m.cls : "text-muted-foreground/50")} />
              </span>
              <span className="tabular absolute top-9 text-[11px] font-bold text-muted-foreground">{m.at}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const bank = useBank();
  const { items, learned, fav, target, language } = bank;
  const [f, setF] = useState<Filters>({ tab: "chat", tone: "all", fav: false, todo: false, q: "" });
  const [fi, setFi] = useState(0);
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [study, setStudy] = useState<{ mode: StudyMode; pool: Item[] } | null>(null);
  const [lesson, setLesson] = useState<{ title: string; items: Item[]; nodeId?: string; review?: boolean; level?: Level; boss?: boolean; nonce: number } | null>(null);
  const [grammarLevel, setGrammarLevel] = useState("全部");
  const [topicIds, setTopicIds] = useState<Partial<Record<"en" | "fr", string>>>({});
  const view = prefs.view ?? "path";
  const clearSection = () => {
    if (location.hash.startsWith("#sec-")) history.replaceState(null, "", location.pathname);
  };
  const setView = (v: "path" | "library" | "grammar" | "practice") => {
    clearSection();
    const p = { ...prefs, view: v };
    setPrefs(p);
    writePrefs(p);
    window.scrollTo({ top: 0 });
  };
  const [addOpen, setAddOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  const set = (p: Partial<Filters>) => {
    setF((o) => ({ ...o, ...p }));
    setFi(0);
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const [pendingSection, setPendingSection] = useState("");
  useEffect(() => {
    const navigate = () => {
      const id = location.hash.slice(1);
      if (!id.startsWith("sec-")) return;
      const params = new URLSearchParams(location.search);
      const order = params.get("lang") === "fr" ? ["fr", "en"] as const : ["en", "fr"] as const;
      for (const lang of order) {
        const matches = bank.catalogs[lang].filter(i => secId(i.sec || "我的句子") === id);
        const item = matches.find(i => i.tab === params.get("tab")) ?? matches[0];
        if (!item) continue;
        bank.setSetting("language", lang);
        const updated = { ...readPrefs(), view: "library" as const };
        setPrefs(updated);
        writePrefs(updated);
        setF({ tab: item.tab, tone: "all", fav: false, todo: false, q: "" });
        setFi(0);
        setPendingSection(id);
        return;
      }
    };
    navigate();
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, [bank.catalogs, bank.setSetting]);
  useEffect(() => {
    if (!pendingSection || view !== "library") return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(pendingSection)?.scrollIntoView({ block: "start", behavior: "instant" });
      setPendingSection("");
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingSection, view, items]);

  const filtered = useMemo(() => {
    const q = norm(f.q).trim();
    return items.filter((it) => {
      if (it.tab !== f.tab) return false;
      if (f.tone !== "all" && it.tone !== f.tone) return false;
      if (f.fav && !fav.has(it.id)) return false;
      if (f.todo && learned.has(it.id)) return false;
      if (q && !norm(`${it.en} ${it.zh} ${it.ex} ${it.sec}`).includes(q)) return false;
      return true;
    });
  }, [items, f, fav, learned]);

  const tabItems = items.filter((i) => i.tab === f.tab);
  const tabDone = tabItems.filter((i) => learned.has(i.id)).length;
  const todoCount = filtered.filter((i) => !learned.has(i.id)).length;
  const best = bank.bestMatch(f.tab);

  const canSpeak = useMemo(speechSupported, []);
  const startStudy = (mode: StudyMode) => setStudy({ mode, pool: filtered.slice() });

  const modes: { key: string; name: string; sub: string; Icon: typeof Layers; tint: string; onClick: () => void }[] = [
    { key: "learn", name: "學習", sub: `還不熟 ${todoCount} 句`, Icon: Brain, tint: "bg-good-soft text-good", onClick: () => startStudy("learn") },
    { key: "write", name: "默寫", sub: canSpeak ? "打字或用說的" : "打字作答", Icon: PenLine, tint: "bg-xp-soft text-[hsl(30_100%_30%)] dark:text-xp", onClick: () => startStudy("write") },
    { key: "test", name: "測驗", sub: `答對 +${XP.testRight} XP`, Icon: ClipboardCheck, tint: "bg-formal-soft text-formal", onClick: () => startStudy("test") },
    { key: "match", name: "配對", sub: best != null ? `最佳 ${fmtTime(best)}` : "挑戰計時", Icon: Puzzle, tint: "bg-streak-soft text-streak", onClick: () => startStudy("match") },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-2 px-4 sm:gap-3 lg:px-6">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
            aria-label="打開分類選單"
            onClick={() => setNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <a href="#" className="hidden shrink-0 items-center gap-2.5 text-foreground sm:flex no-underline lg:w-[226px]" onClick={(e) => (e.preventDefault(), window.scrollTo({ top: 0 }))}>
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-primary text-lg font-extrabold text-primary-foreground">P</span>
            <span className="hidden text-[19px] font-extrabold tracking-tight sm:inline">Phrase Bank</span>
          </a>
          <select aria-label="教材語言" value={language}
              className="h-10 rounded-xl border-2 bg-card px-3 font-bold"
              onChange={e => {
                window.speechSynthesis?.cancel();
                clearSection();
                bank.setSetting("language", e.target.value === "fr" ? "fr" : "en");
                setFi(0);
              }}>
              <option value="en">英語</option>
              <option value="fr">法語</option>
            </select>
          <div className="relative hidden min-w-0 flex-1 md:block lg:max-w-[560px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={f.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder={`搜尋${target.name}或中文`}
              aria-label="搜尋"
              className="h-10 w-full rounded-full border-2 border-transparent bg-secondary pl-10 pr-3 text-[15px] outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card"
            />
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <span className="flex-1 md:hidden" />
            <Hud onOpen={() => setStatsOpen(true)} />
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-primary px-3 font-bold text-primary-foreground shadow-btn transition-colors hover:bg-primary-hover active:translate-y-px active:shadow-none sm:px-4"
              aria-label="新增句子"
            >
              <Plus className="h-5 w-5" />
              <span className="hidden md:inline">新增句子</span>
            </button>
            <button
              type="button"
              className="hidden h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground sm:grid"
              aria-label={dark ? "切換成淺色模式" : "切換成深色模式"}
              onClick={() => {
                const d = !dark;
                setDark(d);
                const p = { ...prefs, theme: d ? ("dark" as const) : ("light" as const) };
                setPrefs(p);
                writePrefs(p);
              }}
            >
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-8 px-4 lg:grid-cols-[226px_minmax(0,1fr)] lg:px-6 xl:grid-cols-[226px_minmax(0,1fr)_296px]">
        <aside className="scrollbar-none sticky top-16 hidden h-[calc(100vh-4rem)] overflow-y-auto pb-8 pt-7 lg:block">
          <LeftNav f={f} set={set} />
        </aside>

        <main className="min-w-0 pb-28 pt-7 lg:pb-16">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap rounded-2xl border-2 bg-card p-1" role="tablist" aria-label="檢視">
              {(
                [
                  ["path", "學習路徑", MapIcon],
                  ["library", "句子庫", BookOpen],
                  ["grammar", "文法庫", BookOpen],
                  ["practice", "文法練功房", PenLine],
                ] as const
              ).map(([k, label, I]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={view === k}
                  onClick={() => setView(k)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold transition-colors",
                    view === k ? "bg-primary text-primary-foreground shadow-btn" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <I className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStatsOpen(true)}
              className="hidden items-center gap-2 rounded-full bg-card px-3 py-1.5 text-sm font-bold shadow-card lg:flex xl:hidden"
            >
              <Trophy className="h-4 w-4 text-xp" /> 任務與成就
            </button>
          </div>
          {(view === "path" || view === "library") && <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none lg:hidden">
            {TABS.map((t) => (
              <button
                key={t.k}
                type="button"
                onClick={() => set({ tab: t.k })}
                aria-pressed={f.tab === t.k}
                className="shrink-0 rounded-full border-2 bg-card px-3.5 py-1.5 text-sm font-bold text-muted-foreground aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
              >
                {t.n}
              </button>
            ))}
          </div>}

          {view === "grammar" || view === "practice" ? (
            <Grammar level={grammarLevel} setLevel={setGrammarLevel} key={language + view} practice={view === "practice"} topicId={topicIds[language]}
              selectTopic={id => setTopicIds(prev => ({ ...prev, [language]: id }))}
              openPractice={() => setView("practice")} openLibrary={() => setView("grammar")} />
          ) : language === "fr" && !items.length ? (
            <p role="status" className="rounded-2xl bg-card p-8 text-center font-bold shadow-card">法語教材準備中</p>
          ) : view === "path" ? (
            <PathView key={language}
              tab={f.tab}
              onStart={(title, its, opts) => setLesson({ title, items: its, ...opts, nonce: Date.now() })}
              onBrowse={(sec) => {
                set({ q: sec });
                setView("library");
              }}
            />
          ) : (
          <>
          <div className="relative mb-4 md:hidden">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={f.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder={`搜尋${target.name}或中文`}
              aria-label="搜尋"
              className="h-11 w-full rounded-full border-2 border-transparent bg-card pl-10 pr-3 text-[15px] shadow-card outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="m-0 text-balance text-[30px] font-extrabold leading-tight tracking-tight sm:text-[34px]">{tabName(f.tab)}</h1>
              <p className="m-0 mt-1.5 text-sm font-semibold text-muted-foreground">
                {tabItems.length} 個句子・已學會 <span className="tabular text-foreground">{tabDone}</span>
                {f.q || f.tone !== "all" || f.fav || f.todo ? <>・篩選後 {filtered.length} 句</> : null}
              </p>
            </div>
          </div>

          <Milestones done={tabDone} total={tabItems.length} />

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={m.onClick}
                className="group flex items-center gap-3 rounded-xl border-b-[3px] border-transparent bg-card p-3.5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lift"
              >
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[10px] transition-transform group-hover:rotate-[-6deg] group-hover:scale-110", m.tint)}>
                  <m.Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-extrabold">{m.name}</span>
                  <span className="block truncate text-xs font-semibold text-muted-foreground">{m.sub}</span>
                </span>
              </button>
            ))}
          </div>

          <section id="viewer" className="mt-6" aria-label="單字卡">
            <Flashcards key={language}
              deck={filtered}
              index={Math.min(fi, Math.max(0, filtered.length - 1))}
              setIndex={setFi}
              front={prefs.front ?? "zh"}
              setFront={(fr) => {
                const p = { ...prefs, front: fr };
                setPrefs(p);
                writePrefs(p);
              }}
              active={!study && !lesson && !addOpen && !navOpen && !statsOpen}
            />
          </section>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 text-[21px] font-extrabold">
              這組的句子 <span className="tabular text-base font-bold text-muted-foreground">({filtered.length})</span>
            </h2>
          </div>
          <div className="mt-3 lg:hidden">
            <FilterChips f={f} set={set} />
          </div>
          <TermList items={filtered} />
          </>
          )}
        </main>

        <aside className="scrollbar-none sticky top-16 hidden h-[calc(100vh-4rem)] overflow-y-auto pb-8 pt-7 xl:block" aria-label="我的進度">
          <PlayerPanel />
        </aside>
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[300px] overflow-y-auto bg-background p-5">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle>分類與章節</SheetTitle>
            <SheetDescription className="sr-only">切換分類、跳到章節或篩選句子</SheetDescription>
          </SheetHeader>
          <LeftNav f={f} set={set} onJump={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <Sheet open={statsOpen} onOpenChange={setStatsOpen}>
        <SheetContent side="right" className="w-[340px] max-w-[92vw] overflow-y-auto bg-background p-4 sm:max-w-[360px]">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle>我的進度</SheetTitle>
            <SheetDescription className="sr-only">等級、每日目標、連續學習和成就</SheetDescription>
          </SheetHeader>
          <PlayerPanel />
        </SheetContent>
      </Sheet>

      <AddDialog key={language} open={addOpen} onOpenChange={setAddOpen} tab={f.tab} onAdded={(t: TabKey) => set({ tab: t })} />

      {study && <Study mode={study.mode} pool={study.pool} tab={f.tab} onExit={() => setStudy(null)} />}
      {lesson && (
        <Lesson
          key={lesson.nonce}
          title={lesson.title}
          items={lesson.items}
          nodeId={lesson.nodeId}
          review={lesson.review}
          level={lesson.level}
          boss={lesson.boss}
          onExit={() => setLesson(null)}
          onRetry={() => setLesson({ ...lesson, nonce: Date.now() })}
        />
      )}

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t-2 bg-card pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="主選單">
        {(
          [
            ["path", "路徑", MapIcon, () => setView("path")],
            ["library", "句子庫", BookOpen, () => setView("library")],
            ["stats", "任務與進度", BarChart3, () => setStatsOpen(true)],
          ] as const
        ).map(([k, label, I, go]) => {
          const on = k === view;
          return (
            <button key={k} type="button" onClick={go} aria-current={on ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-extrabold", on ? "text-primary" : "text-muted-foreground")}>
              <span className={cn("grid h-8 w-12 place-items-center rounded-xl", on && "bg-accent")}>
                <I className="h-5 w-5" />
              </span>
              {label}
            </button>
          );
        })}
      </nav>

      <FxLayer />
    </>
  );
}
