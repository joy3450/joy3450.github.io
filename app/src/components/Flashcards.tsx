import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Repeat2, Star, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { XP, dayKey } from "@/lib/game";
import { speak, toast } from "@/lib/fx";
import { useBank } from "@/lib/store";
import type { Item } from "@/lib/types";
import { IconBtn, ToneTag } from "./game/bits";

export function Flashcards({
  deck,
  index,
  setIndex,
  front,
  setFront,
  active,
}: {
  deck: Item[];
  index: number;
  setIndex: (i: number) => void;
  front: "zh" | "en";
  setFront: (f: "zh" | "en") => void;
  active: boolean;
}) {
  const { target, fav, toggleFav, flipped: onFlip, game } = useBank();
  const [flipped, setFlipped] = useState(false);
  const [dir, setDir] = useState<0 | 1 | -1>(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const it = deck[index];

  useEffect(() => setFlipped(false), [index, deck.length]);

  const flip = () => {
    setFlipped((f) => !f);
    if (!flipped && it) {
      const r = cardRef.current?.getBoundingClientRect();
      onFlip(it.id, r ? { x: r.left + r.width / 2, y: r.top + 24 } : null);
    }
  };
  const go = (step: 1 | -1) => {
    const to = index + step;
    if (to < 0 || to >= deck.length) return;
    setDir(step);
    setIndex(to);
  };

  const keyRef = useRef({ flip, go });
  keyRef.current = { flip, go };
  useEffect(() => {
    if (!active) return;
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        keyRef.current.go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        keyRef.current.go(1);
      } else if (e.key === " " && t.tagName !== "BUTTON" && t.tagName !== "A") {
        e.preventDefault();
        keyRef.current.flip();
      }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [active]);

  if (!it) {
    return <p className="m-0 rounded-2xl bg-card px-4 py-12 text-center text-muted-foreground shadow-card">目前的篩選條件下沒有句子。換個關鍵字或取消篩選看看。</p>;
  }

  const zhFirst = front === "zh";
  const flippedToday = game.flips.date === dayKey() && game.flips.ids.includes(it.id);
  const face = (isFront: boolean) => {
    const showEn = isFront ? !zhFirst : zhFirst;
    return (
      <div className={cn("backface-hidden absolute inset-0 flex flex-col rounded-[20px] bg-card p-5 shadow-lift sm:p-7", !isFront && "rotate-y-180")}>
        <div className="flex items-center justify-between gap-2 text-[13px] font-bold text-muted-foreground">
          <span>{it.sec || "我的句子"}</span>
          <ToneTag tone={it.tone} />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-auto text-center">
          <p className="m-0 text-balance text-[22px] font-bold leading-snug sm:text-[28px]">{showEn ? it.en : it.zh}</p>
          {!isFront && it.ex && <p className="m-0 max-w-[56ch] text-[15px] font-medium text-muted-foreground">{it.ex}</p>}
        </div>
        <p className="m-0 text-center text-[13px] text-muted-foreground">
          {isFront ? (
            <>
              點一下翻面
              {!flippedToday && <span className="ml-2 rounded-full bg-xp-soft px-2 py-px text-xs font-extrabold text-[hsl(30_100%_30%)] dark:text-xp">+{XP.flip} XP</span>}
            </>
          ) : showEn ? (
            `${target.name}`
          ) : (
            "中文"
          )}
        </p>
      </div>
    );
  };

  return (
    <div>
      <div
        key={it.id}
        ref={cardRef}
        role="button"
        tabIndex={0}
        aria-label="翻面"
        onClick={flip}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            flip();
          }
        }}
        className={cn(
          "perspective cursor-pointer rounded-[20px]",
          dir !== 0 && "motion-safe:animate-rise",
        )}
      >
        <div
          className={cn("preserve-3d relative h-[300px] transition-transform duration-500 [transition-timing-function:cubic-bezier(.4,.2,.2,1)] sm:h-[340px]", flipped && "rotate-y-180")}
        >
          {face(true)}
          {face(false)}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <button
          type="button"
          onClick={() => setFront(zhFirst ? "en" : "zh")}
          className="inline-flex items-center gap-2 justify-self-start rounded-lg px-2.5 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          aria-label={zhFirst ? `目前先看中文，切換成先看${target.name}` : `目前先看${target.name}，切換成先看中文`}
        >
          <Repeat2 className="h-5 w-5" />
          <span className="hidden sm:inline">{zhFirst ? "先看中文" : `先看${target.name}`}</span>
        </button>
        <div className="flex items-center justify-center gap-3">
          <IconBtn label="上一張" disabled={index === 0} onClick={() => go(-1)} className="h-12 w-12 border-2 hover:border-primary hover:bg-card hover:text-primary">
            <ArrowLeft className="h-5 w-5" />
          </IconBtn>
          <span className="tabular min-w-[64px] text-center font-bold">
            {index + 1} / {deck.length}
          </span>
          <IconBtn label="下一張" disabled={index >= deck.length - 1} onClick={() => go(1)} className="h-12 w-12 border-2 hover:border-primary hover:bg-card hover:text-primary">
            <ArrowRight className="h-5 w-5" />
          </IconBtn>
        </div>
        <div className="flex justify-end">
          <IconBtn label={`朗讀${target.name}`} onClick={() => speak(it.en, it.language)}>
            <Volume2 className="h-5 w-5" />
          </IconBtn>
          <IconBtn
            label={fav.has(it.id) ? "取消收藏" : "收藏"}
            pressed={fav.has(it.id)}
            onClick={() => {
              toggleFav(it.id);
              toast(fav.has(it.id) ? "已取消收藏" : "已收藏");
            }}
            className="aria-pressed:text-xp"
          >
            <Star className={cn("h-5 w-5", fav.has(it.id) && "fill-current")} />
          </IconBtn>
        </div>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: ((index + 1) / deck.length) * 100 + "%" }} />
      </div>
    </div>
  );
}
