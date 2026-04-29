"use client";
/**
 * SettingsScreen.tsx — Fully wired Settings screen
 *
 * Replaces the static settings section in page.tsx.
 * All toggles save to backend /preferences endpoint.
 * Translation selector calls /preferences to save language.
 * Voice section wires to /voice/status and shows live state.
 * Renewal tracking calls /renewals for real data.
 */

import React, { useState, useEffect } from "react";
import {
  Volume2, Globe, Bell, Accessibility, RefreshCw,
  CheckCircle, Star, Mic, MicOff, Loader2, Calendar,
  AlertCircle, ChevronRight, Plus, Trash2,
} from "lucide-react";
import { get, post, del } from "@/lib/api/client";

// ── Types ──────────────────────────────────────────────────────────────────

interface Preferences {
  language: string;
  accessibility: {
    large_text: boolean;
    high_contrast: boolean;
    voice_only: boolean;
    text_size_scale: number;
  };
  notifications: {
    push_enabled: boolean;
    email_enabled: boolean;
    sms_enabled: boolean;
    medication_reminders: boolean;
    bill_reminders: boolean;
    deadline_alerts: boolean;
    scam_alerts: boolean;
    quiet_hours_start: string;
    quiet_hours_end: string;
  };
  voice_speed: number;
  voice_gender: string;
}

interface VoiceStatus {
  voice_enabled: boolean;
  stt_provider: string;
  tts_provider: string;
}

interface RenewalItem {
  name: string;
  expiry_date: string;
  category: string;
  days_until_expiry: number | null;
  is_urgent: boolean;
  is_expired: boolean;
  status: string;
  source: string;
  document_id: number | null;
  notes: string;
}

interface RenewalData {
  expired: RenewalItem[];
  urgent: RenewalItem[];
  upcoming: RenewalItem[];
  future: RenewalItem[];
  total: number;
  needs_immediate_action: number;
}

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español (Spanish)" },
  { code: "zh", name: "中文 (Chinese)" },
  { code: "hi", name: "हिंदी (Hindi)" },
  { code: "vi", name: "Tiếng Việt (Vietnamese)" },
  { code: "ko", name: "한국어 (Korean)" },
  { code: "ar", name: "العربية (Arabic)" },
  { code: "fr", name: "Français (French)" },
  { code: "pt", name: "Português (Portuguese)" },
  { code: "de", name: "Deutsch (German)" },
  { code: "it", name: "Italiano (Italian)" },
  { code: "tl", name: "Filipino (Tagalog)" },
];

const STATUS_COLORS: Record<string, string> = {
  expired: "bg-red-100 text-red-700 border-red-200",
  critical: "bg-red-50 text-red-600 border-red-100",
  urgent: "bg-amber-50 text-amber-700 border-amber-200",
  upcoming: "bg-blue-50 text-blue-700 border-blue-100",
  ok: "bg-green-50 text-green-700 border-green-100",
  unknown: "bg-gray-50 text-gray-600 border-gray-100",
};

// ── Toggle component ───────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled = false }: {
  value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`w-12 h-6 rounded-full relative transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
        value ? "bg-blue-600" : "bg-gray-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      aria-checked={value}
      role="switch"
    >
      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow transition-transform duration-200 ${
        value ? "translate-x-6" : "translate-x-0.5"
      }`} />
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function SettingsScreen({ onApplyAccessibility }: {
  onApplyAccessibility?: (prefs: Preferences["accessibility"]) => void;
}) {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus | null>(null);
  const [renewals, setRenewals] = useState<RenewalData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingRenewals, setLoadingRenewals] = useState(false);
  const [manualRenewal, setManualRenewal] = useState({
    name: "", expiry_date: "", category: "other", notes: ""
  });
  const [showAddRenewal, setShowAddRenewal] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    get<Preferences>("/preferences")
      .then(setPrefs)
      .catch(() => setPrefs({
        language: "en",
        accessibility: { large_text: false, high_contrast: false, voice_only: false, text_size_scale: 1.0 },
        notifications: {
          push_enabled: true, email_enabled: true, sms_enabled: false,
          medication_reminders: true, bill_reminders: true, deadline_alerts: true,
          scam_alerts: true, quiet_hours_start: "21:00", quiet_hours_end: "08:00",
        },
        voice_speed: 0.9, voice_gender: "female",
      }));

    get<VoiceStatus>("/voice/status").then(setVoiceStatus).catch(() => null);
  }, []);

  // Load renewals when section is visible
  useEffect(() => {
    setLoadingRenewals(true);
    get<RenewalData>("/renewals")
      .then(setRenewals)
      .catch(() => setRenewals(null))
      .finally(() => setLoadingRenewals(false));
  }, []);

  async function savePrefs(updates: Partial<Preferences>) {
    if (!prefs) return;
    const updated = { ...prefs, ...updates };
    setPrefs(updated);
    setSaving(true);
    try {
      await post("/preferences", updates);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (updates.accessibility && onApplyAccessibility) {
        onApplyAccessibility(updated.accessibility);
      }
    } catch {
      // revert
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  }

  function updateAccessibility(key: keyof Preferences["accessibility"], value: boolean | number) {
    if (!prefs) return;
    const newAcc = { ...prefs.accessibility, [key]: value };
    savePrefs({ accessibility: newAcc });
  }

  function updateNotification(key: keyof Preferences["notifications"], value: boolean | string) {
    if (!prefs) return;
    const newNotif = { ...prefs.notifications, [key]: value };
    savePrefs({ notifications: newNotif });
  }

  async function addManualRenewal() {
    if (!manualRenewal.name || !manualRenewal.expiry_date) return;
    try {
      await post("/renewals/manual", manualRenewal);
      const updated = await get<RenewalData>("/renewals");
      setRenewals(updated);
      setManualRenewal({ name: "", expiry_date: "", category: "other", notes: "" });
      setShowAddRenewal(false);
    } catch { /* ignore */ }
  }

  async function deleteManualRenewal(id: number) {
    await del(`/renewals/manual/${id}`);
    const updated = await get<RenewalData>("/renewals");
    setRenewals(updated);
  }

  if (!prefs) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const allRenewalItems = [
    ...(renewals?.expired ?? []),
    ...(renewals?.urgent ?? []),
    ...(renewals?.upcoming ?? []),
    ...(renewals?.future ?? []),
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">⚙️ Settings</h1>
        {saving && <span className="text-sm text-gray-500 flex items-center gap-1"><Loader2 className="w-4 h-4 animate-spin"/> Saving…</span>}
        {saved && !saving && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4"/> Saved</span>}
      </div>

      {/* ── Accessibility ───────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Accessibility className="w-5 h-5 text-blue-500" /> Accessibility
        </h2>
        <div className="space-y-4">
          {[
            { key: "large_text" as const, label: "Large text mode", desc: "Increase all text sizes by 40% for easier reading" },
            { key: "high_contrast" as const, label: "High contrast", desc: "Use higher contrast colors for better visibility" },
            { key: "voice_only" as const, label: "Voice-only mode", desc: "Optimise layout for voice navigation" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{label}</p>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
              <Toggle
                value={prefs.accessibility[key] as boolean}
                onChange={(v) => updateAccessibility(key, v)}
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Text size: {Math.round(prefs.accessibility.text_size_scale * 100)}%
            </label>
            <input
              type="range" min={80} max={180} step={10}
              value={prefs.accessibility.text_size_scale * 100}
              onChange={(e) => updateAccessibility("text_size_scale", Number(e.target.value) / 100)}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Small (80%)</span><span>Normal (100%)</span><span>Large (180%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Notifications ───────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-500" /> Notifications
        </h2>
        <div className="space-y-4">
          {[
            { key: "email_enabled" as const, label: "Email reminders", desc: "Receive deadline reminders by email" },
            { key: "push_enabled" as const, label: "Push notifications", desc: "Receive notifications on your phone" },
            { key: "sms_enabled" as const, label: "SMS alerts", desc: "Receive urgent alerts by text message" },
            { key: "medication_reminders" as const, label: "Medication reminders", desc: "Daily medication dose reminders" },
            { key: "bill_reminders" as const, label: "Bill reminders", desc: "Alert before bills are due" },
            { key: "deadline_alerts" as const, label: "Deadline alerts", desc: "Alerts for important document deadlines" },
            { key: "scam_alerts" as const, label: "Scam alerts", desc: "Immediate alerts when suspicious documents detected" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{label}</p>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
              <Toggle
                value={prefs.notifications[key] as boolean}
                onChange={(v) => updateNotification(key, v)}
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quiet hours start</label>
              <input
                type="time"
                value={prefs.notifications.quiet_hours_start}
                onChange={(e) => updateNotification("quiet_hours_start", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quiet hours end</label>
              <input
                type="time"
                value={prefs.notifications.quiet_hours_end}
                onChange={(e) => updateNotification("quiet_hours_end", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Voice ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-blue-500" /> Voice Assistant
        </h2>
        {voiceStatus?.voice_enabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
              <Mic className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Voice features active</p>
                <p className="text-sm text-green-600">Speech recognition: {voiceStatus.stt_provider}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Speech speed: {Math.round(prefs.voice_speed * 100)}%
              </label>
              <input
                type="range" min={50} max={150} step={10}
                value={prefs.voice_speed * 100}
                onChange={(e) => savePrefs({ voice_speed: Number(e.target.value) / 100 })}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Slower</span><span>Normal</span><span>Faster</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Voice</label>
              <div className="flex gap-3">
                {[{ v: "female", l: "Female (Nova)" }, { v: "male", l: "Male (Echo)" }].map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => savePrefs({ voice_gender: v })}
                    className={`flex-1 py-2 rounded-xl border text-sm font-medium transition ${
                      prefs.voice_gender === v
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <MicOff className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 font-medium">Voice features not configured</p>
            <p className="text-xs text-gray-400 mt-1">Add OPENAI_API_KEY to your backend .env to enable voice</p>
          </div>
        )}
      </div>

      {/* ── Language & Translation ──────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-500" /> Language & Translation
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Preferred language</label>
            <select
              value={prefs.language}
              onChange={(e) => savePrefs({ language: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {LANGUAGES.map(({ code, name }) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
          {prefs.language !== "en" && (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700">
                Document summaries and explanations will be translated to {LANGUAGES.find(l => l.code === prefs.language)?.name} when you upload new documents.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Renewal Tracking ────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-500" /> Renewal Tracking
          </h2>
          <button
            onClick={() => setShowAddRenewal(!showAddRenewal)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {showAddRenewal && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <input
              placeholder="Name (e.g. Passport, Driver's License)"
              value={manualRenewal.name}
              onChange={(e) => setManualRenewal(p => ({ ...p, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={manualRenewal.expiry_date}
              onChange={(e) => setManualRenewal(p => ({ ...p, expiry_date: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            />
            <select
              value={manualRenewal.category}
              onChange={(e) => setManualRenewal(p => ({ ...p, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            >
              {["medicare", "insurance", "housing", "medication", "identity", "other"].map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={addManualRenewal} className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-medium">Save</button>
              <button onClick={() => setShowAddRenewal(false)} className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2 text-sm">Cancel</button>
            </div>
          </div>
        )}

        {loadingRenewals ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
        ) : allRenewalItems.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No renewals tracked yet. Upload documents or add them manually above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allRenewalItems.map((item, i) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${STATUS_COLORS[item.status] ?? STATUS_COLORS.unknown}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    {item.expiry_date}
                    {item.days_until_expiry !== null && (
                      <span className="ml-1">
                        ({item.is_expired ? "expired" : `${item.days_until_expiry} days left`})
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 capitalize">{item.status}</span>
                  {item.source === "manual" && (
                    <button
                      onClick={() => deleteManualRenewal((item as any).id)}
                      className="opacity-60 hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Subscription ────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-6 h-6 text-yellow-300" />
          <h2 className="text-lg font-bold">Upgrade to Premium</h2>
        </div>
        <ul className="space-y-2 text-sm mb-4">
          {[
            "Unlimited document uploads",
            "Voice assistant mode",
            "Multi-language translation",
            "Priority AI analysis",
            "Family dashboard (up to 5 caregivers)",
            "Emergency vault with 1GB storage",
          ].map(f => (
            <li key={f} className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-300 shrink-0" />{f}
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <button className="flex-1 bg-white text-blue-700 font-bold py-2.5 rounded-xl hover:bg-blue-50 transition">
            $5/month
          </button>
          <button className="flex-1 bg-white/20 text-white font-bold py-2.5 rounded-xl hover:bg-white/30 transition">
            $48/year
          </button>
        </div>
      </div>
    </div>
  );
}
