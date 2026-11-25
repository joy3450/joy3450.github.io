import type { Row } from "./raw";
import type { TabKey } from "./types";

export type FrenchRegister = "familier" | "courant" | "soutenu";

export const FRENCH: Record<TabKey, Row<FrenchRegister>[]> = { chat: [], coffee: [], class: [], vocab: [] };
