import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useStore from "../store/useStore";
import { getShopBookings, getShopPhotoUrl, getMyShopReviews } from "../api/client";
import { t, DATE_LOCALE } from "../i18n";

const today = new Date().toISOString().slice(0, 10);

function StarDisplay({ rating, small }) {
  return (
    <span style={{ fontSize: small ? 13 : 16, letterSpacing: 1 }}>
      {[1,2,3,4,5].map((s) => (
        <span key={s} style={{ opacity: s <= Math.round(rating) ? 1 : 0.2 }}>★</span>
      ))}
    </span>
  );
}

export default function Dashboard() {
  const { user, shop } = useStore();
  const lang = user?.language || "uz";
  const [stats, setStats] = useState({ today: 0, pending: 0, upcoming: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewSummary, setReviewSummary] = useState(null);

  function fmtDate(d) {
    return new Date(d).toLocaleDateString(DATE_LOCALE[lang], { month: "short", day: "numeric" });
  }

  useEffect(() => {
    if (!shop) { setLoading(false); return; }
    Promise.all([
      getShopBookings({ from_date: today }),
      getMyShopReviews().catch(() => null),
    ]).then(([data, reviews]) => {
        const todayBookings = data.filter((b) => b.booking_date === today && b.status !== "cancelled");
        const pending = data.filter((b) => b.status === "pending");
        setStats({
          today: todayBookings.length,
          pending: pending.length,
          upcoming: data.filter((b) => b.booking_date >= today && b.status !== "cancelled").length,
        });
        setRecent(data.slice(0, 5));
        if (reviews) setReviewSummary(reviews);
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

      {/* ── No shop: pure customer view ── */}
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

      {/* ── Rejected shop ── */}
      {shop && shop.is_rejected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="alert alert-danger" style={{
            background: "#fee2e2", color: "#991b1b", borderLeft: "4px solid #ef4444",
            borderRadius: 10, padding: "14px 16px", fontSize: 14,
          }}>
            {t("shop_rejected_msg", lang)}
          </div>
          <Link to="/my-bookings" className="btn btn-ghost" style={{ textAlign: "center" }}>
            📋 {t("view_bookings", lang)}
          </Link>
          <Link to="/shop" className="btn btn-primary">
            {t("shop_reapply", lang)}
          </Link>
        </div>
      )}

      {/* ── Pending approval ── */}
      {shop && !shop.is_approved && !shop.is_rejected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ overflow: "hidden", padding: 0, marginBottom: 0 }}>
            {shop.has_photo && (
              <img src={getShopPhotoUrl(shop.id)} alt={shop.name}
                style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
            )}
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{shop.name}</div>
              <div style={{ color: "var(--hint)", fontSize: 13, marginTop: 2 }}>{shop.city} · {shop.address}</div>
            </div>
          </div>
          <div className="alert alert-warning">
            {t("pending_approval_msg", lang)}
          </div>
          <Link to="/my-bookings" className="btn btn-ghost" style={{ textAlign: "center" }}>
            📋 {t("view_bookings", lang)}
          </Link>
        </div>
      )}

      {/* ── Approved barber dashboard ── */}
      {shop && shop.is_approved && (
        <>
          <div className="card" style={{ marginBottom: 16, overflow: "hidden", padding: 0 }}>
            {shop.has_photo && (
              <img src={getShopPhotoUrl(shop.id)} alt={shop.name}
                style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
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
                <span className="badge badge-approved" style={{ marginLeft: 10, flexShrink: 0 }}>
                  {t("status_approved", lang)}
                </span>
              </div>
            </div>
          </div>

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

          {/* Reviews summary */}
          {reviewSummary && reviewSummary.total_reviews > 0 && (
            <div className="card" style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>⭐ {t("reviews_title", lang)}</span>
                <span style={{ fontSize: 13, color: "var(--hint)" }}>
                  {reviewSummary.total_reviews} {t("reviews_count", lang)}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 32, fontWeight: 800 }}>{reviewSummary.average_rating}</span>
                <div>
                  <StarDisplay rating={reviewSummary.average_rating} />
                  <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 2 }}>
                    {t("reviews_out_of_5", lang)}
                  </div>
                </div>
              </div>
              {reviewSummary.reviews.slice(0, 3).map((r) => (
                <div key={r.id} style={{
                  borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 10,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{r.customer_name || "—"}</span>
                    <StarDisplay rating={r.rating} small />
                  </div>
                  {r.comment && (
                    <p style={{ fontSize: 13, color: "var(--hint)", marginTop: 4, lineHeight: 1.5 }}>
                      {r.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Quick actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
            <Link to="/schedule" className="btn btn-ghost">{t("schedule_btn", lang)}</Link>
            <Link to="/block-slots" className="btn btn-ghost">{t("block_slots_btn", lang)}</Link>
          </div>
          <Link to="/my-bookings" style={{ display: "block", textAlign: "center", color: "var(--hint)", fontSize: 13, marginTop: 12 }}>
            📋 {t("view_bookings", lang)}
          </Link>
        </>
      )}
    </div>
  );
}
