import { useState, useEffect } from "react";
import {
  adminGetStats,
  adminGetShops,
  adminApproveShop,
  adminRejectShop,
  adminGetUsers,
  adminGetStaff,
  adminApproveStaff,
  adminRejectStaff,
} from "../api/client";
import { toast } from "../components/Layout";
import { Check, Clock, Users, Store, ClipboardList, CheckCircle, X, ShieldCheck } from "lucide-react";

const TABS = ["Shops", "Staff", "Users", "Stats"];

function StatusBadge({ approved }) {
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 700,
      padding: "3px 10px",
      borderRadius: 20,
      background: approved ? "#10b98120" : "#f59e0b20",
      color: approved ? "#10b981" : "#f59e0b",
      whiteSpace: "nowrap",
    }}>
      {approved
        ? <><Check size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />Approved</>
        : <><Clock size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />Pending</>
      }
    </span>
  );
}

export default function AdminPanel() {
  const [tab, setTab] = useState("Shops");
  const [shops, setShops] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  useEffect(() => {
    Promise.all([adminGetShops(), adminGetStaff(), adminGetUsers(), adminGetStats()])
      .then(([s, sf, u, st]) => { setShops(s); setStaffList(sf); setUsers(u); setStats(st); })
      .catch(() => toast("Failed to load admin data"))
      .finally(() => setLoading(false));
  }, []);

  const ownerName = (ownerId) =>
    users.find((u) => u.id === ownerId)?.full_name ?? `User #${ownerId}`;

  async function approve(id) {
    setActing(id + "_approve");
    try {
      const updated = await adminApproveShop(id);
      setShops((prev) => prev.map((s) => (s.id === id ? updated : s)));
      toast("Shop approved ✓");
    } catch { toast("Failed to approve"); }
    finally { setActing(null); }
  }

  async function reject(id) {
    setActing(id + "_reject");
    try {
      const updated = await adminRejectShop(id);
      setShops((prev) => prev.map((s) => (s.id === id ? updated : s)));
      toast("Approval revoked");
    } catch { toast("Failed"); }
    finally { setActing(null); }
  }

  if (loading) return <div className="loader" style={{ height: "60vh" }}>Loading…</div>;

  const pendingShops = shops.filter((s) => !s.is_approved).length;
  const pendingStaff = staffList.filter((s) => !s.is_approved && !s.is_rejected).length;
  const pendingCount = pendingShops + pendingStaff;

  async function approveStaff(id) {
    setActing(id + "_sapprove");
    try {
      const updated = await adminApproveStaff(id);
      setStaffList((prev) => prev.map((s) => (s.id === id ? updated : s)));
      toast("Staff approved ✓");
    } catch { toast("Failed to approve"); }
    finally { setActing(null); }
  }

  async function rejectStaff(id) {
    setActing(id + "_sreject");
    try {
      const updated = await adminRejectStaff(id);
      setStaffList((prev) => prev.map((s) => (s.id === id ? updated : s)));
      toast("Staff rejected");
    } catch { toast("Failed"); }
    finally { setActing(null); }
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Admin Panel</h2>
        {pendingCount > 0 && (
          <span style={{
            background: "#ef4444",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 20,
            padding: "2px 10px",
          }}>
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--card)", borderRadius: 12, padding: 4 }}>
        {TABS.map((tb) => {
          const badge = tb === "Shops" ? pendingShops : tb === "Staff" ? pendingStaff : 0;
          return (
            <button key={tb} onClick={() => setTab(tb)} style={{
              flex: 1, padding: "9px 0", border: "none", borderRadius: 8, cursor: "pointer",
              fontWeight: 600, fontSize: 13,
              background: tab === tb ? "var(--accent)" : "transparent",
              color: tab === tb ? "#fff" : "var(--hint)",
              transition: "all 0.15s",
            }}>
              {tb}{badge > 0 ? ` (${badge})` : ""}
            </button>
          );
        })}
      </div>

      {/* ── Stats ── */}
      {tab === "Stats" && stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Total Users",    value: stats.total_users,    icon: <Users size={24} color="var(--hint)" /> },
            { label: "Total Shops",    value: stats.total_shops,    icon: <Store size={24} color="var(--hint)" /> },
            { label: "Pending Approval", value: stats.pending_approval, icon: <Clock size={24} color="#f59e0b" />, warn: stats.pending_approval > 0 },
            { label: "Total Bookings", value: stats.total_bookings, icon: <ClipboardList size={24} color="var(--hint)" /> },
          ].map((item) => (
            <div key={item.label} className="card" style={{
              padding: "20px 12px", textAlign: "center",
              border: item.warn ? "1.5px solid #f59e0b" : "1.5px solid transparent",
            }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>{item.icon}</div>
              <div style={{ fontSize: 32, fontWeight: 700, marginTop: 6, color: item.warn ? "#f59e0b" : "var(--text)" }}>
                {item.value}
              </div>
              <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 4 }}>{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Shops ── */}
      {tab === "Shops" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shops.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--hint)" }}>
              <Store size={40} color="var(--hint)" style={{ margin: "0 auto 12px" }} />
              <p>No shops registered yet</p>
            </div>
          )}
          {shops.map((shop) => (
            <div key={shop.id} className="card" style={{ padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{shop.name}</div>
                  <div style={{ fontSize: 13, color: "var(--hint)" }}>{shop.region} · {shop.city}</div>
                  <div style={{ fontSize: 13, color: "var(--hint)" }}>{shop.address}</div>
                  <div style={{ fontSize: 13, color: "var(--hint)" }}>{shop.phone}</div>
                </div>
                <StatusBadge approved={shop.is_approved} />
              </div>

              <div style={{ fontSize: 12, color: "var(--hint)", marginBottom: 12, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                Owner: <span style={{ color: "var(--text)", fontWeight: 500 }}>{ownerName(shop.owner_id)}</span>
                &nbsp;· {shop.slot_duration} min slots
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {!shop.is_approved ? (
                  <>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, padding: "8px 0", fontSize: 13 }}
                      disabled={acting === shop.id + "_approve"}
                      onClick={() => approve(shop.id)}
                    >
                      {acting === shop.id + "_approve" ? "…" : <><CheckCircle size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />Approve</>}
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: "8px 0", fontSize: 13, color: "#ef4444" }}
                      disabled={acting === shop.id + "_reject"}
                      onClick={() => reject(shop.id)}
                    >
                      {acting === shop.id + "_reject" ? "…" : <><X size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />Reject</>}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "7px 16px", fontSize: 13, color: "#ef4444" }}
                    disabled={acting === shop.id + "_reject"}
                    onClick={() => reject(shop.id)}
                  >
                    {acting === shop.id + "_reject" ? "…" : "Revoke approval"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Staff ── */}
      {tab === "Staff" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {staffList.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--hint)" }}>
              <Users size={40} color="var(--hint)" style={{ margin: "0 auto 12px" }} />
              <p>No staff requests yet</p>
            </div>
          )}
          {staffList.map((s) => {
            const isPending = !s.is_approved && !s.is_rejected;
            const shopName = shops.find((sh) => sh.id === s.shop_id)?.name ?? `Shop #${s.shop_id}`;
            return (
              <div key={s.id} className="card" style={{ padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>
                      {s.display_name || `User #${s.user_id}`}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--hint)" }}>Shop: {shopName}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap",
                    background: s.is_approved ? "#10b98120" : s.is_rejected ? "#ef444420" : "#f59e0b20",
                    color: s.is_approved ? "#10b981" : s.is_rejected ? "#ef4444" : "#f59e0b",
                  }}>
                    {s.is_approved ? "Approved" : s.is_rejected ? "Rejected" : "Pending"}
                  </span>
                </div>

                {isPending && (
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, padding: "8px 0", fontSize: 13 }}
                      disabled={acting === s.id + "_sapprove"}
                      onClick={() => approveStaff(s.id)}
                    >
                      {acting === s.id + "_sapprove" ? "…" : <><CheckCircle size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />Approve</>}
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: "8px 0", fontSize: 13, color: "#ef4444" }}
                      disabled={acting === s.id + "_sreject"}
                      onClick={() => rejectStaff(s.id)}
                    >
                      {acting === s.id + "_sreject" ? "…" : <><X size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />Reject</>}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Users ── */}
      {tab === "Users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--hint)" }}>
              <Users size={40} color="var(--hint)" style={{ margin: "0 auto 12px" }} />
              <p>No users yet</p>
            </div>
          )}
          {users.map((u) => (
            <div key={u.id} className="card" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{u.full_name}</div>
                <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 2 }}>
                  ID: {u.telegram_id} · {u.language.toUpperCase()}
                </div>
              </div>
              {u.is_admin && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#6366f120", color: "#6366f1" }}>
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
