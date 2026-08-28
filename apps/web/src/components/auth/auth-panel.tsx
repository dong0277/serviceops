"use client";

import {ArrowLeft, CheckCircle2, KeyRound, ShieldCheck, Users} from "lucide-react";
import {useTranslations} from "next-intl";
import {FormEvent, useEffect, useState} from "react";
import {BrandMark} from "@/components/brand-mark";
import {LanguageSwitcher} from "@/components/language-switcher";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Link} from "@/i18n/navigation";
import {getDemoCustomerKey, getDemoStaffKey} from "@/lib/demo-localization";

type Membership = {
  id: string;
  role: "owner" | "staff" | "customer";
  organization: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
};

type User = {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  memberships: Membership[];
};

type AuthResponse = {
  user: User;
  csrf_token: string;
};

type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

function getApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
  }
  return `${window.location.protocol}//${window.location.hostname}:8000`;
}

function readCookie(name: string) {
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split("; ").find((cookie) => cookie.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

export function AuthPanel() {
  const t = useTranslations("Auth");
  const demoT = useTranslations("DemoData");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("demo-services");
  const [user, setUser] = useState<User | null>(null);
  const [pending, setPending] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadSession() {
      try {
        let response = await fetch(`${getApiBaseUrl()}/api/v1/auth/me`, {
          credentials: "include",
        });
        if (response.status === 401) {
          const csrfToken = readCookie("serviceops_csrf");
          if (csrfToken) {
            const refreshResponse = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
              method: "POST",
              credentials: "include",
              headers: {"X-CSRF-Token": csrfToken},
            });
            if (refreshResponse.ok && active) {
              const refreshed = (await refreshResponse.json()) as AuthResponse;
              setUser(refreshed.user);
              return;
            }
            response = refreshResponse;
          }
        }
        if (response.ok && active) {
          setUser((await response.json()) as User);
        }
      } catch {
        // The form below provides a visible connection error if the user submits.
      } finally {
        if (active) setCheckingSession(false);
      }
    }
    void loadSession();
    return () => {
      active = false;
    };
  }, []);

  function localizedError(code?: string) {
    const knownCodes = [
      "invalid_credentials",
      "invalid_session",
      "login_rate_limited",
      "organization_not_found",
      "registration_failed",
      "untrusted_origin",
      "csrf_failed",
      "validation_error",
    ] as const;
    const known = knownCodes.find((candidate) => candidate === code);
    return known ? t(`errors.${known}`) : t("errors.generic");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const path = mode === "login" ? "login" : "register";
    const body =
      mode === "login"
        ? {email, password}
        : {
            email,
            password,
            display_name: displayName,
            organization_slug: organizationSlug,
          };

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/${path}`, {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as AuthResponse & ApiError;
      if (!response.ok) {
        setError(localizedError(payload.error?.code));
        return;
      }
      setUser(payload.user);
      setPassword("");
      setMessage(mode === "login" ? t("loginSuccess") : t("registerSuccess"));
    } catch {
      setError(t("errors.unavailable"));
    } finally {
      setPending(false);
    }
  }

  async function refreshSession() {
    const csrfToken = readCookie("serviceops_csrf");
    if (!csrfToken) {
      setError(t("errors.sessionExpired"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {"X-CSRF-Token": csrfToken},
      });
      const payload = (await response.json()) as AuthResponse & ApiError;
      if (!response.ok) {
        setError(localizedError(payload.error?.code));
        return;
      }
      setUser(payload.user);
      setMessage(t("refreshSuccess"));
    } catch {
      setError(t("errors.unavailable"));
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    const csrfToken = readCookie("serviceops_csrf");
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: csrfToken ? {"X-CSRF-Token": csrfToken} : {},
      });
      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        setError(localizedError(payload.error?.code));
        return;
      }
      setUser(null);
      setMessage(t("logoutSuccess"));
    } catch {
      setError(t("errors.unavailable"));
    } finally {
      setPending(false);
    }
  }

  function fillDemoOwner() {
    setMode("login");
    setEmail("owner@serviceops.test");
    setPassword("ServiceOps-Demo-2026!");
    setError(null);
  }

  function fillDemoCustomer() {
    setMode("login");
    setEmail("customer.sora@serviceops.test");
    setPassword("ServiceOps-Demo-2026!");
    setError(null);
  }

  function fillDemoStaff() {
    setMode("login");
    setEmail("staff.hana@serviceops.test");
    setPassword("ServiceOps-Demo-2026!");
    setError(null);
  }

  function localizedUserName(currentUser: User) {
    if (currentUser.email === "owner@serviceops.test") return demoT("owner");
    const staffKey = getDemoStaffKey(currentUser.display_name);
    if (staffKey) return demoT(`staff.${staffKey}`);
    const customerKey = getDemoCustomerKey(currentUser.email);
    return customerKey ? demoT(`customers.${customerKey}`) : currentUser.display_name;
  }

  return (
    <main className="surface-grid min-h-screen bg-[#f5f8f6] px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 rounded-xl">
            <BrandMark />
            <div>
              <p className="font-bold tracking-[-0.02em]">ServiceOps</p>
              <p className="text-xs text-muted">{t("securityLabel")}</p>
            </div>
          </Link>
          <LanguageSwitcher />
        </header>

        <div className="grid gap-8 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-20">
          <section>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t("back")}
            </Link>
            <p className="mt-10 text-xs font-bold tracking-[0.16em] text-brand uppercase">
              {t("eyebrow")}
            </p>
            <h1 className="mt-4 text-4xl leading-tight font-bold tracking-[-0.045em] sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted">{t("description")}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="flex gap-3 rounded-2xl border border-line bg-white/80 p-4">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
                <div>
                  <p className="text-sm font-bold">{t("cookieTitle")}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{t("cookieBody")}</p>
                </div>
              </div>
              <div className="flex gap-3 rounded-2xl border border-line bg-white/80 p-4">
                <Users className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
                <div>
                  <p className="text-sm font-bold">{t("tenantTitle")}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{t("tenantBody")}</p>
                </div>
              </div>
            </div>
          </section>

          <Card className="p-5 sm:p-7">
            {checkingSession ? (
              <p className="py-12 text-center text-sm text-muted" aria-live="polite">
                {t("checking")}
              </p>
            ) : user ? (
              <section aria-labelledby="session-title">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <CheckCircle2 className="size-6" aria-hidden="true" />
                </div>
                <p className="mt-6 text-xs font-bold tracking-[0.14em] text-brand uppercase">
                  {t("signedIn")}
                </p>
                <h2 id="session-title" className="mt-2 text-2xl font-bold tracking-[-0.03em]">
                  {localizedUserName(user)}
                </h2>
                <p className="mt-1 text-sm text-muted">{user.email}</p>
                <div className="mt-6 space-y-3">
                  {user.memberships.map((membership) => (
                    <div
                      key={membership.id}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-subtle/60 p-4"
                    >
                      <div>
                        <p className="text-sm font-bold">
                          {membership.organization.slug === "demo-services"
                            ? t("demoOrganizationName")
                            : membership.organization.name}
                        </p>
                        <p className="mt-1 text-xs text-muted">{membership.organization.slug}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand ring-1 ring-line">
                        {t(`roles.${membership.role}`)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button onClick={() => void refreshSession()} disabled={pending}>
                    {t("refresh")}
                  </Button>
                  <Button variant="secondary" onClick={() => void logout()} disabled={pending}>
                    {t("logout")}
                  </Button>
                </div>
              </section>
            ) : (
              <section aria-labelledby="auth-form-title">
                <div className="flex rounded-xl bg-subtle p-1" aria-label={t("modeLabel")}>
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className={`h-10 flex-1 rounded-lg text-sm font-bold transition ${mode === "login" ? "bg-white text-ink shadow-sm" : "text-muted"}`}
                  >
                    {t("login")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className={`h-10 flex-1 rounded-lg text-sm font-bold transition ${mode === "register" ? "bg-white text-ink shadow-sm" : "text-muted"}`}
                  >
                    {t("register")}
                  </button>
                </div>
                <h2 id="auth-form-title" className="mt-7 text-2xl font-bold tracking-[-0.03em]">
                  {mode === "login" ? t("loginTitle") : t("registerTitle")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {mode === "login" ? t("loginHint") : t("registerHint")}
                </p>
                <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
                  {mode === "register" ? (
                    <label className="block text-sm font-semibold">
                      {t("displayName")}
                      <Input
                        className="mt-2"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        autoComplete="name"
                        required
                      />
                    </label>
                  ) : null}
                  <label className="block text-sm font-semibold">
                    {t("email")}
                    <Input
                      className="mt-2"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    {t("password")}
                    <Input
                      className="mt-2"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      minLength={mode === "register" ? 12 : 1}
                      required
                    />
                  </label>
                  {mode === "register" ? (
                    <label className="block text-sm font-semibold">
                      {t("organization")}
                      <Input
                        className="mt-2"
                        value={organizationSlug}
                        onChange={(event) => setOrganizationSlug(event.target.value)}
                        pattern="[a-z0-9-]+"
                        required
                      />
                    </label>
                  ) : null}
                  <Button type="submit" size="lg" className="w-full" disabled={pending}>
                    <KeyRound className="size-4" aria-hidden="true" />
                    {pending ? t("pending") : mode === "login" ? t("login") : t("register")}
                  </Button>
                </form>
                {mode === "login" ? (
                  <div className="mt-5 rounded-2xl border border-brand/15 bg-brand-soft/40 p-4">
                    <p className="text-sm font-bold">{t("demoTitle")}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{t("demoBody")}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                      <button
                        type="button"
                        onClick={fillDemoOwner}
                        className="text-sm font-bold text-brand"
                      >
                        {t("fillDemoOwner")}
                      </button>
                      <button
                        type="button"
                        onClick={fillDemoCustomer}
                        className="text-sm font-bold text-brand"
                      >
                        {t("fillDemoCustomer")}
                      </button>
                      <button
                        type="button"
                        onClick={fillDemoStaff}
                        className="text-sm font-bold text-brand"
                      >
                        {t("fillDemoStaff")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            )}
            <div className="mt-5 min-h-6" aria-live="polite">
              {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
              {message ? <p className="text-sm font-semibold text-brand">{message}</p> : null}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
