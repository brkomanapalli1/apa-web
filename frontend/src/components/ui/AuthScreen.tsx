"use client";
import { useState } from "react";
import { FileText } from "lucide-react";
import { clsx } from "clsx";
import { post, setTokens, ApiError } from "@/lib/api/client";
import type { AuthMode, Tokens } from "@/types";

const SUPPORTED_EXTS = [
  ".pdf",".png",".jpg",".jpeg",".webp",".tif",".tiff",
  ".bmp",".doc",".docx",".xls",".xlsx",".csv",".txt",
];

function AuthInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <input {...props}
        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
      />
    </div>
  );
}

export function AuthScreen({ onSuccess }: { onSuccess: (t: Tokens) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [f, setF] = useState({ email: "", password: "", name: "", token: "", newPw: "" });

  const s = (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setF(p => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") {
        const data = await post<Tokens>("/auth/login", { email: f.email, password: f.password });
        setTokens(data);
        onSuccess(data);
      } else if (mode === "register") {
        const data = await post<Tokens>("/auth/register", { email: f.email, password: f.password, full_name: f.name });
        setTokens(data);
        onSuccess(data);
      } else if (mode === "forgot") {
        await post("/auth/password/forgot", { email: f.email });
        setError("If the account exists, a reset email has been sent.");
        setMode("login");
      } else {
        await post("/auth/password/reset", { token: f.token, new_password: f.newPw });
        setMode("login");
        setError("Password reset — please sign in.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <FileText className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Paperwork Helper</h1>
          <p className="mt-2 text-gray-500">AI assistant for seniors &amp; families</p>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-6">
          {(["login", "register"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={clsx(
                "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all",
                mode === m ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}>
              {m === "login" ? "Sign in" : "Register"}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && <AuthInput label="Full name" value={f.name} onChange={s("name")} required />}
          {["login", "register", "forgot"].includes(mode) && (
            <AuthInput label="Email" type="email" value={f.email} onChange={s("email")} autoComplete="email" required />
          )}
          {["login", "register"].includes(mode) && (
            <AuthInput label="Password" type="password" value={f.password} onChange={s("password")} minLength={8} required />
          )}
          {mode === "reset" && <>
            <AuthInput label="Reset token" value={f.token} onChange={s("token")} required />
            <AuthInput label="New password" type="password" value={f.newPw} onChange={s("newPw")} minLength={8} required />
          </>}
          <button type="submit" disabled={busy}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl text-lg transition-colors shadow-md">
            {busy ? "Please wait…"
              : mode === "login"    ? "Sign in"
              : mode === "register" ? "Create account"
              : mode === "forgot"   ? "Send reset email"
              : "Reset password"}
          </button>
        </form>

        <div className="mt-5 flex justify-center gap-6 text-sm text-blue-600">
          <button onClick={() => setMode("forgot")} className="hover:underline">Forgot password?</button>
          <button onClick={() => setMode("reset")}  className="hover:underline">Have reset token</button>
        </div>

        <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100">
          <p className="text-xs text-amber-700 font-medium mb-1">📄 Supported file types</p>
          <p className="text-xs text-amber-600">{SUPPORTED_EXTS.join(", ")}</p>
        </div>
      </div>
    </div>
  );
}
