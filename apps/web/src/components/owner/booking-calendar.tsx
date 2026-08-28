"use client";

import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  LogIn,
  RefreshCw,
  RotateCcw,
  UserRoundCheck,
} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useCallback, useEffect, useMemo, useState} from "react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {PageHeader} from "@/components/ui/page-header";
import {Select} from "@/components/ui/select";
import {Link} from "@/i18n/navigation";
import {apiRequest, ServiceOpsApiError} from "@/lib/api-client";
import {getDemoCustomerKey, getDemoServiceKey, getDemoStaffKey} from "@/lib/demo-localization";
import {
  bookingStatuses,
  bookingStatusTone,
  type BookingStatus,
  type OwnerBookingPageRecord,
  type OwnerBookingRecord,
  type ServiceRecord,
  type StaffProfileRecord,
} from "@/lib/operations-types";

const organizationSlug = "demo-services";
const calendarPageSize = 100;

async function loadAllCalendarBookings(params: URLSearchParams) {
  const rows: OwnerBookingRecord[] = [];
  let offset = 0;
  let total = 0;
  do {
    const pageParams = new URLSearchParams(params);
    pageParams.set("limit", String(calendarPageSize));
    pageParams.set("offset", String(offset));
    pageParams.set("sort", "starts_at_asc");
    const page = await apiRequest<OwnerBookingPageRecord>(
      `/api/v1/organizations/${organizationSlug}/owner/bookings?${pageParams.toString()}`,
    );
    rows.push(...page.items);
    total = page.total;
    if (page.items.length === 0) break;
    offset += page.items.length;
  } while (offset < total);
  return rows;
}

function seoulDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function formatDateKey(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthBounds(month: Date) {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const start = new Date(Date.UTC(year, monthIndex, 1, 12));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0, 12));
  return {start: formatDateKey(start), end: formatDateKey(end)};
}

function calendarDays(month: Date) {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const first = new Date(Date.UTC(year, monthIndex, 1, 12));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - mondayOffset);
  return Array.from({length: 42}, (_, index) => {
    const value = new Date(gridStart);
    value.setUTCDate(gridStart.getUTCDate() + index);
    return {
      key: formatDateKey(value),
      date: value,
      currentMonth: value.getUTCMonth() === monthIndex,
    };
  });
}

export function BookingCalendar() {
  const t = useTranslations("Calendar");
  const bookingsT = useTranslations("Bookings");
  const demoT = useTranslations("DemoData");
  const locale = useLocale();
  const todayKey = seoulDateKey(new Date());
  const [month, setMonth] = useState(() => {
    const today = parseDateKey(todayKey);
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12));
  });
  const [bookings, setBookings] = useState<OwnerBookingRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [staff, setStaff] = useState<StaffProfileRecord[]>([]);
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [serviceId, setServiceId] = useState("all");
  const [staffId, setStaffId] = useState("all");
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedBooking, setSelectedBooking] = useState<OwnerBookingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"login" | "unavailable" | null>(null);

  const bounds = useMemo(() => monthBounds(month), [month]);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({date_from: bounds.start, date_to: bounds.end});
    if (status !== "all") params.set("status", status);
    if (serviceId !== "all") params.set("service_id", serviceId);
    if (staffId !== "all") params.set("staff_profile_id", staffId);
    try {
      const [bookingData, serviceData, staffData] = await Promise.all([
        loadAllCalendarBookings(params),
        services.length
          ? Promise.resolve(services)
          : apiRequest<ServiceRecord[]>(`/api/v1/organizations/${organizationSlug}/owner/services`),
        staff.length
          ? Promise.resolve(staff)
          : apiRequest<StaffProfileRecord[]>(
              `/api/v1/organizations/${organizationSlug}/owner/staff`,
            ),
      ]);
      setBookings(bookingData);
      setServices(serviceData);
      setStaff(staffData);
      setSelectedBooking((current) =>
        current ? (bookingData.find((booking) => booking.id === current.id) ?? null) : null,
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
  }, [bounds.end, bounds.start, serviceId, services, staff, staffId, status]);

  useEffect(() => {
    let active = true;
    async function load() {
      const params = new URLSearchParams({date_from: bounds.start, date_to: bounds.end});
      if (status !== "all") params.set("status", status);
      if (serviceId !== "all") params.set("service_id", serviceId);
      if (staffId !== "all") params.set("staff_profile_id", staffId);
      try {
        const [bookingData, serviceData, staffData] = await Promise.all([
          loadAllCalendarBookings(params),
          services.length
            ? Promise.resolve(services)
            : apiRequest<ServiceRecord[]>(
                `/api/v1/organizations/${organizationSlug}/owner/services`,
              ),
          staff.length
            ? Promise.resolve(staff)
            : apiRequest<StaffProfileRecord[]>(
                `/api/v1/organizations/${organizationSlug}/owner/staff`,
              ),
        ]);
        if (!active) return;
        setBookings(bookingData);
        setServices(serviceData);
        setStaff(staffData);
        setSelectedBooking((current) =>
          current ? (bookingData.find((booking) => booking.id === current.id) ?? null) : null,
        );
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
  }, [bounds.end, bounds.start, serviceId, services, staff, staffId, status]);

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

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, {year: "numeric", month: "long", timeZone: "UTC"}),
    [locale],
  );
  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "long",
        day: "numeric",
        weekday: "long",
        timeZone: "UTC",
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

  const byDate = useMemo(() => {
    const grouped = new Map<string, OwnerBookingRecord[]>();
    for (const booking of [...bookings].sort(
      (left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
    )) {
      const key = seoulDateKey(booking.starts_at);
      grouped.set(key, [...(grouped.get(key) ?? []), booking]);
    }
    return grouped;
  }, [bookings]);
  const grid = useMemo(() => calendarDays(month), [month]);
  const selectedDayBookings = byDate.get(selectedDate) ?? [];

  function moveMonth(offset: number) {
    const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + offset, 1, 12));
    setMonth(next);
    setSelectedDate(formatDateKey(next));
    setSelectedBooking(null);
    setLoading(true);
    setError(null);
  }

  function goToday() {
    const today = parseDateKey(todayKey);
    setMonth(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12)));
    setSelectedDate(todayKey);
    setSelectedBooking(null);
    setLoading(true);
    setError(null);
  }

  function resetFilters() {
    setLoading(true);
    setError(null);
    setStatus("all");
    setServiceId("all");
    setStaffId("all");
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={goToday}>
              {t("today")}
            </Button>
            <Button
              onClick={() => void loadCalendar()}
              disabled={loading}
              aria-label={t("refresh")}
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{t("refresh")}</span>
            </Button>
          </div>
        }
      />

      <Card className="overflow-hidden">
        <div className="border-b border-line p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
            <label>
              <span className="sr-only">{t("statusFilter")}</span>
              <Select
                aria-label={t("statusFilter")}
                value={status}
                onChange={(event) => {
                  setLoading(true);
                  setStatus(event.target.value as BookingStatus | "all");
                }}
              >
                <option value="all">{t("allStatuses")}</option>
                {bookingStatuses.map((value) => (
                  <option key={value} value={value}>
                    {bookingsT(`statuses.${value}`)}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="sr-only">{t("serviceFilter")}</span>
              <Select
                aria-label={t("serviceFilter")}
                value={serviceId}
                onChange={(event) => {
                  setLoading(true);
                  setServiceId(event.target.value);
                }}
              >
                <option value="all">{t("allServices")}</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {localService(service.name)}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="sr-only">{t("staffFilter")}</span>
              <Select
                aria-label={t("staffFilter")}
                value={staffId}
                onChange={(event) => {
                  setLoading(true);
                  setStaffId(event.target.value);
                }}
              >
                <option value="all">{t("allStaff")}</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {localStaff(member.display_name)}
                  </option>
                ))}
              </Select>
            </label>
            <Button variant="ghost" onClick={resetFilters}>
              <RotateCcw className="size-4" /> {t("reset")}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-line bg-[#fbfcfb] px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            aria-label={t("previousMonth")}
            className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-ink"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h2 className="font-bold tracking-[-0.02em]">{monthFormatter.format(month)}</h2>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            aria-label={t("nextMonth")}
            className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-ink"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {error ? (
          <CalendarError error={error} retry={() => void loadCalendar()} />
        ) : (
          <div className="grid xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="min-w-0 xl:border-r xl:border-line">
              <div className="hidden md:block">
                <div className="grid grid-cols-7 border-b border-line bg-white text-center text-[0.68rem] font-bold tracking-[0.08em] text-muted uppercase">
                  {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((day) => (
                    <div key={day} className="py-3">
                      {t(`weekdays.${day}`)}
                    </div>
                  ))}
                </div>
                <div
                  className="grid grid-cols-7 bg-line/70 gap-px"
                  aria-label={t("monthGrid", {month: monthFormatter.format(month)})}
                >
                  {grid.map((day) => {
                    const dayBookings = byDate.get(day.key) ?? [];
                    const selected = day.key === selectedDate;
                    return (
                      <div
                        key={day.key}
                        className={`min-h-32 bg-white p-2 ${day.currentMonth ? "" : "bg-[#fafbfa] text-muted"}`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate(day.key);
                            setSelectedBooking(dayBookings[0] ?? null);
                          }}
                          aria-label={dayFormatter.format(day.date)}
                          aria-current={day.key === todayKey ? "date" : undefined}
                          aria-pressed={selected}
                          className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${day.key === todayKey ? "bg-brand text-white" : selected ? "bg-brand-soft text-brand" : "hover:bg-subtle"}`}
                        >
                          {day.date.getUTCDate()}
                        </button>
                        <div className="mt-1 space-y-1">
                          {dayBookings.slice(0, 3).map((booking) => (
                            <button
                              type="button"
                              key={booking.id}
                              onClick={() => {
                                setSelectedDate(day.key);
                                setSelectedBooking(booking);
                              }}
                              className="block w-full truncate rounded-md border-l-2 border-brand bg-brand-soft/55 px-2 py-1 text-left text-[0.68rem] font-semibold hover:bg-brand-soft"
                              title={`${timeFormatter.format(new Date(booking.starts_at))} · ${localCustomer(booking)}`}
                            >
                              {timeFormatter.format(new Date(booking.starts_at))} ·{" "}
                              {localCustomer(booking)}
                            </button>
                          ))}
                          {dayBookings.length > 3 ? (
                            <button
                              type="button"
                              onClick={() => setSelectedDate(day.key)}
                              className="px-2 text-[0.65rem] font-bold text-brand"
                            >
                              {t("more", {count: dayBookings.length - 3})}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="divide-y divide-line md:hidden">
                {loading ? (
                  <p
                    className="flex items-center justify-center gap-2 p-12 text-sm text-muted"
                    role="status"
                  >
                    <LoaderCircle className="size-4 animate-spin" /> {t("loading")}
                  </p>
                ) : byDate.size ? (
                  [...byDate.entries()].map(([key, dayBookings]) => (
                    <section key={key} className="p-4">
                      <h3 className="text-sm font-bold">
                        {dayFormatter.format(parseDateKey(key))}
                      </h3>
                      <ul className="mt-3 space-y-2">
                        {dayBookings.map((booking) => (
                          <li key={booking.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDate(key);
                                setSelectedBooking(booking);
                              }}
                              className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-brand/30 hover:bg-brand-soft/30"
                            >
                              <time className="w-16 shrink-0 text-sm font-bold text-brand">
                                {timeFormatter.format(new Date(booking.starts_at))}
                              </time>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">
                                  {localCustomer(booking)}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-muted">
                                  {localService(booking.service.name)}
                                </span>
                              </span>
                              <ChevronRight className="size-4 text-muted" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))
                ) : (
                  <EmptyCalendar />
                )}
              </div>
            </div>

            <aside className="border-t border-line bg-[#fbfcfb] p-5 xl:border-t-0">
              <p className="text-xs font-bold tracking-[0.12em] text-brand uppercase">
                {t("selectedDay")}
              </p>
              <h2 className="mt-2 font-bold">{dayFormatter.format(parseDateKey(selectedDate))}</h2>
              {loading ? (
                <p className="mt-8 flex items-center gap-2 text-sm text-muted" role="status">
                  <LoaderCircle className="size-4 animate-spin" /> {t("loading")}
                </p>
              ) : selectedBooking ? (
                <BookingDetail
                  booking={selectedBooking}
                  localCustomer={localCustomer}
                  localService={localService}
                  localStaff={localStaff}
                  timeFormatter={timeFormatter}
                />
              ) : selectedDayBookings.length ? (
                <div className="mt-5 space-y-2">
                  {selectedDayBookings.map((booking) => (
                    <button
                      type="button"
                      key={booking.id}
                      onClick={() => setSelectedBooking(booking)}
                      className="w-full rounded-xl border border-line bg-white p-3 text-left hover:border-brand/30"
                    >
                      <span className="text-sm font-bold text-brand">
                        {timeFormatter.format(new Date(booking.starts_at))}
                      </span>
                      <span className="mt-1 block truncate text-sm font-semibold">
                        {localCustomer(booking)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-8 text-sm leading-6 text-muted">{t("noBookingsForDay")}</p>
              )}
            </aside>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between text-[0.7rem] text-muted">
        <span>{t("results", {count: bookings.length})}</span>
        <span>Asia/Seoul · UTC+09:00</span>
      </div>
    </div>
  );
}

function BookingDetail({
  booking,
  localCustomer,
  localService,
  localStaff,
  timeFormatter,
}: {
  booking: OwnerBookingRecord;
  localCustomer: (booking: OwnerBookingRecord) => string;
  localService: (name: string) => string;
  localStaff: (name: string) => string;
  timeFormatter: Intl.DateTimeFormat;
}) {
  const t = useTranslations("Calendar");
  const bookingsT = useTranslations("Bookings");
  return (
    <div className="mt-5 rounded-xl border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <time className="text-lg font-bold text-brand" dateTime={booking.starts_at}>
          {timeFormatter.format(new Date(booking.starts_at))}
        </time>
        <Badge tone={bookingStatusTone[booking.status]}>
          {bookingsT(`statuses.${booking.status}`)}
        </Badge>
      </div>
      <h3 className="mt-4 font-bold">{localCustomer(booking)}</h3>
      <p className="mt-1 text-xs text-muted">{booking.customer_email}</p>
      <dl className="mt-5 space-y-3 text-sm">
        <div>
          <dt className="text-xs font-semibold text-muted">{t("service")}</dt>
          <dd className="mt-1 font-semibold">{localService(booking.service.name)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted">{t("staff")}</dt>
          <dd className="mt-1 flex items-center gap-2 font-semibold">
            <UserRoundCheck className="size-4 text-brand" />{" "}
            {localStaff(booking.staff.display_name)}
          </dd>
        </div>
        {booking.internal_note ? (
          <div>
            <dt className="text-xs font-semibold text-muted">{t("internalNote")}</dt>
            <dd className="mt-1 leading-6 text-muted">{booking.internal_note}</dd>
          </div>
        ) : null}
      </dl>
      <Link
        href="/owner/bookings"
        className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand"
      >
        {t("manageBooking")} <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

function EmptyCalendar() {
  const t = useTranslations("Calendar");
  return (
    <div className="p-10 text-center">
      <CalendarDays className="mx-auto size-8 text-brand" />
      <h3 className="mt-4 font-bold">{t("emptyTitle")}</h3>
      <p className="mt-2 text-sm text-muted">{t("emptyBody")}</p>
    </div>
  );
}

function CalendarError({error, retry}: {error: "login" | "unavailable"; retry: () => void}) {
  const t = useTranslations("Calendar");
  return (
    <div className="p-10 text-center sm:p-14">
      <p className="text-sm text-muted">
        {error === "login" ? t("loginRequired") : t("unavailable")}
      </p>
      {error === "login" ? (
        <Link
          href="/login"
          className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand"
        >
          <LogIn className="size-4" /> {t("goToLogin")}
        </Link>
      ) : (
        <Button onClick={retry} className="mt-5">
          <RefreshCw className="size-4" /> {t("retry")}
        </Button>
      )}
    </div>
  );
}
