import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useStore from "../store/useStore";
import { getShopBookings } from "../api/client";

const today = new Date().toISOString().slice(0, 10);

function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Dashboard() {
  const { user, shop } = useStore();
  const [stats, setStats] = useState({ today: 0, pending: 0, upcoming: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shop) { setLoading(false); return; }
    getShopBookings({ from_date: today })
      .then((data) => {
        const todayBookings = data.filter((b) => b.booking_date === today && b.status !== "cancelled");
        const pending = data.filter((b) => b.status === "pending");
        setStats({
          today: todayBookings.length,
          pending: pending.length,
          upcoming: data.filter((b) => b.booking_date >= today && b.status !== "cancelled").length,
        });
        setRecent(data.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shop]);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ color: "var(--hint)", fontSize: 13 }}>Welcome back,</p>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{user?.full_name}</h1>
      </div>

      {/* No shop yet */}
      {!shop && (
        <div className="card" style={{ textAlign: "center", padding: "32px 16px" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✂️</div>
          <h2 style={{ marginBottom: 8 }}>Set up your shop</h2>
          <p style={{ color: "var(--hint)", marginBottom: 20, fontSize: 14 }}>
            Create your barber shop to start accepting bookings.
          </p>
          <Link to="/shop" className="btn btn-primary">Create Shop</Link>
        </div>
      )}

      {/* Shop info + stats */}
      {shop && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{shop.name}</div>
                <div style={{ color: "var(--hint)", fontSize: 13, marginTop: 2 }}>{shop.city} · {shop.address}</div>
              </div>
              <span className={`badge ${shop.is_approved ? "badge-approved" : "badge-pending-approval"}`}>
                {shop.is_approved ? "Approved" : "Pending"}
              </span>
            </div>
          </div>

          {!shop.is_approved && (
            <div className="alert alert-warning">
              Your shop is awaiting admin approval. You can still set up your schedule.
            </div>
          )}

          {loading ? (
            <div className="loader">Loading stats…</div>
          ) : (
            <>
              <div className="stats-row">
                <div className="stat-box">
                  <div className="stat-value">{stats.today}</div>
                  <div className="stat-label">Today</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value" style={{ color: stats.pending > 0 ? "#ff9500" : "var(--btn)" }}>
                    {stats.pending}
                  </div>
                  <div className="stat-label">Pending</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{stats.upcoming}</div>
                  <div className="stat-label">Upcoming</div>
                </div>
              </div>

              {recent.length > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>Recent Bookings</span>
                    <Link to="/bookings" style={{ color: "var(--btn)", fontSize: 13 }}>See all</Link>
                  </div>
                  {recent.map((b) => (
                    <div key={b.id} className="booking-card">
                      <div className="booking-header">
                        <div>
                          <div className="booking-time">{b.time_slot}</div>
                          <div className="booking-date">{fmtDate(b.booking_date)}</div>
                        </div>
                        <span className={`badge badge-${b.status}`}>{b.status}</span>
                      </div>
                      <div className="booking-customer">
                        👤 {b.customer_name} · 📞 {b.customer_phone}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {recent.length === 0 && (
                <div className="empty-state">
                  <div style={{ fontSize: 36 }}>📅</div>
                  <p>No upcoming bookings yet.</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Quick actions */}
      {shop && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
          <Link to="/schedule" className="btn btn-ghost">📆 Schedule</Link>
          <Link to="/block-slots" className="btn btn-ghost">🚫 Block Slots</Link>
        </div>
      )}
    </div>
  );
}
