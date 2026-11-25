import catalog from "../data/grammar-example.json";
import type { Language } from "./language";

export interface GrammarQuestion {
  id: string;
  type: string;
  prompt: string;
  options?: string[];
  answers: string[];
  explanation: string;
}

export interface GrammarTopic {
  language: string;
  id: string;
  title: string;
  explanation: string[];
  examples: { text: string; zh: string }[];
  questions: GrammarQuestion[];
}

export function answerKey(text: string) {
  return text.normalize("NFC").trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
}

function requireContent(condition: boolean, location: string) {
  if (!condition) throw new Error("文法教材格式錯誤：" + location);
}

function validate(topics: GrammarTopic[]) {
  const topicIds = new Set<string>();
  const validId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  for (const t of topics) {
    const key = t.language + ":" + t.id;
    requireContent(["en", "fr"].includes(t.language) && validId.test(t.id) && !topicIds.has(key), key);
    topicIds.add(key);
    requireContent(!!t.title.trim() && t.explanation.length > 0 && t.explanation.every(p => !!p.trim()), key);
    requireContent(t.examples.length > 0 && t.examples.every(e => !!e.text.trim() && !!e.zh.trim()), key);
    const ids = new Set<string>();
    requireContent(t.questions.length > 0, key);
    for (const q of t.questions) {
      const where = key + "/" + q.id;
      requireContent(validId.test(q.id) && !ids.has(q.id), where);
      ids.add(q.id);
      requireContent(!!q.prompt.trim() && !!q.explanation.trim() && q.answers.length > 0 && q.answers.every(a => !!a.trim()), where);
      if (q.type === "choice") {
        const options = q.options ?? [];
        requireContent(options.length >= 2 && options.every(o => !!o.trim()) && new Set(options.map(answerKey)).size === options.length, where);
        requireContent(q.answers.length === 1 && options.includes(q.answers[0]), where);
      } else {
        requireContent(q.type === "fill" && q.options === undefined, where);
      }
    }
  }
  return topics;
}

const topics = validate(catalog.topics);
export function grammarTopics(language: Language) {
  return topics.filter(t => t.language === language);
}

export interface GrammarProgress {
  correct: string[];
  rewarded: boolean;
}

export function grammarResult(previous: GrammarProgress | undefined, correct: string[], questions: string[], boosted: boolean) {
  const mastered = new Set(previous?.correct);
  const before = mastered.size;
  correct.forEach(id => mastered.add(id));
  const completed = questions.every(id => mastered.has(id));
  return {
    progress: { correct: [...mastered], rewarded: completed || !!previous?.rewarded },
    xp: (mastered.size - before) * (boosted ? 10 : 5),
    gems: completed && !previous?.rewarded ? 5 : 0,
  };
}
