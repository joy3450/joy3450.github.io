import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, Crown, Gift, Lock, PackageOpen, RotateCcw, Star, Swords, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { tabName } from "@/lib/data";
import { toast } from "@/lib/fx";
import { UNIT_COLORS, buildPath, nodeStates, type PathNode } from "@/lib/path";
import { useBank } from "@/lib/store";
import { LEVEL_DESC, LEVEL_NAME, rulesFor, type Level } from "@/lib/levels";
import type { Item, TabKey } from "@/lib/types";
import { secId } from "./LeftNav";

const OFFSETS = [0, -1, -1.6, -1, 0, 1, 1.6, 1];
const shade = (v: string, pct = 68) => `color-mix(in srgb, hsl(var(${v})) ${pct}%, black)`;

export function PathView({
  tab,
  onStart,
  onBrowse,
}: {
  tab: TabKey;
  onStart: (title: string, items: Item[], opts: { nodeId?: string; review?: boolean; level?: Level; boss?: boolean }) => void;
  onBrowse: (sec: string) => void;
}) {
  const { items, game, openChest } = useBank();
  const units = useMemo(() => buildPath(items, tab), [items, tab]);
  const states = useMemo(() => nodeStates(units, game.path), [units, game.path]);
  const [open, setOpen] = useState<string | null>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  const lessons = units.flatMap((u) => u.nodes.filter((n) => n.type === "lesson"));
  const doneCount = lessons.filter((n) => game.path[n.id]?.done).length;
  const mistakes = items.filter((i) => i.tab === tab && (game.mistakes[i.id] ?? 0) > 0).sort((a, b) => game.mistakes[b.id] - game.mistakes[a.id]);

  useEffect(() => {
    setOpen(null);
    const t = window.setTimeout(() => currentRef.current?.scrollIntoView({ block: "center" }), 60);
    return () => window.clearTimeout(t);
  }, [tab]);

  const start = (nd: PathNode, level: Level) => {
    setOpen(null);
    if (nd.type === "boss") onStart(`${nd.sec}・單元考`, nd.items, { nodeId: nd.id, boss: true, level: 2 });
    else onStart(nd.title ?? `${nd.sec}・第 ${nd.n} 關`, nd.items, { nodeId: nd.id, level });
  };
  const preferred = (game.settings.level ?? 1) as Level;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-card">
        <div>
          <p className="m-0 text-xs font-extrabold uppercase tracking-[.12em] text-muted-foreground">學習路徑</p>
          <p className="m-0 text-lg font-extrabold">
            {tabName(tab)}・已過 <span className="tabular">{doneCount}</span> / {lessons.length} 關
          </p>
        </div>
        <button
          type="button"
          disabled={!mistakes.length}
          onClick={() => onStart("錯題複習", mistakes.slice(0, 8), { review: true, level: preferred })}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-b-4 bg-card px-4 py-2 font-extrabold text-bad transition-transform active:translate-y-0.5 active:border-b-2 disabled:text-muted-foreground disabled:opacity-60"
        >
          <RotateCcw className="h-4 w-4" /> 複習錯題{mistakes.length ? `（${mistakes.length}）` : ""}
        </button>
      </div>

      {open && <button type="button" aria-label="關閉" className="fixed inset-0 z-[5] cursor-default" onClick={() => setOpen(null)} />}

      {units.map((u) => {
        const color = UNIT_COLORS[u.idx % UNIT_COLORS.length];
        const ls = u.nodes.filter((n) => n.type === "lesson");
        const uDone = ls.filter((n) => game.path[n.id]?.done).length;
        const bossNode = u.nodes.find((n) => n.type === "boss");
        const bossPassed = !!(bossNode && game.path[bossNode.id]?.done);
        return (
          <section key={u.sec} id={secId(u.sec)} className="mb-4 scroll-mt-24" aria-label={`第 ${u.idx + 1} 單元：${u.sec}`}>
            <div className="flex items-center justify-between gap-3 rounded-2xl px-5 py-4 text-white" style={{ background: `hsl(var(${color}))`, boxShadow: `0 4px 0 0 ${shade(color)}` }}>
              <div className="min-w-0">
                <p className="m-0 text-sm font-extrabold uppercase tracking-wide opacity-85">
                  第 {u.idx + 1} 單元・{uDone}/{ls.length} 關
                </p>
                <h3 className="m-0 flex items-center gap-2 truncate text-xl font-extrabold">
                  {u.sec}
                  {bossPassed && <Trophy className="h-5 w-5 shrink-0 text-xp" aria-label="單元考已通過" />}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onBrowse(u.sec)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-white/40 px-3 py-2 text-sm font-extrabold hover:bg-white/15"
              >
                <BookOpen className="h-4 w-4" /> 句子
              </button>
            </div>

            <div className="flex flex-col items-center gap-11 pb-12 pt-14">
              {u.nodes.map((nd, i) => {
                const st = states.get(nd.id)!;
                const prog = game.path[nd.id];
                const x = OFFSETS[(i + u.idx * 2) % OFFSETS.length] * 46;
                const isChest = nd.type === "chest";
                const isBoss = nd.type === "boss";
                const perfect = !!prog?.perfect;
                const lv = prog?.level ?? (prog?.done ? 1 : 0);
                const tone = isChest ? "--xp" : isBoss ? (st === "done" ? "--xp" : "--bad") : lv >= 3 ? "--formal" : color;
                const bg = st === "locked" ? "hsl(var(--secondary))" : `hsl(var(${tone}))`;
                const sh = st === "locked" ? "hsl(var(--border))" : shade(tone);
                const Icon = isChest
                  ? st === "done"
                    ? PackageOpen
                    : Gift
                  : st === "locked"
                    ? Lock
                    : isBoss
                      ? st === "done"
                        ? Trophy
                        : Swords
                      : st === "done"
                        ? lv >= 3
                          ? Crown
                          : lv >= 2
                            ? Star
                            : Check
                        : Star;
                return (
                  <div key={nd.id} ref={st === "current" && !isChest ? currentRef : undefined} className="relative" style={{ transform: `translateX(${x}px)`, zIndex: open === nd.id ? 20 : undefined }}>
                    {st === "current" && !isChest && (
                      <span
                        className="absolute -top-11 left-1/2 z-[2] -translate-x-1/2 animate-bounce whitespace-nowrap rounded-xl border-2 bg-card px-3 py-1.5 text-sm font-extrabold uppercase"
                        style={{ color: `hsl(var(${color}))` }}
                      >
                        開始
                      </span>
                    )}
                    {st === "current" && !isChest && <span className="absolute -inset-2.5 rounded-full border-[6px] opacity-30" style={{ borderColor: `hsl(var(${color}))` }} aria-hidden="true" />}
                    <button
                      type="button"
                      aria-label={
                        isChest
                          ? `第 ${u.idx + 1} 單元寶箱${st === "done" ? "（已開）" : ""}`
                          : isBoss
                            ? `第 ${u.idx + 1} 單元考${st === "done" ? "（已通過）" : st === "locked" ? "（未解鎖）" : ""}`
                            : `第 ${nd.n} 關${nd.title ? "・" + nd.title : ""}${st === "done" ? `（已完成・${LEVEL_NAME[Math.max(1, lv) as Level]}）` : st === "locked" ? "（未解鎖）" : ""}`
                      }
                      onClick={(e) => {
                        if (isChest) {
                          if (st === "done") toast("這個寶箱已經開過了");
                          else if (st === "locked") toast(bossNode ? "通過這個單元的單元考才能開寶箱" : "先完成這個單元的關卡才能開寶箱");
                          else {
                            const r = e.currentTarget.getBoundingClientRect();
                            openChest(nd.id, { x: r.left + r.width / 2, y: r.top });
                          }
                          return;
                        }
                        if (isBoss && st === "locked") {
                          toast("先完成這個單元的所有關卡，才能參加單元考");
                          return;
                        }
                        setOpen(open === nd.id ? null : nd.id);
                      }}
                      className={cn(
                        "relative z-[1] grid h-[72px] w-[72px] place-items-center rounded-full transition-transform active:translate-y-1.5",
                        isChest && "rounded-2xl",
                        isBoss && "h-[84px] w-[84px] rounded-[28px]",
                        (isChest || isBoss) && st === "current" && "animate-bounce",
                      )}
                      style={{ background: bg, boxShadow: `0 7px 0 0 ${sh}` }}
                    >
                      <Icon className={cn("h-8 w-8", st === "locked" ? "text-muted-foreground/60" : "text-white", st === "done" && lv >= 2 && !isBoss && "fill-white/90")} strokeWidth={2.6} />
                    </button>
                    {!isChest && !isBoss && lv > 0 && (
                      <span className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 gap-0.5" aria-hidden="true">
                        {[1, 2, 3].map((k) => (
                          <Star key={k} className={cn("h-3.5 w-3.5", k <= lv ? (lv >= 3 ? "fill-formal text-formal" : "fill-xp text-xp") : "fill-secondary text-border")} />
                        ))}
                      </span>
                    )}
                    {isBoss && st !== "done" && (
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-extrabold text-bad">單元考</span>
                    )}

                    {open === nd.id && !isChest && (
                      <div className="absolute top-[96px] z-10 w-[min(18rem,calc(100vw-32px))] -translate-x-1/2" style={{ left: `calc(50% - ${x}px)` }}>
                      <div
                        className="animate-rise rounded-2xl p-4 text-white"
                        style={{ background: `hsl(var(${isBoss ? "--bad" : st === "locked" ? "--muted-foreground" : color}))`, boxShadow: `0 4px 0 0 ${shade(isBoss ? "--bad" : st === "locked" ? "--muted-foreground" : color)}` }}
                      >
                        {isBoss ? (
                          <>
                            <p className="m-0 text-lg font-extrabold">{nd.sec}・單元考</p>
                            <p className="m-0 mt-1 text-sm font-semibold opacity-90">
                              從整個單元出 10–12 題：填空、找錯字、拼句、聽寫、默寫混在一起。每題限時，最多錯 3 題。通過可拿 +{rulesFor(2, true).gems} 寶石並打開寶箱。
                            </p>
                            <button
                              type="button"
                              onClick={() => start(nd, 2)}
                              className="mt-3 w-full rounded-xl bg-white py-2.5 font-extrabold uppercase text-bad"
                              style={{ boxShadow: "0 4px 0 0 rgb(0 0 0 / .15)" }}
                            >
                              {st === "done" ? "再考一次" : "開始單元考"}
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="m-0 text-lg font-extrabold">
                              {nd.title ?? nd.sec}・第 {nd.n} 關
                            </p>
                            <p className="m-0 mt-0.5 text-sm font-semibold opacity-90">
                              {st === "locked" ? "還沒解鎖，也可以直接挑戰" : st === "done" ? `已通過「${LEVEL_NAME[Math.max(1, lv) as Level]}」${perfect ? "・曾零失誤" : ""}` : `${nd.items.length} 句`}
                            </p>
                            <div className="mt-3 flex flex-col gap-2">
                              {([1, 2, 3] as Level[]).map((L) => {
                                const r = rulesFor(L);
                                const recommended: Level = lv >= 2 ? 3 : lv === 1 ? (Math.max(preferred, 2) as Level) : preferred;
                                const main = L === recommended;
                                return (
                                  <button
                                    key={L}
                                    type="button"
                                    onClick={() => start(nd, L)}
                                    title={LEVEL_DESC[L]}
                                    className={cn(
                                      "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left font-extrabold disabled:cursor-not-allowed disabled:opacity-55",
                                      main ? "bg-white" : "border-2 border-white/45 hover:bg-white/15",
                                    )}
                                    style={main ? { color: `hsl(var(${st === "locked" ? "--muted-foreground" : color}))`, boxShadow: "0 4px 0 0 rgb(0 0 0 / .15)" } : undefined}
                                  >
                                    <span className="flex items-center gap-1.5">
                                      {L === 3 ? <Crown className="h-4 w-4" /> : L === 2 ? <Star className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                      {LEVEL_NAME[L]}
                                      {lv >= L && <span className="text-xs opacity-75">已通過</span>}
                                    </span>
                                    <span className="text-xs font-bold opacity-85">
                                      {L === 1 ? "XP ×1" : `XP ×${r.xp}${r.gems ? `・+${r.gems} 寶石` : ""}`}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="flex flex-col items-center gap-2 pb-6 pt-2 text-center">
        <Trophy className={cn("h-16 w-16", doneCount === lessons.length && lessons.length ? "text-xp" : "text-muted-foreground/40")} />
        <p className="m-0 font-extrabold text-muted-foreground">{doneCount === lessons.length && lessons.length ? "這條路徑全部完成！" : "完成所有關卡拿下這個獎盃"}</p>
      </div>
    </div>
  );
}
