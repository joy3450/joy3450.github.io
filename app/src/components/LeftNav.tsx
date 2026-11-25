import { Crown, Star, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { TABS, TONES } from "@/lib/data";
import { useBank } from "@/lib/store";
import type { Filters, Item } from "@/lib/types";
import { Bar, ToneDot } from "./game/bits";

export function secId(sec: string) {
  return "sec-" + encodeURIComponent(sec).replace(/%/g, "");
}

export function FilterChips({ f, set }: { f: Filters; set: (p: Partial<Filters>) => void }) {
  const { target } = useBank();
  const chip =
    "inline-flex items-center gap-1.5 rounded-full border-2 bg-card px-3 py-0.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground";
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" className={chip} aria-pressed={f.tone === "all"} onClick={() => set({ tone: "all" })}>
        全部語氣
      </button>
      {TONES.map((t) => (
        <button key={t} type="button" className={chip} aria-pressed={f.tone === t} onClick={() => set({ tone: t })}>
          <ToneDot tone={t} />
          {target.tones[t]}
        </button>
      ))}
      <button type="button" className={chip} aria-pressed={f.fav} onClick={() => set({ fav: !f.fav })}>
        <Star className="h-3.5 w-3.5" /> 收藏
      </button>
      <button type="button" className={chip} aria-pressed={f.todo} onClick={() => set({ todo: !f.todo })}>
        <CircleDashed className="h-3.5 w-3.5" /> 還不熟
      </button>
    </div>
  );
}

export function LeftNav({ f, set, onJump }: { f: Filters; set: (p: Partial<Filters>) => void; onJump?: () => void }) {
  const { items, learned, synced } = useBank();
  const tabItems = items.filter((i) => i.tab === f.tab);
  const sections: { sec: string; list: Item[] }[] = [];
  tabItems.forEach((it) => {
    const s = it.sec || "我的句子";
    let g = sections.find((x) => x.sec === s);
    if (!g) sections.push((g = { sec: s, list: [] }));
    g.list.push(it);
  });

  return (
    <nav className="flex flex-col gap-6" aria-label="分類與章節">
      <div>
        <h3 className="mb-2 px-2 text-xs font-extrabold uppercase tracking-[.12em] text-muted-foreground">分類</h3>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {TABS.map((t) => {
            const ti = items.filter((i) => i.tab === t.k);
            const done = ti.filter((i) => learned.has(i.id)).length;
            const all = ti.length > 0 && done === ti.length;
            const active = f.tab === t.k;
            return (
              <li key={t.k}>
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    set({ tab: t.k });
                    onJump?.();
                    window.scrollTo({ top: 0 });
                  }}
                  className={cn(
                    "w-full rounded-xl border-2 px-3 py-2.5 text-left transition-colors",
                    active ? "border-primary bg-card shadow-card" : "border-transparent hover:bg-card",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("font-bold", active && "text-primary")}>{t.n}</span>
                    {all ? (
                      <Crown className="h-4 w-4 text-xp" aria-label="全部學會" />
                    ) : (
                      <span className="tabular text-xs font-bold text-muted-foreground">
                        {done}/{ti.length}
                      </span>
                    )}
                  </span>
                  <Bar value={done} max={ti.length} className="mt-2 h-1.5" fill={all ? "bg-xp" : "bg-good"} label={`${t.n} 學會比例`} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 px-2 text-xs font-extrabold uppercase tracking-[.12em] text-muted-foreground">章節</h3>
        <ul className="m-0 flex list-none flex-col p-0">
          {sections.map((s) => {
            const done = s.list.filter((i) => learned.has(i.id)).length;
            const full = done === s.list.length;
            return (
              <li key={s.sec}>
                <a
                  href={"#" + secId(s.sec)}
                  onClick={() => onJump?.()}
                  className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground no-underline transition-colors hover:bg-card hover:text-foreground"
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      full ? "bg-good" : done > 0 ? "bg-xp" : "bg-border",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.sec}</span>
                  <span className="tabular text-xs font-bold">
                    {done}/{s.list.length}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 px-2 text-xs font-extrabold uppercase tracking-[.12em] text-muted-foreground">篩選</h3>
        <div className="px-1">
          <FilterChips f={f} set={set} />
        </div>
      </div>

      <p className="m-0 px-2 text-xs leading-relaxed text-muted-foreground">
        {synced === "cloud" ? "進度已存到你的帳號，換裝置也會在。" : "收藏、進度和經驗值存在這個瀏覽器裡。"}
      </p>
    </nav>
  );
}
