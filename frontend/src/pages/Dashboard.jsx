import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useStore from "../store/useStore";
import { getShopBookings, getShopPhotoUrl } from "../api/client";
import { t, DATE_LOCALE } from "../i18n";

const today = new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const { user, shop } = useStore();
  const lang = user?.language || "uz";
  const [stats, setStats] = useState({ today: 0, pending: 0, upcoming: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  function fmtDate(d) {
    return new Date(d).toLocaleDateString(DATE_LOCALE[lang], { month: "short", day: "numeric" });
  }

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
        <p style={{ color: "var(--hint)", fontSize: 13 }}>{t("welcome", lang)}</p>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{user?.full_name}</h1>
      </div>

      {/* No shop yet — customer view */}
      {!shop && !user?.is_admin && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ textAlign: "center", padding: "28px 16px" }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>📋</div>
            <h2 style={{ marginBottom: 8, fontSize: 18 }}>{t("my_bookings_title", lang)}</h2>
            <p style={{ color: "var(--hint)", marginBottom: 16, fontSize: 14 }}>
              {t("use_bot_to_find", lang)}
            </p>
            <Link to="/my-bookings" className="btn btn-primary">{t("view_bookings", lang)}</Link>
          </div>
          <div className="card" style={{ textAlign: "center", padding: "20px 16px" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✂️</div>
            <p style={{ color: "var(--hint)", marginBottom: 12, fontSize: 14 }}>
              {t("are_you_barber", lang)}
            </p>
            <Link to="/shop" className="btn btn-secondary" style={{ fontSize: 13 }}>
              {t("open_shop", lang)}
            </Link>
          </div>
        </div>
      )}

      {/* Shop info + stats */}
      {shop && (
        <>
          <div className="card" style={{ marginBottom: 16, overflow: "hidden", padding: 0 }}>
            {/* Cover photo */}
            {shop.has_photo && (
              <img
                src={getShopPhotoUrl(shop.id)}
                alt={shop.name}
                style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
              />
            )}
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{shop.name}</div>
                  <div style={{ color: "var(--hint)", fontSize: 13, marginTop: 2 }}>{shop.city} · {shop.address}</div>
                  {shop.description && (
                    <div style={{ color: "var(--text)", fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                      {shop.description}
                    </div>
                  )}
                </div>
                <span
                  className={`badge ${shop.is_approved ? "badge-approved" : "badge-pending-approval"}`}
                  style={{ marginLeft: 10, flexShrink: 0 }}
                >
                  {shop.is_approved ? t("status_approved", lang) : t("status_pending", lang)}
                </span>
              </div>
            </div>
          </div>

          {!shop.is_approved && (
            <div className="alert alert-warning">
              {t("pending_approval_msg", lang)}
            </div>
          )}

          {loading ? (
            <div className="loader">{t("loading", lang)}</div>
          ) : (
            <>
              <div className="stats-row">
                <div className="stat-box">
                  <div className="stat-value">{stats.today}</div>
                  <div className="stat-label">{t("today_label", lang)}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value" style={{ color: stats.pending > 0 ? "#ff9500" : "var(--btn)" }}>
                    {stats.pending}
                  </div>
                  <div className="stat-label">{t("status_pending", lang)}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{stats.upcoming}</div>
                  <div className="stat-label">{t("upcoming_label", lang)}</div>
                </div>
              </div>

              {recent.length > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{t("recent_bookings", lang)}</span>
                    <Link to="/bookings" style={{ color: "var(--btn)", fontSize: 13 }}>{t("see_all", lang)}</Link>
                  </div>
                  {recent.map((b) => (
                    <div key={b.id} className="booking-card">
                      <div className="booking-header">
                        <div>
                          <div className="booking-time">{b.time_slot}</div>
                          <div className="booking-date">{fmtDate(b.booking_date)}</div>
                        </div>
                        <span className={`badge badge-${b.status}`}>
                          {t("status_" + b.status, lang)}
                        </span>
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
                  <p>{t("no_upcoming", lang)}</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Quick actions */}
      {shop && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
          <Link to="/schedule" className="btn btn-ghost">{t("schedule_btn", lang)}</Link>
          <Link to="/block-slots" className="btn btn-ghost">{t("block_slots_btn", lang)}</Link>
        </div>
      )}
    </div>
  );
}
