import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import useStore from "../store/useStore";
import { getAvailableSlots, blockSlots, unblockSlots, blockDateRange, unblockDateRange, getBlockedDates } from "../api/client";
import { toast } from "../components/Layout";
import { t } from "../i18n";
import { Palmtree, ChevronDown, ChevronUp, Store, MoonStar, CalendarX, Trash2 } from "lucide-react";

const today = new Date().toISOString().slice(0, 10);

function VacationPanel({ lang, shopExists, onChanged }) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [saving, setSaving] = useState(false);

  if (!shopExists) return null;

  async function handleBlock() {
    if (endDate < startDate) { toast(t("vacation_date_error", lang)); return; }
    setSaving(true);
    try {
      const res = await blockDateRange(startDate, endDate);
      toast(`✅ ${res.blocked_count} ${t("vacation_blocked_msg", lang)}`);
      setOpen(false);
      if (onChanged) onChanged();
    } catch (err) {
      toast(err.response?.data?.detail || t("save_failed", lang));
    } finally {
      setSaving(false);
    }
  }

  async function handleUnblock() {
    if (endDate < startDate) { toast(t("vacation_date_error", lang)); return; }
    setSaving(true);
    try {
      await unblockDateRange(startDate, endDate);
      toast(t("vacation_unblocked_msg", lang));
      setOpen(false);
      if (onChanged) onChanged();
    } catch (err) {
      toast(err.response?.data?.detail || t("save_failed", lang));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: 0, fontSize: 15, fontWeight: 700, color: "var(--text)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Palmtree size={16} color="var(--hint)" />
          {t("vacation_title", lang)}
        </span>
        {open ? <ChevronUp size={16} color="var(--hint)" /> : <ChevronDown size={16} color="var(--hint)" />}
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 13, color: "var(--hint)", marginBottom: 12 }}>
            {t("vacation_hint", lang)}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label className="form-label">{t("vacation_from", lang)}</label>
              <input type="date" className="form-input" value={startDate} min={today}
                onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">{t("vacation_to", lang)}</label>
              <input type="date" className="form-input" value={endDate} min={startDate}
                onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              className="btn btn-primary"
              onClick={handleBlock}
              disabled={saving}
              style={{ fontSize: 14 }}
            >
              {saving ? t("saving", lang) : t("vacation_block_btn", lang)}
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleUnblock}
              disabled={saving}
              style={{ fontSize: 14 }}
            >
              {t("vacation_unblock_btn", lang)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BlockedDaysPanel({ lang, onRemoved }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getBlockedDates()
      .then(setDays)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  async function handleRemove(dateStr) {
    setRemoving(dateStr);
    try {
      await unblockDateRange(dateStr, dateStr);
      setDays((prev) => prev.filter((d) => d.date !== dateStr));
      toast(t("blocked_days_removed", lang));
      if (onRemoved) onRemoved();
    } catch {
      toast(t("save_failed", lang));
    } finally {
      setRemoving(null);
    }
  }

  const upcoming = days.filter((d) => !d.is_past);
  const past = days.filter((d) => d.is_past);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: 0, fontSize: 15, fontWeight: 700, color: "var(--text)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarX size={16} color="var(--hint)" />
          {t("blocked_days_title", lang)}
          {days.filter((d) => !d.is_past).length > 0 && (
            <span style={{
              background: "#ff3b30", color: "#fff", borderRadius: 10,
              fontSize: 11, padding: "1px 7px", fontWeight: 600,
            }}>
              {days.filter((d) => !d.is_past).length}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={16} color="var(--hint)" /> : <ChevronDown size={16} color="var(--hint)" />}
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          {loading && <p style={{ fontSize: 13, color: "var(--hint)" }}>{t("loading", lang)}</p>}

          {!loading && days.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--hint)", textAlign: "center", padding: "8px 0" }}>
              {t("blocked_days_empty", lang)}
            </p>
          )}

          {!loading && upcoming.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--hint)", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 }}>
                {t("blocked_days_upcoming", lang)}
              </p>
              {upcoming.map((d) => (
                <div key={d.date} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 0", borderBottom: "1px solid var(--border)",
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {d.is_today
                        ? `${d.date} · ${t("blocked_days_today", lang)}`
                        : d.date}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--hint)", marginLeft: 8 }}>
                      {d.count} {t("blocked_days_slots", lang)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemove(d.date)}
                    disabled={removing === d.date}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#ff3b30", padding: "4px 6px", borderRadius: 6,
                      display: "flex", alignItems: "center", gap: 4, fontSize: 13,
                    }}
                  >
                    <Trash2 size={14} />
                    {removing === d.date ? "…" : t("blocked_days_remove", lang)}
                  </button>
                </div>
              ))}
            </>
          )}

          {!loading && past.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--hint)", textTransform: "uppercase", margin: "12px 0 8px", letterSpacing: 0.5 }}>
                {t("blocked_days_past", lang)}
              </p>
              {past.map((d) => (
                <div key={d.date} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 0", borderBottom: "1px solid var(--border)",
                  opacity: 0.55,
                }}>
                  <div>
                    <span style={{ fontSize: 14 }}>{d.date}</span>
                    <span style={{ fontSize: 12, color: "var(--hint)", marginLeft: 8 }}>
                      {d.count} {t("blocked_days_slots", lang)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemove(d.date)}
                    disabled={removing === d.date}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--hint)", padding: "4px 6px", borderRadius: 6,
                      display: "flex", alignItems: "center", gap: 4, fontSize: 13,
                    }}
                  >
                    <Trash2 size={14} />
                    {removing === d.date ? "…" : t("blocked_days_remove", lang)}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function BlockSlots() {
  const { user, shop } = useStore();
  const lang = user?.language || "uz";
  const [date, setDate] = useState(today);
  const [slotData, setSlotData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingBlocked, setPendingBlocked] = useState(new Set());
  const [blockedDaysKey, setBlockedDaysKey] = useState(0);

  const refreshBlockedDays = useCallback(() => setBlockedDaysKey((k) => k + 1), []);

  useEffect(() => {
    if (!shop) return;
    setSlotData(null);
    getAvailableSlots(shop.id, date)
      .then((data) => {
        setSlotData(data);
        setPendingBlocked(new Set(data.blocked || []));
      })
      .catch(() => toast(t("block_load_error", lang)));
  }, [shop, date]);

  function toggleSlot(slot) {
    if (slotData?.booked?.includes(slot)) return;
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
      toast(t("block_no_changes", lang));
      return;
    }

    setSaving(true);
    try {
      if (toBlock.length > 0)   await blockSlots(date, toBlock);
      if (toUnblock.length > 0) await unblockSlots(date, toUnblock);

      const fresh = await getAvailableSlots(shop.id, date);
      setSlotData(fresh);
      setPendingBlocked(new Set(fresh.blocked || []));
      toast(t("block_saved", lang));
    } catch (err) {
      toast(err.response?.data?.detail || t("save_failed", lang));
    } finally {
      setSaving(false);
    }
  }

  if (!shop) {
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

  const allSlots = slotData?.all_slots || [];

  return (
    <div>
      <h1 className="section-title">{t("block_slots_title", lang)}</h1>
      <p style={{ color: "var(--hint)", fontSize: 14, marginBottom: 16 }}>
        {t("block_slots_hint", lang)}
      </p>

      <VacationPanel lang={lang} shopExists={!!shop} onChanged={refreshBlockedDays} />
      <BlockedDaysPanel key={blockedDaysKey} lang={lang} onRemoved={refreshBlockedDays} />

      <div className="card">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{t("block_select_date", lang)}</label>
          <input
            type="date"
            className="form-input"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {!slotData && <div className="loader">{t("loading", lang)}</div>}

      {slotData && allSlots.length === 0 && (
        <div className="empty-state">
          <MoonStar size={40} color="var(--hint)" style={{ margin: "0 auto 12px" }} />
          <p>{t("block_shop_closed", lang)}</p>
          <Link to="/schedule" style={{ color: "var(--btn)", fontSize: 13, marginTop: 8, display: "block" }}>
            {t("block_edit_schedule", lang)}
          </Link>
        </div>
      )}

      {slotData && allSlots.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            {[
              { color: "var(--bg)", border: "1.5px solid var(--border)", label: t("block_legend_available", lang) },
              { color: "#ff3b30", border: "none", label: t("block_legend_blocked", lang) },
              { color: "var(--secondary-bg)", border: "1.5px solid var(--border)", label: t("block_legend_booked", lang) },
            ].map(({ color, border, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: color, border, display: "inline-block" }} />
                {label}
              </div>
            ))}
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
                >
                  {slot}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
              {saving ? t("saving", lang) : t("save_changes", lang)}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setPendingBlocked(new Set(slotData?.blocked || []))}
              disabled={saving}
            >
              {t("block_reset", lang)}
            </button>
          </div>

          <p style={{ fontSize: 12, color: "var(--hint)", marginTop: 10, textAlign: "center" }}>
            {pendingBlocked.size} {t("block_count_suffix", lang)}
          </p>
        </>
      )}
    </div>
  );
}
