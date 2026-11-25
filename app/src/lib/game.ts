import type { GameState } from "./types";

export const XP = {
  flip: 2,
  learnKnew: 10,
  learnAgain: 3,
  testRight: 15,
  markLearned: 5,
  addPhrase: 10,
  matchPair: 4,
  writePerfect: 20,
  writeClose: 15,
  writeOverride: 10,
} as const;

/** Combo bonus: from the 3rd answer in a row, +2 per step, capped at +10. */
export function comboBonus(combo: number) {
  return combo >= 3 ? Math.min((combo - 2) * 2, 10) : 0;
}

/** XP needed to go from level n to n+1. */
export function needFor(level: number) {
  return 80 + level * 40;
}

const TITLES: [number, string][] = [
  [1, "新手"],
  [2, "破冰者"],
  [4, "聊天咖"],
  [6, "小組靈魂人物"],
  [9, "Coffee chat 常客"],
  [12, "Networking 高手"],
  [16, "Phrase 大師"],
  [20, "傳奇人物"],
];

export function levelInfo(xp: number) {
  let level = 1;
  let rest = xp;
  while (rest >= needFor(level)) {
    rest -= needFor(level);
    level++;
  }
  let title = TITLES[0][1];
  for (const [l, t] of TITLES) if (level >= l) title = t;
  return { level, into: rest, need: needFor(level), title };
}

export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/** A day counts towards the streak once it has at least this much XP. */
export const STREAK_MIN = 10;

/** Days with enough XP count; days covered by a streak freeze bridge the gap without counting. */
export function streakOf(days: Record<string, number>, frozen: string[] = []) {
  const fz = new Set(frozen);
  let d = new Date();
  if ((days[dayKey(d)] ?? 0) < STREAK_MIN) d = addDays(d, -1);
  let n = 0;
  for (let guard = 0; guard < 3650; guard++) {
    const k = dayKey(d);
    if ((days[k] ?? 0) >= STREAK_MIN) n++;
    else if (!fz.has(k)) break;
    d = addDays(d, -1);
  }
  return n;
}

export function lastNDays(days: Record<string, number>, n: number) {
  const out: { key: string; label: string; xp: number; today: boolean }[] = [];
  const names = ["日", "一", "二", "三", "四", "五", "六"];
  for (let i = n - 1; i >= 0; i--) {
    const d = addDays(new Date(), -i);
    const key = dayKey(d);
    out.push({ key, label: names[d.getDay()], xp: days[key] ?? 0, today: i === 0 });
  }
  return out;
}

export interface AchCtx {
  hard: number;
  legend: number;
  boss: number;
  lessons: number;
  units: number;
  gems: number;
  learned: number;
  total: number;
  mastered: number;
  streak: number;
  level: number;
  custom: number;
  today: number;
  goal: number;
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: "sprout" | "book" | "trophy" | "crown" | "flame" | "zap" | "target" | "timer" | "pen" | "medal" | "star" | "gem" | "mic" | "keyboard" | "map" | "flag" | "diamond" | "shield" | "swords";
  check?: (c: AchCtx) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first", name: "第一步", desc: "學會第一個句子", icon: "sprout", check: (c) => c.learned >= 1 },
  { id: "l10", name: "漸入佳境", desc: "學會 10 個句子", icon: "book", check: (c) => c.learned >= 10 },
  { id: "l50", name: "半百", desc: "學會 50 個句子", icon: "medal", check: (c) => c.learned >= 50 },
  { id: "tab", name: "分類制霸", desc: "把一個分類全部學會", icon: "trophy", check: (c) => c.mastered >= 1 },
  { id: "all", name: "全收集", desc: "所有句子都學會", icon: "crown", check: (c) => c.total > 0 && c.learned >= c.total },
  { id: "goal", name: "今日達標", desc: "達成一次每日目標", icon: "target", check: (c) => c.today >= c.goal },
  { id: "s3", name: "三天不斷", desc: "連續 3 天學習", icon: "flame", check: (c) => c.streak >= 3 },
  { id: "s7", name: "一週全勤", desc: "連續 7 天學習", icon: "flame", check: (c) => c.streak >= 7 },
  { id: "lv5", name: "升到 5 級", desc: "累積經驗值到 Lv.5", icon: "star", check: (c) => c.level >= 5 },
  { id: "pen", name: "自己動手", desc: "新增一個自己的句子", icon: "pen", check: (c) => c.custom >= 1 },
  { id: "combo", name: "手感火燙", desc: "連續答對 10 題", icon: "zap" },
  { id: "perfect", name: "零失誤", desc: "測驗 5 題以上全對", icon: "gem" },
  { id: "fast", name: "閃電手", desc: "配對遊戲 30 秒內完成", icon: "timer" },
  { id: "lesson1", name: "啟程", desc: "完成路徑上的第一關", icon: "map", check: (c) => c.lessons >= 1 },
  { id: "unit1", name: "單元達人", desc: "完成一整個單元", icon: "flag", check: (c) => c.units >= 1 },
  { id: "gems200", name: "寶石收藏家", desc: "同時擁有 200 顆寶石", icon: "diamond", check: (c) => c.gems >= 200 },
  { id: "hard1", name: "迎難而上", desc: "用困難以上的難度過一關", icon: "shield", check: (c) => c.hard >= 1 },
  { id: "legend1", name: "傳奇誕生", desc: "通過第一個傳奇關卡", icon: "crown", check: (c) => c.legend >= 1 },
  { id: "legend10", name: "傳奇之路", desc: "通過 10 個傳奇關卡", icon: "crown", check: (c) => c.legend >= 10 },
  { id: "boss1", name: "單元考過關", desc: "通過第一次單元考", icon: "swords", check: (c) => c.boss >= 1 },
  { id: "speak", name: "開口說", desc: "用語音答對一題默寫", icon: "mic" },
  { id: "flawless", name: "一字不差", desc: "默寫 5 題以上全部完美", icon: "keyboard" },
];

export function achById(id: string) {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export const DEFAULT_GAME: GameState = {
  xp: 0,
  grammar: {},
  days: {},
  ach: {},
  flips: { date: "", ids: [] },
  ever: [],
  bestMatch: {},
  bestCombo: 0,
  goal: 60,
  gems: 10000,
  hearts: 100,
  heartsAt: 0,
  freezes: 0,
  frozen: [],
  quests: { date: "", progress: {}, claimed: [] },
  path: {},
  mistakes: {},
  boostUntil: 0,
  settings: { hearts: true, sound: true, level: 1, theme: "indigo" },
};

/* ---------- Economy, hearts, shop ---------- */
export const MAX_HEARTS = 5;
export const HEART_REGEN_MS = 20 * 60 * 1000;
export const GEMS = { lesson: 5, perfect: 5, levelUp: 20, ach: 10, chestMin: 15, chestMax: 30 } as const;
export const SHOP = {
  freeze: { price: 40, max: 2, name: "連勝凍結", desc: "漏掉一天時自動保住連續紀錄" },
  refill: { price: 30, name: "補滿生命", desc: "生命直接回到 5 顆" },
  boost: { price: 50, minutes: 15, name: "雙倍經驗", desc: "15 分鐘內拿到的 XP 加倍" },
} as const;
export type ShopItem = keyof typeof SHOP;

export function heartsNow(g: { hearts: number; heartsAt: number }, now = Date.now(), max = MAX_HEARTS, regen = HEART_REGEN_MS) {
  if (g.hearts >= max) return { n: max, next: 0 };
  const gained = Math.floor((now - g.heartsAt) / regen);
  const n = Math.min(max, g.hearts + Math.max(0, gained));
  const next = n >= max ? 0 : regen - ((now - g.heartsAt) % regen);
  return { n, next };
}

/* ---------- Level rewards ---------- */
export type ThemeId = "indigo" | "forest" | "sunset" | "midnight" | "gold";
export const THEMES: { id: ThemeId; name: string; level: number; swatch: string }[] = [
  { id: "indigo", name: "靛藍", level: 1, swatch: "#4255ff" },
  { id: "forest", name: "森林綠", level: 2, swatch: "#1f8a5b" },
  { id: "sunset", name: "日落橘", level: 5, swatch: "#e8572a" },
  { id: "midnight", name: "午夜紫", level: 10, swatch: "#7b3fe0" },
  { id: "gold", name: "黃金", level: 20, swatch: "#c48a0c" },
];

export interface Perk {
  level: number;
  text: string;
}
export const LEVEL_PERKS: Perk[] = [
  { level: 2, text: "解鎖主題色「森林綠」" },
  { level: 3, text: "愛心上限 +1（6 顆）" },
  { level: 4, text: "每日任務變成 4 個" },
  { level: 5, text: "解鎖主題色「日落橘」" },
  { level: 6, text: "商店 9 折" },
  { level: 8, text: "愛心恢復變快：每 15 分鐘 1 顆" },
  { level: 10, text: "愛心上限 +1（7 顆）" },
  { level: 10, text: "解鎖主題色「午夜紫」" },
  { level: 12, text: "雙倍經驗延長到 20 分鐘" },
  { level: 14, text: "商店 8 折" },
  { level: 16, text: "連勝凍結最多可存 3 個" },
  { level: 20, text: "解鎖主題色「黃金」" },
];

export interface Perks {
  maxHearts: number;
  regenMs: number;
  questSlots: number;
  discount: number;
  boostMinutes: number;
  freezeMax: number;
  themes: ThemeId[];
}

export function perksFor(level: number): Perks {
  return {
    maxHearts: MAX_HEARTS + (level >= 3 ? 1 : 0) + (level >= 10 ? 1 : 0),
    regenMs: level >= 8 ? 15 * 60 * 1000 : HEART_REGEN_MS,
    questSlots: level >= 4 ? 4 : 3,
    discount: level >= 14 ? 0.2 : level >= 6 ? 0.1 : 0,
    boostMinutes: level >= 12 ? 20 : SHOP.boost.minutes,
    freezeMax: level >= 16 ? 3 : SHOP.freeze.max,
    themes: THEMES.filter((t) => level >= t.level).map((t) => t.id),
  };
}

export function priceOf(item: ShopItem, perks: Perks) {
  return Math.round(SHOP[item].price * (1 - perks.discount));
}
