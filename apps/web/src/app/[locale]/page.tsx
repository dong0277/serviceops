import {ArrowUpRight, CalendarCheck2, LayoutDashboard, Rows3} from "lucide-react";
import {getTranslations} from "next-intl/server";
import {BrandMark} from "@/components/brand-mark";
import {LanguageSwitcher} from "@/components/language-switcher";
import {Card} from "@/components/ui/card";
import {Link} from "@/i18n/navigation";

const screens = [
  {key: "customer", href: "/booking", icon: CalendarCheck2, tint: "bg-emerald-50 text-emerald-700"},
  {key: "bookings", href: "/owner/bookings", icon: Rows3, tint: "bg-sky-50 text-sky-700"},
  {
    key: "dashboard",
    href: "/owner/dashboard",
    icon: LayoutDashboard,
    tint: "bg-amber-50 text-amber-700",
  },
] as const;

export default async function PreviewHome() {
  const common = await getTranslations("Common");
  const t = await getTranslations("Home");

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="surface-grid min-h-screen bg-[#f5f8f6] px-5 py-6 sm:px-8 sm:py-8"
    >
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="font-bold tracking-[-0.02em]">{common("brand")}</p>
              <p className="text-xs text-muted">{common("demo")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-xl border border-line bg-white px-3 text-sm font-bold text-brand transition hover:border-brand/30 hover:bg-brand-soft/30"
            >
              {common("account")}
            </Link>
            <LanguageSwitcher />
          </div>
        </header>

        <section className="py-20 text-center sm:py-28">
          <p className="text-xs font-bold tracking-[0.16em] text-brand uppercase">{t("eyebrow")}</p>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl leading-[1.12] font-bold tracking-[-0.055em] text-ink sm:text-6xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            {t("description")}
          </p>
        </section>

        <section aria-label={common("preview")} className="grid gap-4 pb-16 md:grid-cols-3">
          {screens.map((screen, index) => {
            const Icon = screen.icon;
            return (
              <Card
                key={screen.key}
                className={`group enter-up p-5 sm:p-6 ${index > 0 ? "enter-up-delay" : ""}`}
              >
                <span
                  className={`flex size-11 items-center justify-center rounded-2xl ${screen.tint}`}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h2 className="mt-6 text-lg font-bold tracking-[-0.025em]">
                  {t(`${screen.key}Title`)}
                </h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-muted">
                  {t(`${screen.key}Description`)}
                </p>
                <Link
                  href={screen.href}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand transition group-hover:gap-3"
                >
                  {t("open")}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </Card>
            );
          })}
        </section>
      </div>
    </main>
  );
}
