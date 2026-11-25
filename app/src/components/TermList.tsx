import { useRef, useState } from "react";
import { CircleCheck, Copy, Star, Trash2, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyText, pointOf, speak, toast } from "@/lib/fx";
import { useBank } from "@/lib/store";
import type { Item } from "@/lib/types";
import { IconBtn, ToneTag } from "./game/bits";
import { secId } from "./LeftNav";

function DeleteBtn({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  const t = useRef<number | undefined>(undefined);
  return (
    <IconBtn
      label={armed ? "再按一次確認刪除" : "刪除這條"}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          toast("再按一次刪除");
          t.current = window.setTimeout(() => setArmed(false), 3000);
          return;
        }
        window.clearTimeout(t.current);
        onConfirm();
      }}
      className={cn("hover:bg-bad-soft hover:text-bad", armed && "bg-bad-soft text-bad")}
    >
      <Trash2 className="h-[18px] w-[18px]" />
    </IconBtn>
  );
}

function Term({ it }: { it: Item }) {
  const { target, fav, learned, toggleFav, setLearned, deleteCustom } = useBank();
  const isL = learned.has(it.id);
  const isF = fav.has(it.id);
  const [pulse, setPulse] = useState(0);
  return (
    <article
      className={cn(
        "grid grid-cols-1 overflow-hidden rounded-xl bg-card shadow-card transition-shadow hover:shadow-lift md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]",
        isL && "ring-2 ring-inset ring-good/35",
      )}
    >
      <div className="px-4 pb-0 pt-3.5 md:border-r-2 md:border-background md:px-5 md:py-4">
        <p className="m-0 text-[17px] font-bold leading-snug">{it.en}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <ToneTag tone={it.tone} />
          {isL && (
            <span key={pulse} className="animate-pop rounded-md bg-good-soft px-2 py-px text-xs font-bold text-good">
              已學會
            </span>
          )}
          {it.custom && <span className="rounded-md bg-accent px-2 py-px text-xs font-bold text-accent-foreground">自己加的</span>}
        </div>
      </div>
      <div className="px-4 pb-1.5 pt-2.5 md:px-5 md:py-4">
        <p className="m-0">{it.zh}</p>
        {it.ex && <p className="m-0 mt-1.5 text-sm text-muted-foreground">{it.ex}</p>}
      </div>
      <div className="flex justify-end border-t-2 border-background px-2 pb-1.5 md:items-start md:border-t-0 md:px-1.5 md:pt-2">
        <IconBtn
          label={isF ? "取消收藏" : "收藏"}
          pressed={isF}
          onClick={() => {
            toggleFav(it.id);
            toast(isF ? "已取消收藏" : "已收藏");
          }}
          className="aria-pressed:text-xp"
        >
          <Star className={cn("h-[18px] w-[18px]", isF && "fill-current")} />
        </IconBtn>
        <IconBtn
          label={isL ? "改回還不熟" : "標記已學會"}
          pressed={isL}
          onClick={(e) => {
            setLearned(it.id, !isL, pointOf(e));
            if (!isL) setPulse((p) => p + 1);
            toast(isL ? "改回還不熟" : "標記為已學會");
          }}
          className="aria-pressed:text-good"
        >
          <CircleCheck className={cn("h-[18px] w-[18px]", isL && "fill-good/15")} />
        </IconBtn>
        <IconBtn label={`朗讀${target.name}`} onClick={() => speak(it.en, it.language)}>
          <Volume2 className="h-[18px] w-[18px]" />
        </IconBtn>
        <IconBtn label={`複製${target.name}`} onClick={() => copyText(it.en)}>
          <Copy className="h-[18px] w-[18px]" />
        </IconBtn>
        {it.custom && (
          <DeleteBtn
            onConfirm={() => {
              deleteCustom(it.id);
              toast("已刪除");
            }}
          />
        )}
      </div>
    </article>
  );
}

export function TermList({ items }: { items: Item[] }) {
  const { learned } = useBank();
  if (!items.length) {
    return <p className="m-0 rounded-xl bg-card px-4 py-12 text-center text-muted-foreground shadow-card">沒有符合的句子。換個關鍵字或取消篩選看看。</p>;
  }
  const groups: { sec: string; list: Item[] }[] = [];
  items.forEach((it) => {
    const s = it.sec || "我的句子";
    let g = groups.find((x) => x.sec === s);
    if (!g) groups.push((g = { sec: s, list: [] }));
    g.list.push(it);
  });
  return (
    <div>
      {groups.map((g) => {
        const done = g.list.filter((i) => learned.has(i.id)).length;
        return (
          <section key={g.sec} aria-labelledby={secId(g.sec)}>
            <h3 id={secId(g.sec)} className="mb-2.5 mt-7 flex scroll-mt-24 items-center gap-3 text-[13px] font-extrabold tracking-wide text-muted-foreground">
              <span>{g.sec}</span>
              <span className="tabular rounded-full bg-card px-2 py-px text-xs shadow-card">
                {done}/{g.list.length}
              </span>
              <span className="h-px flex-1 bg-border" />
            </h3>
            <div className="flex flex-col gap-2.5">
              {g.list.map((it) => (
                <Term key={it.id} it={it} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
