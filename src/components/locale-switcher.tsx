"use client";

import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { useI18n } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("nav.locale")}
      className="flex items-center rounded-xl border border-white/10 bg-white/[0.04] p-0.5"
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code as Locale)}
          className={cn(
            "rounded-lg px-1.5 py-1 text-[10px] font-semibold tracking-wide transition sm:px-2 sm:text-[11px]",
            locale === code
              ? "bg-amber-400 text-slate-950"
              : "text-white/55 hover:text-white"
          )}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
    </div>
  );
}
