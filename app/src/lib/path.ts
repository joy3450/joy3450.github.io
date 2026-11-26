import { materialKey } from "./language";
import type { Item, TabKey } from "./types";

export interface PathNode {
  id: string;
  title?: string;
  type: "lesson" | "boss" | "chest";
  tab: TabKey;
  sec: string;
  /** lesson number within the unit, from 1 */
  n: number;
  items: Item[];
}

export interface Unit {
  sec: string;
  idx: number;
  nodes: PathNode[];
  items: Item[];
}

const LESSON_SIZE = 5;

function chunk(items: Item[]): Item[][] {
  const out: Item[][] = [];
  for (let i = 0; i < items.length; i += LESSON_SIZE) out.push(items.slice(i, i + LESSON_SIZE));
  // Fold a tiny last lesson into the previous one.
  if (out.length > 1 && out[out.length - 1].length < 3) {
    const last = out.pop()!;
    out[out.length - 1] = out[out.length - 1].concat(last);
  }
  return out;
}

/** Units follow the order sections first appear in; each unit ends with a chest. */
export function buildPath(items: Item[], tab: TabKey): Unit[] {
  const units: Unit[] = [];
  for (const it of items) {
    if (it.tab !== tab) continue;
    const sec = it.sec || "我的句子";
    let u = units.find((x) => x.sec === sec && x.items[0].unitId === it.unitId);
    if (!u) units.push((u = { sec, idx: units.length, nodes: [], items: [] }));
    u.items.push(it);
  }
  for (const u of units) {
    const key = (id: string) => materialKey(u.items[0].language ?? "en", id);
    const first = u.items[0];
    const unitKey = first.unitId ?? `${tab}:${u.sec}`;
    const lessons = new Map<string, Item[]>();
    if (first.unitId) {
      for (const item of u.items) {
        const id = item.lessonId!;
        if (!lessons.has(id)) lessons.set(id, []);
        lessons.get(id)!.push(item);
      }
    }
    const groups = first.unitId ? [...lessons.values()] : chunk(u.items);
    groups.forEach((group, i) =>
      u.nodes.push({ id: key(group[0].lessonId ?? `L:${tab}:${u.sec}:${i}`), title: group[0].lessonTitle, type: "lesson", tab, sec: u.sec, n: i + 1, items: group }),
    );
    if (u.items.length >= 4) u.nodes.push({ id: key(`B:${unitKey}`), type: "boss", tab, sec: u.sec, n: 0, items: u.items });
    u.nodes.push({ id: key(`C:${unitKey}`), type: "chest", tab, sec: u.sec, n: 0, items: [] });
  }
  return units;
}

export type NodeState = "done" | "current" | "locked";

/**
 * A lesson unlocks once the lesson before it (in path order) is done; the first unfinished one is "current".
 * Unit tests and chests never block the path: the unit test opens once every lesson in its unit is done,
 * and the chest opens once the unit test is passed (or straight away for units too small to have one).
 */
export function nodeStates(units: Unit[], progress: Record<string, { done: boolean }>) {
  const map = new Map<string, NodeState>();
  let prevDone = true;
  let currentSet = false;
  for (const u of units) {
    let unitDone = true;
    let bossDone = true;
    for (const nd of u.nodes) {
      const done = !!progress[nd.id]?.done;
      if (nd.type === "boss") {
        bossDone = done;
        map.set(nd.id, done ? "done" : unitDone ? "current" : "locked");
        continue;
      }
      if (nd.type === "chest") {
        map.set(nd.id, done ? "done" : unitDone && bossDone ? "current" : "locked");
        continue;
      }
      if (!done) unitDone = false;
      if (done) map.set(nd.id, "done");
      else if (prevDone && !currentSet) {
        map.set(nd.id, "current");
        currentSet = true;
      } else map.set(nd.id, "locked");
      prevDone = done;
    }
  }
  return map;
}

export const UNIT_COLORS = ["--primary", "--good", "--formal", "--streak", "--neu", "--casual"] as const;
