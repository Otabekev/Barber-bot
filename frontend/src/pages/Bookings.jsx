import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useStore from "../store/useStore";
import { getShopBookings, updateBookingStatus } from "../api/client";
import { toast } from "../components/Layout";
import { t, DATE_LOCALE } from "../i18n";

const today = new Date().toISOString().slice(0, 10);

function BookingCard({ booking, onStatusChange, lang }) {
  const [loading, setLoading] = useState(false);

  async function changeStatus(status) {
    setLoading(true);
    try {
      const updated = await updateBookingStatus(booking.id, status);
      onStatusChange(updated);
      toast(t("booking_updated", lang));
    } catch {
      toast(t("update_failed", lang));
    } finally {
      setLoading(false);
    }
  }

  const { status } = booking;

  return (
    <div className="booking-card">
      <div className="booking-header">
        <div>
          <div className="booking-time">{booking.time_slot}</div>
        </div>
        <span className={`badge badge-${status}`}>{t("status_" + status, lang)}</span>
      </div>

      <div className="booking-customer">
        <div>👤 {booking.customer_name}</div>
        <div style={{ marginTop: 2 }}>📞 {booking.customer_phone}</div>
      </div>

      <div className="booking-actions">
        {status === "pending" && (
          <>
            <button
              className="btn btn-success btn-sm"
              onClick={() => changeStatus("confirmed")}
              disabled={loading}
            >
              {t("btn_confirm", lang)}
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => changeStatus("cancelled")}
              disabled={loading}
            >
              {t("btn_cancel", lang)}
            </button>
          </>
        )}
        {status === "confirmed" && (
          <>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => changeStatus("completed")}
              disabled={loading}
            >
              {t("btn_complete", lang)}
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => changeStatus("cancelled")}
              disabled={loading}
            >
              {t("btn_cancel", lang)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Bookings() {
  const { user, shop } = useStore();
  const lang = user?.language || "uz";
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(0);

  const FILTERS = [
    { label: t("filter_upcoming", lang), params: { from_date: today } },
    { label: t("filter_pending", lang),  params: { status: "pending", from_date: today } },
    { label: t("filter_today", lang),    params: { from_date: today, to_date: today } },
    { label: t("filter_all", lang),      params: {} },
  ];

  function fmtDate(d) {
    const date = new Date(d + "T00:00:00");
    const isToday = d === today;
    if (isToday) return t("today_label", lang);
    return date.toLocaleDateString(DATE_LOCALE[lang], { weekday: "short", month: "short", day: "numeric" });
  }

  useEffect(() => {
    if (!shop) { setLoading(false); return; }
    setLoading(true);
    getShopBookings(FILTERS[activeFilter].params)
      .then(setBookings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shop, activeFilter]);

  const handleStatusChange = (updated) =>
    setBookings((bs) => bs.map((b) => (b.id === updated.id ? updated : b)));

  if (!shop) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: 36 }}>🏪</div>
        <p>{t("create_shop_first", lang)}</p>
        <Link to="/shop" className="btn btn-primary" style={{ marginTop: 16 }}>
          {t("go_to_shop_setup", lang)}
        </Link>
      </div>
    );
  }

  const grouped = bookings.reduce((acc, b) => {
    const key = b.booking_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  return (
    <div>
      <h1 className="section-title">{t("bookings_title", lang)}</h1>

      <div className="filter-tabs">
        {FILTERS.map((f, i) => (
          <button
            key={i}
            className={`filter-tab ${activeFilter === i ? "active" : ""}`}
            onClick={() => setActiveFilter(i)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div className="loader">{t("loading", lang)}</div>}

      {!loading && bookings.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 36 }}>📭</div>
          <p>{t("no_bookings", lang)}</p>
        </div>
      )}

      {!loading &&
        sortedDates.map((date) => (
          <div key={date}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--hint)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 8,
                marginTop: 16,
              }}
            >
              {fmtDate(date)}
            </div>
            {grouped[date].map((b) => (
              <BookingCard key={b.id} booking={b} onStatusChange={handleStatusChange} lang={lang} />
            ))}
          </div>
        ))}
    </div>
  );
}
