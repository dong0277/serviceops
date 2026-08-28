"use client";

import {FileClock, LoaderCircle, LogIn, RefreshCw, Search, UsersRound, Wrench} from "lucide-react";
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
import {
  getDemoCustomerKey,
  getDemoCustomerKeyByName,
  getDemoServiceKey,
  getDemoStaffKey,
} from "@/lib/demo-localization";
import type {AuditLogRecord, CustomerRecord, StaffProfileRecord} from "@/lib/operations-types";

const organizationSlug = "demo-services";

type LoadError = "login" | "unavailable" | null;

function errorKind(caught: unknown): LoadError {
  return caught instanceof ServiceOpsApiError && [401, 403].includes(caught.status)
    ? "login"
    : "unavailable";
}

function EmptyState({
  error,
  loginText,
  emptyText,
}: {
  error: LoadError;
  loginText: string;
  emptyText: string;
}) {
  return (
    <div className="p-12 text-center">
      <p className="text-sm text-muted">{error === "login" ? loginText : emptyText}</p>
      {error === "login" ? (
        <Link
          href="/login"
          className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand"
        >
          <LogIn className="size-4" /> {loginText}
        </Link>
      ) : null}
    </div>
  );
}

export function CustomerDirectory() {
  const t = useTranslations("Customers");
  const demoT = useTranslations("DemoData");
  const locale = useLocale();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCustomers(
        await apiRequest<CustomerRecord[]>(
          `/api/v1/organizations/${organizationSlug}/owner/customers`,
        ),
      );
    } catch (caught) {
      setError(errorKind(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadInitial() {
      try {
        const rows = await apiRequest<CustomerRecord[]>(
          `/api/v1/organizations/${organizationSlug}/owner/customers`,
        );
        if (active) setCustomers(rows);
      } catch (caught) {
        if (active) setError(errorKind(caught));
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadInitial();
    return () => {
      active = false;
    };
  }, []);

  const displayName = useCallback(
    (customer: CustomerRecord) => {
      const key = getDemoCustomerKey(customer.email);
      return key ? demoT(`customers.${key}`) : customer.display_name;
    },
    [demoT],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    return customers.filter(
      (customer) =>
        !normalized ||
        displayName(customer).toLocaleLowerCase(locale).includes(normalized) ||
        customer.email.toLocaleLowerCase(locale).includes(normalized),
    );
  }, [customers, displayName, locale, query]);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeZone: "Asia/Seoul"}),
    [locale],
  );

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
      <Card className="overflow-hidden">
        <div className="border-b border-line p-4 sm:p-5">
          <label className="relative block max-w-md">
            <span className="sr-only">{t("searchLabel")}</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
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
          <EmptyState error={error} loginText={t("loginRequired")} emptyText={t("unavailable")} />
        ) : filtered.length ? (
          <div className="divide-y divide-line">
            {filtered.map((customer) => (
              <article
                key={customer.id}
                className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_180px_180px] sm:items-center sm:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand-strong">
                    {displayName(customer).slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{displayName(customer)}</p>
                    <p className="truncate text-xs text-muted">{customer.email}</p>
                  </div>
                </div>
                <p className="text-sm">
                  <span className="text-muted">{t("bookings")}</span>{" "}
                  <strong>{customer.booking_count}</strong>
                </p>
                <p className="text-sm text-muted">
                  {customer.last_booking_at
                    ? dateFormatter.format(new Date(customer.last_booking_at))
                    : t("noBookings")}
                </p>
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

type ServiceRecord = {id: string; name: string; is_active: boolean};

export function TeamDirectory() {
  const t = useTranslations("Team");
  const bookingsT = useTranslations("Bookings");
  const demoT = useTranslations("DemoData");
  const [staff, setStaff] = useState<StaffProfileRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [staffRows, serviceRows] = await Promise.all([
        apiRequest<StaffProfileRecord[]>(`/api/v1/organizations/${organizationSlug}/owner/staff`),
        apiRequest<ServiceRecord[]>(`/api/v1/organizations/${organizationSlug}/owner/services`),
      ]);
      setStaff(staffRows);
      setServices(serviceRows);
    } catch (caught) {
      setError(errorKind(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadInitial() {
      try {
        const [staffRows, serviceRows] = await Promise.all([
          apiRequest<StaffProfileRecord[]>(`/api/v1/organizations/${organizationSlug}/owner/staff`),
          apiRequest<ServiceRecord[]>(`/api/v1/organizations/${organizationSlug}/owner/services`),
        ]);
        if (active) {
          setStaff(staffRows);
          setServices(serviceRows);
        }
      } catch (caught) {
        if (active) setError(errorKind(caught));
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadInitial();
    return () => {
      active = false;
    };
  }, []);

  const serviceName = useCallback(
    (serviceId: string) => {
      const service = services.find((candidate) => candidate.id === serviceId);
      if (!service) return t("unknownService");
      const key = getDemoServiceKey(service.name);
      return key ? bookingsT(`services.${key}`) : service.name;
    },
    [bookingsT, services, t],
  );

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
      <div className="grid gap-4 lg:grid-cols-2">
        {loading ? (
          <Card className="col-span-full flex items-center justify-center gap-2 p-12 text-sm text-muted">
            <LoaderCircle className="size-4 animate-spin" /> {t("loading")}
          </Card>
        ) : error ? (
          <Card className="col-span-full">
            <EmptyState error={error} loginText={t("loginRequired")} emptyText={t("unavailable")} />
          </Card>
        ) : staff.length ? (
          staff.map((member) => {
            const demoKey = getDemoStaffKey(member.display_name);
            const name = demoKey ? demoT(`staff.${demoKey}`) : member.display_name;
            return (
              <Card key={member.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
                      <UsersRound className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold">{name}</p>
                      <p className="truncate text-xs text-muted">{member.email}</p>
                    </div>
                  </div>
                  <Badge tone={member.is_active ? "success" : "neutral"}>
                    {member.is_active ? t("active") : t("inactive")}
                  </Badge>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {member.service_ids.length ? (
                    member.service_ids.map((serviceId) => (
                      <span
                        key={serviceId}
                        className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-3 py-1.5 text-xs font-semibold"
                      >
                        <Wrench className="size-3.5 text-muted" /> {serviceName(serviceId)}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted">{t("noServices")}</span>
                  )}
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="col-span-full p-12 text-center text-sm text-muted">{t("empty")}</Card>
        )}
      </div>
    </div>
  );
}

export function AuditLogList() {
  const t = useTranslations("Audit");
  const demoT = useTranslations("DemoData");
  const locale = useLocale();
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [action, setAction] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (action !== "all") params.set("action", action);
      const query = params.size ? `?${params.toString()}` : "";
      setLogs(
        await apiRequest<AuditLogRecord[]>(
          `/api/v1/organizations/${organizationSlug}/owner/audit-logs${query}`,
        ),
      );
    } catch (caught) {
      setError(errorKind(caught));
    } finally {
      setLoading(false);
    }
  }, [action]);

  useEffect(() => {
    let active = true;
    async function loadInitial() {
      try {
        const params = new URLSearchParams();
        if (action !== "all") params.set("action", action);
        const query = params.size ? `?${params.toString()}` : "";
        const rows = await apiRequest<AuditLogRecord[]>(
          `/api/v1/organizations/${organizationSlug}/owner/audit-logs${query}`,
        );
        if (active) setLogs(rows);
      } catch (caught) {
        if (active) setError(errorKind(caught));
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadInitial();
    return () => {
      active = false;
    };
  }, [action]);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }),
    [locale],
  );
  const actorName = useCallback(
    (name: string | null) => {
      if (!name) return t("systemActor");
      if (name === "김민준 점주") return demoT("owner");
      const staffKey = getDemoStaffKey(name);
      if (staffKey) return demoT(`staff.${staffKey}`);
      const customerKey = getDemoCustomerKeyByName(name);
      return customerKey ? demoT(`customers.${customerKey}`) : name;
    },
    [demoT, t],
  );
  const knownActions = [
    "service_created",
    "service_updated",
    "service_deactivated",
    "staff_added",
    "staff_updated",
    "staff_deactivated",
    "booking_created",
    "booking_rescheduled",
    "staff_assignment_changed",
    "booking_status_changed",
    "booking_cancelled",
    "booking_internal_note_updated",
    "csv_export_requested",
  ];

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
      <Card className="overflow-hidden">
        <div className="border-b border-line p-4 sm:p-5">
          <label className="block max-w-xs">
            <span className="sr-only">{t("filterLabel")}</span>
            <Select value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="all">{t("allActions")}</option>
              {knownActions.map((value) => (
                <option key={value} value={value}>
                  {t(`actions.${value}`)}
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
          <EmptyState error={error} loginText={t("loginRequired")} emptyText={t("unavailable")} />
        ) : logs.length ? (
          <div className="divide-y divide-line">
            {logs.map((entry) => (
              <article
                key={entry.id}
                className="grid gap-3 px-4 py-4 sm:grid-cols-[44px_1fr_auto] sm:items-center sm:px-5"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-subtle text-muted">
                  <FileClock className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    {knownActions.includes(entry.action)
                      ? t(`actions.${entry.action}`)
                      : entry.action}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {actorName(entry.actor_display_name)} · {entry.entity_type}
                    {entry.entity_id ? ` · ${entry.entity_id.slice(0, 8)}` : ""}
                  </p>
                </div>
                <time className="text-xs text-muted" dateTime={entry.created_at}>
                  {formatter.format(new Date(entry.created_at))}
                </time>
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
