"use client";

import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Dumbbell,
  LoaderCircle,
  LogIn,
  MapPin,
  Menu,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useCallback, useEffect, useMemo, useState} from "react";
import {BrandMark} from "@/components/brand-mark";
import {LanguageSwitcher} from "@/components/language-switcher";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Link} from "@/i18n/navigation";
import {apiRequest, ServiceOpsApiError} from "@/lib/api-client";
import {getDemoServiceKey, getDemoStaffKey} from "@/lib/demo-localization";

type ServiceRecord = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_display_cents: number | null;
  is_active: boolean;
};

type SlotRecord = {
  staff_profile_id: string;
  staff_display_name: string;
  starts_at: string;
  ends_at: string;
};

type BookingRecord = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "requested" | "confirmed" | "in_progress" | "completed" | "cancelled";
  cancelled_at: string | null;
  service: {
    id: string;
    name: string;
    duration_minutes: number;
    price_display_cents: number | null;
  };
  staff: {id: string; display_name: string};
};

const organizationSlug = "demo-services";
const serviceIcons = [Sparkles, Wrench, Dumbbell] as const;
const serviceTones = [
  "bg-emerald-50 text-emerald-700",
  "bg-sky-50 text-sky-700",
  "bg-amber-50 text-amber-700",
] as const;

function toDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function organizationDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+09:00`);
}

export function CustomerBooking() {
  const t = useTranslations("Booking");
  const statusT = useTranslations("Bookings.statuses");
  const demoT = useTranslations("DemoData");
  const common = useTranslations("Common");
  const locale = useLocale();
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [dateKey, setDateKey] = useState(() => toDateKey(new Date(Date.now() + 86400000)));
  const [slots, setSlots] = useState<SlotRecord[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotRecord | null>(null);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const dates = useMemo(
    () =>
      Array.from({length: 7}, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() + index + 1);
        return toDateKey(date);
      }),
    [],
  );
  const selectedService = services.find((service) => service.id === serviceId) ?? null;

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: "Asia/Seoul",
        month: "long",
        day: "numeric",
        weekday: "short",
      }),
    [locale],
  );
  const compactDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: "Asia/Seoul",
        weekday: "short",
      }),
    [locale],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: "Asia/Seoul",
        month: "short",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
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
  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "KRW",
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const loadBookings = useCallback(async () => {
    try {
      const data = await apiRequest<BookingRecord[]>(
        `/api/v1/organizations/${organizationSlug}/bookings`,
      );
      setBookings(data);
      setAuthenticated(true);
    } catch (caught) {
      if (caught instanceof ServiceOpsApiError && [401, 403].includes(caught.status)) {
        setBookings([]);
        setAuthenticated(false);
        return;
      }
      setError(t("errors.unavailable"));
    }
  }, [t]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await apiRequest<ServiceRecord[]>(
          `/api/v1/organizations/${organizationSlug}/services`,
          {},
          {retryAuth: false},
        );
        if (!active) return;
        setServices(data);
        setServiceId((current) => current || data[0]?.id || "");
      } catch {
        if (active) setError(t("errors.unavailable"));
      } finally {
        if (active) setLoadingServices(false);
      }
    }
    async function loadOwnBookings() {
      try {
        const data = await apiRequest<BookingRecord[]>(
          `/api/v1/organizations/${organizationSlug}/bookings`,
        );
        if (!active) return;
        setBookings(data);
        setAuthenticated(true);
      } catch (caught) {
        if (!active) return;
        if (caught instanceof ServiceOpsApiError && [401, 403].includes(caught.status)) {
          setBookings([]);
          setAuthenticated(false);
          return;
        }
        setError(t("errors.unavailable"));
      }
    }
    void load();
    void loadOwnBookings();
    return () => {
      active = false;
    };
  }, [loadBookings, t]);

  useEffect(() => {
    if (!serviceId) return;
    let active = true;
    async function load() {
      setLoadingSlots(true);
      setSelectedSlot(null);
      try {
        const params = new URLSearchParams({
          service_id: serviceId,
          date_from: dateKey,
          date_to: dateKey,
        });
        const data = await apiRequest<SlotRecord[]>(
          `/api/v1/organizations/${organizationSlug}/slots?${params.toString()}`,
          {},
          {retryAuth: false},
        );
        if (active) setSlots(data);
      } catch {
        if (active) {
          setSlots([]);
          setError(t("errors.unavailable"));
        }
      } finally {
        if (active) setLoadingSlots(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [dateKey, serviceId, t]);

  function localizedApiError(caught: unknown) {
    if (!(caught instanceof ServiceOpsApiError)) return t("errors.unavailable");
    if (caught.status === 401 || caught.status === 403) return t("errors.loginRequired");
    if (caught.code === "booking_conflict") return t("errors.bookingConflict");
    if (caught.code === "staff_unavailable") return t("errors.staffUnavailable");
    return t("errors.requestFailed");
  }

  function localizedServiceName(name: string) {
    const key = getDemoServiceKey(name);
    return key ? t(`services.${key}.name`) : name;
  }

  function localizedServiceDescription(service: ServiceRecord) {
    const key = getDemoServiceKey(service.name);
    return key ? t(`services.${key}.description`) : service.description;
  }

  function localizedStaffName(name: string) {
    const key = getDemoStaffKey(name);
    return key ? demoT(`staff.${key}`) : name;
  }

  async function submitBooking() {
    if (!selectedService || !selectedSlot) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      if (reschedulingId) {
        await apiRequest<BookingRecord>(
          `/api/v1/organizations/${organizationSlug}/bookings/${reschedulingId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              staff_profile_id: selectedSlot.staff_profile_id,
              starts_at: selectedSlot.starts_at,
            }),
          },
          {csrf: true},
        );
        setMessage(t("rescheduledTitle"));
        setReschedulingId(null);
      } else {
        await apiRequest<BookingRecord>(
          `/api/v1/organizations/${organizationSlug}/bookings`,
          {
            method: "POST",
            body: JSON.stringify({
              service_id: selectedService.id,
              staff_profile_id: selectedSlot.staff_profile_id,
              starts_at: selectedSlot.starts_at,
            }),
          },
          {csrf: true},
        );
        setMessage(t("confirmedTitle"));
      }
      setAuthenticated(true);
      setSelectedSlot(null);
      await loadBookings();
      const params = new URLSearchParams({
        service_id: selectedService.id,
        date_from: dateKey,
        date_to: dateKey,
      });
      setSlots(
        await apiRequest<SlotRecord[]>(
          `/api/v1/organizations/${organizationSlug}/slots?${params.toString()}`,
          {},
          {retryAuth: false},
        ),
      );
    } catch (caught) {
      setError(localizedApiError(caught));
      if (caught instanceof ServiceOpsApiError && [401, 403].includes(caught.status)) {
        setAuthenticated(false);
      }
    } finally {
      setPending(false);
    }
  }

  async function cancelExisting(bookingId: string) {
    setPending(true);
    setError(null);
    try {
      await apiRequest<BookingRecord>(
        `/api/v1/organizations/${organizationSlug}/bookings/${bookingId}/cancel`,
        {method: "POST"},
        {csrf: true},
      );
      setMessage(t("cancelledTitle"));
      await loadBookings();
    } catch (caught) {
      setError(localizedApiError(caught));
    } finally {
      setPending(false);
    }
  }

  function beginReschedule(booking: BookingRecord) {
    setServiceId(booking.service.id);
    setReschedulingId(booking.id);
    setSelectedSlot(null);
    setMessage(t("chooseReschedule"));
    window.scrollTo({top: 0, behavior: "smooth"});
  }

  const selectedTime = selectedSlot ? timeFormatter.format(new Date(selectedSlot.starts_at)) : "—";
  const displayPrice =
    selectedService?.price_display_cents == null
      ? t("priceNotSet")
      : priceFormatter.format(selectedService.price_display_cents);

  return (
    <div className="min-h-screen bg-[#f7faf8] pb-28 lg:pb-10">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="text-sm font-bold tracking-[-0.02em]">ServiceOps</p>
              <p className="hidden text-[0.68rem] text-muted sm:block">{t("brandSub")}</p>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher compact />
            <Link
              href="/login"
              aria-label={common("account")}
              className="flex size-10 items-center justify-center rounded-full border border-line bg-white text-ink"
            >
              <Menu className="size-5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          href="/"
          className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {common("preview")}
        </Link>

        <div className="mb-8 lg:mb-10">
          <p className="text-xs font-bold tracking-[0.16em] text-brand uppercase">{t("eyebrow")}</p>
          <h1 className="mt-3 text-3xl leading-tight font-bold tracking-[-0.045em] sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted sm:text-base">{t("description")}</p>
        </div>

        <ol aria-label={t("progress")} className="mb-8 flex max-w-2xl items-center">
          {[t("stepService"), t("stepSchedule"), t("stepConfirm")].map((label, index) => (
            <li key={label} className={`flex items-center ${index < 2 ? "flex-1" : ""}`}>
              <span
                className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${index < 2 ? "bg-brand text-white" : "bg-subtle text-muted"}`}
              >
                {index === 0 ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span
                className={`ml-2 hidden text-xs font-semibold sm:block ${index < 2 ? "text-ink" : "text-muted"}`}
              >
                {label}
              </span>
              {index < 2 ? <span className="mx-3 h-px flex-1 bg-line sm:mx-4" /> : null}
            </li>
          ))}
        </ol>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="min-w-0 space-y-6">
            <Card className="min-w-0 p-5 sm:p-7">
              <div className="mb-5">
                <h2 className="text-xl font-bold tracking-[-0.03em]">{t("chooseService")}</h2>
                <p className="mt-1.5 text-sm text-muted">{t("chooseServiceHint")}</p>
              </div>
              {loadingServices ? (
                <LoadingState label={t("loadingServices")} />
              ) : services.length === 0 ? (
                <p className="rounded-xl bg-subtle p-6 text-center text-sm text-muted">
                  {t("noServices")}
                </p>
              ) : (
                <div
                  role="radiogroup"
                  aria-label={t("chooseService")}
                  className="grid gap-3 sm:grid-cols-3"
                >
                  {services.map((service, index) => {
                    const Icon = serviceIcons[index % serviceIcons.length];
                    const selected = service.id === serviceId;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setServiceId(service.id);
                          setMessage(null);
                          if (reschedulingId && service.id !== selectedService?.id) {
                            setReschedulingId(null);
                          }
                        }}
                        className={`relative min-h-44 rounded-2xl border p-4 text-left transition ${selected ? "border-brand bg-brand-soft/40 shadow-[0_0_0_1px_var(--so-color-brand)]" : "border-line bg-white hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"}`}
                      >
                        {selected ? (
                          <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-brand text-white">
                            <Check className="size-3" />
                          </span>
                        ) : null}
                        <span
                          className={`flex size-10 items-center justify-center rounded-xl ${serviceTones[index % serviceTones.length]}`}
                        >
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <span className="mt-4 block font-bold">
                          {localizedServiceName(service.name)}
                        </span>
                        <span className="mt-1.5 block text-xs leading-5 text-muted">
                          {localizedServiceDescription(service)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="min-w-0 p-5 sm:p-7">
              <h2 className="text-xl font-bold tracking-[-0.03em]">{t("chooseDate")}</h2>
              <div
                className="scrollbar-none -mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-2"
                role="radiogroup"
                aria-label={t("chooseDate")}
              >
                {dates.map((candidate) => {
                  const selected = dateKey === candidate;
                  const date = organizationDate(candidate);
                  return (
                    <button
                      key={candidate}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setDateKey(candidate)}
                      className={`flex min-w-[4.5rem] flex-col items-center rounded-2xl border px-3 py-3 transition ${selected ? "border-brand bg-brand text-white shadow-lg shadow-brand/15" : "border-line bg-white text-ink hover:border-brand/35"}`}
                    >
                      <span
                        className={`text-[0.7rem] font-semibold ${selected ? "text-white/72" : "text-muted"}`}
                      >
                        {compactDateFormatter.format(date)}
                      </span>
                      <span className="mt-1 text-xl font-bold">
                        {Number(candidate.slice(8, 10))}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-7 flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-[-0.03em]">{t("chooseTime")}</h2>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  {t("available")}
                </span>
              </div>
              {loadingSlots ? (
                <LoadingState label={t("loadingSlots")} />
              ) : slots.length === 0 ? (
                <p className="mt-4 rounded-xl bg-subtle p-6 text-center text-sm text-muted">
                  {t("noSlots")}
                </p>
              ) : (
                <div
                  className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"
                  role="radiogroup"
                  aria-label={t("chooseTime")}
                >
                  {slots.map((slot) => {
                    const selected =
                      selectedSlot?.staff_profile_id === slot.staff_profile_id &&
                      selectedSlot.starts_at === slot.starts_at;
                    return (
                      <button
                        key={`${slot.staff_profile_id}-${slot.starts_at}`}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setSelectedSlot(slot)}
                        className={`min-h-14 rounded-xl border px-3 py-2 text-sm font-semibold transition ${selected ? "border-brand bg-brand-soft text-brand-strong shadow-[0_0_0_1px_var(--so-color-brand)]" : "border-line bg-white text-ink hover:border-brand/35"}`}
                      >
                        <span className="block">
                          {timeFormatter.format(new Date(slot.starts_at))}
                        </span>
                        <span className="mt-0.5 block text-[0.68rem] font-medium text-muted">
                          {localizedStaffName(slot.staff_display_name)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <Card className="min-w-0 overflow-hidden lg:sticky lg:top-6">
            <div className="border-b border-line px-5 py-4 sm:px-6">
              <h2 className="text-lg font-bold">
                {reschedulingId ? t("rescheduleSummary") : t("summary")}
              </h2>
            </div>
            <div className="space-y-4 p-5 sm:p-6">
              <SummaryRow
                icon={Sparkles}
                label={t("service")}
                value={selectedService ? localizedServiceName(selectedService.name) : "—"}
              />
              <SummaryRow
                icon={MapPin}
                label={t("date")}
                value={dateFormatter.format(organizationDate(dateKey))}
              />
              <SummaryRow
                icon={Clock3}
                label={t("time")}
                value={
                  selectedSlot && selectedService
                    ? `${selectedTime} · ${localizedStaffName(selectedSlot.staff_display_name)} · ${t("minutes", {count: selectedService.duration_minutes})}`
                    : t("selectSlot")
                }
              />
              <div className="my-1 h-px bg-line" />
              <div className="flex items-end justify-between">
                <span className="text-sm text-muted">{t("price")}</span>
                <strong className="text-xl tracking-[-0.03em]">{displayPrice}</strong>
              </div>
              <p className="flex items-start gap-2 rounded-xl bg-subtle p-3 text-xs leading-5 text-muted">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                {t("nonBilling")}
              </p>
              {message ? (
                <div
                  role="status"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"
                >
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <CheckCircle2 className="size-4" />
                    {message}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-emerald-700">{t("confirmedBody")}</p>
                </div>
              ) : null}
              {error ? (
                <p
                  role="alert"
                  className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700"
                >
                  {error}
                </p>
              ) : null}
              {authenticated === false ? (
                <Link
                  href="/login"
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-brand/25 bg-brand-soft text-sm font-bold text-brand"
                >
                  <LogIn className="size-4" /> {t("goToLogin")}
                </Link>
              ) : null}
              <Button
                size="lg"
                className="w-full"
                onClick={() => void submitBooking()}
                disabled={!selectedSlot || pending}
              >
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {pending ? t("pending") : reschedulingId ? t("confirmReschedule") : t("confirm")}
                {!pending ? <ChevronRight className="size-4" /> : null}
              </Button>
              {reschedulingId ? (
                <Button variant="ghost" className="w-full" onClick={() => setReschedulingId(null)}>
                  <RotateCcw className="size-4" /> {t("stopReschedule")}
                </Button>
              ) : null}
            </div>
          </Card>
        </div>

        <Card className="mt-8 overflow-hidden">
          <div className="border-b border-line px-5 py-5 sm:px-7">
            <h2 className="text-xl font-bold tracking-[-0.03em]">{t("myBookings")}</h2>
            <p className="mt-1.5 text-sm text-muted">{t("myBookingsHint")}</p>
          </div>
          {authenticated === false ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted">{t("loginRequired")}</p>
              <Link href="/login" className="mt-3 inline-flex text-sm font-bold text-brand">
                {t("goToLogin")}
              </Link>
            </div>
          ) : bookings.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">{t("emptyBookings")}</p>
          ) : (
            <div className="divide-y divide-line">
              {bookings.map((booking) => (
                <article
                  key={booking.id}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{localizedServiceName(booking.service.name)}</p>
                      <Badge
                        tone={
                          booking.status === "cancelled"
                            ? "danger"
                            : booking.status === "completed"
                              ? "neutral"
                              : booking.status === "requested"
                                ? "warning"
                                : "info"
                        }
                      >
                        {statusT(booking.status)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      {dateTimeFormatter.format(new Date(booking.starts_at))} ·{" "}
                      {localizedStaffName(booking.staff.display_name)}
                    </p>
                  </div>
                  {booking.status === "requested" || booking.status === "confirmed" ? (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => beginReschedule(booking)}
                        disabled={pending}
                      >
                        {t("reschedule")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void cancelExisting(booking.id)}
                        disabled={pending}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </Card>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">
              {selectedService ? localizedServiceName(selectedService.name) : t("chooseService")} ·{" "}
              {selectedTime}
            </p>
            <p className="mt-0.5 font-bold">{displayPrice}</p>
          </div>
          <Button onClick={() => void submitBooking()} disabled={!selectedSlot || pending}>
            {t("continue")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LoadingState({label}: {label: string}) {
  return (
    <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted" role="status">
      <LoaderCircle className="size-4 animate-spin" /> {label}
    </p>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-subtle text-brand">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}
