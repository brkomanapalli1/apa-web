"use client";
/**
 * Remaining app screens — each exported as a named component.
 * These are smaller screens that don't yet warrant their own file.
 * As features grow, split each into its own file in this folder.
 */
import { useState } from "react";
import { Calendar, CheckCircle, Globe, Heart, Lock, Phone, Pill, Star, Users, Volume2 } from "lucide-react";
import { clsx } from "clsx";
import { post, ApiError } from "@/lib/api/client";
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
              {"eligibility" in b ? (b as {eligibility:string}).eligibility : b.description}
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

export function SettingsScreen() {
  const ACCESSIBILITY = [
    { label:"Large text mode",          desc:"Increase all text sizes by 20%" },
    { label:"High contrast",            desc:"Use higher contrast colors for better visibility" },
    { label:"Simple mode",              desc:"Show only essential information" },
    { label:"Screen reader optimized",  desc:"Optimize layout for screen reader users" },
  ];
  const NOTIFICATIONS = [
    { label:"Email reminders",     desc:"Receive deadline reminders by email", on:true },
    { label:"SMS alerts",          desc:"Receive urgent alerts by text message", on:false },
    { label:"Push notifications",  desc:"Receive notifications on your phone", on:true },
    { label:"Caregiver alerts",    desc:"Notify your caregiver when new documents arrive", on:true },
    { label:"Medication reminders",desc:"Daily medication reminders", on:true },
    { label:"Scam alerts",         desc:"Immediate alerts when scam documents are detected", on:true },
  ];
  const LANGUAGES = [
    { value:"en", label:"English" }, { value:"es", label:"Español (Spanish)" },
    { value:"zh", label:"中文 (Chinese)" }, { value:"hi", label:"हिंदी (Hindi)" },
    { value:"vi", label:"Tiếng Việt (Vietnamese)" }, { value:"ko", label:"한국어 (Korean)" },
    { value:"ar", label:"العربية (Arabic)" }, { value:"fr", label:"Français (French)" },
    { value:"pt", label:"Português (Portuguese)" }, { value:"ru", label:"Русский (Russian)" },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900">⚙️ Settings</h1>

      {/* Accessibility */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">♿ Accessibility</h2>
        <div className="space-y-4">
          {ACCESSIBILITY.map(({ label, desc }) => (
            <div key={label} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{label}</p>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
              <button className="w-12 h-6 bg-gray-200 rounded-full relative transition-colors hover:bg-gray-300">
                <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 shadow transition-transform" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">🔔 Notifications</h2>
        <div className="space-y-4">
          {NOTIFICATIONS.map(({ label, desc, on }) => (
            <div key={label} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{label}</p>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
              <button className={clsx("w-12 h-6 rounded-full relative transition-colors", on ? "bg-blue-600" : "bg-gray-200")}>
                <div className={clsx("w-5 h-5 bg-white rounded-full absolute top-0.5 shadow transition-transform", on ? "right-0.5" : "left-0.5")} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Voice */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">🎙️ Voice Assistant</h2>
        <div className="p-4 bg-gray-50 rounded-xl text-center">
          <Volume2 className="w-8 h-8 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">Voice mode requires the Whisper API key to be configured.</p>
          <p className="text-xs text-gray-400 mt-1">Set VOICE_ENABLED=true and WHISPER_API_KEY in your backend .env</p>
        </div>
      </div>

      {/* Language */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">🌍 Language & Translation</h2>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Preferred language</label>
          <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
      </div>

      {/* Subscription */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-6 h-6 text-yellow-300" />
          <h2 className="text-lg font-bold">Upgrade to Premium</h2>
        </div>
        <ul className="space-y-2 text-sm mb-4">
          {["Unlimited document uploads","Voice assistant","Multi-language translation","Priority AI analysis","Family dashboard (up to 5 caregivers)","Emergency vault with 1GB storage"].map(f => (
            <li key={f} className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-300 shrink-0" />{f}</li>
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
