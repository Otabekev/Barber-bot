import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useStore from "../store/useStore";
import { getShopBookings, updateBookingStatus } from "../api/client";
import { toast } from "../components/Layout";

const today = new Date().toISOString().slice(0, 10);

const FILTERS = [
  { label: "Upcoming", params: { from_date: today } },
  { label: "Pending",  params: { status: "pending", from_date: today } },
  { label: "Today",    params: { from_date: today, to_date: today } },
  { label: "All",      params: {} },
];

function fmtDate(d) {
  const date = new Date(d + "T00:00:00");
  const isToday = d === today;
  if (isToday) return "Today";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function BookingCard({ booking, onStatusChange }) {
  const [loading, setLoading] = useState(false);

  async function changeStatus(status) {
    setLoading(true);
    try {
      const updated = await updateBookingStatus(booking.id, status);
      onStatusChange(updated);
      toast(`Booking ${status}`);
    } catch {
      toast("Failed to update");
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
          <div className="booking-date">{fmtDate(booking.booking_date)}</div>
        </div>
        <span className={`badge badge-${status}`}>{status}</span>
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
              Confirm
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => changeStatus("cancelled")}
              disabled={loading}
            >
              Cancel
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
              Complete
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => changeStatus("cancelled")}
              disabled={loading}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Bookings() {
  const { shop } = useStore();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(0);

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
        <p>Create your shop first.</p>
        <Link to="/shop" className="btn btn-primary" style={{ marginTop: 16 }}>Go to Shop Setup</Link>
      </div>
    );
  }

  // Group bookings by date
  const grouped = bookings.reduce((acc, b) => {
    const key = b.booking_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  return (
    <div>
      <h1 className="section-title">Bookings</h1>

      <div className="filter-tabs">
        {FILTERS.map((f, i) => (
          <button
            key={f.label}
            className={`filter-tab ${activeFilter === i ? "active" : ""}`}
            onClick={() => setActiveFilter(i)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div className="loader">Loading…</div>}

      {!loading && bookings.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 36 }}>📭</div>
          <p>No bookings found.</p>
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
              <BookingCard key={b.id} booking={b} onStatusChange={handleStatusChange} />
            ))}
          </div>
        ))}
    </div>
  );
}
