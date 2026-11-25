import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "./fx";

/* Minimal typing for the Web Speech API (not in the TS DOM lib). */
interface Alt {
  transcript: string;
}
interface Res {
  isFinal: boolean;
  length: number;
  [k: number]: Alt;
}
interface ResEvent {
  results: { length: number; [k: number]: Res };
}
interface Rec {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: ResEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecCtor = new () => Rec;

function ctor(): RecCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupported = () => typeof window !== "undefined" && !!ctor();

/** One-shot speech recognition. Calls onFinal with up to 4 alternative transcripts. */
export function useSpeech(voice: string, onFinal: (alts: string[]) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const rec = useRef<Rec | null>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  const stop = useCallback(() => rec.current?.stop(), []);

  const start = useCallback(() => {
    const C = ctor();
    if (!C) {
      toast("這個瀏覽器不支援語音輸入，可以改用 Chrome、Edge 或 Safari");
      return;
    }
    rec.current?.abort();
    const r = new C();
    r.lang = voice;
    r.interimResults = true;
    r.maxAlternatives = 4;
    r.continuous = false;
    let delivered = false;
    let latest = "";
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      latest = text;
      setInterim(text);
      const last = e.results[e.results.length - 1];
      if (last.isFinal && !delivered) {
        const head = Array.from({ length: e.results.length - 1 }, (_, i) => e.results[i][0].transcript).join("");
        const alts: string[] = [];
        for (let k = 0; k < last.length; k++) alts.push(head + last[k].transcript);
        delivered = true;
        cb.current(alts);
      }
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") toast("沒有麥克風權限，請在瀏覽器的網站設定裡允許麥克風");
      else if (e.error === "service-not-allowed")
        toast("語音辨識被系統擋下。Mac 請到「系統設定 → 鍵盤 → 聽寫」打開聽寫，或改用鍵盤的聽寫功能輸入");
      else if (e.error === "no-speech") toast("沒聽到聲音，再試一次");
      else if (e.error === "audio-capture") toast("找不到麥克風，請確認麥克風有接好");
      else if (e.error === "network")
        toast(navigator.onLine ? "這個瀏覽器的語音辨識服務用不了（Brave、Arc 常見），請改用 Chrome、Edge 或 Safari，或用鍵盤的聽寫功能" : "語音辨識需要網路連線");
      else if (e.error !== "aborted") toast("語音辨識出錯了，再試一次");
    };
    r.onend = () => {
      setListening(false);
      if (!delivered && latest.trim()) {
        delivered = true;
        cb.current([latest]);
      }
    };
    rec.current = r;
    setInterim("");
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  }, [voice]);

  useEffect(() => () => rec.current?.abort(), []);

  return { listening, interim, start, stop };
}
