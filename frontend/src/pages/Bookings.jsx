import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useStore from "../store/useStore";
import { getShopBookings, updateBookingStatus, sendMessageToCustomer } from "../api/client";
import { toast } from "../components/Layout";
import { t, DATE_LOCALE } from "../i18n";
import { User, Phone, Check, Store, Sun, CalendarX, Archive, AlertCircle, UserX, MessageSquare, Send } from "lucide-react";

const today = new Date().toISOString().slice(0, 10);

// ── Booking card ────────────────────────────────────────────────────────────
function BookingCard({ booking, onStatusChange, lang }) {
  const [loading, setLoading] = useState(false);
  const [showMsg, setShowMsg] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [msgSending, setMsgSending] = useState(false);
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
    } catch (err) {
      toast(err.response?.data?.detail || t("update_failed", lang));
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!msgText.trim()) return;
    setMsgSending(true);
    try {
      await sendMessageToCustomer(booking.id, msgText.trim());
      toast(t("message_sent", lang));
      setShowMsg(false);
      setMsgText("");
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast(detail === "no_telegram" ? t("no_telegram_linked", lang) : t("update_failed", lang));
    } finally {
      setMsgSending(false);
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
              status === "no_show"   ? "#f3f4f6" :
              "#fee2e2",
            color:
              status === "pending"   ? "#92400e" :
              status === "confirmed" ? "#065f46" :
              status === "completed" ? "#0369a1" :
              status === "no_show"   ? "#6b7280" :
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
        <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <User size={13} color="var(--hint)" /> {booking.customer_name}
        </div>
        <div style={{ color: "var(--hint)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <Phone size={13} color="var(--hint)" /> {booking.customer_phone}
        </div>
      </div>

      {/* Send message to customer */}
      <div style={{ marginBottom: 8 }}>
        {!showMsg ? (
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            onClick={() => setShowMsg(true)}
          >
            <MessageSquare size={14} /> {t("btn_message", lang)}
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <textarea
              rows={3}
              style={{ width: "100%", borderRadius: 8, border: "1px solid var(--secondary-bg)", padding: "8px 10px", fontSize: 14, resize: "none", boxSizing: "border-box" }}
              placeholder={t("message_placeholder", lang)}
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              autoFocus
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                onClick={sendMessage}
                disabled={msgSending || !msgText.trim()}
              >
                <Send size={14} /> {t("btn_send", lang)}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                style={{ paddingLeft: 16, paddingRight: 16 }}
                onClick={() => { setShowMsg(false); setMsgText(""); }}
                disabled={msgSending}
              >
                {t("btn_cancel", lang)}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {(isPending || isConfirmed) && (
        <div style={{ display: "flex", gap: 8 }}>
          {isPending && (
            <button
              className="btn btn-success btn-sm"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
              onClick={() => changeStatus("confirmed")}
              disabled={loading}
            >
              <Check size={14} /> {t("btn_confirm", lang)}
            </button>
          )}
          {isConfirmed && (
            <button
              className="btn btn-primary btn-sm"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
              onClick={() => changeStatus("completed")}
              disabled={loading}
            >
              <Check size={14} /> {t("btn_complete", lang)}
            </button>
          )}
          {isConfirmed && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: "#6b7280" }}
              onClick={() => changeStatus("no_show")}
              disabled={loading}
            >
              <UserX size={14} /> {t("btn_no_show", lang)}
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
  const { user, shop, staffRecord, shopStaff } = useStore();
  const lang = user?.language || "uz";
  const isOwner = shop && staffRecord && shop.owner_id === staffRecord.user_id;
  const hasTeam = shopStaff.filter((s) => s.is_active && s.is_approved).length > 1;

  const [tab, setTab] = useState(TAB_TODAY);
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filterStaffId, setFilterStaffId] = useState(null); // owner: filter by staff

  useEffect(() => {
    if (!staffRecord && !shop) { setLoading(false); return; }
    setLoading(true);
    setLoadError(false);
    const params = filterStaffId ? { staff_id: filterStaffId } : {};
    getShopBookings(params)
      .then(setAllBookings)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [staffRecord, shop, filterStaffId]);

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

  if (!staffRecord && !shop) {
    return (
      <div className="empty-state">
        <Store size={40} color="var(--hint)" style={{ margin: "0 auto 12px" }} />
        <p>{t("create_shop_first", lang)}</p>
        <Link to="/shop" className="btn btn-primary" style={{ marginTop: 16 }}>
          {t("go_to_shop_setup", lang)}
        </Link>
      </div>
    );
  }

  const TABS = [
    { id: TAB_TODAY,    label: t("tab_today", lang),    icon: <Sun size={14} />,       count: todayBookings.length },
    { id: TAB_UPCOMING, label: t("tab_upcoming", lang), icon: <CalendarX size={14} />, count: upcomingBookings.length },
    { id: TAB_HISTORY,  label: t("tab_history", lang),  icon: <Archive size={14} />,   count: 0 },
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

      {/* Staff filter pills — owner only, only when team has multiple members */}
      {isOwner && hasTeam && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <button
            onClick={() => setFilterStaffId(null)}
            style={{
              padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: filterStaffId === null ? "var(--btn)" : "var(--secondary-bg)",
              color: filterStaffId === null ? "var(--btn-text)" : "var(--hint)",
            }}
          >
            {t("all_staff", lang)}
          </button>
          {shopStaff.filter((s) => s.is_active && s.is_approved).map((s) => (
            <button
              key={s.id}
              onClick={() => setFilterStaffId(s.id)}
              style={{
                padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: filterStaffId === s.id ? "var(--btn)" : "var(--secondary-bg)",
                color: filterStaffId === s.id ? "var(--btn-text)" : "var(--hint)",
              }}
            >
              {s.display_name || t("unnamed_staff", lang)}
            </button>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "var(--secondary-bg)", borderRadius: 12, padding: 4 }}>
        {TABS.map(({ id, label, icon, count }) => (
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
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
            }}
          >
            {icon}
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

      {!loading && loadError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fee2e2", color: "#991b1b", borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 16 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          {t("load_error", lang)}
        </div>
      )}

      {!loading && !loadError && activeList.length === 0 && (
        <div className="empty-state">
          {tab === TAB_TODAY
            ? <Sun size={40} color="var(--hint)" style={{ margin: "0 auto 12px" }} />
            : tab === TAB_UPCOMING
            ? <CalendarX size={40} color="var(--hint)" style={{ margin: "0 auto 12px" }} />
            : <Archive size={40} color="var(--hint)" style={{ margin: "0 auto 12px" }} />
          }
          <p style={{ marginTop: 4 }}>
            {tab === TAB_TODAY    ? t("no_bookings_today", lang) :
             tab === TAB_UPCOMING ? t("no_upcoming_bookings", lang) :
             t("no_history", lang)}
          </p>
        </div>
      )}

      {/* Today: flat list sorted by time */}
      {!loading && !loadError && tab === TAB_TODAY && todayBookings.map((b) => (
        <BookingCard key={b.id} booking={b} onStatusChange={handleStatusChange} lang={lang} />
      ))}

      {/* Upcoming / History: grouped by date */}
      {!loading && !loadError && showGrouped && sortedDates.map((date) => (
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
