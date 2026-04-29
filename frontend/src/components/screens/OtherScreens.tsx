"use client";
/**
 * Remaining app screens — each exported as a named component.
 * These are smaller screens that don't yet warrant their own file.
 * As features grow, split each into its own file in this folder.
 */
import { useEffect, useState } from "react";
import {
  Accessibility, Bell, Calendar, CheckCircle, Globe, Heart,
  Loader2, Lock, Mic, MicOff, Phone, Pill, Plus, RefreshCw,
  Star, Trash2, Users, Volume2,
} from "lucide-react";
import { clsx } from "clsx";
import { del, get, post, ApiError } from "@/lib/api/client";
import type {
  CaregiverMember, Document, MedicationEntry,
  TimelineEvent, User, VaultItem,
} from "@/types";
import type { ToastType } from "@/types";
import { formatDate } from "@/lib/utils";

// ── Medications ────────────────────────────────────────────────────────────

interface MedEntry extends MedicationEntry { doc_name: string; doc_id: number; }

const TIME_SLOTS: Record<string, string[]> = {
  Morning:  ["06","07","08","09","10","11"],
  Noon:     ["12","13"],
  Afternoon:["14","15","16"],
  Evening:  ["17","18","19","20"],
  Bedtime:  ["21","22","23","00"],
};
const SLOT_EMOJI: Record<string, string> = {
  Morning:"🌅", Noon:"☀️", Afternoon:"🌤️", Evening:"🌆", Bedtime:"🌙", "As Needed":"💊",
};

export function MedicationsScreen({ medications }: { medications: MedEntry[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">💊 Medication Schedule</h1>
        <p className="text-gray-500 mt-1">Extracted from your prescription and discharge paperwork.</p>
      </div>

      {medications.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <Pill className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No medications extracted yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Upload prescription paperwork or hospital discharge papers to see your schedule.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(["Morning","Noon","Afternoon","Evening","Bedtime","As Needed"] as const).map(slot => {
            const slotMeds = medications.filter(m => {
              const times = m.reminder_times ?? [];
              if (slot === "As Needed") return times.length === 0;
              return times.some(t => TIME_SLOTS[slot]?.includes(t.slice(0, 2)));
            });
            if (!slotMeds.length) return null;
            return (
              <div key={slot} className="bg-white border border-gray-200 rounded-2xl p-5">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-xl">{SLOT_EMOJI[slot]}</span>
                  {slot}
                  {slotMeds[0]?.reminder_times?.[0] && (
                    <span className="text-xs text-gray-500 font-normal">({slotMeds[0].reminder_times[0]})</span>
                  )}
                </h3>
                <div className="space-y-3">
                  {slotMeds.map((m, i) => (
                    <div key={i} className="p-3 bg-green-50 rounded-xl">
                      <p className="font-semibold text-green-900">{m.name}{m.dosage ? ` — ${m.dosage}` : ""}</p>
                      <p className="text-xs text-green-700 mt-0.5">{m.instructions || m.frequency || "As prescribed"}</p>
                      {m.with_food !== null && (
                        <p className="text-xs text-green-600 mt-0.5">{m.with_food ? "🍽 Take with food" : "💧 Empty stomach"}</p>
                      )}
                      {m.refill_date && <p className="text-xs text-amber-600 mt-1">📅 Refill by: {m.refill_date}</p>}
                      <p className="text-xs text-gray-400 mt-1">From: {m.doc_name}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-sm text-blue-800">
          <strong>⚕️ Medical Disclaimer:</strong> Medication information is extracted for reminder
          purposes only. Always follow your doctor's or pharmacist's exact instructions.
          This is not medical advice.
        </p>
      </div>
    </div>
  );
}

// ── Caregiver ──────────────────────────────────────────────────────────────

export function CaregiverScreen({
  caregivers, onRefetch, toast,
}: { caregivers: CaregiverMember[]; onRefetch: () => void; toast: (t: ToastType, m: string) => void; }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [busy, setBusy] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await post("/invitations", { invitee_email: email.trim(), role });
      setEmail("");
      toast("success", "Invitation sent!");
      onRefetch();
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Could not send invitation.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">👨‍👩‍👧 Caregiver Access</h1>
        <p className="text-gray-500 mt-1">Invite trusted family members to help manage paperwork.</p>
      </div>

      {/* Permission level explainer */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Permission Levels</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { role:"Viewer", icon:"👁", desc:"Can see summaries and deadlines only." },
            { role:"Member", icon:"✏️", desc:"Can add notes and help respond to documents." },
            { role:"Admin",  icon:"🔑", desc:"Full access — can upload, delete, and manage all documents." },
          ].map(({ role: r, icon, desc }) => (
            <div key={r} className="p-4 bg-gray-50 rounded-xl">
              <p className="text-2xl mb-2">{icon}</p>
              <p className="font-semibold text-gray-900">{r}</p>
              <p className="text-xs text-gray-500 mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Invite form */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Invite a Caregiver</h2>
        <form onSubmit={invite} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Their email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="family@example.com"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Permission level</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base">
              <option value="viewer">Viewer — can see summaries and deadlines</option>
              <option value="member">Member — can add notes and help respond</option>
              <option value="admin">Admin — full access</option>
            </select>
          </div>
          <button type="submit" disabled={busy || !email.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition">
            {busy ? "Sending…" : "Send Invitation"}
          </button>
        </form>
      </div>

      {/* Current members */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Current Members ({caregivers.length})</h2>
        {caregivers.length === 0 ? (
          <p className="text-gray-400 text-sm">No caregiver members yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {caregivers.map(c => (
              <div key={c.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{c.full_name || c.email}</p>
                  <p className="text-sm text-gray-500">{c.email} · {c.role}</p>
                </div>
                <span className={clsx("text-xs font-medium px-2.5 py-1 rounded-full",
                  c.accepted ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                  {c.accepted ? "Active" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Emergency Vault ────────────────────────────────────────────────────────

const VAULT_CATEGORIES = [
  { name: "Medical",   icon: "🏥" },
  { name: "Financial", icon: "💰" },
  { name: "Legal",     icon: "⚖️" },
  { name: "Identity",  icon: "🪪" },
  { name: "Contacts",  icon: "📞" },
];

export function VaultScreen({ items }: { items: VaultItem[] }) {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">🔒 Emergency Document Vault</h1>
        <p className="text-gray-500 mt-1">Important documents instantly accessible in emergencies.</p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <p className="text-sm text-amber-800">
          <strong>📋 What to store here:</strong> Insurance cards, Medicare card, medical contacts,
          medication list, power of attorney, ID copies, emergency contacts, living will.
        </p>
      </div>
      {VAULT_CATEGORIES.map(({ name, icon }) => {
        const catItems = items.filter(v => v.category.toLowerCase() === name.toLowerCase());
        return (
          <div key={name} className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{icon} {name}</h2>
              <span className="text-sm text-gray-400">{catItems.length} item{catItems.length !== 1 ? "s" : ""}</span>
            </div>
            {catItems.length === 0 ? (
              <p className="text-gray-400 text-sm">No {name.toLowerCase()} documents in vault yet.</p>
            ) : (
              <div className="space-y-2">
                {catItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                    </div>
                    <p className="text-xs text-gray-400">{formatDate(item.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Timeline ───────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  medical:   "bg-blue-100 text-blue-800",
  financial: "bg-green-100 text-green-800",
  legal:     "bg-purple-100 text-purple-800",
  utility:   "bg-amber-100 text-amber-800",
  government:"bg-red-100 text-red-800",
};

export function TimelineScreen({
  events, onSelectDoc,
}: { events: TimelineEvent[]; onSelectDoc: (id: number) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">📅 Document Timeline</h1>
        <p className="text-gray-500 mt-1">Your complete life-document history in chronological order.</p>
      </div>
      {events.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No timeline events yet. Upload documents to build your timeline.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-6">
            {events.map(event => (
              <div key={event.id} className="flex gap-6">
                <div className="w-16 text-center shrink-0">
                  <div className="w-4 h-4 bg-blue-600 rounded-full mx-auto relative z-10 mt-1" />
                  <p className="text-xs text-gray-500 mt-1">{event.date.slice(0, 10)}</p>
                </div>
                <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-4 mb-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900">{event.title}</p>
                    <span className={clsx(
                      "text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 capitalize",
                      CAT_COLORS[event.category] || "bg-gray-100 text-gray-700"
                    )}>{event.category}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{event.summary}</p>
                  {event.document_id && (
                    <button onClick={() => onSelectDoc(event.document_id!)}
                      className="text-blue-600 text-xs mt-2 hover:underline">
                      View document →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Benefits Navigator ─────────────────────────────────────────────────────

const DEFAULT_BENEFITS = [
  { name:"Medicare",               cat:"Health",    phone:"1-800-633-4227", url:"medicare.gov",          desc:"Health insurance for people 65+ and some younger people with disabilities." },
  { name:"Medicaid",               cat:"Health",    phone:"1-800-318-2596", url:"medicaid.gov",           desc:"Free or low-cost health coverage for people with limited income." },
  { name:"Social Security",        cat:"Income",    phone:"1-800-772-1213", url:"ssa.gov",                desc:"Monthly retirement, disability, and survivor benefits." },
  { name:"SNAP (Food Assistance)", cat:"Food",      phone:"1-800-221-5689", url:"fns.usda.gov/snap",      desc:"Monthly benefit to help buy food. Based on income and household size." },
  { name:"LIHEAP (Energy Assist)", cat:"Utilities", phone:"1-866-674-6327", url:"acf.hhs.gov/ocs/liheap", desc:"Help paying heating and cooling bills for low-income households." },
  { name:"Veterans Benefits (VA)", cat:"Veterans",  phone:"1-800-827-1000", url:"va.gov",                 desc:"Benefits for military veterans including healthcare, disability, and pension." },
  { name:"SSI",                    cat:"Income",    phone:"1-800-772-1213", url:"ssa.gov/ssi",            desc:"Monthly payments for adults 65+ or disabled people with limited income." },
  { name:"Property Tax Relief",    cat:"Housing",   phone:"Contact county",  url:"usa.gov/senior-housing", desc:"Many states offer property tax exemptions or reductions for seniors." },
];

export function BenefitsScreen({ benefits }: { benefits?: { name: string; description: string; eligibility: string; url: string; phone: string }[] }) {
  const list = benefits?.length ? benefits : DEFAULT_BENEFITS;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">❤️ Benefits Navigator</h1>
        <p className="text-gray-500 mt-1">Government and assistance programs you may qualify for.</p>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-sm text-blue-800">
          <strong>ℹ️ Note:</strong> Eligibility information is for guidance only.
          Contact the program directly to confirm eligibility and apply.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map((b, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-2">
              <p className="font-bold text-gray-900">{b.name}</p>
              {"cat" in b && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{(b as typeof DEFAULT_BENEFITS[0]).cat}</span>}
            </div>
            <p className="text-sm text-gray-600 mb-3">
              {"eligibility" in b ? (b as {eligibility:string}).eligibility : b.desc}
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{b.phone}</span>
              <a href={`https://${b.url}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:underline">
                <Globe className="w-3 h-3" />{b.url}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Reminders ──────────────────────────────────────────────────────────────

interface RemindersProps {
  allDeadlines: { title: string; date: string; reason: string; action: string; doc_name: string; doc_id: number }[];
  allMedications: MedEntry[];
}

export function RemindersScreen({ allDeadlines, allMedications }: RemindersProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">🔔 Reminders</h1>
        <p className="text-gray-500 mt-1">All your deadlines and medication reminders in one place.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document deadlines */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📅 Document Deadlines</h2>
          {allDeadlines.length === 0 ? (
            <p className="text-gray-400 text-sm">No upcoming deadlines.</p>
          ) : (
            <div className="space-y-3">
              {allDeadlines.map((d, i) => (
                <div key={i} className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-amber-900 text-sm">{d.title}</p>
                    <span className="text-xs text-amber-700 font-mono shrink-0 ml-2">{d.date}</span>
                  </div>
                  <p className="text-xs text-amber-700 mt-1">{d.reason}</p>
                  <p className="text-xs font-medium text-amber-900 mt-1">→ {d.action}</p>
                  <p className="text-xs text-gray-500 mt-1">From: {d.doc_name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Medication reminders */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">💊 Medication Reminders</h2>
          {allMedications.length === 0 ? (
            <p className="text-gray-400 text-sm">Upload prescription paperwork to see medication reminders.</p>
          ) : (
            <div className="space-y-3">
              {allMedications.map((m, i) => (
                <div key={i} className="p-3 bg-green-50 border border-green-100 rounded-xl">
                  <p className="font-semibold text-green-900">{m.name}{m.dosage ? ` ${m.dosage}` : ""}</p>
                  <p className="text-xs text-green-700">{m.instructions || m.frequency}</p>
                  {m.reminder_times?.length > 0 && <p className="text-xs text-green-600 mt-1">⏰ {m.reminder_times.join(", ")}</p>}
                  {m.refill_date && <p className="text-xs text-amber-600 mt-1">📅 Refill: {m.refill_date}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Renewal tracking */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">🔄 Renewal Tracking</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label:"Medicare Enrollment", next:"Annual — Oct 15 – Dec 7" },
            { label:"Insurance Renewal",   next:"Check your policy for renewal date" },
            { label:"Medicaid Renewal",    next:"Check your renewal notice" },
          ].map(r => (
            <div key={r.label} className="p-4 bg-gray-50 rounded-xl">
              <p className="font-semibold text-gray-900 text-sm">{r.label}</p>
              <p className="text-xs text-gray-500 mt-1">{r.next}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────

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

interface VoiceStatus { voice_enabled: boolean; stt_provider: string; }

interface RenewalItem {
  name: string; expiry_date: string; category: string;
  days_until_expiry: number | null; is_urgent: boolean;
  is_expired: boolean; status: string; source: string;
  document_id: number | null; notes: string;
}

interface RenewalData {
  expired: RenewalItem[]; urgent: RenewalItem[];
  upcoming: RenewalItem[]; future: RenewalItem[];
  total: number; needs_immediate_action: number;
}

const SETTINGS_LANGUAGES = [
  { code:"en", name:"English" }, { code:"es", name:"Español (Spanish)" },
  { code:"zh", name:"中文 (Chinese)" }, { code:"hi", name:"हिंदी (Hindi)" },
  { code:"vi", name:"Tiếng Việt (Vietnamese)" }, { code:"ko", name:"한국어 (Korean)" },
  { code:"ar", name:"العربية (Arabic)" }, { code:"fr", name:"Français (French)" },
  { code:"pt", name:"Português (Portuguese)" }, { code:"de", name:"Deutsch (German)" },
  { code:"it", name:"Italiano (Italian)" }, { code:"tl", name:"Filipino (Tagalog)" },
];

const RENEWAL_COLORS: Record<string, string> = {
  expired: "bg-red-100 text-red-700 border-red-200",
  critical: "bg-red-50 text-red-600 border-red-100",
  urgent: "bg-amber-50 text-amber-700 border-amber-200",
  upcoming: "bg-blue-50 text-blue-700 border-blue-100",
  ok: "bg-green-50 text-green-700 border-green-100",
};

const DEFAULT_PREFS: Preferences = {
  language: "en",
  accessibility: { large_text: false, high_contrast: false, voice_only: false, text_size_scale: 1.0 },
  notifications: {
    push_enabled: true, email_enabled: true, sms_enabled: false,
    medication_reminders: true, bill_reminders: true,
    deadline_alerts: true, scam_alerts: true,
    quiet_hours_start: "21:00", quiet_hours_end: "08:00",
  },
  voice_speed: 0.9, voice_gender: "female",
};

function PrefToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={clsx(
        "w-12 h-6 rounded-full relative transition-colors duration-200",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
        value ? "bg-blue-600" : "bg-gray-200"
      )}
      role="switch" aria-checked={value}
    >
      <div className={clsx(
        "w-5 h-5 bg-white rounded-full absolute top-0.5 shadow transition-transform duration-200",
        value ? "translate-x-6" : "translate-x-0.5"
      )} />
    </button>
  );
}

export function SettingsScreen() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus | null>(null);
  const [renewals, setRenewals] = useState<RenewalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newRenewal, setNewRenewal] = useState({ name:"", expiry_date:"", category:"other", notes:"" });

  useEffect(() => {
    Promise.all([
      get<Preferences>("/preferences").catch(() => DEFAULT_PREFS),
      get<VoiceStatus>("/voice/status").catch(() => null),
      get<RenewalData>("/renewals").catch(() => null),
    ]).then(([p, v, r]) => { setPrefs(p); setVoiceStatus(v); setRenewals(r); })
      .finally(() => setLoading(false));
  }, []);

  async function save(updates: Partial<Preferences>) {
    const prev = prefs;
    setPrefs(p => ({ ...p, ...updates }));
    setSaving(true);
    try {
      await post("/preferences", updates);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      const acc = (updates.accessibility ?? prefs.accessibility);
      document.documentElement.style.fontSize = acc.large_text ? `${acc.text_size_scale * 100}%` : "";
      if (acc.high_contrast) document.documentElement.classList.add("high-contrast");
      else document.documentElement.classList.remove("high-contrast");
    } catch { setPrefs(prev); }
    finally { setSaving(false); }
  }

  async function addRenewal() {
    if (!newRenewal.name || !newRenewal.expiry_date) return;
    await post("/renewals/manual", newRenewal);
    const r = await get<RenewalData>("/renewals");
    setRenewals(r);
    setNewRenewal({ name:"", expiry_date:"", category:"other", notes:"" });
    setShowAdd(false);
  }

  async function removeRenewal(id: number) {
    await del(`/renewals/manual/${id}`);
    const r = await get<RenewalData>("/renewals");
    setRenewals(r);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );

  const allRenewals = [
    ...(renewals?.expired ?? []), ...(renewals?.urgent ?? []),
    ...(renewals?.upcoming ?? []), ...(renewals?.future ?? []),
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">⚙️ Settings</h1>
        <div className="flex items-center gap-2 text-sm">
          {saving && <span className="text-gray-400 flex items-center gap-1"><Loader2 className="w-4 h-4 animate-spin"/>Saving…</span>}
          {saved && !saving && <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4"/>Saved</span>}
        </div>
      </div>

      {/* Accessibility */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Accessibility className="w-5 h-5 text-blue-500"/>Accessibility
        </h2>
        <div className="space-y-4">
          {([
            { key:"large_text"    as const, label:"Large text mode",  desc:"Increase all text sizes by 40%" },
            { key:"high_contrast" as const, label:"High contrast",    desc:"Stronger colors for better visibility" },
            { key:"voice_only"    as const, label:"Voice-only mode",  desc:"Optimise layout for voice navigation" },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div><p className="font-medium text-gray-900">{label}</p><p className="text-sm text-gray-500">{desc}</p></div>
              <PrefToggle
                value={prefs.accessibility[key]}
                onChange={v => save({ accessibility: { ...prefs.accessibility, [key]: v } })}
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Text size: {Math.round(prefs.accessibility.text_size_scale * 100)}%
            </label>
            <input type="range" min={80} max={180} step={10}
              value={prefs.accessibility.text_size_scale * 100}
              onChange={e => save({ accessibility: { ...prefs.accessibility, text_size_scale: Number(e.target.value) / 100 } })}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>80%</span><span>Normal (100%)</span><span>180%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-500"/>Notifications
        </h2>
        <div className="space-y-4">
          {([
            { key:"email_enabled"        as const, label:"Email reminders",      desc:"Receive deadline reminders by email" },
            { key:"push_enabled"         as const, label:"Push notifications",   desc:"Receive notifications on your phone" },
            { key:"sms_enabled"          as const, label:"SMS alerts",           desc:"Receive urgent alerts by text message" },
            { key:"medication_reminders" as const, label:"Medication reminders", desc:"Daily medication dose reminders" },
            { key:"bill_reminders"       as const, label:"Bill reminders",       desc:"Alert before bills are due" },
            { key:"deadline_alerts"      as const, label:"Deadline alerts",      desc:"Alerts for important document deadlines" },
            { key:"scam_alerts"          as const, label:"Scam alerts",          desc:"Immediate alert when suspicious documents detected" },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div><p className="font-medium text-gray-900">{label}</p><p className="text-sm text-gray-500">{desc}</p></div>
              <PrefToggle
                value={prefs.notifications[key] as boolean}
                onChange={v => save({ notifications: { ...prefs.notifications, [key]: v } })}
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quiet hours start</label>
              <input type="time" value={prefs.notifications.quiet_hours_start}
                onChange={e => save({ notifications: { ...prefs.notifications, quiet_hours_start: e.target.value } })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quiet hours end</label>
              <input type="time" value={prefs.notifications.quiet_hours_end}
                onChange={e => save({ notifications: { ...prefs.notifications, quiet_hours_end: e.target.value } })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Voice */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-blue-500"/>Voice Assistant
        </h2>
        {voiceStatus?.voice_enabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
              <Mic className="w-5 h-5 text-green-600"/>
              <div>
                <p className="font-medium text-green-800">Voice features active</p>
                <p className="text-sm text-green-600">Speech: {voiceStatus.stt_provider}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Speed: {Math.round(prefs.voice_speed * 100)}%
              </label>
              <input type="range" min={50} max={150} step={10}
                value={prefs.voice_speed * 100}
                onChange={e => save({ voice_speed: Number(e.target.value) / 100 })}
                className="w-full accent-blue-600"
              />
            </div>
            <div className="flex gap-3">
              {[{ v:"female", l:"Female (Nova)" }, { v:"male", l:"Male (Echo)" }].map(({ v, l }) => (
                <button key={v} onClick={() => save({ voice_gender: v })}
                  className={clsx("flex-1 py-2 rounded-xl border text-sm font-medium transition",
                    prefs.voice_gender === v
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                  )}>{l}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <MicOff className="w-8 h-8 mx-auto text-gray-400 mb-2"/>
            <p className="text-sm text-gray-600 font-medium">Voice features not configured</p>
            <p className="text-xs text-gray-400 mt-1">Add OPENAI_API_KEY to your backend .env to enable voice</p>
          </div>
        )}
      </div>

      {/* Language */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-500"/>Language & Translation
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Preferred language</label>
            <select value={prefs.language} onChange={e => save({ language: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              {SETTINGS_LANGUAGES.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
            </select>
          </div>
          {prefs.language !== "en" && (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0"/>
              <p className="text-sm text-blue-700">
                New document summaries will be translated to {SETTINGS_LANGUAGES.find(l => l.code === prefs.language)?.name}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Renewal Tracking */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-500"/>Renewal Tracking
          </h2>
          <button onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <Plus className="w-4 h-4"/>Add
          </button>
        </div>

        {showAdd && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <input placeholder="Name (e.g. Passport, Driver's License)"
              value={newRenewal.name} onChange={e => setNewRenewal(p => ({ ...p, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"/>
            <input type="date" value={newRenewal.expiry_date}
              onChange={e => setNewRenewal(p => ({ ...p, expiry_date: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"/>
            <select value={newRenewal.category} onChange={e => setNewRenewal(p => ({ ...p, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
              {["medicare","insurance","housing","medication","identity","other"].map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={addRenewal}
                className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-blue-700">Save</button>
              <button onClick={() => setShowAdd(false)}
                className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2 text-sm hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        )}

        {allRenewals.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50"/>
            <p className="text-sm">No renewals tracked yet. Upload documents or add manually above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allRenewals.map((item, i) => (
              <div key={i} className={clsx(
                "flex items-center justify-between p-3 rounded-xl border",
                RENEWAL_COLORS[item.status] || "bg-gray-50 text-gray-700 border-gray-200"
              )}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    {item.expiry_date}
                    {item.days_until_expiry !== null && (
                      <span className="ml-1">({item.is_expired ? "expired" : `${item.days_until_expiry}d left`})</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 capitalize">{item.status}</span>
                  {item.source === "manual" && (
                    <button onClick={() => removeRenewal((item as any).id)} className="opacity-50 hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subscription */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-6 h-6 text-yellow-300"/>
          <h2 className="text-lg font-bold">Upgrade to Premium</h2>
        </div>
        <ul className="space-y-2 text-sm mb-4">
          {["Unlimited document uploads","Voice assistant mode","Multi-language translation","Priority AI analysis","Family dashboard (up to 5 caregivers)","Emergency vault with 1GB storage"].map(f => (
            <li key={f} className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-300 shrink-0"/>{f}</li>
          ))}
        </ul>
        <div className="flex gap-3">
          <button className="flex-1 bg-white text-blue-700 font-bold py-2.5 rounded-xl hover:bg-blue-50 transition">$5/month</button>
          <button className="flex-1 bg-white/20 text-white font-bold py-2.5 rounded-xl hover:bg-white/30 transition">$48/year</button>
        </div>
      </div>
    </div>
  );
}

// ── Admin ──────────────────────────────────────────────────────────────────

export function AdminScreen({ users }: { users: User[] }) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">🛡️ Admin</h1>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">All Users ({users.length})</h2>
        <div className="divide-y divide-gray-100">
          {users.map(u => (
            <div key={u.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{u.full_name || u.email}</p>
                <p className="text-sm text-gray-500">{u.email} · {u.role}</p>
              </div>
              <span className={clsx("text-xs font-medium px-2.5 py-1 rounded-full",
                u.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                {u.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}