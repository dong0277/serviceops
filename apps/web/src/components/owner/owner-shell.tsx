"use client";

import {
  BookOpenCheck,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  ContactRound,
  FileClock,
  LayoutDashboard,
  Menu,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import {useTranslations} from "next-intl";
import {useState} from "react";
import {BrandMark} from "@/components/brand-mark";
import {LanguageSwitcher} from "@/components/language-switcher";
import {Link, usePathname} from "@/i18n/navigation";
import {useModalFocus} from "@/lib/use-modal-focus";

const navItems = [
  {key: "overview", href: "/owner/dashboard", icon: LayoutDashboard},
  {key: "bookings", href: "/owner/bookings", icon: ClipboardList},
  {key: "calendar", href: "/owner/calendar", icon: CalendarDays},
  {key: "customers", href: "/owner/customers", icon: ContactRound},
  {key: "services", href: "/owner/services", icon: Wrench},
  {key: "team", href: "/owner/team", icon: UsersRound},
  {key: "audit", href: "/owner/audit", icon: FileClock},
] as const;

export function OwnerShell({children}: {children: React.ReactNode}) {
  const t = useTranslations("Owner");
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const mobileNavigationRef = useModalFocus<HTMLElement>(mobileOpen, () => setMobileOpen(false));

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden min-h-screen flex-col bg-[#102a24] text-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/8 px-6">
          <BrandMark inverse />
          <div>
            <p className="text-[0.95rem] font-bold tracking-[-0.02em]">ServiceOps</p>
            <p className="mt-0.5 text-[0.68rem] text-white/75">{t("demoOrg")}</p>
          </div>
        </div>
        <div className="px-4 pt-5">
          <div className="mb-5 rounded-xl border border-white/8 bg-white/[0.055] p-3.5">
            <p className="text-xs text-white/75">{t("workspaceLabel")}</p>
            <p className="mt-1 text-sm font-semibold">{t("workspace")}</p>
          </div>
          <nav aria-label={t("navigation")} className="space-y-1">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-10 items-center gap-3 rounded-[0.65rem] px-3 text-sm transition ${active ? "bg-white text-[#12382f] shadow-sm" : "text-white/62 hover:bg-white/8 hover:text-white"}`}
                >
                  <Icon className="size-[1.05rem]" aria-hidden="true" />
                  <span>{t(item.key)}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto border-t border-white/8 p-4">
          <div className="flex items-center gap-3 px-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#d9a766] text-xs font-bold text-[#3c2812]">
              JY
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{t("admin")}</p>
              <p className="truncate text-[0.68rem] text-white/75">owner@haesol.test</p>
            </div>
            <ChevronLeft className="size-4 text-white/35" aria-hidden="true" />
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-white/92 px-4 backdrop-blur sm:px-6 lg:h-[4.5rem] lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={t("openNavigation")}
              className="flex size-10 items-center justify-center rounded-xl border border-line bg-white text-ink"
            >
              <Menu className="size-5" />
            </button>
            <BrandMark />
            <span className="text-sm font-bold">ServiceOps</span>
          </div>
          <div className="hidden items-center gap-2 text-xs font-semibold text-muted lg:flex">
            <BookOpenCheck className="size-4 text-brand" aria-hidden="true" />
            {t("workspace")}
          </div>
          <div className="ml-auto flex items-center gap-4">
            <LanguageSwitcher compact />
            <Link
              href="/owner/audit"
              aria-label={t("recentActivity")}
              className="relative flex size-9 items-center justify-center rounded-full bg-subtle text-muted"
            >
              <FileClock className="size-4" />
            </Link>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9"
        >
          {children}
        </main>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t("closeOverlay")}
            onClick={() => setMobileOpen(false)}
            tabIndex={-1}
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
          />
          <aside
            ref={mobileNavigationRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("mobileNavigation")}
            tabIndex={-1}
            className="relative flex h-full w-[min(86vw,320px)] flex-col bg-[#102a24] p-4 text-white shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between px-1">
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
            <nav aria-label={t("mobileNavigation")} className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm ${active ? "bg-white text-[#12382f]" : "text-white/75 hover:bg-white/8 hover:text-white"}`}
                  >
                    <Icon className="size-[1.05rem]" />
                    {t(item.key)}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
