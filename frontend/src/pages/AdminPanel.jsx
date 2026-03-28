import { useState, useEffect } from "react";
import {
  adminGetStats,
  adminGetShops,
  adminApproveShop,
  adminRejectShop,
  adminGetUsers,
} from "../api/client";
import { toast } from "../components/Layout";

const TABS = ["Shops", "Users", "Stats"];

export default function AdminPanel() {
  const [tab, setTab] = useState("Shops");
  const [shops, setShops] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  useEffect(() => {
    Promise.all([adminGetShops(), adminGetUsers(), adminGetStats()])
      .then(([s, u, st]) => {
        setShops(s);
        setUsers(u);
        setStats(st);
      })
      .catch(() => toast("Failed to load admin data"))
      .finally(() => setLoading(false));
  }, []);

  async function approve(id) {
    setActing(id + "_approve");
    try {
      const updated = await adminApproveShop(id);
      setShops((prev) => prev.map((s) => (s.id === id ? updated : s)));
      toast("Shop approved");
    } catch {
      toast("Failed");
    } finally {
      setActing(null);
    }
  }

  async function reject(id) {
    setActing(id + "_reject");
    try {
      const updated = await adminRejectShop(id);
      setShops((prev) => prev.map((s) => (s.id === id ? updated : s)));
      toast("Shop rejected");
    } catch {
      toast("Failed");
    } finally {
      setActing(null);
    }
  }

  if (loading) return <div className="loader" style={{ height: "60vh" }}>Loading…</div>;

  return (
    <div className="page">
      <h2 style={{ marginBottom: 16 }}>⚙️ Admin Panel</h2>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--card)", borderRadius: 10, padding: 4 }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "8px 0",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              background: tab === t ? "var(--accent)" : "transparent",
              color: tab === t ? "#fff" : "var(--text)",
              transition: "all 0.2s",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Stats" && stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Users", value: stats.total_users, icon: "👤" },
            { label: "Shops", value: stats.total_shops, icon: "🏪" },
            { label: "Pending", value: stats.pending_approval, icon: "⏳", warn: stats.pending_approval > 0 },
            { label: "Bookings", value: stats.total_bookings, icon: "📋" },
          ].map((item) => (
            <div
              key={item.label}
              className="card"
              style={{
                padding: "16px 12px",
                textAlign: "center",
                border: item.warn ? "1px solid #f59e0b" : undefined,
              }}
            >
              <div style={{ fontSize: 24 }}>{item.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{item.value}</div>
              <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "Shops" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shops.length === 0 && (
            <p style={{ color: "var(--hint)", textAlign: "center", padding: 32 }}>No shops yet</p>
          )}
          {shops.map((shop) => (
            <div key={shop.id} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{shop.name}</div>
                  <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 2 }}>
                    {shop.region} · {shop.city}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--hint)" }}>{shop.address}</div>
                  <div style={{ fontSize: 13, color: "var(--hint)" }}>{shop.phone}</div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 20,
                    background: shop.is_approved ? "#10b98122" : "#f59e0b22",
                    color: shop.is_approved ? "#10b981" : "#f59e0b",
                    whiteSpace: "nowrap",
                  }}
                >
                  {shop.is_approved ? "Approved" : "Pending"}
                </span>
              </div>
              {!shop.is_approved && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, padding: "7px 0", fontSize: 13 }}
                    disabled={acting === shop.id + "_approve"}
                    onClick={() => approve(shop.id)}
                  >
                    {acting === shop.id + "_approve" ? "…" : "✅ Approve"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: "7px 0", fontSize: 13, color: "#ef4444" }}
                    disabled={acting === shop.id + "_reject"}
                    onClick={() => reject(shop.id)}
                  >
                    {acting === shop.id + "_reject" ? "…" : "❌ Reject"}
                  </button>
                </div>
              )}
              {shop.is_approved && (
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 10, padding: "6px 14px", fontSize: 13, color: "#ef4444" }}
                  disabled={acting === shop.id + "_reject"}
                  onClick={() => reject(shop.id)}
                >
                  {acting === shop.id + "_reject" ? "…" : "Revoke approval"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "Users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.length === 0 && (
            <p style={{ color: "var(--hint)", textAlign: "center", padding: 32 }}>No users yet</p>
          )}
          {users.map((u) => (
            <div key={u.id} className="card" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{u.full_name}</div>
                <div style={{ fontSize: 12, color: "var(--hint)" }}>
                  ID: {u.telegram_id} · {u.language.toUpperCase()}
                </div>
              </div>
              {u.is_admin && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#6366f122", color: "#6366f1" }}>
                  ADMIN
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
