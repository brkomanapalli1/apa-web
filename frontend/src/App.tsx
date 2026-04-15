import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  forgotPassword,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  resetPassword,
  Tokens,
} from './api';
import './styles.css';

const authKey = 'tokens';
const SUPPORTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.bmp', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'];
const FILE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.bmp,.doc,.docx,.xls,.xlsx,.csv,.txt';

type Tab = 'home' | 'documents' | 'helpers' | 'admin';
type ViewMode = 'simple' | 'helper';
type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

type Notice = { type: 'info' | 'success' | 'error'; text: string } | null;

function parseJson(value: unknown) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getDisplayName(value: unknown, fallback = 'Untitled document'): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.filename === 'string') return obj.filename;
    if (typeof obj.name === 'string') return obj.name;
  }
  return fallback;
}

function friendlyStatus(status?: string) {
  switch (String(status || '').toLowerCase()) {
    case 'completed':
    case 'processed':
      return 'Ready';
    case 'processing':
    case 'queued':
    case 'uploaded':
    case 'uploading':
      return 'Analyzing';
    case 'failed':
      return 'Needs attention';
    case 'quarantined':
      return 'Blocked';
    default:
      return 'Uploaded';
  }
}

function friendlyWorkflow(state?: string) {
  switch (String(state || '').toLowerCase()) {
    case 'new': return 'Uploaded';
    case 'needs_review': return 'Needs your attention';
    case 'in_progress': return 'Waiting on a response';
    case 'waiting_on_user': return 'Waiting on you';
    case 'done': return 'Resolved';
    default: return 'Uploaded';
  }
}

function helperRoleLabel(role?: string) {
  switch (String(role || '').toLowerCase()) {
    case 'admin': return 'Can manage';
    case 'member': return 'Can help';
    default: return 'Can view';
  }
}

function documentTypeLabel(value?: string) {
  return String(value || 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getExtension(filename: string) {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

function inferMimeType(file: File) {
  const ext = getExtension(file.name);
  if (file.type) return file.type;
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.bmp': 'image/bmp',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

function isSupportedFile(file: File) {
  return SUPPORTED_EXTENSIONS.includes(getExtension(file.name));
}

function initialAuthMode(): AuthMode {
  const params = new URLSearchParams(window.location.search);
  if (params.get('token')) return 'reset';
  if (window.location.pathname.includes('reset-password')) return 'reset';
  return 'login';
}

export default function App() {
  const [tokens, setTokens] = useState<Tokens>(() => {
    try {
      return JSON.parse(localStorage.getItem(authKey) || 'null');
    } catch {
      return null;
    }
  });

  const [tab, setTab] = useState<Tab>('home');
  const [viewMode, setViewMode] = useState<ViewMode>('simple');
  const [authMode, setAuthMode] = useState<AuthMode>(initialAuthMode());
  const [notice, setNotice] = useState<Notice>(null);

  const [docs, setDocs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);

  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password123');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('token') || '');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [commentBody, setCommentBody] = useState('');
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<number | null>(null);
  const uploadXhrRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => {
    localStorage.setItem(authKey, JSON.stringify(tokens));
  }, [tokens]);

  useEffect(() => {
    if (tokens?.access_token) {
      void hydrate();
    }
  }, [tokens?.access_token]);

  useEffect(() => () => {
    stopPolling();
    uploadXhrRef.current?.abort();
  }, []);

  const parsedFields = useMemo(() => parseJson(selected?.extracted_fields) || {}, [selected?.extracted_fields]);
  const parsedActions = useMemo(() => (parseJson(selected?.recommended_actions) || []) as any[], [selected?.recommended_actions]);
  const parsedLetter = useMemo(() => parseJson(selected?.generated_letter) || {}, [selected?.generated_letter]);
  const seniorView = parsedFields?.ui_summary || {};

  const counts = useMemo(() => {
    const total = docs.length;
    const analyzing = docs.filter((doc) => ['uploading', 'uploaded', 'queued', 'processing'].includes(String(doc.status).toLowerCase())).length;
    const needsAttention = docs.filter((doc) => ['failed', 'quarantined'].includes(String(doc.status).toLowerCase()) || ['needs_review', 'waiting_on_user'].includes(String(doc.workflow_state).toLowerCase())).length;
    const resolved = docs.filter((doc) => String(doc.workflow_state).toLowerCase() === 'done' || String(doc.status).toLowerCase() === 'completed').length;
    return { total, analyzing, needsAttention, resolved };
  }, [docs]);

  async function hydrate() {
    const [docRes, userRes, invitationRes] = await Promise.all([
      api('/documents', {}, tokens, setTokens).catch(() => []),
      api('/admin/users', {}, tokens, setTokens).catch(() => []),
      api('/invitations', {}, tokens, setTokens).catch(() => []),
    ]);
    setDocs(Array.isArray(docRes) ? docRes : []);
    setUsers(Array.isArray(userRes) ? userRes : []);
    setInvitations(Array.isArray(invitationRes) ? invitationRes : []);
  }

  function stopPolling() {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
  }

  function setSuccess(text: string) {
    setNotice({ type: 'success', text });
  }

  function setError(text: string) {
    setNotice({ type: 'error', text });
  }

  function setInfo(text: string) {
    setNotice({ type: 'info', text });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    try {
      const data = await apiLogin({ email, password });
      setTokens(data);
      setSuccess('Signed in successfully.');
    } catch (error: any) {
      setError(error?.message || 'Login failed');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    try {
      const data = await apiRegister({ email: registerEmail, password: registerPassword, full_name: registerName });
      setTokens(data);
      setSuccess('Account created successfully.');
    } catch (error: any) {
      setError(error?.message || 'Registration failed');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    try {
      await forgotPassword(forgotEmail);
      setSuccess('If the account exists, a reset email has been sent.');
      setAuthMode('login');
    } catch (error: any) {
      setError(error?.message || 'Unable to send reset email');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    try {
      await resetPassword(resetToken, resetNewPassword);
      setSuccess('Password reset successful. Please sign in with your new password.');
      setAuthMode('login');
      setPassword('');
      setResetNewPassword('');
    } catch (error: any) {
      setError(error?.message || 'Unable to reset password');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    try {
      if (tokens?.refresh_token) {
        await apiLogout(tokens.refresh_token);
      }
    } finally {
      stopPolling();
      setTokens(null);
      setSelected(null);
      setDocs([]);
      setUsers([]);
      setInvitations([]);
      setComments([]);
      setActivity([]);
      setVersions([]);
      setSuccess('Signed out.');
      setAuthMode('login');
    }
  }

  function cancelUpload() {
    uploadXhrRef.current?.abort();
    uploadXhrRef.current = null;
    setIsUploading(false);
    setUploadProgress(0);
    setUploadFileName('');
    setInfo('Upload canceled.');
  }

  function uploadFileWithProgress(url: string, file: File, onProgress: (percent: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      uploadXhrRef.current = xhr;
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', inferMimeType(file));
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        uploadXhrRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve();
          return;
        }
        reject(new Error(`Upload failed with status ${xhr.status}`));
      };
      xhr.onerror = () => {
        uploadXhrRef.current = null;
        reject(new Error('Network error during upload'));
      };
      xhr.onabort = () => {
        uploadXhrRef.current = null;
        reject(new Error('Upload canceled'));
      };
      xhr.send(file);
    });
  }

  async function pollDocument(documentId: number) {
    stopPolling();
    setIsPolling(true);
    setInfo('Your document is being analyzed.');

    const run = async () => {
      try {
        const job = await api(`/documents/${documentId}/status`, {}, tokens, setTokens);
        const status = String(job?.status ?? '').toLowerCase();

        if (['completed', 'processed'].includes(status)) {
          stopPolling();
          await hydrate();
          await openDocument(documentId);
          setSuccess('Analysis is ready.');
          return true;
        }
        if (['failed', 'quarantined'].includes(status)) {
          stopPolling();
          await hydrate();
          setError(status === 'quarantined' ? 'This file was blocked during safety scanning.' : 'We could not finish analyzing this document.');
          return true;
        }

        setInfo(`Still analyzing... (${status || 'queued'})`);
        return false;
      } catch (error: any) {
        stopPolling();
        setError(error?.message || 'Unable to check document status');
        return true;
      }
    };

    const finishedImmediately = await run();
    if (finishedImmediately) return;

    pollingRef.current = window.setInterval(() => {
      void run();
    }, 3000);
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isSupportedFile(file)) {
      setError(`Unsupported file. Use one of: ${SUPPORTED_EXTENSIONS.join(', ')}`);
      e.target.value = '';
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadFileName(file.name);
      setInfo(`Preparing ${file.name}...`);

      const presigned = await api('/documents/presigned-upload', {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, mime_type: inferMimeType(file) }),
      }, tokens, setTokens);

      setInfo(`Uploading ${file.name}...`);
      await uploadFileWithProgress(presigned.upload_url, file, setUploadProgress);

      const completion = await api('/documents/complete-upload', {
        method: 'POST',
        body: JSON.stringify({ document_id: presigned.document_id }),
      }, tokens, setTokens);

      await hydrate();
      setTab('documents');
      if (String(completion?.status).toLowerCase() === 'completed') {
        await openDocument(presigned.document_id);
        setSuccess('Analysis is ready.');
      } else {
        await pollDocument(presigned.document_id);
      }
    } catch (error: any) {
      if (error?.status === 409) {
        setError(error?.message || 'This document was already uploaded.');
      } else {
        setError(error?.message || 'Upload failed');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadFileName('');
      e.target.value = '';
    }
  }

  async function openDocument(id: number) {
    const [doc, c, a, v] = await Promise.all([
      api(`/documents/${id}`, {}, tokens, setTokens),
      api(`/documents/${id}/comments`, {}, tokens, setTokens).catch(() => []),
      api(`/documents/${id}/activity`, {}, tokens, setTokens).catch(() => []),
      api(`/documents/${id}/versions`, {}, tokens, setTokens).catch(() => []),
    ]);
    setSelected(doc);
    setComments(Array.isArray(c) ? c : []);
    setActivity(Array.isArray(a) ? a : []);
    setVersions(Array.isArray(v) ? v : []);
    setTab('documents');
  }

  async function deleteDocument() {
    if (!selected) return;
    if (!window.confirm(`Delete "${getDisplayName(selected.name)}"?`)) return;
    try {
      await api(`/documents/${selected.id}`, { method: 'DELETE' }, tokens, setTokens);
      setSelected(null);
      setComments([]);
      setActivity([]);
      setVersions([]);
      await hydrate();
      setSuccess('Document deleted.');
      setTab('home');
    } catch (error: any) {
      setError(error?.message || 'Delete failed');
    }
  }

  async function postComment() {
    if (!selected || !commentBody.trim()) return;
    try {
      await api(`/documents/${selected.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: commentBody.trim() }),
      }, tokens, setTokens);
      setCommentBody('');
      await openDocument(selected.id);
      setSuccess('Note added.');
    } catch (error: any) {
      setError(error?.message || 'Unable to add note');
    }
  }

  async function updateWorkflow(workflow_state: string) {
    if (!selected) return;
    try {
      const doc = await api(`/documents/${selected.id}/workflow`, {
        method: 'POST',
        body: JSON.stringify({ workflow_state }),
      }, tokens, setTokens);
      setSelected(doc);
      await hydrate();
      setSuccess('Status updated.');
    } catch (error: any) {
      setError(error?.message || 'Unable to update status');
    }
  }

  async function assign(assigned_to_user_id: string) {
    if (!selected) return;
    try {
      const value = assigned_to_user_id ? Number(assigned_to_user_id) : null;
      const doc = await api(`/documents/${selected.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assigned_to_user_id: value }),
      }, tokens, setTokens);
      setSelected(doc);
      await hydrate();
      setSuccess('Helper assignment updated.');
    } catch (error: any) {
      setError(error?.message || 'Unable to update helper assignment');
    }
  }

  async function sendInvite() {
    try {
      await api('/invitations', {
        method: 'POST',
        body: JSON.stringify({ invitee_email: inviteeEmail, role: inviteRole }),
      }, tokens, setTokens);
      setInviteeEmail('');
      setInviteRole('viewer');
      await hydrate();
      setSuccess('Trusted helper invited.');
    } catch (error: any) {
      setError(error?.message || 'Unable to send invite');
    }
  }

  async function generateLetter() {
    if (!selected) return;
    try {
      const data = await api(`/documents/${selected.id}/generate-letter`, { method: 'POST', body: JSON.stringify({}) }, tokens, setTokens);
      setSelected((prev: any) => ({ ...prev, generated_letter: data }));
      setSuccess('Draft letter generated.');
    } catch (error: any) {
      setError(error?.message || 'Unable to generate letter');
    }
  }

  if (!tokens?.access_token) {
    return (
      <div className="auth-shell">
        <div className="panel auth-panel">
          <span className="eyebrow">AI paperwork help for seniors</span>
          <h1 style={{ marginTop: 0 }}>AI Paperwork Assistant</h1>
          <p className="muted">Upload medical bills, Medicare notices, Medicaid letters, insurance paperwork, and household bills. The app explains what the document means and what to do next.</p>

          <div className="row wrap" style={{ marginBottom: 16 }}>
            <button type="button" onClick={() => setAuthMode('login')}>Sign in</button>
            <button type="button" onClick={() => setAuthMode('register')}>Register</button>
            <button type="button" onClick={() => setAuthMode('forgot')}>Forgot password</button>
            <button type="button" onClick={() => setAuthMode('reset')}>Reset password</button>
          </div>

          {notice && <div className="callout" style={{ marginBottom: 16 }}>{notice.text}</div>}

          {authMode === 'login' && (
            <form onSubmit={handleLogin}>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
              <button type="submit" disabled={authBusy}>{authBusy ? 'Signing in...' : 'Sign in'}</button>
            </form>
          )}

          {authMode === 'register' && (
            <form onSubmit={handleRegister}>
              <input value={registerName} onChange={(e) => setRegisterName(e.target.value)} placeholder="Full name" required />
              <input value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} placeholder="Email" type="email" required />
              <input value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} placeholder="Password" type="password" minLength={8} required />
              <button type="submit" disabled={authBusy}>{authBusy ? 'Creating account...' : 'Create account'}</button>
            </form>
          )}

          {authMode === 'forgot' && (
            <form onSubmit={handleForgotPassword}>
              <input value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="Your email" type="email" required />
              <button type="submit" disabled={authBusy}>{authBusy ? 'Sending...' : 'Send reset email'}</button>
            </form>
          )}

          {authMode === 'reset' && (
            <form onSubmit={handleResetPassword}>
              <input value={resetToken} onChange={(e) => setResetToken(e.target.value)} placeholder="Reset token" required />
              <input value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} placeholder="New password" type="password" minLength={8} required />
              <button type="submit" disabled={authBusy}>{authBusy ? 'Resetting...' : 'Reset password'}</button>
            </form>
          )}

          <div className="callout" style={{ marginTop: 16 }}>
            <strong>Supported uploads:</strong> {SUPPORTED_EXTENSIONS.join(', ')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>P1</div>
        <button type="button" onClick={() => setTab('home')}>Dashboard</button>
        <button type="button" onClick={() => setTab('documents')}>Documents</button>
        <button type="button" onClick={() => setTab('helpers')}>Trusted helpers</button>
        <button type="button" onClick={() => setTab('admin')}>Admin</button>
        <button type="button" onClick={handleLogout}>Sign out</button>
      </aside>

      <main className="content">
        <div className="topbar">
          <div>
            <h1 style={{ marginBottom: 10 }}>AI Paperwork Assistant</h1>
            <p className="muted" style={{ marginTop: 0 }}>Senior-first paperwork help for medical bills, Medicare, Medicaid, insurance notices, and household bills.</p>
          </div>
          <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)} style={{ minWidth: 180 }}>
              <option value="simple">Simple mode</option>
              <option value="helper">Helper mode</option>
            </select>
            {isPolling && <div className="status-chip">Analyzing document…</div>}
          </div>
        </div>

        {notice && <div className="callout" style={{ marginBottom: 16 }}>{notice.text}</div>}

        {tab === 'home' && (
          <div className="grid two">
            <section className="panel">
              <h2 style={{ marginTop: 0 }}>Quick actions</h2>
              <div className="row wrap">
                <label className="upload" aria-disabled={isUploading}>
                  Upload document
                  <input type="file" accept={FILE_ACCEPT} onChange={upload} disabled={isUploading} />
                </label>
                <button type="button" onClick={() => void hydrate()}>Refresh workspace</button>
                {isUploading && <button type="button" onClick={cancelUpload}>Cancel upload</button>}
              </div>
              <p className="muted">Supported: {SUPPORTED_EXTENSIONS.join(', ')}</p>
              {isUploading && (
                <div className="upload-progress">
                  <div className="upload-progress__label">Uploading {uploadFileName} ({uploadProgress}%)</div>
                  <div className="upload-progress__track"><div className="upload-progress__bar" style={{ width: `${uploadProgress}%` }} /></div>
                </div>
              )}
              <div className="metric-strip">
                <div className="metric"><span className="muted">Documents</span><strong>{counts.total}</strong></div>
                <div className="metric"><span className="muted">Analyzing</span><strong>{counts.analyzing}</strong></div>
                <div className="metric"><span className="muted">Needs attention</span><strong>{counts.needsAttention}</strong></div>
                <div className="metric"><span className="muted">Resolved</span><strong>{counts.resolved}</strong></div>
              </div>
            </section>

            <section className="panel">
              <h2 style={{ marginTop: 0 }}>What this app helps with</h2>
              <div className="list">
                <div className="callout"><strong>Medical bills</strong><div className="muted">Find amount due, date, provider, and next steps.</div></div>
                <div className="callout"><strong>Medicare or Medicaid notices</strong><div className="muted">Understand whether it is a bill, notice, or coverage action.</div></div>
                <div className="callout"><strong>Trusted helper support</strong><div className="muted">Share paperwork with family or helpers only when you want.</div></div>
              </div>
            </section>
          </div>
        )}

        {tab === 'documents' && (
          <div className="grid detail-layout">
            <section className="panel">
              <div className="row between">
                <h2 style={{ marginTop: 0 }}>Your documents</h2>
                <button type="button" onClick={() => void hydrate()}>Refresh</button>
              </div>
              <div className="list">
                {docs.map((doc) => (
                  <button key={doc.id} type="button" className={`doc-item ${selected?.id === doc.id ? 'active' : ''}`} onClick={() => void openDocument(doc.id)}>
                    <strong>{getDisplayName(doc.name)}</strong>
                    <span className="muted">{documentTypeLabel(doc.document_type)}</span>
                    <span className="muted">Status: {friendlyStatus(doc.status)}</span>
                    <span className="muted">Action: {friendlyWorkflow(doc.workflow_state)}</span>
                  </button>
                ))}
                {!docs.length && <div className="callout">No documents yet. Upload your first bill or notice.</div>}
              </div>
            </section>

            <section className="panel">
              {!selected ? (
                <div className="callout">Choose a document to review.</div>
              ) : (
                <>
                  <div className="row between" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <h2 style={{ marginTop: 0, marginBottom: 6 }}>{getDisplayName(selected.name)}</h2>
                      <div className="muted">{documentTypeLabel(selected.document_type)} · {friendlyStatus(selected.status)} · {friendlyWorkflow(selected.workflow_state)}</div>
                    </div>
                    <div className="row wrap">
                      <button type="button" onClick={generateLetter}>Generate letter</button>
                      <button type="button" onClick={deleteDocument}>Delete</button>
                    </div>
                  </div>

                  <div className="insight-grid">
                    <div className="action-card"><strong>What this is</strong><div className="muted" style={{ marginTop: 8 }}>{seniorView.what_this_is || selected.summary || 'Analysis summary will appear here.'}</div></div>
                    <div className="action-card"><strong>Do I need to pay now?</strong><div className="muted" style={{ marginTop: 8 }}>{seniorView.do_i_need_to_pay_now || parsedFields.patient_responsibility || parsedFields.amount_due || 'Review the document details first.'}</div></div>
                    <div className="action-card"><strong>Main date</strong><div className="muted" style={{ marginTop: 8 }}>{seniorView.main_date || parsedFields.renewal_due_date || parsedFields.statement_date || parsedFields.service_date || 'No main date detected.'}</div></div>
                  </div>

                  <div className="grid two" style={{ marginTop: 16 }}>
                    <div className="subpanel">
                      <h3 style={{ marginTop: 0 }}>Important details</h3>
                      {Object.entries(parsedFields).filter(([key]) => !['all_detected_amounts', 'ui_summary'].includes(key)).slice(0, 12).map(([key, value]) => (
                        <div className="field-row" key={key}>
                          <span className="muted">{documentTypeLabel(key)}</span>
                          <strong>{typeof value === 'object' ? JSON.stringify(value) : String(value || '—')}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="subpanel">
                      <h3 style={{ marginTop: 0 }}>What to do next</h3>
                      <div className="list">
                        {parsedActions.length ? parsedActions.map((item, index) => (
                          <div className="action-card" key={index}>
                            <strong>{item.title || `Next step ${index + 1}`}</strong>
                            <div className="muted" style={{ marginTop: 6 }}>{item.why || item.reason || 'Recommended follow-up.'}</div>
                            <div style={{ marginTop: 8 }}>{item.action || 'Review this document carefully.'}</div>
                          </div>
                        )) : <div className="callout">No recommendations yet.</div>}
                      </div>
                    </div>
                  </div>

                  {parsedLetter?.body && (
                    <div className="letter-card" style={{ marginTop: 16 }}>
                      <h3 style={{ marginTop: 0 }}>{parsedLetter.title || 'Draft letter'}</h3>
                      <div className="muted" style={{ marginBottom: 8 }}>Subject: {parsedLetter.subject || 'No subject'}</div>
                      <pre>{parsedLetter.body}</pre>
                    </div>
                  )}

                  {viewMode === 'helper' && (
                    <div className="grid two" style={{ marginTop: 16 }}>
                      <div className="subpanel">
                        <h3 style={{ marginTop: 0 }}>Helper tools</h3>
                        <select value={selected.assigned_to_user_id || ''} onChange={(e) => void assign(e.target.value)}>
                          <option value="">No helper assigned</option>
                          {users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email}</option>)}
                        </select>
                        <select value={selected.workflow_state || 'new'} onChange={(e) => void updateWorkflow(e.target.value)}>
                          <option value="new">Uploaded</option>
                          <option value="needs_review">Needs your attention</option>
                          <option value="in_progress">Waiting on a response</option>
                          <option value="waiting_on_user">Waiting on you</option>
                          <option value="done">Resolved</option>
                        </select>
                        <textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Add a note for a trusted helper" rows={4} />
                        <button type="button" onClick={postComment}>Save note</button>
                      </div>

                      <div className="subpanel">
                        <h3 style={{ marginTop: 0 }}>Activity</h3>
                        <div className="list">
                          {comments.map((item) => <div key={`comment-${item.id}`} className="comment"><strong>{item.user_name || 'User'}</strong><div>{item.body}</div></div>)}
                          {activity.map((item) => <div key={`activity-${item.id}`} className="activity"><strong>{item.action}</strong><div className="muted">{item.actor_name || 'System'}</div></div>)}
                          {versions.map((item) => <div key={`version-${item.id}`} className="version"><strong>Version {item.version_number}</strong><div className="muted">{item.created_at}</div></div>)}
                          {!comments.length && !activity.length && !versions.length && <div className="callout">No helper activity yet.</div>}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}

        {tab === 'helpers' && (
          <div className="grid two">
            <section className="panel">
              <h2 style={{ marginTop: 0 }}>Invite a trusted helper</h2>
              <input value={inviteeEmail} onChange={(e) => setInviteeEmail(e.target.value)} placeholder="Helper email" type="email" />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                <option value="viewer">Can view</option>
                <option value="member">Can help</option>
                <option value="admin">Can manage</option>
              </select>
              <button type="button" onClick={sendInvite}>Send invite</button>
            </section>
            <section className="panel">
              <h2 style={{ marginTop: 0 }}>Current invitations</h2>
              <div className="list">
                {invitations.map((invite) => (
                  <div key={invite.id} className="user-row">
                    <div>
                      <strong>{invite.invitee_email}</strong>
                      <div className="muted">{helperRoleLabel(invite.role)}</div>
                    </div>
                    <div className="muted">{invite.accepted ? 'Accepted' : 'Pending'}</div>
                  </div>
                ))}
                {!invitations.length && <div className="callout">No helper invitations yet.</div>}
              </div>
            </section>
          </div>
        )}

        {tab === 'admin' && (
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Users</h2>
            <div className="list">
              {users.map((user) => (
                <div key={user.id} className="user-row">
                  <div>
                    <strong>{user.full_name || user.email}</strong>
                    <div className="muted">{user.email}</div>
                  </div>
                  <div className="muted">{helperRoleLabel(user.role)}</div>
                </div>
              ))}
              {!users.length && <div className="callout">No users found.</div>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
