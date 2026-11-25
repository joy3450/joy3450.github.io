import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TABS, TONES, tabName } from "@/lib/data";
import { XP } from "@/lib/game";
import { useBank } from "@/lib/store";
import type { TabKey, Tone } from "@/lib/types";

const field =
  "w-full rounded-[10px] border-2 border-transparent bg-secondary px-3 py-2.5 text-[15px] font-medium text-foreground outline-none transition-colors focus:border-primary focus:bg-card";
const lab = "flex flex-col gap-1.5 text-[13px] font-bold text-muted-foreground";

export function AddDialog({ open, onOpenChange, tab, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; tab: TabKey; onAdded: (t: TabKey) => void }) {
  const { items, addCustom, target } = useBank();
  const [fTab, setFTab] = useState<TabKey>(tab);
  const [sec, setSec] = useState("");
  const [en, setEn] = useState("");
  const [zh, setZh] = useState("");
  const [ex, setEx] = useState("");
  const [tone, setTone] = useState<Tone>("neutral");
  const [msg, setMsg] = useState("");
  const enRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFTab(tab);
      setMsg("");
    }
  }, [open, tab]);

  const secs = Array.from(new Set(items.filter((i) => i.tab === fTab && i.sec).map((i) => i.sec)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] rounded-2xl border-0 bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold">新增句子</DialogTitle>
          <DialogDescription>每新增一句可以拿 {XP.addPhrase} XP。</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3.5 sm:grid-cols-2"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            if (!en.trim() || !zh.trim()) {
              setMsg(target.name + "和中文都要填。");
              return;
            }
            const it = addCustom({ tab: fTab, sec: sec.trim() || "我的句子", en: en.trim(), zh: zh.trim(), ex: ex.trim(), tone });
            setEn("");
            setZh("");
            setEx("");
            setMsg(`已加入「${tabName(it.tab)} / ${it.sec}」，可以繼續新增。`);
            onAdded(it.tab);
            enRef.current?.focus();
          }}
        >
          <label className={lab}>
            分頁
            <select className={field} value={fTab} onChange={(e) => setFTab(e.target.value as TabKey)}>
              {TABS.map((t) => (
                <option key={t.k} value={t.k}>
                  {t.n}
                </option>
              ))}
            </select>
          </label>
          <label className={lab}>
            分區（可自己取名）
            <input className={field} list="secList" placeholder="例如：聊天氣" value={sec} onChange={(e) => setSec(e.target.value)} />
            <datalist id="secList">
              {secs.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className={lab + " sm:col-span-2"}>
            {target.name}
            <input ref={enRef} className={field} required placeholder={target.name === "英文" ? "例如：Fancy a cuppa?" : "例如：Bonjour !"} value={en} onChange={(e) => setEn(e.target.value)} autoFocus />
          </label>
          <label className={lab + " sm:col-span-2"}>
            中文意思
            <input className={field} required placeholder="例如：想喝杯茶嗎？" value={zh} onChange={(e) => setZh(e.target.value)} />
          </label>
          <label className={lab + " sm:col-span-2"}>
            例句或情境（選填）
            <textarea className={field + " min-h-[70px] resize-y"} value={ex} onChange={(e) => setEx(e.target.value)} />
          </label>
          <label className={lab}>
            語氣
            <select className={field} value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {target.tones[t]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end justify-end">
            <button
              type="submit"
              className="rounded-xl bg-primary px-6 py-2.5 font-bold text-primary-foreground shadow-btn transition-colors hover:bg-primary-hover active:translate-y-px active:shadow-none"
            >
              加入
            </button>
          </div>
          <p role="status" className="m-0 min-h-5 text-sm font-semibold text-good sm:col-span-2">
            {msg}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
