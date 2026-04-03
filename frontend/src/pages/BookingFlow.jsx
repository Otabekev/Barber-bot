import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Scissors, User, Layers, CalendarDays,
  Clock, ChevronRight, CheckCircle2, Home,
} from "lucide-react";
import { getAvailableSlots, createBooking, getShopPublic } from "../api/client";
import { toast } from "../components/Layout";
import useStore from "../store/useStore";
import { t, DATE_LOCALE } from "../i18n";

const today = () => new Date().toISOString().split("T")[0];
const addDays = (d, n) => {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().split("T")[0];
};
function dateDays() {
  const days = [];
  for (let i = 0; i < 14; i++) days.push(addDays(today(), i));
  return days;
}

const STEPS = { SERVICE: "service", DATE: "date", SLOT: "slot", FORM: "form", DONE: "done" };

/* ── Tiny reusable back-arrow button ─────────────────────────────────── */
function BackBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 38, height: 38, borderRadius: "50%",
        border: "none", background: "var(--secondary-bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", flexShrink: 0,
        color: "var(--hint)",
      }}
    >
      <ArrowLeft size={18} />
    </button>
  );
}

/* ── Sticky step header ──────────────────────────────────────────────── */
function StepHeader({ title, onBack, current, total }) {
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 10,
      background: "var(--bg)",
      padding: "12px 0 10px",
      marginBottom: 20,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      {onBack ? <BackBtn onClick={onBack} /> : <div style={{ width: 38 }} />}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>{title}</div>
      </div>
      <div style={{
        fontSize: 12, fontWeight: 600, color: "var(--hint)",
        background: "var(--secondary-bg)", borderRadius: 20,
        padding: "4px 10px", flexShrink: 0,
      }}>
        {current}/{total}
      </div>
    </div>
  );
}

/* ── Dot progress ────────────────────────────────────────────────────── */
function Dots({ total, current }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 28 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i === current ? 20 : 7, height: 7,
          borderRadius: 4,
          background: i === current ? "var(--btn)" : i < current ? "color-mix(in srgb, var(--btn) 35%, transparent)" : "var(--border)",
          transition: "all 0.25s",
        }} />
      ))}
    </div>
  );
}

export default function BookingFlow() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const shopId = Number(params.get("shop_id"));
  const preDate = params.get("date") || null;
  const preSlot = params.get("slot") || null;
  const preService = params.get("service") || null;
  const { user } = useStore();
  const lang = user?.language || "uz";

  const [shopInfo, setShopInfo] = useState(null);
  const [step, setStep] = useState(null);
  const [selectedService, setSelectedService] = useState(preService || "haircut");
  const [selectedDate, setSelectedDate] = useState(preDate);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(preSlot);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+998");
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef(null);
  const dateRowRef = useRef(null);

  useEffect(() => {
    if (!shopId) { navigate("/", { replace: true }); return; }
    getShopPublic(shopId)
      .then((info) => {
        setShopInfo(info);
        // If both date and slot are pre-filled from bot quick-book, jump to form
        if (preDate && preSlot) {
          setStep(STEPS.FORM);
        } else if (preDate) {
          // Date pre-selected — load slots and go to slot picker
          setStep(STEPS.SLOT);
          getAvailableSlots(shopId, preDate, preService || "haircut")
            .then((data) => setSlots(data.slots || []))
            .catch(() => setSlots([]));
        } else {
          setStep(info.beard_duration ? STEPS.SERVICE : STEPS.DATE);
        }
      })
      .catch(() => {
        setShopInfo({ slot_duration: 30, beard_duration: null });
        setStep(preDate && preSlot ? STEPS.FORM : STEPS.DATE);
      });
  }, [shopId, navigate]);

  function fmtWeekdayShort(d) {
    return new Date(d + "T00:00:00").toLocaleDateString(DATE_LOCALE[lang], { weekday: "short" });
  }
  function fmtDayNum(d) {
    return new Date(d + "T00:00:00").getDate();
  }
  function fmtMonthShort(d) {
    return new Date(d + "T00:00:00").toLocaleDateString(DATE_LOCALE[lang], { month: "short" });
  }
  function fmtDayMonth(d) {
    return new Date(d + "T00:00:00").toLocaleDateString(DATE_LOCALE[lang], { day: "numeric", month: "long" });
  }
  function fmtWeekdayLong(d) {
    return new Date(d + "T00:00:00").toLocaleDateString(DATE_LOCALE[lang], { weekday: "long" });
  }

  async function loadSlots(date, svcType = selectedService) {
    setSlotsLoading(true);
    try {
      const data = await getAvailableSlots(shopId, date, svcType);
      setSlots(data.slots || []);
    } catch {
      setSlots([]);
      toast(t("book_slot_error", lang));
    } finally {
      setSlotsLoading(false);
    }
  }

  function pickService(svc) {
    setSelectedService(svc);
    setStep(STEPS.DATE);
  }

  function pickDate(date) {
    setSelectedDate(date);
    loadSlots(date, selectedService);
    setStep(STEPS.SLOT);
  }

  function pickSlot(slot) {
    setSelectedSlot(slot);
    setStep(STEPS.FORM);
    setTimeout(() => nameRef.current?.focus(), 80);
  }

  async function submitBooking(e) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSubmitting(true);
    try {
      await createBooking({
        shop_id: shopId,
        booking_date: selectedDate,
        time_slot: selectedSlot,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        service_type: selectedService,
      });
      setStep(STEPS.DONE);
    } catch (err) {
      toast(err.response?.data?.detail || t("book_submit_error", lang));
    } finally {
      setSubmitting(false);
    }
  }

  if (!shopId) return null;
  if (step === null) return <div className="loader">{t("loading", lang)}</div>;

  const hairDur = shopInfo?.slot_duration || 30;
  const beardDur = shopInfo?.beard_duration;
  const comboDur = hairDur + (beardDur || 15);
  const hasBeard = !!beardDur;

  const visibleSteps = hasBeard
    ? [STEPS.SERVICE, STEPS.DATE, STEPS.SLOT, STEPS.FORM]
    : [STEPS.DATE, STEPS.SLOT, STEPS.FORM];
  const totalSteps = visibleSteps.length;
  const stepIdx = visibleSteps.indexOf(step);

  /* ─── DONE screen ────────────────────────────────────────────────────── */
  if (step === STEPS.DONE) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px", textAlign: "center" }}>
        <div style={{
          width: 88, height: 88, borderRadius: "50%",
          background: "linear-gradient(135deg, #10b981, #059669)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 24,
          boxShadow: "0 8px 32px rgba(16,185,129,0.35)",
        }}>
          <CheckCircle2 size={44} color="#fff" />
        </div>

        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
          {t("book_done_title", lang)}
        </h2>
        <p style={{ color: "var(--hint)", fontSize: 15, marginBottom: 28 }}>
          {t("book_done_hint", lang)}
        </p>

        {/* Booking summary ticket */}
        <div style={{
          width: "100%", maxWidth: 360,
          background: "var(--secondary-bg)",
          borderRadius: 20, overflow: "hidden",
          marginBottom: 28,
        }}>
          <div style={{
            background: "linear-gradient(135deg, var(--btn), #6366f1)",
            padding: "20px 24px", color: "#fff",
          }}>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 2, textTransform: "capitalize" }}>
              {fmtWeekdayLong(selectedDate)}
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{fmtDayMonth(selectedDate)}</div>
          </div>
          <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--hint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("book_pick_slot", lang)}</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{selectedSlot}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "var(--hint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {t("pick_service", lang)}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
                {t("service_" + selectedService, lang)}
              </div>
            </div>
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: "100%", maxWidth: 360, minHeight: 54, fontSize: 16, fontWeight: 700, borderRadius: 16 }}
          onClick={() => navigate("/my-bookings")}
        >
          {t("book_my_bookings_btn", lang)}
        </button>
        <button
          onClick={() => navigate("/")}
          style={{ marginTop: 12, background: "none", border: "none", color: "var(--hint)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
        >
          <Home size={14} /> {t("book_done_home", lang)}
        </button>
      </div>
    );
  }

  /* ─── SERVICE step ───────────────────────────────────────────────────── */
  const SERVICE_OPTIONS = [
    {
      key: "haircut",
      icon: <Scissors size={24} />,
      color: "#3b82f6",
      dur: hairDur,
    },
    ...(hasBeard ? [
      { key: "beard",  icon: <User size={24} />,   color: "#8b5cf6", dur: beardDur },
      { key: "combo",  icon: <Layers size={24} />, color: "#f59e0b", dur: comboDur, badge: t("book_combo_popular", lang) },
    ] : []),
  ];

  /* ─── Slot grouping ──────────────────────────────────────────────────── */
  function groupSlots(slotList) {
    const morning = slotList.filter((s) => parseInt(s) < 12);
    const afternoon = slotList.filter((s) => parseInt(s) >= 12 && parseInt(s) < 17);
    const evening = slotList.filter((s) => parseInt(s) >= 17);
    return [
      { label: "🌅 " + t("slots_morning", lang), slots: morning },
      { label: "☀️ " + t("slots_afternoon", lang), slots: afternoon },
      { label: "🌆 " + t("slots_evening", lang), slots: evening },
    ].filter((g) => g.slots.length > 0);
  }

  const stepTitle =
    step === STEPS.SERVICE ? t("pick_service", lang) :
    step === STEPS.DATE    ? t("book_pick_date", lang) :
    step === STEPS.SLOT    ? t("book_pick_slot", lang) :
    t("book_your_info", lang);

  const onBack =
    step === STEPS.SERVICE ? null :
    step === STEPS.DATE    ? (hasBeard ? () => setStep(STEPS.SERVICE) : null) :
    step === STEPS.SLOT    ? () => setStep(STEPS.DATE) :
    () => setStep(STEPS.SLOT);

  return (
    <div style={{ paddingBottom: 32 }}>
      <StepHeader
        title={stepTitle}
        onBack={onBack}
        current={stepIdx + 1}
        total={totalSteps}
      />
      <Dots total={totalSteps} current={stepIdx} />

      {/* ── SERVICE ─────────────────────────────────────────────────────── */}
      {step === STEPS.SERVICE && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {SERVICE_OPTIONS.map(({ key, icon, color, dur, badge }) => (
            <button
              key={key}
              onClick={() => pickService(key)}
              style={{
                display: "flex", alignItems: "center", gap: 16,
                padding: "18px 20px", borderRadius: 18,
                border: "1.5px solid var(--border)",
                background: "var(--bg)",
                cursor: "pointer", textAlign: "left",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                position: "relative", overflow: "hidden",
              }}
            >
              {/* Colored icon circle */}
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: color + "18",
                border: `1.5px solid ${color}33`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26, flexShrink: 0,
              }}>
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text)" }}>
                  {t("service_" + key, lang)}
                </div>
                <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 3 }}>
                  {dur} {t("minutes", lang)}
                </div>
              </div>
              {badge && (
                <div style={{
                  background: "#fef3c7", color: "#92400e",
                  fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "3px 10px",
                }}>
                  {badge}
                </div>
              )}
              {/* Chevron */}
              <div style={{ color: "var(--hint)", fontSize: 18, flexShrink: 0 }}>›</div>
            </button>
          ))}
        </div>
      )}

      {/* ── DATE ─────────────────────────────────────────────────────────── */}
      {step === STEPS.DATE && (
        <>
          {/* Selected service pill reminder */}
          {hasBeard && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "var(--secondary-bg)", borderRadius: 20, padding: "6px 14px",
              fontSize: 13, fontWeight: 600, marginBottom: 20,
            }}>
              {selectedService === "haircut" ? "✂️" : selectedService === "beard" ? "🪒" : "💈"}
              {t("service_" + selectedService, lang)}
              <button
                onClick={() => setStep(STEPS.SERVICE)}
                style={{ background: "none", border: "none", color: "var(--btn)", fontSize: 12, cursor: "pointer", padding: 0 }}
              >
                {t("change", lang) || "›"}
              </button>
            </div>
          )}

          {/* Horizontal date carousel */}
          <div
            ref={dateRowRef}
            style={{
              display: "flex", gap: 8, overflowX: "auto",
              paddingBottom: 8, scrollbarWidth: "none",
              marginBottom: 24, WebkitOverflowScrolling: "touch",
            }}
          >
            {dateDays().map((d) => {
              const isToday = d === today();
              return (
                <button
                  key={d}
                  onClick={() => pickDate(d)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 2, padding: "12px 10px", minWidth: 58, borderRadius: 16,
                    border: isToday ? "2px solid var(--btn)" : "1.5px solid var(--border)",
                    background: isToday ? "var(--btn)" : "var(--bg)",
                    color: isToday ? "var(--btn-text)" : "var(--text)",
                    cursor: "pointer", flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.75, textTransform: "uppercase" }}>
                    {fmtWeekdayShort(d)}
                  </span>
                  <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                    {fmtDayNum(d)}
                  </span>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>
                    {fmtMonthShort(d)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Vertical list of days as cards (big version) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dateDays().map((d) => {
              const isToday = d === today();
              return (
                <button
                  key={d}
                  onClick={() => pickDate(d)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "16px 20px", borderRadius: 16,
                    border: isToday ? "2px solid var(--btn)" : "1.5px solid var(--border)",
                    background: isToday ? `color-mix(in srgb, var(--btn) 8%, var(--bg))` : "var(--bg)",
                    cursor: "pointer",
                    boxShadow: isToday ? `0 0 0 1px color-mix(in srgb, var(--btn) 20%, transparent)` : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: 12,
                      background: isToday ? "var(--btn)" : "var(--secondary-bg)",
                      color: isToday ? "var(--btn-text)" : "var(--text)",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", opacity: 0.8 }}>
                        {fmtMonthShort(d)}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{fmtDayNum(d)}</div>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontWeight: 700, fontSize: 16, textTransform: "capitalize" }}>
                        {isToday ? t("today_label", lang) : fmtWeekdayLong(d)}
                      </div>
                      {isToday && (
                        <div style={{ fontSize: 12, color: "var(--hint)", marginTop: 1 }}>{fmtDayMonth(d)}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ color: "var(--btn)", fontSize: 20, fontWeight: 300 }}>›</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── SLOT ─────────────────────────────────────────────────────────── */}
      {step === STEPS.SLOT && (
        <>
          {/* Selected date chip */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "var(--secondary-bg)", borderRadius: 20, padding: "8px 16px",
            fontSize: 14, fontWeight: 600, marginBottom: 24, textTransform: "capitalize",
          }}>
            📅 {fmtWeekdayLong(selectedDate)}, {fmtDayMonth(selectedDate)}
          </div>

          {slotsLoading ? (
            <div className="loader" style={{ height: 140 }}>{t("book_loading_slots", lang)}</div>
          ) : slots.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 48 }}>😴</div>
              <p style={{ marginTop: 12, fontSize: 15 }}>{t("book_no_slots", lang)}</p>
              <button
                onClick={() => setStep(STEPS.DATE)}
                className="btn btn-ghost"
                style={{ marginTop: 16 }}
              >
                ← {t("book_pick_date", lang)}
              </button>
            </div>
          ) : (
            groupSlots(slots).map(({ label, slots: group }) => (
              <div key={label} style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: "var(--hint)",
                  textTransform: "uppercase", letterSpacing: "0.07em",
                  marginBottom: 10,
                }}>
                  {label}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {group.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => pickSlot(slot)}
                      style={{
                        padding: "14px 8px", borderRadius: 14,
                        border: "1.5px solid var(--border)",
                        background: "var(--bg)",
                        fontSize: 16, fontWeight: 700, color: "var(--text)",
                        cursor: "pointer",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                        transition: "transform 0.1s, box-shadow 0.1s",
                      }}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* ── FORM ─────────────────────────────────────────────────────────── */}
      {step === STEPS.FORM && (
        <>
          {/* Booking summary ticket */}
          <div style={{
            background: "linear-gradient(135deg, var(--btn), #6366f1)",
            borderRadius: 20, overflow: "hidden",
            marginBottom: 28,
            boxShadow: "0 8px 24px color-mix(in srgb, var(--btn) 30%, transparent)",
          }}>
            <div style={{ padding: "20px 22px", color: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>{t("book_pick_slot", lang)}</div>
                  <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, marginTop: 2 }}>{selectedSlot}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>{t("pick_service", lang)}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                    {t("service_" + selectedService, lang)}
                  </div>
                </div>
              </div>
              <div style={{
                marginTop: 14, paddingTop: 14,
                borderTop: "1px solid rgba(255,255,255,0.2)",
                fontSize: 14, opacity: 0.9, textTransform: "capitalize",
              }}>
                📅 {fmtWeekdayLong(selectedDate)}, {fmtDayMonth(selectedDate)}
              </div>
            </div>
          </div>

          <form onSubmit={submitBooking}>
            <div className="form-group">
              <label className="form-label">{t("book_name_label", lang)}</label>
              <input
                ref={nameRef}
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("book_name_placeholder", lang)}
                autoComplete="name"
                required
                style={{ minHeight: 56, fontSize: 16, borderRadius: 14 }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t("book_phone_label", lang)}</label>
              <input
                className="form-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("book_phone_placeholder", lang)}
                inputMode="tel"
                autoComplete="tel"
                required
                style={{ minHeight: 56, fontSize: 16, borderRadius: 14 }}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%", minHeight: 56, marginTop: 8,
                border: "none", borderRadius: 16, cursor: "pointer",
                fontSize: 17, fontWeight: 700,
                background: "linear-gradient(135deg, var(--btn), #6366f1)",
                color: "#fff",
                opacity: submitting ? 0.6 : 1,
                boxShadow: "0 6px 20px color-mix(in srgb, var(--btn) 30%, transparent)",
                transition: "opacity 0.15s, transform 0.1s",
              }}
            >
              {submitting ? t("book_submitting", lang) : t("book_submit", lang)}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
