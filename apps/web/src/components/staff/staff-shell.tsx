"use client";

import {BriefcaseBusiness, ClipboardCheck, Menu, X} from "lucide-react";
import {useTranslations} from "next-intl";
import {useState} from "react";
import {BrandMark} from "@/components/brand-mark";
import {LanguageSwitcher} from "@/components/language-switcher";
import {Link, usePathname} from "@/i18n/navigation";

export function StaffShell({children}: {children: React.ReactNode}) {
  const t = useTranslations("Staff");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = pathname.startsWith("/staff/bookings");

  const navigation = (
    <nav aria-label={t("navigation")}>
      <Link
        href="/staff/bookings"
        onClick={() => setMobileOpen(false)}
        aria-current={active ? "page" : undefined}
        className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition ${active ? "bg-white text-[#12382f]" : "text-white/68 hover:bg-white/8 hover:text-white"}`}
      >
        <ClipboardCheck className="size-[1.05rem]" /> {t("assignedWork")}
      </Link>
    </nav>
  );

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="hidden min-h-screen flex-col bg-[#102a24] p-4 text-white lg:flex">
        <div className="flex h-16 items-center gap-3 px-2">
          <BrandMark inverse />
          <div>
            <p className="font-bold">ServiceOps</p>
            <p className="text-[0.68rem] text-white/48">{t("workspace")}</p>
          </div>
        </div>
        <div className="mt-5">{navigation}</div>
        <div className="mt-auto rounded-xl border border-white/8 bg-white/[0.055] p-3.5">
          <p className="text-xs text-white/45">{t("signedInAs")}</p>
          <p className="mt-1 text-sm font-semibold">{t("demoStaff")}</p>
          <p className="mt-0.5 truncate text-[0.68rem] text-white/45">staff.hana@serviceops.test</p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-line bg-white/92 px-4 backdrop-blur sm:px-6 lg:h-[4.5rem] lg:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={t("openNavigation")}
            className="mr-3 flex size-10 items-center justify-center rounded-xl border border-line lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2 text-sm font-bold">
            <BriefcaseBusiness className="size-4 text-brand" /> {t("workspace")}
          </div>
          <div className="ml-auto">
            <LanguageSwitcher compact />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
          {children}
        </main>
      </div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t("closeOverlay")}
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/35"
          />
          <aside className="relative h-full w-[min(86vw,320px)] bg-[#102a24] p-4 text-white shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BrandMark inverse />
                <span className="font-bold">ServiceOps</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label={t("closeNavigation")}
                className="flex size-9 items-center justify-center rounded-lg bg-white/8"
              >
                <X className="size-5" />
              </button>
            </div>
            {navigation}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
