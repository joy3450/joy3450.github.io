export type Language = "en" | "fr";

export const languages = {
  en: { name: "英文", voice: "en-GB", tones: { casual: "casual", neutral: "neutral", formal: "formal" } },
  fr: { name: "法文", voice: "fr-FR", tones: { casual: "familier", neutral: "courant", formal: "soutenu" } },
};

// Unprefixed keys belong to the original English course.
export function materialKey(language: Language, id: string) {
  return language === "en" ? id : language + ":" + id;
}
