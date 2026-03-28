import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useStore from "../store/useStore";
import { getAvailableSlots, blockSlots, unblockSlots } from "../api/client";
import { toast } from "../components/Layout";

const today = new Date().toISOString().slice(0, 10);

export default function BlockSlots() {
  const { shop } = useStore();
  const [date, setDate] = useState(today);
  const [slotData, setSlotData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingBlocked, setPendingBlocked] = useState(new Set());

  useEffect(() => {
    if (!shop) return;
    setSlotData(null);
    getAvailableSlots(shop.id, date)
      .then((data) => {
        setSlotData(data);
        setPendingBlocked(new Set(data.blocked || []));
      })
      .catch(() => toast("Failed to load slots"));
  }, [shop, date]);

  function toggleSlot(slot) {
    if (slotData?.booked?.includes(slot)) return; // can't toggle booked slots
    setPendingBlocked((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  }

  async function handleSave() {
    if (!slotData) return;
    const originalBlocked = new Set(slotData.blocked || []);
    const toBlock = [...pendingBlocked].filter((s) => !originalBlocked.has(s));
    const toUnblock = [...originalBlocked].filter((s) => !pendingBlocked.has(s));

    if (toBlock.length === 0 && toUnblock.length === 0) {
      toast("No changes to save");
      return;
    }

    setSaving(true);
    try {
      if (toBlock.length > 0)   await blockSlots(date, toBlock);
      if (toUnblock.length > 0) await unblockSlots(date, toUnblock);

      // Refresh
      const fresh = await getAvailableSlots(shop.id, date);
      setSlotData(fresh);
      setPendingBlocked(new Set(fresh.blocked || []));
      toast("Slots updated!");
    } catch {
      toast("Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!shop) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: 36 }}>🏪</div>
        <p>Create your shop first.</p>
        <Link to="/shop" className="btn btn-primary" style={{ marginTop: 16 }}>Go to Shop Setup</Link>
      </div>
    );
  }

  const allSlots = slotData?.all_slots || [];
  const bookedSet = new Set(
    (slotData?.all_slots || []).filter((s) => !slotData?.slots?.includes(s) && !pendingBlocked.has(s))
  );

  return (
    <div>
      <h1 className="section-title">Block Slots</h1>
      <p style={{ color: "var(--hint)", fontSize: 14, marginBottom: 16 }}>
        Tap a slot to block it. Blocked slots won't appear to customers.
      </p>

      <div className="card">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Select Date</label>
          <input
            type="date"
            className="form-input"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {!slotData && (
        <div className="loader">Loading slots…</div>
      )}

      {slotData && allSlots.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 36 }}>😴</div>
          <p>Shop is closed on this day.</p>
          <Link to="/schedule" style={{ color: "var(--btn)", fontSize: 13, marginTop: 8, display: "block" }}>
            Edit schedule →
          </Link>
        </div>
      )}

      {slotData && allSlots.length > 0 && (
        <>
          {/* Legend */}
          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: "var(--bg)", border: "1.5px solid var(--border)", display: "inline-block" }} />
              Available
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: "#ff3b30", display: "inline-block" }} />
              Blocked
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: "var(--secondary-bg)", border: "1.5px solid var(--border)", display: "inline-block" }} />
              Booked
            </div>
          </div>

          <div className="slot-grid">
            {allSlots.map((slot) => {
              const isBlocked = pendingBlocked.has(slot);
              const serverBooked = slotData.slots
                ? !slotData.slots.includes(slot) && !isBlocked
                : false;

              let cls = "slot-chip";
              if (isBlocked) cls += " blocked";
              else if (serverBooked) cls += " booked";

              return (
                <div
                  key={slot}
                  className={cls}
                  onClick={() => !serverBooked && toggleSlot(slot)}
                  title={serverBooked ? "Already booked by a customer" : isBlocked ? "Click to unblock" : "Click to block"}
                >
                  {slot}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
              {saving ? "Saving…" : `Save Changes`}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setPendingBlocked(new Set(slotData?.blocked || []))}
              disabled={saving}
            >
              Reset
            </button>
          </div>

          <p style={{ fontSize: 12, color: "var(--hint)", marginTop: 10, textAlign: "center" }}>
            {pendingBlocked.size} slot{pendingBlocked.size !== 1 ? "s" : ""} blocked
          </p>
        </>
      )}
    </div>
  );
}
