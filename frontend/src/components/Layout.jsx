import { useRef, useState } from "react";
import BottomNav from "./BottomNav";

// Simple toast context
let _addToast = null;
export function toast(msg) { _addToast?.(msg); }

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
      <main className="page-content">{children}</main>
      <BottomNav />

      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
