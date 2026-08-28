"use client";

import {CalendarClock, CheckCircle2, LoaderCircle, LogIn, RefreshCw, UserRound} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useCallback, useEffect, useMemo, useState} from "react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {PageHeader} from "@/components/ui/page-header";
import {Select} from "@/components/ui/select";
import {Link} from "@/i18n/navigation";
import {apiRequest, ServiceOpsApiError} from "@/lib/api-client";
import {
  getDemoCustomerKeyByName,
  getDemoServiceKey,
  getDemoStaffKey,
} from "@/lib/demo-localization";
import {
  bookingStatuses,
  bookingStatusTone,
  nextBookingStatuses,
  type BookingStatus,
  type StaffBookingRecord,
} from "@/lib/operations-types";

const organizationSlug = "demo-services";

export function StaffBookingBoard() {
  const t = useTranslations("StaffBookings");
  const bookingsT = useTranslations("Bookings");
  const demoT = useTranslations("DemoData");
  const locale = useLocale();
  const [bookings, setBookings] = useState<StaffBookingRecord[]>([]);
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"login" | "unavailable" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = status === "all" ? "" : `?status=${status}`;
      setBookings(
        await apiRequest<StaffBookingRecord[]>(
          `/api/v1/organizations/${organizationSlug}/staff/bookings${query}`,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof ServiceOpsApiError && [401, 403, 404].includes(caught.status)
          ? "login"
          : "unavailable",
      );
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    let active = true;
    async function loadInitial() {
      try {
        const query = status === "all" ? "" : `?status=${status}`;
        const rows = await apiRequest<StaffBookingRecord[]>(
          `/api/v1/organizations/${organizationSlug}/staff/bookings${query}`,
        );
        if (active) setBookings(rows);
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof ServiceOpsApiError && [401, 403, 404].includes(caught.status)
            ? "login"
            : "unavailable",
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadInitial();
    return () => {
      active = false;
    };
  }, [status]);

  async function changeStatus(booking: StaffBookingRecord, nextStatus: BookingStatus) {
    if (nextStatus === "cancelled" && !window.confirm(t("confirmCancel"))) return;
    setProcessingId(booking.id);
    setActionError(null);
    try {
      const updated = await apiRequest<StaffBookingRecord>(
        `/api/v1/organizations/${organizationSlug}/staff/bookings/${booking.id}/status`,
        {method: "PATCH", body: JSON.stringify({status: nextStatus})},
        {csrf: true},
      );
      setBookings((current) =>
        current.map((candidate) => (candidate.id === booking.id ? updated : candidate)),
      );
    } catch {
      setActionError(t("actionFailed"));
    } finally {
      setProcessingId(null);
    }
  }

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }),
    [locale],
  );
  const localizedCustomer = useCallback(
    (name: string) => {
      const key = getDemoCustomerKeyByName(name);
      return key ? demoT(`customers.${key}`) : name;
    },
    [demoT],
  );
  const localizedService = useCallback(
    (name: string) => {
      const key = getDemoServiceKey(name);
      return key ? bookingsT(`services.${key}`) : name;
    },
    [bookingsT],
  );
  const localizedStaff = useCallback(
    (name: string) => {
      const key = getDemoStaffKey(name);
      return key ? demoT(`staff.${key}`) : name;
    },
    [demoT],
  );
  const activeCount = bookings.filter((booking) =>
    ["confirmed", "in_progress"].includes(booking.status),
  ).length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> {t("refresh")}
          </Button>
        }
      />
      <section className="grid grid-cols-2 gap-3" aria-label={t("highlights")}>
        <Card className="p-5 shadow-none">
          <p className="text-xs text-muted">{t("assigned")}</p>
          <p className="mt-1 text-2xl font-bold text-brand">{bookings.length}</p>
        </Card>
        <Card className="p-5 shadow-none">
          <p className="text-xs text-muted">{t("active")}</p>
          <p className="mt-1 text-2xl font-bold text-sky-700">{activeCount}</p>
        </Card>
      </section>
      {actionError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {actionError}
        </p>
      ) : null}
      <Card className="overflow-hidden">
        <div className="border-b border-line p-4 sm:p-5">
          <label className="block max-w-xs">
            <span className="sr-only">{t("statusFilter")}</span>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as BookingStatus | "all")}
            >
              <option value="all">{t("allStatuses")}</option>
              {bookingStatuses.map((value) => (
                <option key={value} value={value}>
                  {bookingsT(`statuses.${value}`)}
                </option>
              ))}
            </Select>
          </label>
        </div>
        {loading ? (
          <p
            role="status"
            className="flex items-center justify-center gap-2 p-12 text-sm text-muted"
          >
            <LoaderCircle className="size-4 animate-spin" /> {t("loading")}
          </p>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-sm text-muted">
              {error === "login" ? t("loginRequired") : t("unavailable")}
            </p>
            {error === "login" ? (
              <Link
                href="/login"
                className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand"
              >
                <LogIn className="size-4" /> {t("goToLogin")}
              </Link>
            ) : null}
          </div>
        ) : bookings.length ? (
          <div className="divide-y divide-line">
            {bookings.map((booking) => (
              <article key={booking.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-subtle text-muted">
                      <UserRound className="size-4" />
                    </span>
                    <div>
                      <p className="font-bold">
                        {localizedCustomer(booking.customer_display_name)}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {localizedService(booking.service.name)} ·{" "}
                        {localizedStaff(booking.staff.display_name)}
                      </p>
                    </div>
                  </div>
                  <Badge tone={bookingStatusTone[booking.status]}>
                    {bookingsT(`statuses.${booking.status}`)}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-subtle p-3">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold">
                    <CalendarClock className="size-4 text-muted" />{" "}
                    {dateFormatter.format(new Date(booking.starts_at))}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {nextBookingStatuses[booking.status].map((nextStatus) => (
                      <Button
                        key={nextStatus}
                        size="sm"
                        variant={nextStatus === "cancelled" ? "ghost" : "secondary"}
                        disabled={processingId === booking.id}
                        onClick={() => void changeStatus(booking, nextStatus)}
                      >
                        <CheckCircle2 className="size-4" /> {t(`actions.${nextStatus}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="p-12 text-center text-sm text-muted">{t("empty")}</p>
        )}
      </Card>
    </div>
  );
}
