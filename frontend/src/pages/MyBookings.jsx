import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMyBookings, cancelMyBooking, getShopReviews } from "../api/client";
import { toast } from "../components/Layout";
import useStore from "../store/useStore";
import { t, DATE_LOCALE } from "../i18n";
import { Star, CalendarX, AlertCircle, MessageSquarePlus } from "lucide-react";

function StarDisplay({ rating }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1,2,3,4,5].map((s) => (
        <Star key={s} size={13} color="#f59e0b" fill={s <= Math.round(rating) ? "#f59e0b" : "none"} opacity={s <= Math.round(rating) ? 1 : 0.3} />
      ))}
    </span>
  );
}

export default function MyBookings() {
  const { user } = useStore();
  const navigate = useNavigate();
  const lang = user?.language || "uz";
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  // Map of shop_id → { average_rating, total_reviews }
  const [shopRatings, setShopRatings] = useState({});

  function fmtDate(d) {
    return new Date(d + "T00:00:00").toLocaleDateString(DATE_LOCALE[lang], {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  const STATUS_STYLE = {
    pending:   { color: "#f59e0b" },
    confirmed: { color: "#10b981" },
    cancelled: { color: "#ef4444" },
    completed: { color: "#6b7280" },
    no_show:   { color: "#9ca3af" },
  };

  useEffect(() => {
    setLoadError(false);
    getMyBookings()
      .then(async (data) => {
        setBookings(data);
        // Fetch ratings for unique shops with bookings
        const shopIds = [...new Set(data.map((b) => b.shop_id).filter(Boolean))];
        const ratings = {};
        await Promise.all(
          shopIds.map((id) =>
            getShopReviews(id)
              .then((r) => { ratings[id] = r; })
              .catch(() => {})
          )
        );
        setShopRatings(ratings);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  async function handleCancel(id) {
    setCancelling(id);
    try {
      const updated = await cancelMyBooking(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
      toast(t("cancel_success", lang));
    } catch (err) {
      toast(err.response?.data?.detail || t("cancel_error", lang));
    } finally {
      setCancelling(null);
    }
  }

  if (loading) return <div className="loader" style={{ height: "60vh" }}>{t("loading", lang)}</div>;

  return (
    <div className="page">
      <h2 style={{ marginBottom: 16 }}>{t("my_bookings_heading", lang)}</h2>

      {loadError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fee2e2", color: "#991b1b", borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 16 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          {t("load_error", lang)}
        </div>
      )}

      {!loadError && bookings.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--hint)" }}>
          <CalendarX size={40} color="var(--hint)" style={{ margin: "0 auto 12px" }} />
          <p>{t("no_bookings_yet", lang)}</p>
        </div>
      )}

      {!loadError && bookings.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bookings.map((b) => {
            const s = STATUS_STYLE[b.status] || STATUS_STYLE.pending;
            const canCancel = b.status === "pending" || b.status === "confirmed";
            const shopRating = b.shop_id && shopRatings[b.shop_id];
            return (
              <div key={b.id} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>
                      {fmtDate(b.booking_date)}, {b.time_slot}
                    </span>
                    {b.service_type && b.service_type !== "haircut" && (
                      <span style={{
                        display: "inline-block", marginLeft: 8,
                        background: "#e0f2fe", color: "#0369a1",
                        fontSize: 11, fontWeight: 600, borderRadius: 10, padding: "2px 8px",
                      }}>
                        {t("service_" + b.service_type, lang)}
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 600,
                    color: s.color, background: s.color + "22",
                    borderRadius: 20, padding: "2px 10px", flexShrink: 0,
                  }}>
                    {t("status_" + b.status, lang)}
                  </span>
                </div>

                {/* Shop rating row */}
                {shopRating && shopRating.total_reviews > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <StarDisplay rating={shopRating.average_rating} />
                    <span style={{ fontSize: 12, color: "var(--hint)" }}>
                      {shopRating.average_rating} ({shopRating.total_reviews} {t("reviews_count", lang)})
                    </span>
                  </div>
                )}

                {canCancel && (
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: 8, padding: "6px 14px", fontSize: 13 }}
                    disabled={cancelling === b.id}
                    onClick={() => handleCancel(b.id)}
                  >
                    {cancelling === b.id ? t("cancelling", lang) : t("btn_cancel_booking", lang)}
                  </button>
                )}

                {/* Leave review button for completed bookings */}
                {b.status === "completed" && (
                  <button
                    className="btn btn-ghost"
                    style={{ marginTop: 8, padding: "6px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
                    onClick={() => navigate(`/review?booking_id=${b.id}`)}
                  >
                    <MessageSquarePlus size={14} />
                    {t("review_submit", lang)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
