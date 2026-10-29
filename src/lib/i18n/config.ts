export const LOCALES = ["hk", "tw", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "hk";
export const LOCALE_COOKIE = "vm_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  hk: "HK",
  tw: "TW",
  en: "ENG",
};

export const LOCALE_HTML_LANG: Record<Locale, string> = {
  hk: "zh-Hant-HK",
  tw: "zh-Hant-TW",
  en: "en",
};

export function parseLocale(value: string | null | undefined): Locale {
  if (value === "hk" || value === "tw" || value === "en") return value;
  return DEFAULT_LOCALE;
}
