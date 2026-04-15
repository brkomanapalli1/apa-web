
import { useEffect, useState } from 'react';
import { forgotPassword, login, logout, logoutAll, me, refreshTokens, register, resetPassword } from '../api';
import { loadTokens, saveTokens } from '../lib/auth';
import type { AuthTokens, User } from '../lib/types';

export function useAuth() {
  const [tokens, setTokens] = useState<AuthTokens | null>(loadTokens());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    saveTokens(tokens);
  }, [tokens]);

  useEffect(() => {
    if (!tokens?.access_token) {
      setUser(null);
      return;
    }
    me().then(setUser).catch(() => setUser(null));
  }, [tokens?.access_token]);

  return {
    tokens,
    user,
    loading,
    async register(email: string, password: string, full_name: string) {
      setLoading(true);
      try {
        const res = await register({ email, password, full_name });
        setTokens(res);
        return res;
      } finally { setLoading(false); }
    },
    async login(email: string, password: string) {
      setLoading(true);
      try {
        const res = await login({ email, password });
        setTokens(res);
        return res;
      } finally { setLoading(false); }
    },
    async refresh() {
      if (!tokens?.refresh_token) return null;
      const res = await refreshTokens(tokens.refresh_token);
      setTokens(res);
      return res;
    },
    async logout() {
      if (tokens?.refresh_token) await logout(tokens.refresh_token).catch(() => null);
      setTokens(null);
      setUser(null);
    },
    async logoutAll() {
      await logoutAll();
      setTokens(null);
      setUser(null);
    },
    forgotPassword,
    resetPassword,
  };
}
