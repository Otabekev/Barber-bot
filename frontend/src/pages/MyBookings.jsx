import { useState, useEffect } from "react";
import { getMyBookings, cancelMyBooking } from "../api/client";
import { toast } from "../components/Layout";
import useStore from "../store/useStore";
import { t, DATE_LOCALE } from "../i18n";

export default function MyBookings() {
  const { user } = useStore();
  const lang = user?.language || "uz";
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

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
  };

  useEffect(() => {
    getMyBookings()
      .then(setBookings)
      .catch(() => toast(t("load_error", lang)))
      .finally(() => setLoading(false));
  }, []);

  async function handleCancel(id) {
    setCancelling(id);
    try {
      const updated = await cancelMyBooking(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
      toast(t("cancel_success", lang));
    } catch {
      toast(t("cancel_error", lang));
    } finally {
      setCancelling(null);
    }
  }

  if (loading) return <div className="loader" style={{ height: "60vh" }}>{t("loading", lang)}</div>;

  return (
    <div className="page">
      <h2 style={{ marginBottom: 16 }}>{t("my_bookings_heading", lang)}</h2>

      {bookings.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--hint)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <p>{t("no_bookings_yet", lang)}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bookings.map((b) => {
            const s = STATUS_STYLE[b.status] || STATUS_STYLE.pending;
            const canCancel = b.status === "pending" || b.status === "confirmed";
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
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: s.color,
                      background: s.color + "22",
                      borderRadius: 20,
                      padding: "2px 10px",
                      flexShrink: 0,
                    }}
                  >
                    {t("status_" + b.status, lang)}
                  </span>
                </div>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
