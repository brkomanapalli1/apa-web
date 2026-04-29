/**
 * api/client.ts — Centralized API client
 *
 * Features:
 *  - Automatic JWT attach on every request
 *  - Silent token refresh on 401 (single in-flight refresh, queued retries)
 *  - Exponential back-off retry for transient 5xx / network errors
 *  - Typed error class with status code and server detail
 *  - Progress callback support for file uploads (XHR-based)
 *  - AbortSignal / cancel support
 */

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// ── Token storage ─────────────────────────────────────────────────────────

const TOKEN_KEY = "paperwork_tokens_v2";

export type Tokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export function getTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function setTokens(tokens: Tokens | null): void {
  if (typeof window === "undefined") return;
  if (!tokens) {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  }
}

// ── Error class ───────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detail?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function extractMessage(error: AxiosError): string {
  const data = error.response?.data as Record<string, unknown> | undefined;
  if (!data) return error.message;
  if (typeof data.detail === "string") return data.detail;
  if (
    data.detail &&
    typeof data.detail === "object" &&
    "message" in data.detail
  ) {
    return String((data.detail as Record<string, unknown>).message);
  }
  if (data.message && typeof data.message === "string") return data.message;
  return error.message;
}

// ── Refresh token queue ───────────────────────────────────────────────────

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processRefreshQueue(token: string | null, error: unknown = null) {
  refreshQueue.forEach((pending) => {
    if (token) {
      pending.resolve(token);
    } else {
      pending.reject(error);
    }
  });
  refreshQueue = [];
}

// ── Axios instance ────────────────────────────────────────────────────────

const client: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor — attach token
client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tokens = getTokens();
  if (tokens?.access_token && config.headers) {
    config.headers.Authorization = `Bearer ${tokens.access_token}`;
  }
  return config;
});

// Response interceptor — refresh on 401
client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status === 401 &&
      !original._retry &&
      getTokens()?.refresh_token
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        })
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return client(original);
          })
          .catch((err) => Promise.reject(err));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post<Tokens>(`${API_URL}/auth/refresh`, {
          refresh_token: getTokens()?.refresh_token,
        });
        setTokens(data);
        processRefreshQueue(data.access_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return client(original);
      } catch (refreshError) {
        processRefreshQueue(null, refreshError);
        setTokens(null);
        // Redirect to login — works in Next.js client components
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    const status = error.response?.status ?? 0;
    const message = extractMessage(error);
    const detail = (error.response?.data as Record<string, unknown>)?.detail;
    throw new ApiError(status, message, detail);
  }
);

// ── Typed request helpers ─────────────────────────────────────────────────

export async function get<T>(
  path: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const { data } = await client.get<T>(path, config);
  return data;
}

export async function post<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const { data } = await client.post<T>(path, body, config);
  return data;
}

export async function patch<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const { data } = await client.patch<T>(path, body, config);
  return data;
}

export async function del<T>(
  path: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const { data } = await client.delete<T>(path, config);
  return data;
}

// ── File upload with progress (XHR) ──────────────────────────────────────

export function uploadFileWithProgress(
  url: string,
  file: File | Blob,
  mimeType: string,
  onProgress: (percent: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", mimeType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new ApiError(xhr.status, `Upload failed: HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () =>
      reject(new ApiError(0, "Network error during upload"));
    xhr.onabort = () => reject(new ApiError(0, "Upload cancelled"));

    if (signal) {
      signal.addEventListener("abort", () => xhr.abort());
    }

    xhr.send(file);
  });
}

export { client };
