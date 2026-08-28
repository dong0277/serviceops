export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class ServiceOpsApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ServiceOpsApiError";
  }
}

export function getApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
  }
  return `${window.location.protocol}//${window.location.hostname}:8000`;
}

export function readCookie(name: string) {
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split("; ").find((cookie) => cookie.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

async function refreshAccessSession() {
  const csrfToken = readCookie("serviceops_csrf");
  if (!csrfToken) return false;
  const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {"X-CSRF-Token": csrfToken},
  });
  return response.ok;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: {csrf?: boolean; retryAuth?: boolean} = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (options.csrf) {
    const csrfToken = readCookie("serviceops_csrf");
    if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  }
  let response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (response.status === 401 && options.retryAuth !== false && (await refreshAccessSession())) {
    const retryHeaders = new Headers(headers);
    if (options.csrf) {
      const refreshedCsrf = readCookie("serviceops_csrf");
      if (refreshedCsrf) retryHeaders.set("X-CSRF-Token", refreshedCsrf);
    }
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: retryHeaders,
      credentials: "include",
    });
  }
  if (!response.ok) {
    let payload: ApiErrorPayload = {};
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      // A structured fallback below keeps UI errors predictable.
    }
    throw new ServiceOpsApiError(
      response.status,
      payload.error?.code ?? "request_failed",
      payload.error?.message ?? "The request could not be completed.",
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function downloadApiFile(path: string, filename: string): Promise<void> {
  let response = await fetch(`${getApiBaseUrl()}${path}`, {credentials: "include"});
  if (response.status === 401 && (await refreshAccessSession())) {
    response = await fetch(`${getApiBaseUrl()}${path}`, {credentials: "include"});
  }
  if (!response.ok) {
    let payload: ApiErrorPayload = {};
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      // A structured fallback below keeps download errors predictable.
    }
    throw new ServiceOpsApiError(
      response.status,
      payload.error?.code ?? "request_failed",
      payload.error?.message ?? "The file could not be downloaded.",
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
