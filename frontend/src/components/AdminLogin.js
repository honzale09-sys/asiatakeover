import { useState } from "react";
import { api, formatError } from "@/api";

export default function AdminLogin({ title, subtitle, onLogin, testPrefix = "admin", identifierType = "email", identifierLabel = "Email" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api.post("/auth/login", { email, password });
      onLogin(r.data);
    } catch (e2) {
      setError(formatError(e2));
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full bg-[#0D0E15] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FF0055] outline-none transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#060609]">
      <form
        onSubmit={submit}
        className="w-full max-w-sm glass border border-white/10 rounded-3xl p-8"
        data-testid={`${testPrefix}-login-form`}
      >
        <p className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-[#00F0FF] mb-2">Restricted</p>
        <h1 className="font-display font-extrabold text-2xl uppercase mb-1">{title}</h1>
        <p className="text-slate-400 text-sm mb-6">{subtitle}</p>
        <div className="space-y-4">
          <input
            data-testid={`${testPrefix}-email-input`}
            type={identifierType}
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
            className={inputCls}
            placeholder={identifierLabel}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            data-testid={`${testPrefix}-password-input`}
            type="password"
            required
            className={inputCls}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p className="text-[#FF0055] font-mono2 text-xs mt-4" data-testid={`${testPrefix}-login-error`}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          data-testid={`${testPrefix}-login-button`}
          className="mt-6 w-full bg-[#FF0055] hover:bg-[#FFE600] hover:text-black text-white font-display font-bold uppercase text-sm py-3.5 rounded-full transition-colors duration-300 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
