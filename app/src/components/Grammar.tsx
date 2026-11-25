import { useState } from "react";
import { Volume2 } from "lucide-react";
import { answerKey, grammarTopics, type GrammarTopic } from "@/lib/grammar";
import { useBank } from "@/lib/store";
import { speak } from "@/lib/fx";
import { Bar } from "./game/bits";

const primary = "rounded-xl bg-primary px-5 py-2.5 font-bold text-primary-foreground shadow-btn disabled:opacity-50";
const secondary = "rounded-xl border-2 bg-card px-4 py-2 font-bold";
const card = "space-y-5 rounded-2xl bg-card p-5 shadow-card sm:p-7";

export function Grammar({ practice, topicId, selectTopic, openPractice, openLibrary }: {
  practice: boolean;
  topicId?: string;
  selectTopic: (id: string) => void;
  openPractice: () => void;
  openLibrary: () => void;
}) {
  const { language, game } = useBank();
  const topics = grammarTopics(language);
  const topic = topics.find(t => t.id === topicId) ?? topics[0];
  if (!topic) return <p className={card}>文法教材準備中</p>;
  const progress = game.grammar[language + ":" + topic.id];
  const mastered = topic.questions.filter(q => progress?.correct.includes(q.id)).length;
  return <section className="space-y-4">
    <label className="flex flex-wrap items-center gap-3 font-bold">
      文法主題
      <select className={secondary + " max-w-full"} value={topic.id} onChange={e => selectTopic(e.target.value)}>
        {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
      </select>
    </label>
    <article className={card}>
      <header>
        <p className="mb-1 text-sm font-bold text-muted-foreground">{practice ? "文法練功房" : "文法庫"} · 已掌握 {mastered} / {topic.questions.length} 題</p>
        <h1 className="text-2xl font-extrabold">{topic.title}</h1>
      </header>
      {practice ? <Practice key={topic.id} topic={topic} openLibrary={openLibrary} /> : <>
        {topic.explanation.map((p, i) => <p key={i} className="leading-relaxed">{p}</p>)}
        <h2 className="text-lg font-bold">例句</h2>
        <ul className="space-y-3">{topic.examples.map((e, i) => <li key={i} className="rounded-xl bg-secondary p-4">
          <div className="flex items-start justify-between gap-2">
            <p lang={language} className="font-bold">{e.text}</p>
            <button type="button" onClick={() => speak(e.text, language)} aria-label={`朗讀例句 ${i + 1}`} className="p-1 text-primary"><Volume2 size={20} /></button>
          </div>
          <p className="mt-1 text-muted-foreground">{e.zh}</p>
        </li>)}</ul>
        <button type="button" className={primary} onClick={openPractice}>練這個主題</button>
      </>}
    </article>
  </section>;
}

function Practice({ topic, openLibrary }: { topic: GrammarTopic; openLibrary: () => void }) {
  const { finishGrammar } = useBank();
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState<string[]>([]);
  const [result, setResult] = useState<{ xp: number; gems: number } | null>(null);
  const question = topic.questions[index];
  const total = topic.questions.length;
  function next() {
    if (index + 1 === total) {
      setResult(finishGrammar(topic.id, correct, topic.questions.map(q => q.id)));
    } else {
      setIndex(index + 1);
      setChecked(false);
      setAnswer("");
    }
  }
  if (result) return <div className="space-y-4" role="status">
    <h2 className="text-xl font-bold">練習結算</h2>
    <p>答對 {correct.length} / {total} 題 · +{result.xp} XP · +{result.gems} 寶石</p>
    <button type="button" className={secondary} onClick={openLibrary}>回文法庫</button>
    <button type="button" className={primary + " ml-2"} onClick={() => {
      setResult(null); setCorrect([]); setIndex(0); setChecked(false); setAnswer("");
    }}>再練一次</button>
  </div>;
  return <div className="space-y-4">
    <p className="text-sm font-bold text-muted-foreground">第 {index + 1} / {total} 題</p>
    <Bar value={index + Number(checked)} max={total} label="練習進度" />
    <form className="space-y-4" onSubmit={e => {
      e.preventDefault();
      if (checked || !answer.trim()) return;
      if (question.answers.some(a => answerKey(a) === answerKey(answer))) setCorrect(prev => [...prev, question.id]);
      setChecked(true);
    }}>
      <fieldset disabled={checked} className="grid gap-2">
        <legend className="mb-3 font-bold">{question.prompt}</legend>
        {question.type === "choice" ? question.options!.map(option => <label key={option}
          className={"flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 " + (option === answer ? "border-primary bg-accent" : "")}>
          <input type="radio" name="grammar-choice" checked={option === answer} onChange={() => setAnswer(option)} />
          {option}
        </label>) : <input aria-label="填寫答案" autoComplete="off" autoCapitalize="off" spellCheck={false}
          className={secondary} value={answer} onChange={e => setAnswer(e.target.value)} />}
      </fieldset>
      {!checked && <button type="submit" className={primary} disabled={!answer.trim()}>檢查答案</button>}
    </form>
    {checked && <div className="space-y-3 rounded-xl bg-secondary p-4" aria-live="polite">
      <p className="font-bold">{correct.includes(question.id) ? "答對了" : "再記一下"} · 參考答案：{question.answers[0]}</p>
      <p>{question.explanation}</p>
      <button type="button" className={primary} onClick={next}>{index + 1 === total ? "查看結算" : "下一題"}</button>
    </div>}
  </div>;
}
