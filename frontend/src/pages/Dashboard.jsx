import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  CalendarCheck, Scissors, Clock, Calendar, Ban,
  User, Phone, AlertCircle, Star, Users,
} from "lucide-react";
import useStore from "../store/useStore";
import { getShopBookings, getShopPhotoUrl, getMyShopReviews } from "../api/client";
import { t, DATE_LOCALE } from "../i18n";

const IC = 16; // standard inline icon size
const MUTED = "var(--hint)";

function StarDisplay({ rating }) {
  return (
    <span style={{ fontSize: 16, letterSpacing: 1 }}>
      {[1,2,3,4,5].map((s) => (
        <span key={s} style={{ opacity: s <= Math.round(rating) ? 1 : 0.2 }}>★</span>
      ))}
    </span>
  );
}

export default function Dashboard() {
  const { user, shop, staffRecord, shopStaff } = useStore();
  const lang = user?.language || "uz";
  const isOwner = shop && staffRecord && shop.owner_id === staffRecord.user_id;
  const hasTeam = shopStaff.filter((s) => s.is_active && s.is_approved).length > 1;
  const location = useLocation();
  const [stats, setStats] = useState({ today: 0, pending: 0, upcoming: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [loadError, setLoadError] = useState(false);

  function fmtDate(d) {
    return new Date(d).toLocaleDateString(DATE_LOCALE[lang], { month: "short", day: "numeric" });
  }

  useEffect(() => {
    if (!shop) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    setLoading(true);
    setLoadError(false);
    setStats({ today: 0, pending: 0, upcoming: 0 });
    setRecent([]);
    Promise.all([
      getShopBookings({}),
      getMyShopReviews().catch(() => null),
    ]).then(([data, reviews]) => {
        const todayBookings = data.filter((b) => b.booking_date === todayStr && b.status !== "cancelled");
        setStats({
          today: todayBookings.length,
          pending: data.filter((b) => b.status === "pending").length,
          upcoming: data.filter((b) => b.booking_date >= todayStr && !["cancelled", "completed"].includes(b.status)).length,
        });
        setRecent(
          data
            .filter((b) => b.booking_date >= todayStr)
            .sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.time_slot.localeCompare(b.time_slot))
            .slice(0, 5)
        );
        if (reviews) setReviewSummary(reviews);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [shop, location.key]);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ color: MUTED, fontSize: 13 }}>{t("welcome", lang)}</p>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{user?.full_name}</h1>
      </div>

      {/* ── Staff member (not owner, no shop in their own name) ── */}
      {!shop && staffRecord && !user?.is_admin && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ padding: "16px" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              {staffRecord.display_name || user?.full_name}
            </div>
            {staffRecord.is_approved ? (
              <span className="badge badge-approved">{t("status_approved", lang)}</span>
            ) : staffRecord.is_rejected ? (
              <span className="badge badge-rejected">{t("staff_rejected", lang)}</span>
            ) : (
              <span style={{ fontSize: 12, background: "#fef9c3", color: "#854d0e", borderRadius: 6, padding: "2px 8px" }}>
                {t("staff_pending", lang)}
              </span>
            )}
          </div>
          {staffRecord.is_approved && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Link to="/bookings" className="btn btn-ghost" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <CalendarCheck size={IC} /> {t("nav_bookings", lang)}
              </Link>
              <Link to="/schedule" className="btn btn-ghost" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Calendar size={IC} /> {t("schedule_btn", lang)}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── No shop, no staff record: pure customer view ── */}
      {!shop && !staffRecord && !user?.is_admin && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ textAlign: "center", padding: "28px 16px" }}>
            <CalendarCheck size={40} color={MUTED} style={{ margin: "0 auto 12px" }} />
            <h2 style={{ marginBottom: 8, fontSize: 18 }}>{t("my_bookings_title", lang)}</h2>
            <p style={{ color: MUTED, marginBottom: 16, fontSize: 14 }}>
              {t("use_bot_to_find", lang)}
            </p>
            <Link to="/my-bookings" className="btn btn-primary">{t("view_bookings", lang)}</Link>
          </div>
          <div className="card" style={{ textAlign: "center", padding: "20px 16px" }}>
            <Scissors size={32} color={MUTED} style={{ margin: "0 auto 10px" }} />
            <p style={{ color: MUTED, marginBottom: 12, fontSize: 14 }}>
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
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            background: "#fee2e2", color: "#991b1b", borderLeft: "4px solid #ef4444",
            borderRadius: 10, padding: "14px 16px", fontSize: 14,
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            {t("shop_rejected_msg", lang)}
          </div>
          <Link to="/my-bookings" className="btn btn-ghost" style={{ textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <CalendarCheck size={IC} /> {t("view_bookings", lang)}
          </Link>
          <Link to="/shop" className="btn btn-primary">{t("shop_reapply", lang)}</Link>
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
              <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{shop.city} · {shop.address}</div>
            </div>
          </div>
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            background: "#fef9c3", color: "#854d0e", borderLeft: "4px solid #f59e0b",
            borderRadius: 10, padding: "12px 14px", fontSize: 14,
          }}>
            <Clock size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            {t("pending_approval_msg", lang)}
          </div>
          <Link to="/my-bookings" className="btn btn-ghost" style={{ textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <CalendarCheck size={IC} /> {t("view_bookings", lang)}
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
                  <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{shop.city} · {shop.address}</div>
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

          {loading && <div className="loader">{t("loading", lang)}</div>}

          {loadError && !loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fee2e2", color: "#991b1b", borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 16 }}>
              <AlertCircle size={16} />
              {t("load_error", lang)}
            </div>
          )}

          {!loading && !loadError && (
            <>
              <div className="stats-row">
                <div className="stat-box">
                  <div className="stat-value">{stats.today}</div>
                  <div className="stat-label">{t("today_label", lang)}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value" style={{ color: stats.pending > 0 ? "#f59e0b" : "var(--text)" }}>
                    {stats.pending}
                  </div>
                  <div className="stat-label">{t("status_pending", lang)}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{stats.upcoming}</div>
                  <div className="stat-label">{t("upcoming_label", lang)}</div>
                </div>
              </div>

              {/* Reviews — stars + count only */}
              {reviewSummary && reviewSummary.total_reviews > 0 && (
                <div className="card" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                  <Star size={20} color="#f59e0b" fill="#f59e0b" />
                  <span style={{ fontSize: 22, fontWeight: 800 }}>{reviewSummary.average_rating}</span>
                  <div>
                    <StarDisplay rating={reviewSummary.average_rating} />
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>
                      {reviewSummary.total_reviews} {t("reviews_count", lang)}
                    </div>
                  </div>
                </div>
              )}

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
                      <div className="booking-customer" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <User size={13} color={MUTED} /> {b.customer_name}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Phone size={13} color={MUTED} /> {b.customer_phone}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {recent.length === 0 && (
                <div className="empty-state">
                  <Calendar size={36} color={MUTED} />
                  <p style={{ marginTop: 10 }}>{t("no_upcoming", lang)}</p>
                </div>
              )}
            </>
          )}

          {/* Quick actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
            <Link to="/schedule" className="btn btn-ghost" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Calendar size={IC} /> {t("schedule_btn", lang)}
            </Link>
            <Link to="/block-slots" className="btn btn-ghost" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Ban size={IC} /> {t("block_slots_btn", lang)}
            </Link>
            {isOwner && (
              <Link to="/team" className="btn btn-ghost" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, gridColumn: "1 / -1" }}>
                <Users size={IC} /> {t("nav_team", lang)}
              </Link>
            )}
          </div>
          <Link to="/my-bookings" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: MUTED, fontSize: 13, marginTop: 12 }}>
            <CalendarCheck size={14} /> {t("view_bookings", lang)}
          </Link>
        </>
      )}
    </div>
  );
}
