import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getAvailableSlots, createBooking, getShopPublic } from "../api/client";
import { toast } from "../components/Layout";
import useStore from "../store/useStore";
import { t, DATE_LOCALE } from "../i18n";

const today = () => new Date().toISOString().split("T")[0];
const addDays = (d, n) => {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date.toISOString().split("T")[0];
};

function dateDays() {
  const days = [];
  for (let i = 0; i < 14; i++) days.push(addDays(today(), i));
  return days;
}

const STEPS = { SERVICE: "service", DATE: "date", SLOT: "slot", FORM: "form", DONE: "done" };

export default function BookingFlow() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const shopId = Number(params.get("shop_id"));
  const { user } = useStore();
  const lang = user?.language || "uz";

  const [shopInfo, setShopInfo] = useState(null);
  const [step, setStep] = useState(null); // null until shopInfo loaded
  const [selectedService, setSelectedService] = useState("haircut");
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+998");
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!shopId) { navigate("/", { replace: true }); return; }
    getShopPublic(shopId)
      .then((info) => {
        setShopInfo(info);
        // Skip SERVICE step if beard is not offered
        setStep(info.beard_duration ? STEPS.SERVICE : STEPS.DATE);
      })
      .catch(() => {
        setStep(STEPS.DATE);
        setShopInfo({ slot_duration: 30, beard_duration: null });
      });
  }, [shopId, navigate]);

  function fmtWeekday(d) {
    return new Date(d + "T00:00:00").toLocaleDateString(DATE_LOCALE[lang], { weekday: "long" });
  }

  function fmtDayMonth(d) {
    return new Date(d + "T00:00:00").toLocaleDateString(DATE_LOCALE[lang], { day: "numeric", month: "long" });
  }

  function fmtDateShort(d) {
    return new Date(d + "T00:00:00").toLocaleDateString(DATE_LOCALE[lang], {
      weekday: "short", day: "numeric", month: "short",
    });
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
    setTimeout(() => nameRef.current?.focus(), 50);
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
      const msg = err.response?.data?.detail || t("book_submit_error", lang);
      toast(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!shopId) return null;
  if (step === null) {
    return <div className="loader">{t("loading", lang)}</div>;
  }

  const hairDur = shopInfo?.slot_duration || 30;
  const beardDur = shopInfo?.beard_duration;
  const comboDur = hairDur + (beardDur || 15);

  if (step === STEPS.DONE) {
    const serviceLabel = t("service_" + selectedService, lang);
    return (
      <div style={{ padding: "32px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 72, marginBottom: 8, lineHeight: 1 }}>✅</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: "16px 0 8px" }}>
          {t("book_done_title", lang)}
        </h2>
        <div
          style={{
            background: "linear-gradient(135deg, var(--btn), #6366f1)",
            borderRadius: 16,
            padding: "20px 24px",
            margin: "20px 0 24px",
            color: "#fff",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 800 }}>{selectedSlot}</div>
          <div style={{ fontSize: 15, opacity: 0.9, marginTop: 4 }}>{fmtDayMonth(selectedDate)}</div>
          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>{serviceLabel}</div>
        </div>
        <p style={{ color: "var(--hint)", fontSize: 14, marginBottom: 28 }}>
          {t("book_done_hint", lang)}
        </p>
        <button
          className="btn btn-primary"
          style={{ width: "100%", minHeight: 52, fontSize: 16, fontWeight: 700 }}
          onClick={() => navigate("/my-bookings")}
        >
          {t("book_my_bookings_btn", lang)}
        </button>
        <button
          className="btn btn-ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => navigate("/")}
        >
          {t("book_done_home", lang)}
        </button>
      </div>
    );
  }

  const stepIndex = [STEPS.SERVICE, STEPS.DATE, STEPS.SLOT, STEPS.FORM].indexOf(step);
  const totalSteps = shopInfo?.beard_duration ? 4 : 3;
  const visibleSteps = shopInfo?.beard_duration
    ? [STEPS.SERVICE, STEPS.DATE, STEPS.SLOT, STEPS.FORM]
    : [STEPS.DATE, STEPS.SLOT, STEPS.FORM];
  const progressIndex = visibleSteps.indexOf(step);

  return (
    <div className="page">
      {/* Progress bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {visibleSteps.map((s, i) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: progressIndex >= i ? "var(--btn)" : "var(--border)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>

      {/* ── SERVICE step ── */}
      {step === STEPS.SERVICE && (
        <>
          <h2 style={{ marginBottom: 20 }}>{t("pick_service", lang)}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={() => pickService("haircut")}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "16px 18px", borderRadius: 14,
                border: "1.5px solid var(--border)", background: "var(--secondary-bg)",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{ fontSize: 32 }}>✂️</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{t("service_haircut", lang)}</div>
                <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 2 }}>{hairDur} {t("minutes", lang)}</div>
              </div>
            </button>
            {beardDur && (
              <button
                onClick={() => pickService("beard")}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "16px 18px", borderRadius: 14,
                  border: "1.5px solid var(--border)", background: "var(--secondary-bg)",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ fontSize: 32 }}>🪒</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{t("service_beard", lang)}</div>
                  <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 2 }}>{beardDur} {t("minutes", lang)}</div>
                </div>
              </button>
            )}
            {beardDur && (
              <button
                onClick={() => pickService("combo")}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "16px 18px", borderRadius: 14,
                  border: "2px solid var(--btn)", background: "var(--secondary-bg)",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ fontSize: 32 }}>✂️🪒</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{t("service_combo", lang)}</div>
                  <div style={{ fontSize: 13, color: "var(--hint)", marginTop: 2 }}>{comboDur} {t("minutes", lang)}</div>
                </div>
              </button>
            )}
          </div>
        </>
      )}

      {/* ── DATE step ── */}
      {step === STEPS.DATE && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            {shopInfo?.beard_duration && (
              <button
                onClick={() => setStep(STEPS.SERVICE)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, padding: 0 }}
              >
                ←
              </button>
            )}
            <h2 style={{ margin: 0 }}>{t("book_pick_date", lang)}</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dateDays().map((d) => {
              const isToday = d === today();
              return (
                <button
                  key={d}
                  onClick={() => pickDate(d)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start",
                    padding: "14px 18px", borderRadius: 14,
                    border: isToday ? "2px solid var(--btn)" : "1.5px solid var(--border)",
                    background: isToday ? "var(--btn)" : "var(--secondary-bg)",
                    color: isToday ? "var(--btn-text)" : "var(--text)",
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 700, textTransform: "capitalize" }}>
                    {isToday ? `${t("today_label", lang)} — ` : ""}{fmtWeekday(d)}
                  </span>
                  <span style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>{fmtDayMonth(d)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── SLOT step ── */}
      {step === STEPS.SLOT && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setStep(STEPS.DATE)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, padding: 0 }}
            >
              ←
            </button>
            <h2 style={{ margin: 0 }}>{t("book_pick_slot", lang)}</h2>
          </div>
          <p style={{ color: "var(--hint)", marginBottom: 16 }}>{fmtDayMonth(selectedDate)}</p>
          {slotsLoading ? (
            <div className="loader" style={{ height: 120 }}>{t("book_loading_slots", lang)}</div>
          ) : slots.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--hint)" }}>
              {t("book_no_slots", lang)}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {slots.map((slot) => (
                <button
                  key={slot}
                  className="btn btn-secondary"
                  style={{ padding: "12px 0", fontSize: 15, fontWeight: 600 }}
                  onClick={() => pickSlot(slot)}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── FORM step ── */}
      {step === STEPS.FORM && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setStep(STEPS.SLOT)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, padding: 0 }}
            >
              ←
            </button>
            <h2 style={{ margin: 0 }}>{t("book_your_info", lang)}</h2>
          </div>

          {/* Summary card */}
          <div
            style={{
              background: "linear-gradient(135deg, var(--btn), #6366f1)",
              borderRadius: 16,
              padding: "16px 20px",
              marginBottom: 24,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 32 }}>📅</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{selectedSlot}</div>
              <div style={{ fontSize: 14, opacity: 0.9, marginTop: 3 }}>{fmtDayMonth(selectedDate)}</div>
              {selectedService !== "haircut" && (
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                  {t("service_" + selectedService, lang)}
                </div>
              )}
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
                style={{ minHeight: 52, fontSize: 16 }}
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
                style={{ minHeight: 52, fontSize: 16 }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", minHeight: 52, fontSize: 16, fontWeight: 700, marginTop: 8 }}
              disabled={submitting}
            >
              {submitting ? t("book_submitting", lang) : t("book_submit", lang)}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
