import type { Language } from "./language";

import type { GrammarProgress } from "./grammar";

export type Tone = "casual" | "neutral" | "formal";
export type TabKey = "chat" | "coffee" | "class" | "vocab";

export interface Item {
  id: string;
  unitId?: string;
  lessonId?: string;
  lessonTitle?: string;
  language?: Language;
  tab: TabKey;
  sec: string;
  en: string;
  zh: string;
  ex: string;
  tone: Tone;
  custom: boolean;
}

export interface Filters {
  tab: TabKey;
  tone: "all" | Tone;
  fav: boolean;
  todo: boolean;
  q: string;
}

export type StudyMode = "learn" | "write" | "test" | "match";

export interface GameState {
  xp: number;
  grammar: Record<string, GrammarProgress>;
  /** XP earned per local date, keyed YYYY-MM-DD */
  days: Record<string, number>;
  /** unlocked achievement id -> date unlocked */
  ach: Record<string, string>;
  /** card ids flipped today, so flips only pay out once a day */
  flips: { date: string; ids: string[] };
  /** ids that have ever been marked learned, so toggling cannot farm XP */
  ever: string[];
  /** best match time in seconds, per tab */
  bestMatch: Partial<Record<string, number>>;
  bestCombo: number;
  goal: number;
  gems: number;
  /** hearts stored at heartsAt; regeneration is computed from the timestamp */
  hearts: number;
  heartsAt: number;
  /** streak freezes owned, and the days they covered */
  freezes: number;
  frozen: string[];
  quests: { date: string; progress: Record<string, number>; claimed: string[] };
  /** path node id -> completion */
  path: Record<string, { done: boolean; perfect: boolean; plays: number; level?: number }>;
  /** item id -> times answered wrong (decreases when answered right in review) */
  mistakes: Record<string, number>;
  /** double XP active until this timestamp (ms) */
  boostUntil: number;
  settings: { language?: Language; hearts: boolean; sound: boolean; level: 1 | 2; theme: "indigo" | "forest" | "sunset" | "midnight" | "gold" };
}
