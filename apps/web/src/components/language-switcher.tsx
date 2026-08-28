"use client";

import {Languages} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {usePathname, useRouter} from "@/i18n/navigation";
import type {AppLocale} from "@/i18n/routing";

export function LanguageSwitcher({compact = false}: {compact?: boolean}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Common");
  const pathname = usePathname();
  const router = useRouter();

  function changeLocale(nextLocale: AppLocale) {
    router.replace(pathname, {locale: nextLocale});
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted">
      <Languages aria-hidden="true" className="size-4" />
      {!compact ? <span className="sr-only">{t("language")}</span> : null}
      <select
        aria-label={t("language")}
        value={locale}
        onChange={(event) => changeLocale(event.target.value as AppLocale)}
        className="min-h-10 cursor-pointer bg-transparent px-1 text-sm font-semibold text-ink"
      >
        <option value="ko">{t("korean")}</option>
        <option value="en">{t("english")}</option>
      </select>
    </label>
  );
}
