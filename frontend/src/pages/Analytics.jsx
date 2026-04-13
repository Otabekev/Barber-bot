import { useEffect, useState } from "react";
import useStore from "../store/useStore";
import { getMyAnalytics } from "../api/client";
import { t } from "../i18n";

const DAY_KEYS = ["day_0", "day_1", "day_2", "day_3", "day_4", "day_5", "day_6"];

function PeriodToggle({ value, onChange, lang }) {
  const options = [
    { key: "week",  label: t("analytics_period_week", lang) },
    { key: "month", label: t("analytics_period_month", lang) },
    { key: "all",   label: t("analytics_period_all", lang) },
  ];
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: value === o.key ? 700 : 400,
            background: value === o.key ? "var(--btn)" : "var(--secondary-bg)",
            color: value === o.key ? "var(--btn-text)" : "var(--text)",
            transition: "background 0.15s",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StatBox({ label, value, accent }) {
  return (
    <div className="stat-box" style={{ flex: 1, textAlign: "center", padding: "14px 8px" }}>
      <div
        className="stat-value"
        style={{ fontSize: 28, fontWeight: 700, color: accent || "var(--text)" }}
      >
        {value}
      </div>
      <div className="stat-label" style={{ fontSize: 12, color: "var(--hint)", marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function ServiceBar({ label, count, total, highlight }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
        <span style={{ fontWeight: highlight ? 700 : 400, color: highlight ? "var(--btn)" : "var(--text)" }}>
          {label} {highlight && "⭐"}
        </span>
        <span style={{ color: "var(--hint)" }}>{count} ({pct}%)</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--secondary-bg)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 3,
            background: highlight ? "var(--btn)" : "var(--hint)",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

function DayBars({ counts, busiestIdx, lang }) {
  const max = Math.max(...counts, 1);
  const BAR_MAX_H = 40;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: BAR_MAX_H + 24 }}>
      {counts.map((cnt, i) => {
        const h = Math.max(4, Math.round((cnt / max) * BAR_MAX_H));
        const isBusiest = i === busiestIdx;
        return (
          <div
            key={i}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
          >
            <div
              style={{
                width: "100%",
                height: h,
                borderRadius: 3,
                background: isBusiest ? "var(--btn)" : "var(--secondary-bg)",
                transition: "height 0.4s ease",
              }}
            />
            <span
              style={{
                fontSize: 10,
                color: isBusiest ? "var(--btn)" : "var(--hint)",
                fontWeight: isBusiest ? 700 : 400,
              }}
            >
              {t(DAY_KEYS[i], lang).slice(0, 2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StarDisplay({ rating }) {
  return (
    <span style={{ fontSize: 20, letterSpacing: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ opacity: s <= Math.round(rating) ? 1 : 0.25 }}>★</span>
      ))}
    </span>
  );
}

export default function Analytics() {
  const { user } = useStore();
  const lang = user?.language || "uz";

  const [period, setPeriod] = useState("month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getMyAnalytics(period)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  const noData = !data || data.total === 0;

  // Find most popular service
  let topService = null;
  if (data?.services) {
    const entries = Object.entries(data.services);
    topService = entries.reduce((a, b) => (b[1] > a[1] ? b : a), entries[0])?.[0];
  }

  const serviceLabels = {
    haircut: "✂️ " + t("service_haircut", lang),
    beard:   "🧔 " + t("service_beard", lang),
    combo:   "✂️🧔 " + t("service_combo", lang),
  };
  const totalServices = data
    ? (data.services.haircut + data.services.beard + data.services.combo)
    : 0;

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <h2 style={{ marginBottom: 4 }}>{t("analytics_title", lang)}</h2>

      <PeriodToggle value={period} onChange={setPeriod} lang={lang} />

      {loading && (
        <div className="loader" style={{ height: 120 }}>{t("loading", lang)}</div>
      )}

      {!loading && noData && (
        <div
          style={{
            textAlign: "center",
            color: "var(--hint)",
            marginTop: 40,
            fontSize: 15,
          }}
        >
          {t("analytics_no_data", lang)}
        </div>
      )}

      {!loading && data && !noData && (
        <>
          {/* ── Stats row ── */}
          <div className="stats-row" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <StatBox label={t("analytics_total", lang)}  value={data.total}     />
            <StatBox label={t("analytics_done", lang)}   value={data.completed} accent="var(--btn)" />
            <StatBox label={t("analytics_missed", lang)} value={data.no_show}   accent={data.no_show > 0 ? "#e55" : undefined} />
          </div>

          {/* ── Completion rate ── */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div
              style={{ fontSize: 36, fontWeight: 800, color: "var(--btn)", textAlign: "center" }}
            >
              {data.completion_rate}%
            </div>
            <div style={{ textAlign: "center", color: "var(--hint)", fontSize: 13, marginBottom: 8 }}>
              {t("analytics_completion_rate", lang)}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 12, color: "var(--hint)" }}>
              <span>❌ {data.no_show} {t("analytics_no_shows", lang)}</span>
              <span>🔄 {data.returning_customers} {t("analytics_returning", lang)}</span>
            </div>
          </div>

          {/* ── Services ── */}
          {totalServices > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>
                {t("analytics_services_title", lang)}
              </div>
              {Object.entries(data.services).map(([svc, cnt]) => (
                <ServiceBar
                  key={svc}
                  label={serviceLabels[svc] || svc}
                  count={cnt}
                  total={totalServices}
                  highlight={svc === topService && cnt > 0}
                />
              ))}
            </div>
          )}

          {/* ── Busiest day ── */}
          {data.busiest_day && data.busiest_day.counts.some((c) => c > 0) && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-title" style={{ marginBottom: 2 }}>
                {t("analytics_busiest_day", lang)}
              </div>
              {data.busiest_day.day !== null && (
                <div style={{ fontSize: 13, color: "var(--hint)", marginBottom: 10 }}>
                  {t(DAY_KEYS[data.busiest_day.day], lang)}
                </div>
              )}
              <DayBars
                counts={data.busiest_day.counts}
                busiestIdx={data.busiest_day.day}
                lang={lang}
              />
            </div>
          )}

          {/* ── Rating ── */}
          {data.review_count > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>
                  {data.avg_rating}
                </div>
                <StarDisplay rating={data.avg_rating} />
                <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 6 }}>
                  {t("reviews_count", lang)
                    ? `${data.review_count} ${t("reviews_count", lang)}`
                    : `${data.review_count} reviews`}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
