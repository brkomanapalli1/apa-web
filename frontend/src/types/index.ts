// ── All shared types for the APA frontend ─────────────────────────────────

export type Screen =
  | "dashboard" | "documents" | "medications" | "caregiver"
  | "vault" | "timeline" | "benefits" | "reminders" | "settings" | "admin";

export type AuthMode = "login" | "register" | "forgot" | "reset";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  subscription_status: string;
}

export interface Deadline {
  title: string;
  date: string;
  reason: string;
  action: string;
}

export interface Recommendation {
  title: string;
  why: string;
  priority: string;
  action: string;
}

export interface GeneratedLetter {
  title: string;
  subject: string;
  body: string;
  audience: string;
  use_case: string;
}

export interface ScamAnalysis {
  is_suspicious: boolean;
  confidence: number;
  risk_level: string;
  warning_message: string;
  safe_message: string;
  recommended_actions: string[];
  signals: { category: string; description: string; severity: string }[];
}

export interface MedicationEntry {
  name: string;
  dosage: string | null;
  frequency: string | null;
  reminder_times: string[];
  with_food: boolean | null;
  instructions: string;
  refill_date: string | null;
  doc_name?: string;
  doc_id?: number;
}

export interface BillingError {
  description: string;
  amount: string;
  severity: string;
}

export interface Document {
  id: number;
  name: string;
  status: string;
  workflow_state: string;
  document_type: string;
  document_type_confidence: number | null;
  summary: string | null;
  deadlines: Deadline[];
  extracted_fields: Record<string, unknown>;
  recommended_actions: Recommendation[];
  generated_letter: GeneratedLetter | null;
  scam_analysis?: ScamAnalysis | null;
  medications?: MedicationEntry[];
  billing_errors?: BillingError[];
  extracted_text?: string | null;
  assigned_to_user_id: number | null;
  assigned_to_user_name: string | null;
  has_ocr: boolean;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: number;
  title: string;
  due_date: string;
  due_at?: string;
  reminder_type: string;
  status: string;
  document_id: number | null;
  notes: string | null;
  payload?: Record<string, unknown>;
}

export interface CaregiverMember {
  id: number;
  email: string;
  full_name: string;
  role: string;
  accepted: boolean;
  created_at: string;
}

export interface VaultItem {
  id: number;
  name: string;
  category: string;
  description: string | null;
  created_at: string;
}

export interface TimelineEvent {
  id: number;
  date: string;
  title: string;
  category: string;
  document_id: number | null;
  summary: string;
}

export interface BenefitProgram {
  name: string;
  description: string;
  eligibility: string;
  action: string;
  url: string;
  phone: string;
}

export interface FinancialAlert {
  category: string;
  description: string;
  change_pct: number;
  severity: string;
}

export interface AppState {
  screen: Screen;
  selectedDocId: number | null;
  statusFilter: string | null;
  searchQuery: string;
  selectedCategory: string;
  sidebarOpen: boolean;
}
