import { useEffect, useState } from "react";
import { Check, Flame, Gem, Gift, Heart, Lock, PackageOpen, Palette, Snowflake, Star, Timer, Volume2, VolumeX, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { TABS } from "@/lib/data";
import { ACHIEVEMENTS, LEVEL_PERKS, SHOP, STREAK_MIN, THEMES, lastNDays, priceOf, type ShopItem } from "@/lib/game";
import { msUntilMidnight } from "@/lib/quests";
import { useBank } from "@/lib/store";
import { ACH_ICON, Bar, LevelBadge, Ring, fmtTime } from "./game/bits";

const GOALS = [30, 60, 100, 150];

function Panel({ title, right, children, className }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl bg-card p-4 shadow-card", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="m-0 text-[15px] font-extrabold">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

const GEM_TXT = "text-[hsl(199_89%_40%)] dark:text-[hsl(199_89%_65%)]";

function fmtLeft(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.ceil((ms % 3600000) / 60000);
  return h ? `${h} 小時 ${m} 分` : `${m} 分鐘`;
}

export function StatStrip({ className }: { className?: string }) {
  const { streak, game, hearts, perks } = useBank();
  const heartsOn = game.settings.hearts;
  return (
    <div className={cn("grid grid-cols-3 gap-2 rounded-2xl bg-card p-3 shadow-card", className)}>
      <div className="flex flex-col items-center gap-0.5" title={`連續學習 ${streak} 天`}>
        <span className={cn("flex items-center gap-1 text-lg font-extrabold", streak ? "text-streak" : "text-muted-foreground")}>
          <Flame className={cn("h-6 w-6", streak > 0 && "animate-flicker fill-streak/30")} />
          <span className="tabular">{streak}</span>
        </span>
        <span className="text-[11px] font-bold text-muted-foreground">連續天數</span>
      </div>
      <div className="flex flex-col items-center gap-0.5" title={`${game.gems} 顆寶石`}>
        <span className={cn("flex items-center gap-1 text-lg font-extrabold", GEM_TXT)}>
          <Gem className="h-6 w-6" />
          <span className="tabular">{game.gems}</span>
        </span>
        <span className="text-[11px] font-bold text-muted-foreground">寶石</span>
      </div>
      <div className="flex flex-col items-center gap-0.5" title={heartsOn ? `${hearts.n} 顆生命` : "生命制度已關閉"}>
        <span className={cn("flex items-center gap-1 text-lg font-extrabold", heartsOn ? "text-bad" : "text-muted-foreground")}>
          <Heart className={cn("h-6 w-6", heartsOn && "fill-bad")} />
          <span className="tabular">{heartsOn ? hearts.n : "∞"}</span>
        </span>
        <span className="text-[11px] font-bold text-muted-foreground">
          {heartsOn && hearts.n < perks.maxHearts && hearts.next ? `${Math.ceil(hearts.next / 60000)} 分後 +1` : "生命"}
        </span>
      </div>
    </div>
  );
}

export function QuestPanel() {
  const { quests, claimQuest } = useBank();
  const [left, setLeft] = useState(msUntilMidnight());
  useEffect(() => {
    const t = window.setInterval(() => setLeft(msUntilMidnight()), 30000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <Panel title="每日任務" right={<span className="text-xs font-bold text-muted-foreground">{fmtLeft(left)}後更新</span>}>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {quests.map((q) => {
          const ready = q.progress >= q.target && !q.claimed;
          return (
            <li key={q.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-bold">{q.title}</p>
                <div className="relative mt-1.5">
                  <Bar value={q.progress} max={q.target} fill={q.claimed ? "bg-good" : "bg-xp"} className="h-4" label={q.title} />
                  <span className="tabular absolute inset-0 grid place-items-center text-[11px] font-extrabold text-foreground/70">
                    {q.progress} / {q.target}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={!ready}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  claimQuest(q.id, { x: r.left + r.width / 2, y: r.top });
                }}
                aria-label={q.claimed ? "已領取" : ready ? `領取 ${q.reward} 寶石` : `完成後可領 ${q.reward} 寶石`}
                title={q.claimed ? "已領取" : `${q.reward} 寶石`}
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform",
                  ready ? "animate-bounce bg-xp text-white shadow-btn" : q.claimed ? "bg-secondary text-good" : "bg-secondary text-muted-foreground/60",
                )}
              >
                {q.claimed ? <PackageOpen className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function ShopPanel() {
  const { game, buy, boostLeft, hearts, perks } = useBank();
  const rows: { k: ShopItem; icon: React.ReactNode; note: string; desc: string }[] = [
    { k: "freeze", icon: <Snowflake className="h-5 w-5" />, note: `擁有 ${game.freezes} / ${perks.freezeMax}`, desc: SHOP.freeze.desc },
    {
      k: "refill",
      icon: <Heart className="h-5 w-5 fill-current" />,
      note: game.settings.hearts ? `目前 ${hearts.n} / ${perks.maxHearts}` : "生命制度已關閉",
      desc: `生命直接回到 ${perks.maxHearts} 顆`,
    },
    { k: "boost", icon: <Zap className="h-5 w-5" />, note: boostLeft ? `剩 ${Math.ceil(boostLeft / 60000)} 分鐘` : "", desc: `${perks.boostMinutes} 分鐘內拿到的 XP 加倍` },
  ];
  const tint: Record<ShopItem, string> = {
    freeze: "bg-[hsl(199_89%_48%/.14)] text-[hsl(199_89%_42%)]",
    refill: "bg-bad-soft text-bad",
    boost: "bg-xp-soft text-[hsl(30_100%_30%)] dark:text-xp",
  };
  return (
    <Panel title={perks.discount ? `商店・${Math.round((1 - perks.discount) * 10)} 折` : "商店"} right={<span className={cn("flex items-center gap-1 text-sm font-extrabold", GEM_TXT)}><Gem className="h-4 w-4" />{game.gems}</span>}>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((r) => {
          const it = SHOP[r.k];
          return (
            <li key={r.k} className="flex items-center gap-3">
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tint[r.k])}>{r.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-extrabold">{it.name}</p>
                <p className="m-0 text-xs text-muted-foreground">{r.desc}{r.note && `・${r.note}`}</p>
              </div>
              <button
                type="button"
                onClick={() => buy(r.k)}
                disabled={game.gems < priceOf(r.k, perks)}
                className={cn("inline-flex shrink-0 items-center gap-1 rounded-xl border-2 border-b-4 px-2.5 py-1.5 text-sm font-extrabold transition-transform active:translate-y-0.5 active:border-b-2 disabled:opacity-45", GEM_TXT)}
              >
                <Gem className="h-4 w-4" />
                {perks.discount > 0 && <s className="text-xs font-bold text-muted-foreground">{it.price}</s>}
                {priceOf(r.k, perks)}
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function RewardsPanel() {
  const { lvl } = useBank();
  const next = LEVEL_PERKS.find((p) => p.level > lvl.level);
  return (
    <Panel title="等級獎勵" right={next ? <span className="text-xs font-bold text-muted-foreground">下一個：Lv.{next.level}</span> : undefined}>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {LEVEL_PERKS.map((p) => {
          const on = lvl.level >= p.level;
          const isNext = p === next;
          return (
            <li
              key={p.text}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm",
                on ? "font-bold" : "text-muted-foreground",
                isNext && "bg-accent font-bold text-accent-foreground",
              )}
            >
              <span
                className={cn(
                  "tabular grid h-7 w-9 shrink-0 place-items-center rounded-lg text-xs font-extrabold",
                  on ? "bg-good text-white" : isNext ? "bg-primary text-primary-foreground" : "bg-secondary",
                )}
              >
                {on ? <Check className="h-4 w-4" /> : `Lv${p.level}`}
              </span>
              <span className="min-w-0 flex-1">{p.text}</span>
              {!on && !isNext && <Lock className="h-3.5 w-3.5 shrink-0" />}
            </li>
          );
        })}
      </ul>
      {next && (
        <p className="m-0 mt-2 text-xs text-muted-foreground">
          再 {lvl.need - lvl.into} XP 升到 Lv.{lvl.level + 1}
          {next.level > lvl.level + 1 && `，Lv.${next.level} 會解鎖「${next.text}」`}
        </p>
      )}
    </Panel>
  );
}

function SettingsPanel() {
  const { game, setSetting, perks, theme } = useBank();
  const row = (k: "sound" | "hearts", label: string, desc: string, icon: React.ReactNode) => (
    <label className="flex cursor-pointer items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
      <input type="checkbox" className="peer sr-only" checked={game.settings[k]} onChange={(e) => setSetting(k, e.target.checked)} />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-border transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-good peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ring" />
    </label>
  );
  return (
    <Panel title="設定">
      <div className="flex flex-col gap-3">
        {row("sound", "音效", "答對、答錯和過關的聲音", game.settings.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />)}
        {row("hearts", "生命制度", "關卡答錯會扣生命，關掉就無限", <Heart className="h-4 w-4" />)}
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-muted-foreground">
            <Star className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">預設難度</span>
            <span className="block text-xs text-muted-foreground">路徑關卡會先推薦這個難度</span>
          </span>
          <span className="inline-flex rounded-xl border-2 p-0.5" role="group" aria-label="預設難度">
            {([1, 2] as const).map((L) => (
              <button
                key={L}
                type="button"
                aria-pressed={game.settings.level === L}
                onClick={() => setSetting("level", L)}
                className="rounded-lg px-2.5 py-1 text-xs font-extrabold text-muted-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                {L === 1 ? "一般" : "困難"}
              </button>
            ))}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-muted-foreground">
            <Palette className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">主題色</span>
            <span className="block text-xs text-muted-foreground">升級會解鎖更多顏色</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-2 pl-12" role="radiogroup" aria-label="主題色">
          {THEMES.map((t) => {
            const unlocked = perks.themes.includes(t.id);
            const on = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!unlocked}
                onClick={() => setSetting("theme", t.id)}
                title={unlocked ? t.name : `Lv.${t.level} 解鎖「${t.name}」`}
                aria-label={unlocked ? t.name : `${t.name}（Lv.${t.level} 解鎖）`}
                className={cn("relative grid h-8 w-8 place-items-center rounded-full transition-transform enabled:hover:scale-110", on && "ring-2 ring-foreground ring-offset-2 ring-offset-card")}
                style={{ background: t.swatch, opacity: unlocked ? 1 : 0.3 }}
              >
                {on && <Check className="h-4 w-4 text-white" />}
                {!unlocked && <Lock className="h-3.5 w-3.5 text-white" />}
              </button>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

export function PlayerPanel() {
  const { game, lvl, streak, todayXP, setGoal, bestMatch } = useBank();
  const week = lastNDays(game.days, 7);
  const maxDay = Math.max(game.goal, ...week.map((d) => d.xp));
  const unlocked = ACHIEVEMENTS.filter((a) => game.ach[a.id]).length;

  return (
    <div className="flex flex-col gap-4">
      <StatStrip />
      <QuestPanel />
      {/* Player card */}
      <section className="relative overflow-hidden rounded-2xl bg-card p-4 shadow-card">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <LevelBadge level={lvl.level} />
          <div className="min-w-0">
            <p className="m-0 text-xs font-bold text-muted-foreground">目前稱號</p>
            <p className="m-0 truncate text-lg font-extrabold leading-tight">{lvl.title}</p>
          </div>
        </div>
        <div className="relative mt-4">
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="font-bold">Lv.{lvl.level} → {lvl.level + 1}</span>
            <span className="tabular font-bold text-muted-foreground">
              {lvl.into} / {lvl.need} XP
            </span>
          </div>
          <Bar value={lvl.into} max={lvl.need} fill="bg-xp" className="h-3" label="升級進度" />
          <p className="m-0 mt-2 text-xs text-muted-foreground">
            總經驗值 <b className="tabular text-foreground">{game.xp}</b> XP，再 {lvl.need - lvl.into} XP 升級
          </p>
        </div>
      </section>

      <RewardsPanel />

      {/* Daily goal + streak */}
      <Panel title="今日目標">
        <div className="flex items-center gap-4">
          <Ring value={todayXP} max={game.goal} size={78} stroke={8} color={todayXP >= game.goal ? "hsl(var(--good))" : "hsl(var(--xp))"}>
            <div className="text-center leading-none">
              <b className="tabular block text-lg">{todayXP}</b>
              <span className="text-[11px] font-bold text-muted-foreground">/ {game.goal}</span>
            </div>
          </Ring>
          <div className="min-w-0">
            <p className="m-0 font-bold">{todayXP >= game.goal ? "達標了，做得好！" : `還差 ${game.goal - todayXP} XP`}</p>
            <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="每日目標">
              {GOALS.map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={game.goal === g}
                  onClick={() => setGoal(g)}
                  className="tabular rounded-full border-2 px-2 py-px text-xs font-bold text-muted-foreground transition-colors hover:text-foreground aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground"
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="連續學習"
        right={
          <span className="flex items-center gap-1 font-extrabold text-streak">
            <Flame className={cn("h-5 w-5", streak > 0 && "animate-flicker fill-streak/30")} />
            <span className="tabular">{streak} 天</span>
          </span>
        }
      >
        <div className="flex items-end justify-between gap-1.5" aria-label="最近 7 天經驗值">
          {week.map((d) => {
            const h = maxDay ? Math.max(4, Math.round((d.xp / maxDay) * 64)) : 4;
            const hit = d.xp >= STREAK_MIN;
            const froze = game.frozen.includes(d.key);
            return (
              <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5" title={`${d.key}：${d.xp} XP`}>
                <div className="flex h-16 w-full items-end justify-center">
                  <div
                    className={cn("w-full max-w-[22px] rounded-md transition-all duration-700", d.xp >= game.goal ? "bg-good" : hit ? "bg-xp" : "bg-secondary")}
                    style={{ height: h }}
                  />
                </div>
                <span className={cn("grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold", d.today ? "bg-foreground text-background" : "text-muted-foreground")}>
                  {hit ? <Flame className={cn("h-3.5 w-3.5", d.today ? "text-xp" : "text-streak")} /> : froze ? <Snowflake className="h-3.5 w-3.5 text-[hsl(199_89%_48%)]" /> : d.label}
                </span>
              </div>
            );
          })}
        </div>
        <p className="m-0 mt-2 text-xs text-muted-foreground">
          一天拿到 {STREAK_MIN} XP 以上就算有學習。{game.freezes > 0 ? `已裝備 ${game.freezes} 個連勝凍結。` : "可以到商店買連勝凍結保護紀錄。"}
        </p>
      </Panel>

      <ShopPanel />

      {/* Achievements */}
      <Panel
        title="成就"
        right={
          <span className="tabular rounded-full bg-xp-soft px-2 text-xs font-extrabold text-[hsl(30_100%_30%)] dark:text-xp">
            {unlocked} / {ACHIEVEMENTS.length}
          </span>
        }
      >
        <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0">
          {ACHIEVEMENTS.map((a) => {
            const on = !!game.ach[a.id];
            const I = ACH_ICON[a.icon];
            return (
              <li key={a.id} title={`${a.name}：${a.desc}${on ? "（已解鎖）" : ""}`} className="flex flex-col items-center gap-1 text-center">
                <span
                  className={cn(
                    "relative grid h-11 w-11 place-items-center rounded-full transition-transform hover:scale-110",
                    on ? "bg-gradient-to-br from-xp to-streak text-white shadow-btn" : "bg-secondary text-muted-foreground/60",
                  )}
                >
                  <I className="h-5 w-5" />
                  {!on && <Lock className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-card p-0.5 text-muted-foreground" />}
                </span>
                <span className={cn("text-[11px] font-bold leading-tight", on ? "text-foreground" : "text-muted-foreground")}>{a.name}</span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="個人紀錄">
        <dl className="m-0 grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Zap className="h-4 w-4 text-xp" /> 最高連擊
            </dt>
            <dd className="tabular m-0 font-extrabold">{game.bestCombo}</dd>
          </div>
          {TABS.map((t) => (
            <div key={t.k} className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Timer className="h-4 w-4 text-primary" /> 配對・{t.short}
              </dt>
              <dd className="tabular m-0 font-extrabold">{bestMatch(t.k) != null ? fmtTime(bestMatch(t.k)!) : "—"}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <SettingsPanel />
    </div>
  );
}
