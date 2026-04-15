
import { useMemo, useState } from 'react';
import { startGoogleSSO } from '../api';
import { useAuth } from '../hooks/useAuth';

export function AuthPanel() {
  const auth = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('password123');
  const [fullName, setFullName] = useState('Demo User');
  const [resetToken, setResetToken] = useState('');
  const [message, setMessage] = useState('');

  const title = useMemo(() => ({login:'Login', register:'Create account', forgot:'Forgot password', reset:'Reset password'}[mode]), [mode]);

  async function submit() {
    try {
      if (mode === 'login') await auth.login(email, password);
      if (mode === 'register') await auth.register(email, password, fullName);
      if (mode === 'forgot') setMessage((await auth.forgotPassword(email)).message || 'Reset email sent');
      if (mode === 'reset') setMessage((await auth.resetPassword(resetToken, password)).message || 'Password reset');
    } catch (error: any) {
      setMessage(error.message || 'Action failed');
    }
  }

  async function handleGoogle() {
    try {
      const res = await startGoogleSSO();
      window.location.href = res.authorization_url;
    } catch (error: any) {
      setMessage(error.message || 'Google SSO unavailable');
    }
  }

  return (
    <div className="card auth-card">
      <h1>AI Paperwork Assistant V9</h1>
      <p>Web auth flows now include refresh-aware sessions, forgot/reset password, logout-all, and Google SSO.</p>
      <h2>{title}</h2>
      {mode === 'register' && <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />}
      {(mode === 'login' || mode === 'register' || mode === 'forgot') && <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />}
      {mode === 'reset' && <input value={resetToken} onChange={(e) => setResetToken(e.target.value)} placeholder="Reset token" />}
      {(mode === 'login' || mode === 'register' || mode === 'reset') && <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'reset' ? 'New password' : 'Password'} type="password" />}
      <div className="row">
        <button onClick={submit} disabled={auth.loading}>{title}</button>
        <button onClick={handleGoogle}>Google SSO</button>
      </div>
      <div className="row wrap">
        <button onClick={() => setMode('login')}>Login</button>
        <button onClick={() => setMode('register')}>Register</button>
        <button onClick={() => setMode('forgot')}>Forgot password</button>
        <button onClick={() => setMode('reset')}>Reset password</button>
      </div>
      {message && <p className="message">{message}</p>}
      <p className="muted">Use <strong>admin@example.com</strong> to preview admin panels after registration.</p>
    </div>
  );
}
