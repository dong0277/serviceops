"use client";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Download,
  FileClock,
  LoaderCircle,
  LogIn,
  RefreshCw,
  Sparkles,
  TrendingDown,
  UsersRound,
} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useCallback, useEffect, useMemo, useState} from "react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {PageHeader} from "@/components/ui/page-header";
import {Select} from "@/components/ui/select";
import {Link} from "@/i18n/navigation";
import {apiRequest, downloadApiFile, ServiceOpsApiError} from "@/lib/api-client";
import {getDemoCustomerKey, getDemoServiceKey, getDemoStaffKey} from "@/lib/demo-localization";
import {
  bookingStatusTone,
  type BookingStatus,
  type OwnerBookingRecord,
  type OwnerDashboardRecord,
} from "@/lib/operations-types";

const organizationSlug = "demo-services";

export function Dashboard() {
  const t = useTranslations("Dashboard");
  const bookingsT = useTranslations("Bookings");
  const demoT = useTranslations("DemoData");
  const locale = useLocale();
  const [periodDays, setPeriodDays] = useState(7);
  const [dashboard, setDashboard] = useState<OwnerDashboardRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"login" | "unavailable" | null>(null);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDashboard(
        await apiRequest<OwnerDashboardRecord>(
          `/api/v1/organizations/${organizationSlug}/owner/dashboard?period_days=${periodDays}`,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof ServiceOpsApiError && [401, 403].includes(caught.status)
          ? "login"
          : "unavailable",
      );
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await apiRequest<OwnerDashboardRecord>(
          `/api/v1/organizations/${organizationSlug}/owner/dashboard?period_days=${periodDays}`,
        );
        if (active) setDashboard(data);
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof ServiceOpsApiError && [401, 403].includes(caught.status)
            ? "login"
            : "unavailable",
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [periodDays]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      }),
    [locale],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale],
  );

  const localService = useCallback(
    (name: string) => {
      const key = getDemoServiceKey(name);
      return key ? bookingsT(`services.${key}`) : name;
    },
    [bookingsT],
  );
  const localStaff = useCallback(
    (name: string) => {
      const key = getDemoStaffKey(name);
      return key ? demoT(`staff.${key}`) : name;
    },
    [demoT],
  );
  const localCustomer = useCallback(
    (booking: OwnerBookingRecord) => {
      const key = getDemoCustomerKey(booking.customer_email);
      return key ? demoT(`customers.${key}`) : booking.customer_display_name;
    },
    [demoT],
  );

  async function exportPeriod() {
    if (!dashboard) return;
    setExporting(true);
    setNotice(null);
    try {
      const params = new URLSearchParams({
        date_from: dashboard.period_start,
        date_to: dashboard.period_end,
      });
      await downloadApiFile(
        `/api/v1/organizations/${organizationSlug}/owner/bookings/export?${params.toString()}`,
        `serviceops-${dashboard.period_start}-${dashboard.period_end}.csv`,
      );
      setNotice(t("exportSuccess"));
    } catch {
      setNotice(t("exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={
          dashboard
            ? dateFormatter.format(new Date(`${dashboard.today}T12:00:00+09:00`))
            : t("eyebrow")
        }
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <label>
              <span className="sr-only">{t("periodLabel")}</span>
              <Select
                aria-label={t("periodLabel")}
                value={periodDays}
                onChange={(event) => {
                  setLoading(true);
                  setError(null);
                  setPeriodDays(Number(event.target.value));
                }}
                className="w-auto min-w-32"
              >
                <option value={7}>{t("period7")}</option>
                <option value={30}>{t("period30")}</option>
              </Select>
            </label>
            <Button
              variant="secondary"
              onClick={() => void loadDashboard()}
              disabled={loading}
              aria-label={t("refresh")}
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              <span className="hidden sm:inline">{t("refresh")}</span>
            </Button>
            <Button
              onClick={() => void exportPeriod()}
              disabled={!dashboard || exporting}
              aria-label={exporting ? t("exporting") : t("export")}
            >
              {exporting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              <span className="hidden sm:inline">{exporting ? t("exporting") : t("export")}</span>
            </Button>
          </div>
        }
      />

      {notice ? (
        <p
          className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      {loading && !dashboard ? (
        <DashboardSkeleton label={t("loading")} />
      ) : error ? (
        <DashboardError error={error} retry={() => void loadDashboard()} />
      ) : dashboard ? (
        <>
          <section aria-label={t("keyMetrics")} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard
              label={t("todayBookings")}
              value={String(dashboard.today_booking_count)}
              icon={CalendarDays}
            />
            <MetricCard
              label={t("periodBookings")}
              value={String(dashboard.period_booking_count)}
              icon={FileClock}
            />
            <MetricCard
              label={t("completionRate")}
              value={`${dashboard.completion_rate}%`}
              icon={CheckCircle2}
            />
            <MetricCard
              label={t("cancellations")}
              value={String(dashboard.cancellation_count)}
              icon={TrendingDown}
            />
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
            <TodaySchedule
              bookings={dashboard.today_schedule}
              localCustomer={localCustomer}
              localService={localService}
              localStaff={localStaff}
              timeFormatter={timeFormatter}
            />
            <StatusOverview
              counts={dashboard.status_counts}
              total={dashboard.period_booking_count}
            />
          </div>

          {dashboard.period_booking_count === 0 ? (
            <Card className="p-8 text-center sm:p-12">
              <CalendarDays className="mx-auto size-8 text-brand" />
              <h2 className="mt-4 font-bold">{t("emptyTitle")}</h2>
              <p className="mt-2 text-sm text-muted">{t("emptyBody")}</p>
              <Link
                href="/owner/calendar"
                className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand"
              >
                {t("openCalendar")} <ArrowRight className="size-4" />
              </Link>
            </Card>
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              <ServiceMix
                metrics={dashboard.service_counts}
                total={dashboard.period_booking_count}
                localService={localService}
              />
              <Workload metrics={dashboard.staff_workload} localStaff={localStaff} />
            </div>
          )}

          <Card className="relative overflow-hidden border-0 bg-[#163c33] p-6 text-white shadow-[var(--so-shadow-float)] sm:p-7">
            <div className="absolute -top-14 -right-10 size-44 rounded-full bg-white/[0.055]" />
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-[#8de0c6]">
              <Sparkles className="size-5" />
            </span>
            <h2 className="mt-5 text-xl font-bold tracking-[-0.025em]">{t("insightTitle")}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
              {dashboard.requested_count
                ? t("insightRequested", {count: dashboard.requested_count})
                : t("insightClear")}
            </p>
            <Link
              href="/owner/calendar"
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-white underline decoration-white/50 underline-offset-4"
            >
              {t("reviewSchedule")} <ArrowRight className="size-4" />
            </Link>
          </Card>

          <p className="text-right text-[0.7rem] text-muted">{dashboard.timezone} · UTC+09:00</p>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
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
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
    </Card>
  );
}

function TodaySchedule({
  bookings,
  localCustomer,
  localService,
  localStaff,
  timeFormatter,
}: {
  bookings: OwnerBookingRecord[];
  localCustomer: (booking: OwnerBookingRecord) => string;
  localService: (name: string) => string;
  localStaff: (name: string) => string;
  timeFormatter: Intl.DateTimeFormat;
}) {
  const t = useTranslations("Dashboard");
  const bookingsT = useTranslations("Bookings");
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between border-b border-line px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-bold tracking-[-0.02em]">{t("scheduleTitle")}</h2>
          <p className="mt-1 text-xs text-muted">{t("scheduleHint", {count: bookings.length})}</p>
        </div>
        <Link
          href="/owner/calendar"
          className="inline-flex items-center gap-1 text-xs font-bold text-brand"
        >
          {t("viewCalendar")} <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {bookings.length ? (
        <ul className="divide-y divide-line px-5 sm:px-6">
          {bookings.map((booking) => (
            <li key={booking.id} className="flex items-center gap-3 py-4">
              <time
                className="w-16 shrink-0 text-sm font-bold text-brand"
                dateTime={booking.starts_at}
              >
                {timeFormatter.format(new Date(booking.starts_at))}
              </time>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {localCustomer(booking)} · {localService(booking.service.name)}
                </p>
                <p className="mt-1 truncate text-xs text-muted">
                  {localStaff(booking.staff.display_name)}
                </p>
              </div>
              <Badge tone={bookingStatusTone[booking.status]}>
                {bookingsT(`statuses.${booking.status}`)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-6 py-12 text-center text-sm text-muted">{t("emptySchedule")}</p>
      )}
    </Card>
  );
}

function StatusOverview({
  counts,
  total,
}: {
  counts: {status: BookingStatus; count: number}[];
  total: number;
}) {
  const t = useTranslations("Dashboard");
  const bookingsT = useTranslations("Bookings");
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-bold tracking-[-0.02em]">{t("statusTitle")}</h2>
      <p className="mt-1 text-xs text-muted">{t("statusHint")}</p>
      <ul className="mt-6 space-y-3">
        {counts.map((metric) => (
          <li
            key={metric.status}
            className="grid grid-cols-[minmax(90px,1fr)_minmax(80px,1.5fr)_2rem] items-center gap-3 text-xs"
          >
            <span className="font-semibold">{bookingsT(`statuses.${metric.status}`)}</span>
            <span className="h-2 overflow-hidden rounded-full bg-subtle">
              <span
                className="block h-full rounded-full bg-brand"
                style={{width: `${total ? (metric.count / total) * 100 : 0}%`}}
              />
            </span>
            <strong className="text-right">{metric.count}</strong>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ServiceMix({
  metrics,
  total,
  localService,
}: {
  metrics: OwnerDashboardRecord["service_counts"];
  total: number;
  localService: (name: string) => string;
}) {
  const t = useTranslations("Dashboard");
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-bold tracking-[-0.02em]">{t("serviceMixTitle")}</h2>
      <p className="mt-1 text-xs text-muted">{t("serviceMixHint")}</p>
      <ul className="mt-6 space-y-5">
        {metrics.map((metric) => {
          const percentage = total ? Math.round((metric.count / total) * 100) : 0;
          return (
            <li key={metric.service_id}>
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-semibold">{localService(metric.service_name)}</span>
                <span className="text-muted">
                  {t("jobs", {count: metric.count})} · {percentage}%
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-subtle"
                role="progressbar"
                aria-valuenow={percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={localService(metric.service_name)}
              >
                <div className="h-full rounded-full bg-brand" style={{width: `${percentage}%`}} />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Workload({
  metrics,
  localStaff,
}: {
  metrics: OwnerDashboardRecord["staff_workload"];
  localStaff: (name: string) => string;
}) {
  const t = useTranslations("Dashboard");
  const maximum = Math.max(1, ...metrics.map((metric) => metric.count));
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold tracking-[-0.02em]">{t("workloadTitle")}</h2>
          <p className="mt-1 text-xs text-muted">{t("workloadHint")}</p>
        </div>
        <UsersRound className="size-5 text-brand" aria-hidden="true" />
      </div>
      {metrics.length ? (
        <ul className="mt-6 space-y-5">
          {metrics.map((metric) => (
            <li key={metric.staff_profile_id}>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold">{localStaff(metric.staff_display_name)}</span>
                <span className="text-muted">{t("jobs", {count: metric.count})}</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-subtle"
                role="progressbar"
                aria-valuenow={metric.count}
                aria-valuemin={0}
                aria-valuemax={maximum}
                aria-label={localStaff(metric.staff_display_name)}
              >
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{width: `${(metric.count / maximum) * 100}%`}}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-sm text-muted">{t("emptyWorkload")}</p>
      )}
    </Card>
  );
}

function DashboardSkeleton({label}: {label: string}) {
  return (
    <div role="status" aria-label={label} className="space-y-5">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-28 animate-pulse rounded-[var(--so-radius-lg)] bg-white" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-[var(--so-radius-lg)] bg-white" />
        <div className="h-80 animate-pulse rounded-[var(--so-radius-lg)] bg-white" />
      </div>
    </div>
  );
}

function DashboardError({error, retry}: {error: "login" | "unavailable"; retry: () => void}) {
  const t = useTranslations("Dashboard");
  return (
    <Card className="p-8 text-center sm:p-12">
      <p className="text-sm text-muted">
        {error === "login" ? t("loginRequired") : t("unavailable")}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        {error === "login" ? (
          <Link
            href="/login"
            className="inline-flex h-11 items-center gap-2 rounded-[var(--so-radius-sm)] bg-brand px-4 text-sm font-semibold text-white"
          >
            <LogIn className="size-4" /> {t("goToLogin")}
          </Link>
        ) : (
          <Button onClick={retry}>
            <RefreshCw className="size-4" /> {t("retry")}
          </Button>
        )}
      </div>
    </Card>
  );
}
