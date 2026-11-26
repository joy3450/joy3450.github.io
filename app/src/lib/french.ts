import catalog from "../../../joy-fr-path-120.json";
import { materialKey } from "./language";
import type { Item, Tone } from "./types";

const tones: Record<string, Tone> = { familier: "casual", courant: "neutral", soutenu: "formal" };
const phrases = new Map(catalog.phrases.map(p => [p.id, p]));

export const frenchItems: Item[] = catalog.units.flatMap(unit =>
  unit.lessons.flatMap(lesson => lesson.phraseIds.map(id => {
    const phrase = phrases.get(id);
    if (!phrase || !tones[phrase.register]) throw new Error("法語教材格式錯誤：" + id);
    return {
      id: materialKey("fr", id), language: "fr" as const, tab: "chat" as const,
      sec: unit.title, unitId: unit.id, lessonId: lesson.id, lessonTitle: lesson.title,
      en: phrase.fr, zh: phrase.zh, ex: "", tone: tones[phrase.register], custom: false,
    };
  })),
);
