"use client";

import {
  CircleDollarSign,
  Clock3,
  LoaderCircle,
  LogIn,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  Wrench,
  X,
} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useCallback, useEffect, useMemo, useState} from "react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {PageHeader} from "@/components/ui/page-header";
import {Select} from "@/components/ui/select";
import {Link} from "@/i18n/navigation";
import {apiRequest, ServiceOpsApiError} from "@/lib/api-client";
import {getDemoServiceKey} from "@/lib/demo-localization";
import type {ServiceRecord} from "@/lib/operations-types";
import {useModalFocus} from "@/lib/use-modal-focus";

const organizationSlug = "demo-services";

type ServiceForm = {
  name: string;
  description: string;
  duration: string;
  price: string;
  active: boolean;
};

const emptyForm: ServiceForm = {
  name: "",
  description: "",
  duration: "60",
  price: "",
  active: true,
};

export function ServiceManagement() {
  const t = useTranslations("Services");
  const bookingsT = useTranslations("Bookings");
  const bookingT = useTranslations("Booking");
  const locale = useLocale();
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"login" | "unavailable" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<ServiceRecord | "new" | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const dialogRef = useModalFocus<HTMLElement>(Boolean(editing), () => {
    if (!saving) setEditing(null);
  });

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setServices(
        await apiRequest<ServiceRecord[]>(
          `/api/v1/organizations/${organizationSlug}/owner/services`,
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
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await apiRequest<ServiceRecord[]>(
          `/api/v1/organizations/${organizationSlug}/owner/services`,
        );
        if (active) setServices(data);
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
  }, []);

  const localService = useCallback(
    (name: string) => {
      const key = getDemoServiceKey(name);
      return key ? bookingsT(`services.${key}`) : name;
    },
    [bookingsT],
  );

  const localDescription = useCallback(
    (service: ServiceRecord) => {
      const key = getDemoServiceKey(service.name);
      return key ? bookingT(`services.${key}.description`) : service.description;
    },
    [bookingT],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    return services.filter(
      (service) =>
        (visibility === "all" ||
          (visibility === "active" ? service.is_active : !service.is_active)) &&
        (!normalized ||
          localService(service.name).toLocaleLowerCase(locale).includes(normalized) ||
          localDescription(service).toLocaleLowerCase(locale).includes(normalized)),
    );
  }, [locale, localDescription, localService, query, services, visibility]);

  const currency = useMemo(
    () =>
      new Intl.NumberFormat(locale, {style: "currency", currency: "KRW", maximumFractionDigits: 0}),
    [locale],
  );

  function openCreate() {
    setForm(emptyForm);
    setEditing("new");
    setNotice(null);
  }

  function openEdit(service: ServiceRecord) {
    setForm({
      name: service.name,
      description: service.description,
      duration: String(service.duration_minutes),
      price: service.price_display_cents === null ? "" : String(service.price_display_cents),
      active: service.is_active,
    });
    setEditing(service);
    setNotice(null);
  }

  async function saveService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const duration = Number(form.duration);
    const price = form.price ? Number(form.price) : null;
    if (
      !form.name.trim() ||
      !Number.isInteger(duration) ||
      duration < 15 ||
      (price !== null && price < 0)
    ) {
      setNotice(t("validationError"));
      return;
    }
    setSaving(true);
    setNotice(null);
    const isNew = editing === "new";
    try {
      const saved = await apiRequest<ServiceRecord>(
        isNew
          ? `/api/v1/organizations/${organizationSlug}/owner/services`
          : `/api/v1/organizations/${organizationSlug}/owner/services/${editing?.id}`,
        {
          method: isNew ? "POST" : "PATCH",
          body: JSON.stringify({
            name: form.name,
            description: form.description,
            duration_minutes: duration,
            price_display_cents: price,
            is_active: form.active,
          }),
        },
        {csrf: true},
      );
      setServices((current) =>
        isNew
          ? [...current, saved].sort((left, right) => left.name.localeCompare(right.name))
          : current.map((service) => (service.id === saved.id ? saved : service)),
      );
      setEditing(null);
      setNotice(isNew ? t("created") : t("updated"));
    } catch {
      setNotice(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleService(service: ServiceRecord) {
    if (
      service.is_active &&
      !window.confirm(t("confirmDeactivate", {name: localService(service.name)}))
    ) {
      return;
    }
    setProcessingId(service.id);
    setNotice(null);
    try {
      if (service.is_active) {
        await apiRequest<void>(
          `/api/v1/organizations/${organizationSlug}/owner/services/${service.id}`,
          {method: "DELETE"},
          {csrf: true},
        );
        setServices((current) =>
          current.map((candidate) =>
            candidate.id === service.id ? {...candidate, is_active: false} : candidate,
          ),
        );
        setNotice(t("deactivated"));
      } else {
        const updated = await apiRequest<ServiceRecord>(
          `/api/v1/organizations/${organizationSlug}/owner/services/${service.id}`,
          {method: "PATCH", body: JSON.stringify({is_active: true})},
          {csrf: true},
        );
        setServices((current) =>
          current.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
        );
        setNotice(t("reactivated"));
      }
    } catch {
      setNotice(t("actionFailed"));
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => void loadServices()}
              disabled={loading}
              aria-label={t("refresh")}
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{t("refresh")}</span>
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" /> {t("newService")}
            </Button>
          </div>
        }
      />

      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted"
        >
          {notice}
        </p>
      ) : null}

      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:p-5">
          <label className="relative block">
            <span className="sr-only">{t("searchLabel")}</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
          </label>
          <label>
            <span className="sr-only">{t("visibilityLabel")}</span>
            <Select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as typeof visibility)}
            >
              <option value="all">{t("allServices")}</option>
              <option value="active">{t("activeOnly")}</option>
              <option value="inactive">{t("inactiveOnly")}</option>
            </Select>
          </label>
        </div>

        {loading ? (
          <p
            className="flex items-center justify-center gap-2 p-12 text-sm text-muted"
            role="status"
          >
            <LoaderCircle className="size-4 animate-spin" /> {t("loading")}
          </p>
        ) : error ? (
          <ServiceError error={error} retry={() => void loadServices()} />
        ) : filtered.length ? (
          <ul className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {filtered.map((service) => (
              <li key={service.id}>
                <article className="flex h-full flex-col rounded-2xl border border-line bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                      <Wrench className="size-5" aria-hidden="true" />
                    </span>
                    <Badge tone={service.is_active ? "success" : "neutral"}>
                      {service.is_active ? t("active") : t("inactive")}
                    </Badge>
                  </div>
                  <h2 className="mt-5 font-bold">{localService(service.name)}</h2>
                  <p className="mt-2 min-h-10 text-sm leading-5 text-muted">
                    {localDescription(service) || t("noDescription")}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-muted">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-subtle px-2.5 py-1.5">
                      <Clock3 className="size-3.5" />{" "}
                      {t("minutes", {count: service.duration_minutes})}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-subtle px-2.5 py-1.5">
                      <CircleDollarSign className="size-3.5" />
                      {service.price_display_cents === null
                        ? t("priceNotSet")
                        : currency.format(service.price_display_cents)}
                    </span>
                  </div>
                  <div className="mt-6 flex gap-2 border-t border-line pt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(service)}
                      className="flex-1"
                    >
                      <Pencil className="size-3.5" /> {t("edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void toggleService(service)}
                      disabled={processingId === service.id}
                      className="flex-1"
                    >
                      {processingId === service.id ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        <Power className="size-3.5" />
                      )}
                      {service.is_active ? t("deactivate") : t("reactivate")}
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-12 text-center">
            <Wrench className="mx-auto size-8 text-brand" />
            <h2 className="mt-4 font-bold">{t("emptyTitle")}</h2>
            <p className="mt-2 text-sm text-muted">{t("emptyBody")}</p>
          </div>
        )}
      </Card>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
          <button
            type="button"
            aria-label={t("closeOverlay")}
            onClick={() => !saving && setEditing(null)}
            tabIndex={-1}
            className="absolute inset-0"
          />
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-dialog-title"
            tabIndex={-1}
            className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.12em] text-brand uppercase">
                  {t("dialogEyebrow")}
                </p>
                <h2 id="service-dialog-title" className="mt-2 text-xl font-bold">
                  {editing === "new" ? t("createTitle") : t("editTitle")}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => !saving && setEditing(null)}
                aria-label={t("closeDialog")}
                className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-subtle"
              >
                <X className="size-5" />
              </button>
            </div>
            <form onSubmit={(event) => void saveService(event)} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-muted">{t("name")}</span>
                <Input
                  data-autofocus
                  required
                  maxLength={120}
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({...current, name: event.target.value}))
                  }
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-muted">
                  {t("serviceDescription")}
                </span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({...current, description: event.target.value}))
                  }
                  className="w-full resize-y rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-2 block text-xs font-bold text-muted">{t("duration")}</span>
                  <Input
                    type="number"
                    min={15}
                    max={1440}
                    step={5}
                    required
                    value={form.duration}
                    onChange={(event) =>
                      setForm((current) => ({...current, duration: event.target.value}))
                    }
                  />
                </label>
                <label>
                  <span className="mb-2 block text-xs font-bold text-muted">{t("price")}</span>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={form.price}
                    onChange={(event) =>
                      setForm((current) => ({...current, price: event.target.value}))
                    }
                    placeholder={t("pricePlaceholder")}
                  />
                </label>
              </div>
              {editing !== "new" ? (
                <label className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) =>
                      setForm((current) => ({...current, active: event.target.checked}))
                    }
                    className="size-4 accent-[var(--so-color-brand)]"
                  />
                  {t("availableForBooking")}
                </label>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  {saving ? t("saving") : t("save")}
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ServiceError({error, retry}: {error: "login" | "unavailable"; retry: () => void}) {
  const t = useTranslations("Services");
  return (
    <div className="p-12 text-center">
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
