import { FRENCH, type FrenchRegister } from "./french";
import { materialKey, type Language } from "./language";
import { RAW, type Row } from "./raw";
import type { Item, TabKey, Tone } from "./types";

export const TABS: { k: TabKey; n: string; short: string }[] = [
  { k: "chat", n: "日常聊天", short: "聊天" },
  { k: "coffee", n: "Coffee chat / 面試", short: "Coffee chat" },
  { k: "class", n: "課堂・簡報・會議", short: "課堂" },
  { k: "vocab", n: "單字", short: "單字" },
];

export const TONES: Tone[] = ["casual", "neutral", "formal"];

const frenchTones: Record<FrenchRegister, Tone> = { familier: "casual", courant: "neutral", soutenu: "formal" };

function course<T extends string>(language: Language, rows: Record<TabKey, Row<T>[]>, toneOf: (register: T) => Tone): Item[] {
  return TABS.flatMap((t) =>
    rows[t.k].map((r, i) => ({
      language,
      id: materialKey(language, t.k + (i + 1)),
      tab: t.k,
      sec: r[0],
      en: r[1],
      zh: r[2],
      ex: r[3],
      tone: toneOf(r[4]),
      custom: false,
    })),
  );
}

export const courses = { en: course("en", RAW, tone => tone), fr: course("fr", FRENCH, tone => frenchTones[tone]) };

export function tabName(k: TabKey) {
  return TABS.find((t) => t.k === k)?.n ?? k;
}

export function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
