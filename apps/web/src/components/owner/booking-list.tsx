"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  LogIn,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  UserRoundCheck,
  X,
} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {LocalizedDatePicker} from "@/components/ui/localized-date-picker";
import {PageHeader} from "@/components/ui/page-header";
import {Select} from "@/components/ui/select";
import {Link} from "@/i18n/navigation";
import {apiRequest, downloadApiFile, ServiceOpsApiError} from "@/lib/api-client";
import {getDemoCustomerKey, getDemoServiceKey, getDemoStaffKey} from "@/lib/demo-localization";
import {
  bookingStatuses,
  bookingStatusTone,
  nextBookingStatuses,
  type BookingStatus,
  type OwnerBookingPageRecord,
  type OwnerBookingRecord,
  type OwnerBookingSort,
  type ServiceRecord,
  type StaffProfileRecord,
} from "@/lib/operations-types";
import {useModalFocus} from "@/lib/use-modal-focus";

type Status = BookingStatus;
type BookingRecord = OwnerBookingRecord;

const organizationSlug = "demo-services";
const pageSize = 10;

function paginationItems(currentPage: number, pageCount: number) {
  const pages = [...new Set([1, currentPage - 1, currentPage, currentPage + 1, pageCount])]
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((left, right) => left - right);
  return pages.flatMap<number | string>((page, index) => {
    const previous = pages[index - 1];
    return index > 0 && previous !== undefined && page - previous > 1
      ? [`ellipsis-${previous}`, page]
      : [page];
  });
}

export function BookingList() {
  const t = useTranslations("Bookings");
  const demoT = useTranslations("DemoData");
  const locale = useLocale();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState<Status | "all">("all");
  const [service, setService] = useState("all");
  const [date, setDate] = useState("");
  const [sort, setSort] = useState<OwnerBookingSort>("starts_at_desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({
    today_count: 0,
    requested_count: 0,
    upcoming_count: 0,
  });
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"login" | "unavailable" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingBookingId, setProcessingBookingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [staffOptions, setStaffOptions] = useState<StaffProfileRecord[]>([]);
  const [editStaffId, setEditStaffId] = useState("");
  const [editNote, setEditNote] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const requestIdRef = useRef(0);
  const detailsDialogRef = useModalFocus<HTMLElement>(Boolean(selectedBooking), () => {
    if (!savingDetails) setSelectedBooking(null);
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let active = true;
    void apiRequest<ServiceRecord[]>(`/api/v1/organizations/${organizationSlug}/owner/services`)
      .then((data) => {
        if (active) setServices(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const loadBookings = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String((page - 1) * pageSize),
      sort,
    });
    if (debouncedQuery) params.set("query", debouncedQuery);
    if (status !== "all") params.set("status", status);
    if (service !== "all") params.set("service_id", service);
    if (date) {
      params.set("date_from", date);
      params.set("date_to", date);
    }
    try {
      const data = await apiRequest<OwnerBookingPageRecord>(
        `/api/v1/organizations/${organizationSlug}/owner/bookings?${params.toString()}`,
      );
      if (requestId !== requestIdRef.current) return;
      setBookings(data.items);
      setTotal(data.total);
      setSummary(data.summary);
      const resolvedPageCount = Math.max(1, Math.ceil(data.total / pageSize));
      if (page > resolvedPageCount) setPage(resolvedPageCount);
    } catch (caught) {
      if (requestId !== requestIdRef.current) return;
      setError(
        caught instanceof ServiceOpsApiError && [401, 403].includes(caught.status)
          ? "login"
          : "unavailable",
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [date, debouncedQuery, page, service, sort, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadBookings(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadBookings]);

  const localizedServiceName = useCallback(
    (name: string) => {
      const key = getDemoServiceKey(name);
      return key ? t(`services.${key}`) : name;
    },
    [t],
  );
  const localizedStaffName = useCallback(
    (name: string) => {
      const key = getDemoStaffKey(name);
      return key ? demoT(`staff.${key}`) : name;
    },
    [demoT],
  );
  const localizedCustomerName = useCallback(
    (booking: BookingRecord) => {
      const key = getDemoCustomerKey(booking.customer_email);
      return key ? demoT(`customers.${key}`) : booking.customer_display_name;
    },
    [demoT],
  );

  const serviceOptions = useMemo(() => {
    return services
      .map((item) => [item.id, localizedServiceName(item.name)] as const)
      .sort((left, right) => left[1].localeCompare(right[1], locale));
  }, [locale, localizedServiceName, services]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: "Asia/Seoul",
        month: "short",
        day: "numeric",
        weekday: "short",
      }),
    [locale],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [locale],
  );

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const visiblePageItems = useMemo(() => paginationItems(page, pageCount), [page, pageCount]);

  function resetFilters() {
    setQuery("");
    setDebouncedQuery("");
    setStatus("all");
    setService("all");
    setDate("");
    setSort("starts_at_desc");
    setPage(1);
  }

  async function changeStatus(booking: BookingRecord, nextStatus: Status) {
    if (nextStatus === "cancelled" && !window.confirm(t("confirmCancel"))) return;
    setProcessingBookingId(booking.id);
    setActionError(null);
    try {
      const updated = await apiRequest<BookingRecord>(
        `/api/v1/organizations/${organizationSlug}/owner/bookings/${booking.id}/status`,
        {method: "PATCH", body: JSON.stringify({status: nextStatus})},
        {csrf: true},
      );
      setBookings((current) =>
        current.map((candidate) => (candidate.id === booking.id ? updated : candidate)),
      );
      await loadBookings();
    } catch {
      setActionError(t("actionFailed"));
    } finally {
      setProcessingBookingId(null);
    }
  }

  async function exportCsv() {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (service !== "all") params.set("service_id", service);
    if (date) {
      params.set("date_from", date);
      params.set("date_to", date);
    }
    if (query.trim()) params.set("query", query.trim());
    params.set("sort", sort);
    setExporting(true);
    setActionError(null);
    try {
      const queryString = params.size ? `?${params.toString()}` : "";
      await downloadApiFile(
        `/api/v1/organizations/${organizationSlug}/owner/bookings/export${queryString}`,
        "serviceops-bookings.csv",
      );
    } catch {
      setActionError(t("exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  async function openDetails(booking: BookingRecord) {
    setSelectedBooking(booking);
    setEditStaffId(booking.staff.id);
    setEditNote(booking.internal_note ?? "");
    setActionError(null);
    try {
      setStaffOptions(
        await apiRequest<StaffProfileRecord[]>(
          `/api/v1/organizations/${organizationSlug}/owner/staff`,
        ),
      );
    } catch {
      setActionError(t("detailFailed"));
    }
  }

  async function saveDetails() {
    if (!selectedBooking) return;
    setSavingDetails(true);
    setActionError(null);
    try {
      const updated = await apiRequest<BookingRecord>(
        `/api/v1/organizations/${organizationSlug}/owner/bookings/${selectedBooking.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({staff_profile_id: editStaffId, internal_note: editNote}),
        },
        {csrf: true},
      );
      setBookings((current) =>
        current.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
      );
      setSelectedBooking(null);
    } catch {
      setActionError(t("saveFailed"));
    } finally {
      setSavingDetails(false);
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void exportCsv()} disabled={exporting}>
              <Download className="size-4" /> {exporting ? t("exporting") : t("exportCsv")}
            </Button>
            <Button onClick={() => void loadBookings()} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              {t("refresh")}
            </Button>
          </div>
        }
      />

      {actionError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {actionError}
        </p>
      ) : null}

      <section aria-label={t("highlights")} className="grid grid-cols-3 gap-3">
        <MiniMetric label={t("today")} value={String(summary.today_count)} accent="text-brand" />
        <MiniMetric
          label={t("awaitingConfirmation")}
          value={String(summary.requested_count)}
          accent="text-amber-600"
        />
        <MiniMetric
          label={t("upcoming")}
          value={String(summary.upcoming_count)}
          accent="text-sky-700"
        />
      </section>

      <Card className="overflow-hidden">
        <div className="border-b border-line bg-white p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_150px_160px_160px_150px_auto]">
            <label className="relative block">
              <span className="sr-only">{t("searchLabel")}</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                maxLength={200}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder={t("searchPlaceholder")}
                className="pl-9"
              />
            </label>
            <label>
              <span className="sr-only">{t("statusLabel")}</span>
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as Status | "all");
                  setPage(1);
                }}
              >
                <option value="all">{t("allStatuses")}</option>
                {bookingStatuses.map((value) => (
                  <option key={value} value={value}>
                    {t(`statuses.${value}`)}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="sr-only">{t("serviceLabel")}</span>
              <Select
                value={service}
                onChange={(event) => {
                  setService(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">{t("allServices")}</option>
                {serviceOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </label>
            <LocalizedDatePicker
              value={date}
              onChange={(value) => {
                setDate(value);
                setPage(1);
              }}
              locale={locale}
              label={t("dateLabel")}
              placeholder={t("datePlaceholder")}
              clearLabel={t("clearDate")}
              previousMonthLabel={t("previousMonth")}
              nextMonthLabel={t("nextMonth")}
            />
            <label>
              <span className="sr-only">{t("sortLabel")}</span>
              <Select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as OwnerBookingSort);
                  setPage(1);
                }}
              >
                <option value="starts_at_desc">{t("sortNewest")}</option>
                <option value="starts_at_asc">{t("sortOldest")}</option>
              </Select>
            </label>
            <Button variant="ghost" onClick={resetFilters} className="xl:px-3">
              <RotateCcw className="size-4" /> {t("reset")}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-line bg-[#fbfcfb] px-4 py-3 sm:px-5">
          <p role="status" className="text-xs font-semibold text-muted">
            {t("results", {count: total})}
          </p>
          <span className="text-[0.68rem] text-muted">UTC+09:00 · Asia/Seoul</span>
        </div>

        {loading ? (
          <p
            className="flex items-center justify-center gap-2 p-12 text-sm text-muted"
            role="status"
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
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-[0.7rem] font-bold tracking-[0.08em] text-muted uppercase">
                    <th className="px-5 py-3">{t("customer")}</th>
                    <th className="px-4 py-3">{t("schedule")}</th>
                    <th className="px-4 py-3">{t("serviceLabel")}</th>
                    <th className="px-4 py-3">{t("staff")}</th>
                    <th className="px-4 py-3">{t("status")}</th>
                    <th className="w-14 px-4 py-3">
                      <span className="sr-only">{t("more")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr
                      key={booking.id}
                      className="border-b border-line last:border-0 hover:bg-subtle/45"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                            {localizedCustomerName(booking).slice(0, 1)}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-ink">
                              {localizedCustomerName(booking)}
                            </p>
                            <p className="mt-0.5 text-[0.7rem] text-muted">
                              {booking.customer_email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold">
                          {dateFormatter.format(new Date(booking.starts_at))}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {timeFormatter.format(new Date(booking.starts_at))}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {localizedServiceName(booking.service.name)}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-2 text-sm text-ink">
                          <UserRoundCheck className="size-4 text-muted" />{" "}
                          {localizedStaffName(booking.staff.display_name)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={bookingStatusTone[booking.status]}>
                          {t(`statuses.${booking.status}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void openDetails(booking)}
                            aria-label={`${localizedCustomerName(booking)} ${t("manage")}`}
                            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-ink"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                          {nextBookingStatuses[booking.status].length ? (
                            <Select
                              value=""
                              aria-label={`${localizedCustomerName(booking)} ${t("statusAction")}`}
                              disabled={processingBookingId === booking.id}
                              onChange={(event) =>
                                void changeStatus(booking, event.target.value as Status)
                              }
                              className="h-9 min-w-32 text-xs"
                            >
                              <option value="">{t("statusAction")}</option>
                              {nextBookingStatuses[booking.status].map((nextStatus) => (
                                <option key={nextStatus} value={nextStatus}>
                                  {t(`actions.${nextStatus}`)}
                                </option>
                              ))}
                            </Select>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-line md:hidden">
              {bookings.map((booking) => (
                <article key={booking.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{localizedCustomerName(booking)}</p>
                      <p className="mt-1 text-xs text-muted">
                        {localizedServiceName(booking.service.name)}
                      </p>
                    </div>
                    <Badge tone={bookingStatusTone[booking.status]}>
                      {t(`statuses.${booking.status}`)}
                    </Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-subtle p-3 text-xs">
                    <div>
                      <p className="text-muted">{t("schedule")}</p>
                      <p className="mt-1 font-semibold">
                        {dateFormatter.format(new Date(booking.starts_at))} ·{" "}
                        {timeFormatter.format(new Date(booking.starts_at))}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted">{t("staff")}</p>
                      <p className="mt-1 font-semibold">
                        {localizedStaffName(booking.staff.display_name)}
                      </p>
                    </div>
                  </div>
                  {nextBookingStatuses[booking.status].length ? (
                    <Select
                      value=""
                      aria-label={`${localizedCustomerName(booking)} ${t("statusAction")}`}
                      disabled={processingBookingId === booking.id}
                      onChange={(event) => void changeStatus(booking, event.target.value as Status)}
                      className="mt-3"
                    >
                      <option value="">{t("statusAction")}</option>
                      {nextBookingStatuses[booking.status].map((nextStatus) => (
                        <option key={nextStatus} value={nextStatus}>
                          {t(`actions.${nextStatus}`)}
                        </option>
                      ))}
                    </Select>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void openDetails(booking)}
                    className="mt-2 w-full"
                  >
                    <MoreHorizontal className="size-4" /> {t("manage")}
                  </Button>
                </article>
              ))}
            </div>

            {bookings.length === 0 ? (
              <p className="p-12 text-center text-sm text-muted">{t("empty")}</p>
            ) : null}

            {bookings.length > 0 ? (
              <nav
                aria-label={t("pagination")}
                className="flex flex-col items-center justify-between gap-3 border-t border-line bg-[#fbfcfb] px-4 py-4 sm:flex-row sm:px-5"
              >
                <p className="text-xs font-semibold text-muted">
                  {t("pageStatus", {page, pages: pageCount})}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1 || loading}
                    aria-label={t("previousPage")}
                    className="px-2.5"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  {visiblePageItems.map((item) =>
                    typeof item === "number" ? (
                      <Button
                        key={item}
                        variant={item === page ? "primary" : "ghost"}
                        size="sm"
                        onClick={() => setPage(item)}
                        disabled={loading}
                        aria-current={item === page ? "page" : undefined}
                        aria-label={t("goToPage", {page: item})}
                        className="min-w-9 px-2.5"
                      >
                        {item}
                      </Button>
                    ) : (
                      <span key={item} aria-hidden="true" className="px-1 text-sm text-muted">
                        …
                      </span>
                    ),
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                    disabled={page === pageCount || loading}
                    aria-label={t("nextPage")}
                    className="px-2.5"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </nav>
            ) : null}
          </>
        )}
      </Card>

      {selectedBooking ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            aria-label={t("closeDetails")}
            onClick={() => setSelectedBooking(null)}
            tabIndex={-1}
          />
          <section
            ref={detailsDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-details-title"
            tabIndex={-1}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.08em] text-brand uppercase">
                  {t("manageEyebrow")}
                </p>
                <h2 id="booking-details-title" className="mt-1 text-xl font-bold">
                  {localizedCustomerName(selectedBooking)}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {localizedServiceName(selectedBooking.service.name)} ·{" "}
                  {dateFormatter.format(new Date(selectedBooking.starts_at))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                aria-label={t("closeDetails")}
                className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-subtle"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-muted">
                  {t("assignedStaff")}
                </span>
                <Select
                  value={editStaffId}
                  onChange={(event) => setEditStaffId(event.target.value)}
                >
                  {staffOptions
                    .filter(
                      (member) =>
                        member.is_active && member.service_ids.includes(selectedBooking.service.id),
                    )
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {localizedStaffName(member.display_name)}
                      </option>
                    ))}
                </Select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-muted">{t("internalNote")}</span>
                <textarea
                  value={editNote}
                  onChange={(event) => setEditNote(event.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="w-full resize-y rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                  placeholder={t("internalNotePlaceholder")}
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelectedBooking(null)}>
                {t("close")}
              </Button>
              <Button onClick={() => void saveDetails()} disabled={savingDetails || !editStaffId}>
                {savingDetails ? t("saving") : t("save")}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function MiniMetric({label, value, accent}: {label: string; value: string; accent: string}) {
  return (
    <Card className="px-4 py-4 shadow-none sm:px-5">
      <p className="truncate text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-[-0.04em] ${accent}`}>{value}</p>
    </Card>
  );
}
