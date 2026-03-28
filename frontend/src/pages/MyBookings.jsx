import { useState, useEffect } from "react";
import { getMyBookings, cancelMyBooking } from "../api/client";
import { toast } from "../components/Layout";

const STATUS_LABEL = {
  pending: { text: "Kutilmoqda", color: "#f59e0b" },
  confirmed: { text: "Tasdiqlandi", color: "#10b981" },
  cancelled: { text: "Bekor", color: "#ef4444" },
  completed: { text: "Tugadi", color: "#6b7280" },
};

function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("uz-UZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    getMyBookings()
      .then(setBookings)
      .catch(() => toast("Bronlarni yuklashda xato"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCancel(id) {
    setCancelling(id);
    try {
      const updated = await cancelMyBooking(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
      toast("Bron bekor qilindi");
    } catch {
      toast("Bekor qilishda xato");
    } finally {
      setCancelling(null);
    }
  }

  if (loading) return <div className="loader" style={{ height: "60vh" }}>Yuklanmoqda…</div>;

  return (
    <div className="page">
      <h2 style={{ marginBottom: 16 }}>📋 Mening bronlarim</h2>

      {bookings.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--hint)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <p>Hali bron yo'q</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bookings.map((b) => {
            const s = STATUS_LABEL[b.status] || STATUS_LABEL.pending;
            const canCancel = b.status === "pending" || b.status === "confirmed";
            return (
              <div
                key={b.id}
                className="card"
                style={{ padding: "14px 16px" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>
                    {fmtDate(b.booking_date)}, {b.time_slot}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: s.color,
                      background: s.color + "22",
                      borderRadius: 20,
                      padding: "2px 10px",
                    }}
                  >
                    {s.text}
                  </span>
                </div>
                {canCancel && (
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: 8, padding: "6px 14px", fontSize: 13 }}
                    disabled={cancelling === b.id}
                    onClick={() => handleCancel(b.id)}
                  >
                    {cancelling === b.id ? "…" : "Bekor qilish"}
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
