"use client";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Download,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {PageHeader} from "@/components/ui/page-header";
import {Select} from "@/components/ui/select";
import {Link} from "@/i18n/navigation";

const workload = [
  {name: "김민아", enName: "Mina Kim", count: 18, width: "90%", color: "bg-brand"},
  {name: "박준호", enName: "Jun Park", count: 14, width: "70%", color: "bg-sky-500"},
  {name: "오수빈", enName: "Subin Oh", count: 9, width: "45%", color: "bg-amber-400"},
];

const services = [
  {key: "cleaning", value: 52, color: "#117a64"},
  {key: "repair", value: 31, color: "#4e9bb4"},
  {key: "training", value: 17, color: "#e8a33b"},
] as const;

export function Dashboard() {
  const t = useTranslations("Dashboard");
  const bookings = useTranslations("Bookings");
  const locale = useLocale();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <Select aria-label={t("period")} defaultValue="7" className="w-auto min-w-28">
              <option value="7">{t("period")}</option>
            </Select>
            <Button variant="secondary" className="hidden sm:inline-flex">
              <Download className="size-4" aria-hidden="true" />
              {t("export")}
            </Button>
          </>
        }
      />

      <section aria-label={t("keyMetrics")} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label={t("todayBookings")}
          value="8"
          change={t("vsPrevious", {value: "+14%"})}
          positive
          icon={CalendarDays}
        />
        <MetricCard
          label={t("periodBookings")}
          value="41"
          change={t("vsPrevious", {value: "+8%"})}
          positive
          icon={TrendingUp}
        />
        <MetricCard
          label={t("completionRate")}
          value="92%"
          change={t("onTrack")}
          positive
          icon={CheckCircle2}
        />
        <MetricCard
          label={t("cancellations")}
          value="3"
          change={t("vsPrevious", {value: "-2"})}
          positive
          icon={TrendingDown}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.8fr)]">
        <Card className="overflow-hidden">
          <div className="flex items-start justify-between border-b border-line px-5 py-5 sm:px-6">
            <div>
              <h2 className="font-bold tracking-[-0.02em]">{t("scheduleTitle")}</h2>
              <p className="mt-1 text-xs text-muted">{t("scheduleHint")}</p>
            </div>
            <Link
              href="/owner/bookings"
              className="inline-flex items-center gap-1 text-xs font-bold text-brand"
            >
              {t("viewAll")}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-line px-5 sm:px-6">
            {(["first", "second", "third", "fourth"] as const).map((key, index) => {
              const status =
                index === 0
                  ? "in_progress"
                  : index === 1
                    ? "confirmed"
                    : index === 2
                      ? "requested"
                      : "confirmed";
              return (
                <div key={key} className="flex items-center gap-4 py-4">
                  <span
                    className={`relative flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${index === 0 ? "bg-brand text-white" : "bg-subtle text-muted"}`}
                  >
                    {index + 1}
                    {index === 0 ? (
                      <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-accent ring-2 ring-white" />
                    ) : null}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {t(`schedule.${key}`)}
                  </p>
                  <Badge
                    tone={
                      status === "in_progress"
                        ? "success"
                        : status === "requested"
                          ? "warning"
                          : "info"
                    }
                  >
                    {bookings(`statuses.${status}`)}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold tracking-[-0.02em]">{t("serviceMixTitle")}</h2>
              <p className="mt-1 text-xs text-muted">{t("serviceMixHint")}</p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Sparkles className="size-5" />
            </span>
          </div>
          <div className="mt-7 flex items-center gap-7">
            <div
              className="relative flex size-32 shrink-0 items-center justify-center rounded-full"
              style={{
                background: "conic-gradient(#117a64 0 52%, #4e9bb4 52% 83%, #e8a33b 83% 100%)",
              }}
              role="img"
              aria-label={services
                .map((service) => `${bookings(`services.${service.key}`)} ${service.value}%`)
                .join(", ")}
            >
              <span className="flex size-[4.6rem] flex-col items-center justify-center rounded-full bg-white shadow-inner">
                <strong className="text-xl">41</strong>
                <span className="text-[0.65rem] text-muted">{t("total")}</span>
              </span>
            </div>
            <ul className="min-w-0 flex-1 space-y-3">
              {services.map((service) => (
                <li key={service.key} className="flex items-center gap-2 text-xs">
                  <span
                    className="size-2.5 rounded-full"
                    style={{backgroundColor: service.color}}
                  />
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {bookings(`services.${service.key}`)}
                  </span>
                  <strong>{service.value}%</strong>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold tracking-[-0.02em]">{t("workloadTitle")}</h2>
              <p className="mt-1 text-xs text-muted">{t("workloadHint")}</p>
            </div>
            <UsersRound className="size-5 text-brand" />
          </div>
          <div className="mt-7 space-y-5">
            {workload.map((person) => (
              <div key={person.name}>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold">
                    {locale === "ko" ? person.name : person.enName}
                  </span>
                  <span className="text-muted">{t("jobs", {count: person.count})}</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-subtle"
                  role="progressbar"
                  aria-valuenow={person.count}
                  aria-valuemin={0}
                  aria-valuemax={20}
                  aria-label={person.enName}
                >
                  <div
                    className={`h-full rounded-full ${person.color}`}
                    style={{width: person.width}}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-[#163c33] p-6 text-white shadow-[var(--so-shadow-float)] sm:p-7">
          <div className="absolute -top-12 -right-10 size-40 rounded-full bg-white/[0.055]" />
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-[#8de0c6]">
            <Sparkles className="size-5" />
          </span>
          <h2 className="mt-6 text-xl font-bold tracking-[-0.025em]">{t("insightTitle")}</h2>
          <p className="mt-3 text-sm leading-6 text-white/67">{t("insightBody")}</p>
          <Link
            href="/owner/bookings"
            className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#91e2c9]"
          >
            {t("reviewSchedule")}
            <ArrowRight className="size-4" />
          </Link>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  change,
  positive,
  icon: Icon,
}: {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  icon: typeof CalendarDays;
}) {
  return (
    <Card className="p-4 shadow-none sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted sm:text-sm">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-[-0.045em] sm:text-3xl">{value}</p>
        </div>
        <span className="hidden size-9 items-center justify-center rounded-xl bg-brand-soft text-brand sm:flex">
          <Icon className="size-4" />
        </span>
      </div>
      <p
        className={`mt-3 text-[0.68rem] font-semibold ${positive ? "text-emerald-700" : "text-rose-700"}`}
      >
        {change}
      </p>
    </Card>
  );
}
