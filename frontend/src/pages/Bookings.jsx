import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useStore from "../store/useStore";
import { getShopBookings, updateBookingStatus } from "../api/client";
import { toast } from "../components/Layout";
import { t, DATE_LOCALE } from "../i18n";

const today = new Date().toISOString().slice(0, 10);

// ── Booking card ────────────────────────────────────────────────────────────
function BookingCard({ booking, onStatusChange, lang }) {
  const [loading, setLoading] = useState(false);
  const { status } = booking;

  function fmtFullDate(d) {
    return new Date(d + "T00:00:00").toLocaleDateString(DATE_LOCALE[lang], {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  async function changeStatus(newStatus) {
    setLoading(true);
    try {
      const updated = await updateBookingStatus(booking.id, newStatus);
      onStatusChange(updated);
      toast(t("booking_updated", lang));
    } catch {
      toast(t("update_failed", lang));
    } finally {
      setLoading(false);
    }
  }

  const isPending = status === "pending";
  const isConfirmed = status === "confirmed";

  return (
    <div
      className="booking-card"
      style={{
        borderLeft: isPending ? "4px solid #f59e0b" : isConfirmed ? "4px solid #10b981" : undefined,
        marginBottom: 10,
      }}
    >
      {/* Time + date + status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{booking.time_slot}</div>
          <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 3 }}>
            {fmtFullDate(booking.booking_date)}
          </div>
          {booking.service_type && booking.service_type !== "haircut" && (
            <span style={{
              display: "inline-block", marginTop: 4,
              background: "#e0f2fe", color: "#0369a1",
              fontSize: 11, fontWeight: 600, borderRadius: 10, padding: "2px 8px",
            }}>
              {t("service_" + booking.service_type, lang)}
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "4px 12px",
            borderRadius: 20,
            background:
              status === "pending"   ? "#fef3c7" :
              status === "confirmed" ? "#d1fae5" :
              status === "completed" ? "#e0f2fe" :
              "#fee2e2",
            color:
              status === "pending"   ? "#92400e" :
              status === "confirmed" ? "#065f46" :
              status === "completed" ? "#0369a1" :
              "#991b1b",
          }}
        >
          {t("status_" + status, lang)}
        </span>
      </div>

      {/* Customer info */}
      <div
        style={{
          background: "var(--secondary-bg)",
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 10,
          fontSize: 14,
        }}
      >
        <div style={{ fontWeight: 600 }}>👤 {booking.customer_name}</div>
        <div style={{ color: "var(--hint)", marginTop: 4 }}>📞 {booking.customer_phone}</div>
      </div>

      {/* Actions */}
      {(isPending || isConfirmed) && (
        <div style={{ display: "flex", gap: 8 }}>
          {isPending && (
            <button
              className="btn btn-success btn-sm"
              style={{ flex: 1 }}
              onClick={() => changeStatus("confirmed")}
              disabled={loading}
            >
              ✓ {t("btn_confirm", lang)}
            </button>
          )}
          {isConfirmed && (
            <button
              className="btn btn-primary btn-sm"
              style={{ flex: 1 }}
              onClick={() => changeStatus("completed")}
              disabled={loading}
            >
              ✓ {t("btn_complete", lang)}
            </button>
          )}
          <button
            className="btn btn-danger btn-sm"
            style={{ flex: isPending || isConfirmed ? 0 : 1, paddingLeft: 16, paddingRight: 16 }}
            onClick={() => changeStatus("cancelled")}
            disabled={loading}
          >
            {t("btn_cancel", lang)}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Grouped date list ───────────────────────────────────────────────────────
function BookingDateGroup({ date, bookings, onStatusChange, lang }) {
  function fmtGroupDate(d) {
    if (d === today) return t("today_label", lang);
    return new Date(d + "T00:00:00").toLocaleDateString(DATE_LOCALE[lang], {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--hint)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 8,
          marginTop: 16,
          paddingBottom: 6,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {fmtGroupDate(date)}
      </div>
      {bookings.map((b) => (
        <BookingCard key={b.id} booking={b} onStatusChange={onStatusChange} lang={lang} />
      ))}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
const TAB_TODAY    = "today";
const TAB_UPCOMING = "upcoming";
const TAB_HISTORY  = "history";

export default function Bookings() {
  const { user, shop } = useStore();
  const lang = user?.language || "uz";
  const [tab, setTab] = useState(TAB_TODAY);
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shop) { setLoading(false); return; }
    setLoading(true);
    // Fetch all bookings at once; we filter client-side for the 3 tabs
    getShopBookings({})
      .then(setAllBookings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shop]);

  const handleStatusChange = (updated) =>
    setAllBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));

  // ── Tab filters ─────────────────────────────────────────────────────
  const todayBookings = allBookings
    .filter((b) => b.booking_date === today && ["pending", "confirmed"].includes(b.status))
    .sort((a, b) => a.time_slot.localeCompare(b.time_slot));

  const upcomingBookings = allBookings
    .filter((b) => b.booking_date > today && ["pending", "confirmed"].includes(b.status))
    .sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.time_slot.localeCompare(b.time_slot));

  const historyBookings = allBookings
    .filter((b) => ["completed", "cancelled"].includes(b.status))
    .sort((a, b) => b.booking_date.localeCompare(a.booking_date) || b.time_slot.localeCompare(a.time_slot));

  // Group upcoming by date
  function groupByDate(list) {
    return list.reduce((acc, b) => {
      if (!acc[b.booking_date]) acc[b.booking_date] = [];
      acc[b.booking_date].push(b);
      return acc;
    }, {});
  }

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

  const TABS = [
    { id: TAB_TODAY,    label: `📅 ${t("tab_today", lang)}`,    count: todayBookings.length },
    { id: TAB_UPCOMING, label: `🔜 ${t("tab_upcoming", lang)}`, count: upcomingBookings.length },
    { id: TAB_HISTORY,  label: `📋 ${t("tab_history", lang)}`,  count: 0 },
  ];

  const activeList =
    tab === TAB_TODAY    ? todayBookings :
    tab === TAB_UPCOMING ? upcomingBookings :
    historyBookings;

  const showGrouped = tab !== TAB_TODAY;
  const grouped = showGrouped ? groupByDate(activeList) : {};
  const sortedDates = Object.keys(grouped).sort(
    tab === TAB_HISTORY ? (a, b) => b.localeCompare(a) : (a, b) => a.localeCompare(b)
  );

  return (
    <div>
      <h1 className="section-title">{t("bookings_title", lang)}</h1>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "var(--secondary-bg)", borderRadius: 12, padding: 4 }}>
        {TABS.map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              position: "relative",
              padding: "9px 4px",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12,
              background: tab === id ? "var(--btn)" : "transparent",
              color: tab === id ? "var(--btn-text)" : "var(--hint)",
              transition: "all 0.15s",
              lineHeight: 1.2,
            }}
          >
            {label}
            {count > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  background: tab === id ? "rgba(255,255,255,0.3)" : "#ef4444",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 800,
                  borderRadius: 10,
                  padding: "1px 5px",
                  lineHeight: 1.4,
                }}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <div className="loader">{t("loading", lang)}</div>}

      {!loading && activeList.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 40 }}>
            {tab === TAB_TODAY ? "☀️" : tab === TAB_UPCOMING ? "📭" : "🗂️"}
          </div>
          <p style={{ marginTop: 12 }}>
            {tab === TAB_TODAY    ? t("no_bookings_today", lang) :
             tab === TAB_UPCOMING ? t("no_upcoming_bookings", lang) :
             t("no_history", lang)}
          </p>
        </div>
      )}

      {/* Today: flat list sorted by time */}
      {!loading && tab === TAB_TODAY && todayBookings.map((b) => (
        <BookingCard key={b.id} booking={b} onStatusChange={handleStatusChange} lang={lang} />
      ))}

      {/* Upcoming / History: grouped by date */}
      {!loading && showGrouped && sortedDates.map((date) => (
        <BookingDateGroup
          key={date}
          date={date}
          bookings={grouped[date]}
          onStatusChange={handleStatusChange}
          lang={lang}
        />
      ))}
    </div>
  );
}
