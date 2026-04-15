const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export type Tokens = { access_token: string; refresh_token: string } | null;

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  full_name: string;
};

type RequestHeaders = Record<string, string>;

function getStoredTokens(): Tokens {
  try {
    const raw = localStorage.getItem('tokens');
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

function setStoredTokens(tokens: Tokens) {
  if (!tokens) {
    localStorage.removeItem('tokens');
    return;
  }
  localStorage.setItem('tokens', JSON.stringify(tokens));
}

async function parseJsonSafe(res: Response) {
  return res.json().catch(() => ({}));
}

export async function api(
  path: string,
  options: RequestInit = {},
  tokens?: Tokens,
  setTokens?: (tokens: Tokens) => void,
  retry = true
) {
  const activeTokens = tokens ?? getStoredTokens();

  const headers: RequestHeaders = {
    ...((options.headers as RequestHeaders) || {}),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (activeTokens?.access_token) {
    headers.Authorization = `Bearer ${activeTokens.access_token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retry && activeTokens?.refresh_token) {
    const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: activeTokens.refresh_token }),
    });

    const refreshData = await parseJsonSafe(refreshRes);

    if (refreshRes.ok && refreshData?.access_token) {
      const newTokens: Tokens = {
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token ?? activeTokens.refresh_token,
      };

      setStoredTokens(newTokens);
      setTokens?.(newTokens);

      return api(path, options, newTokens, setTokens, false);
    }
  }

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    const detail =
      typeof data?.detail === 'string'
        ? data.detail
        : data?.detail?.message
          ? data.detail.message
          : data?.detail
            ? JSON.stringify(data.detail)
            : data?.message || 'Request failed';

    const error = new Error(detail) as Error & {
      status?: number;
      payload?: unknown;
    };

    error.status = res.status;
    error.payload = data;

    throw error;
  }

  return data;
}

export async function register(payload: RegisterPayload) {
  const data = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (data?.access_token && data?.refresh_token) {
    setStoredTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
  }

  return data;
}

export async function login(payload: LoginPayload) {
  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (data?.access_token && data?.refresh_token) {
    setStoredTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
  }

  return data;
}

export async function me() {
  return api('/auth/me', { method: 'GET' });
}

export async function refreshTokens(refresh_token: string) {
  const data = await api('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token }),
  });

  if (data?.access_token) {
    setStoredTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? refresh_token,
    });
  }

  return data;
}

export async function logout(refresh_token: string) {
  const data = await api('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token }),
  }).catch(() => ({}));

  setStoredTokens(null);
  return data;
}

export async function logoutAll() {
  const data = await api('/auth/logout-all', {
    method: 'POST',
  }).catch(() => ({}));

  setStoredTokens(null);
  return data;
}

export async function forgotPassword(email: string) {
  return api('/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, new_password: string) {
  return api('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ token, new_password }),
  });
}

export async function startGoogleSSO(): Promise<{ authorization_url: string }> {
  const directUrl = `${API_URL}/auth/sso/google/start`;

  try {
    const res = await fetch(directUrl, { method: 'GET' });
    const data = await parseJsonSafe(res);

    if (res.ok && data?.authorization_url) {
      return data as { authorization_url: string };
    }
  } catch {
    // fallback below
  }

  return { authorization_url: directUrl };
}

export function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export { API_URL };