import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useStore from "../store/useStore";
import { getMySchedule, updateSchedule } from "../api/client";
import { toast } from "../components/Layout";
import { t } from "../i18n";

// day_0 = Monday … day_6 = Sunday — keys live in locales/*.json
const DEFAULT_SCHEDULE = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  open_time: "09:00",
  close_time: "18:00",
  is_working: i < 5,
}));

export default function Schedule() {
  const { user, shop } = useStore();
  const lang = user?.language || "uz";
  const [rows, setRows] = useState(DEFAULT_SCHEDULE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!shop) { setLoading(false); return; }
    getMySchedule()
      .then((data) => {
        if (data.length > 0) {
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
      toast(t("save_schedule_success", lang));
    } catch (err) {
      toast(err.response?.data?.detail || t("save_failed", lang));
    } finally {
      setSaving(false);
    }
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

  if (loading) return <div className="loader">{t("loading_schedule", lang)}</div>;

  return (
    <div>
      <h1 className="section-title">{t("schedule_title", lang)}</h1>
      <p style={{ color: "var(--hint)", fontSize: 14, marginBottom: 16 }}>
        {t("schedule_hint", lang)}
      </p>

      <div className="card">
        {rows.map((row, idx) => (
          <div
            key={row.day_of_week}
            className="day-row"
            style={{ flexDirection: "column", alignItems: "stretch", gap: 0 }}
          >
            {/* Day name + toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 48 }}>
              <span className="day-name">{t(`day_${row.day_of_week}`, lang)}</span>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={row.is_working}
                  onChange={(e) => updateRow(idx, { is_working: e.target.checked })}
                />
                <span className="toggle-slider" />
              </label>
              {!row.is_working && (
                <span style={{ color: "var(--hint)", fontSize: 13 }}>{t("closed", lang)}</span>
              )}
            </div>

            {/* Time inputs — only when working */}
            {row.is_working && (
              <div className="time-inputs" style={{ marginTop: 8, marginBottom: 6 }}>
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
            )}
          </div>
        ))}
      </div>

      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? t("saving", lang) : t("save_schedule", lang)}
      </button>
    </div>
  );
}
