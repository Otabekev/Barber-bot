import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useStore from "../store/useStore";
import { getMySchedule, updateSchedule } from "../api/client";
import { toast } from "../components/Layout";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEFAULT_SCHEDULE = DAYS.map((_, i) => ({
  day_of_week: i,
  open_time: "09:00",
  close_time: "18:00",
  is_working: i < 5,  // Mon–Fri on by default
}));

export default function Schedule() {
  const { shop } = useStore();
  const [rows, setRows] = useState(DEFAULT_SCHEDULE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!shop) { setLoading(false); return; }
    getMySchedule()
      .then((data) => {
        if (data.length > 0) {
          // Merge server data into the 7-day grid
          const map = Object.fromEntries(data.map((d) => [d.day_of_week, d]));
          setRows(
            DEFAULT_SCHEDULE.map((def) =>
              map[def.day_of_week]
                ? { ...def, ...map[def.day_of_week] }
                : def
            )
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shop]);

  const updateRow = (idx, patch) =>
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  async function handleSave() {
    setSaving(true);
    try {
      await updateSchedule(rows);
      toast("Schedule saved!");
    } catch (err) {
      toast(err.response?.data?.detail || "Save failed");
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

  if (loading) return <div className="loader">Loading schedule…</div>;

  return (
    <div>
      <h1 className="section-title">Work Schedule</h1>
      <p style={{ color: "var(--hint)", fontSize: 14, marginBottom: 16 }}>
        Set your working hours for each day of the week.
      </p>

      <div className="card">
        {rows.map((row, idx) => (
          <div key={row.day_of_week} className="day-row">
            <span className="day-name">{DAYS[row.day_of_week]}</span>

            <label className="toggle">
              <input
                type="checkbox"
                checked={row.is_working}
                onChange={(e) => updateRow(idx, { is_working: e.target.checked })}
              />
              <span className="toggle-slider" />
            </label>

            {row.is_working ? (
              <div className="time-inputs">
                <input
                  type="time"
                  value={row.open_time}
                  onChange={(e) => updateRow(idx, { open_time: e.target.value })}
                />
                <span>–</span>
                <input
                  type="time"
                  value={row.close_time}
                  onChange={(e) => updateRow(idx, { close_time: e.target.value })}
                />
              </div>
            ) : (
              <span style={{ color: "var(--hint)", fontSize: 13, flex: 1 }}>Closed</span>
            )}
          </div>
        ))}
      </div>

      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save Schedule"}
      </button>
    </div>
  );
}
