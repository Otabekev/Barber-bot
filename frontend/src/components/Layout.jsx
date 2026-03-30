import { useRef, useState } from "react";
import BottomNav from "./BottomNav";
import useStore from "../store/useStore";
import { updateLanguage } from "../api/client";

// Simple toast context
let _addToast = null;
export function toast(msg) { _addToast?.(msg); }

const LANGS = [
  { code: "uz", flag: "🇺🇿", label: "UZ" },
  { code: "ru", flag: "🇷🇺", label: "RU" },
  { code: "en", flag: "🇬🇧", label: "EN" },
];

function LanguageSwitcher() {
  const { user, setUserLang } = useStore();
  const lang = user?.language || "uz";
  const [switching, setSwitching] = useState(false);

  async function switchLang(code) {
    if (code === lang || switching) return;
    setSwitching(true);
    try {
      await updateLanguage(code);
      setUserLang(code);
    } catch {
      // Best-effort — update store anyway so UI responds
      setUserLang(code);
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div style={{
      display: "flex",
      justifyContent: "flex-end",
      gap: 4,
      padding: "8px 16px 0",
    }}>
      {LANGS.map(({ code, flag, label }) => (
        <button
          key={code}
          onClick={() => switchLang(code)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            padding: "4px 10px",
            borderRadius: 20,
            border: "none",
            cursor: code === lang ? "default" : "pointer",
            fontSize: 12,
            fontWeight: 600,
            background: code === lang ? "var(--btn)" : "var(--secondary-bg)",
            color: code === lang ? "var(--btn-text)" : "var(--hint)",
            transition: "all 0.15s",
            opacity: switching ? 0.6 : 1,
          }}
        >
          {flag} {label}
        </button>
      ))}
    </div>
  );
}

export default function Layout({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  _addToast = (msg) => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  };

  return (
    <div className="app-shell">
      <main className="page-content">
        <LanguageSwitcher />
        {children}
      </main>
      <BottomNav />

      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
