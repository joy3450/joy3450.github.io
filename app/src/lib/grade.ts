/*
 * Lenient answer checking for typed or spoken answers.
 *
 * Both the answer and the target go through the same normalisation, so anything that
 * normalisation folds together (case, punctuation, contractions, British/American spelling,
 * digits vs words, hyphens) never costs marks. On top of that, the score blends a
 * character-level similarity (forgives typos) with a word-level match (forgives a missing
 * or extra word), weighting small function words less than content words.
 */

import type { Language } from "./language";

export type Level = "perfect" | "close" | "partial" | "miss";

export interface GradeResult {
  score: number;
  level: Level;
  /** Target words in display form, flagged when the answer covered them. */
  words: { text: string; hit: boolean | null }[];
}

const NUM: Record<string, string> = {
  "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven",
  "8": "eight", "9": "nine", "10": "ten", "11": "eleven", "12": "twelve", "15": "fifteen", "18": "eighteen",
  "20": "twenty", "30": "thirty", "40": "forty", "50": "fifty", "60": "sixty", "90": "ninety", "100": "hundred",
};

const STOP = new Set(
  "a an the to of and or but so is am are was were be been i you we they he she it this that there in on at for with by from as do does did have has had will would can could should shall may might not just me my your our".split(" "),
);

export function norm(s: string, language: Language = "en"): string {
  if (language === "fr") return s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  let t = s
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\.{3}|…/g, " ")
    .replace(/%/g, " percent ")
    .replace(/£/g, " pound ")
    .replace(/&/g, " and ");
  t = t
    .replace(/\bcan't\b/g, "can not")
    .replace(/\bcannot\b/g, "can not")
    .replace(/\bwon't\b/g, "will not")
    .replace(/\bshan't\b/g, "shall not")
    .replace(/\blet's\b/g, "let us")
    .replace(/n't\b/g, " not")
    .replace(/'m\b/g, " am")
    .replace(/'re\b/g, " are")
    .replace(/'ll\b/g, " will")
    .replace(/'ve\b/g, " have")
    .replace(/'d\b/g, " would")
    .replace(/'s\b/g, " is")
    .replace(/'/g, "");
  t = t.replace(/[^a-z0-9\s]+/g, " ");
  t = t.replace(/\b\d+\b/g, (d) => NUM[d] ?? d);
  // British / American spelling: fold both sides to one form
  t = t
    .replace(/programme/g, "program")
    .replace(/(\w{2,})is(e|es|ed|ing|ation|ations)\b/g, "$1iz$2")
    .replace(/(\w)ys(e|es|ed|ing)\b/g, "$1yz$2")
    .replace(/(\w{2,})our\b/g, "$1or")
    .replace(/(\w{2,})our(s|ed|ing|able)\b/g, "$1or$2")
    .replace(/(\w{2,})tre\b/g, "$1ter")
    .replace(/(\w{2,}[aeiou])ll(ed|ing|er)\b/g, "$1l$2")
    .replace(/learnt/g, "learned");
  return t.replace(/\s+/g, " ").trim();
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function similarity(a: string, b: string) {
  const m = Math.max(a.length, b.length);
  return m ? 1 - lev(a, b) / m : 1;
}

function tokEq(a: string, b: string) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4) return false;
  return similarity(a, b) >= 0.75;
}

/** Longest common subsequence with fuzzy token equality; returns matched indices in `t`. */
function lcsHits(t: string[], a: string[]): boolean[] {
  const n = t.length;
  const m = a.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = tokEq(t[i], a[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const hit = new Array<boolean>(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (tokEq(t[i], a[j]) && dp[i][j] === dp[i + 1][j + 1] + 1) {
      hit[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return hit;
}

export function grade(answer: string, target: string, language: Language = "en"): GradeResult {
  const display = target.split(/\s+/).filter(Boolean);
  // Map each display word to its normalised tokens so hits can be shown per word.
  const owner: number[] = [];
  const tTok: string[] = [];
  display.forEach((w, k) => {
    norm(w, language)
      .split(" ")
      .filter(Boolean)
      .forEach((t) => {
        tTok.push(t);
        owner.push(k);
      });
  });
  const A = norm(answer, language);
  const aTok = A ? A.split(" ") : [];
  const hits = lcsHits(tTok, aTok);

  const words = display.map((text, k) => {
    const idx = owner.map((o, i) => (o === k ? i : -1)).filter((i) => i >= 0);
    return { text, hit: idx.length ? idx.every((i) => hits[i]) : null };
  });

  if (!aTok.length) return { score: 0, level: "miss", words: words.map((w) => ({ ...w, hit: w.hit === null ? null : false })) };

  const T = tTok.join(" ");
  const charR = similarity(A.replace(/ /g, ""), T.replace(/ /g, ""));
  const open = /\.{3}|…/.test(target);
  const short = tTok.length <= 2;

  let score: number;
  if (short) {
    // Single words and two-word terms: typo-tolerant, but the word itself has to be right.
    score = charR;
    if (open && hits.every(Boolean)) score = 1;
  } else {
    // In short phrases every word carries meaning ("count me in" vs "count me out").
    const w = (t: string) => (tTok.length > 4 && STOP.has(t) ? 0.35 : 1);
    const total = tTok.reduce((s, t) => s + w(t), 0);
    const got = tTok.reduce((s, t, i) => s + (hits[i] ? w(t) : 0), 0);
    const recall = total ? got / total : 0;
    const matched = hits.filter(Boolean).length;
    const precision = aTok.length ? matched / aTok.length : 0;
    // Templates such as "To be fair, ..." expect extra words, so only recall counts.
    const wordScore = open ? recall : 0.7 * recall + 0.3 * precision;
    score = tTok.length <= 4 && !open ? 0.5 * charR + 0.5 * wordScore : Math.max(charR, wordScore);
  }

  const perfect = A === T || charR >= 0.97 || (open && hits.every(Boolean) && score >= 0.97);
  const level: Level = perfect
    ? "perfect"
    : score >= (short ? 0.8 : 0.78)
      ? "close"
      : score >= (short ? 0.65 : 0.55)
        ? "partial"
        : "miss";
  if (perfect) words.forEach((w) => w.hit !== null && (w.hit = true));
  if (perfect) score = 1;
  return { score, level, words };
}

/** "Did you manage" -> "D__ y__ m_____" */
export function hintOf(target: string) {
  return target
    .split(/\s+/)
    .map((w) => w.replace(/\p{L}+(?:['’]\p{L}+)*/gu, (m) => m[0] + m.slice(1).replace(/\p{L}/gu, "_")))
    .join(" ");
}

export function bestOf(answers: string[], target: string, language: Language = "en") {
  let best: { text: string; g: GradeResult } | null = null;
  for (const a of answers) {
    const g = grade(a, target, language);
    if (!best || g.score > best.g.score) best = { text: a, g };
  }
  return best;
}
