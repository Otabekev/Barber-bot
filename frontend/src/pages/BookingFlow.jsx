import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getAvailableSlots, createBooking } from "../api/client";
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

const STEPS = { DATE: "date", SLOT: "slot", FORM: "form", DONE: "done" };

export default function BookingFlow() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const shopId = Number(params.get("shop_id"));
  const { user } = useStore();
  const lang = user?.language || "uz";

  function fmtDate(d) {
    return new Date(d + "T00:00:00").toLocaleDateString(DATE_LOCALE[lang], {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  const [step, setStep] = useState(STEPS.DATE);
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+998");
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!shopId) navigate("/", { replace: true });
  }, [shopId, navigate]);

  async function loadSlots(date) {
    setSlotsLoading(true);
    try {
      const data = await getAvailableSlots(shopId, date);
      setSlots(data.slots || []);
    } catch {
      setSlots([]);
      toast(t("book_slot_error", lang));
    } finally {
      setSlotsLoading(false);
    }
  }

  function pickDate(date) {
    setSelectedDate(date);
    loadSlots(date);
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

  if (step === STEPS.DONE) {
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
          <div style={{ fontSize: 15, opacity: 0.9, marginTop: 4 }}>{fmtDate(selectedDate)}</div>
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

  return (
    <div className="page">
      {/* Progress indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[STEPS.DATE, STEPS.SLOT, STEPS.FORM].map((s, i) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: [STEPS.DATE, STEPS.SLOT, STEPS.FORM].indexOf(step) >= i
                ? "var(--accent)"
                : "var(--border)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>

      {step === STEPS.DATE && (
        <>
          <h2 style={{ marginBottom: 16 }}>{t("book_pick_date", lang)}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dateDays().map((d) => (
              <button
                key={d}
                className="btn btn-secondary"
                style={{ textAlign: "left", justifyContent: "flex-start" }}
                onClick={() => pickDate(d)}
              >
                {d === today() ? t("book_today_prefix", lang) : ""}{fmtDate(d)}
              </button>
            ))}
          </div>
        </>
      )}

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
          <p style={{ color: "var(--hint)", marginBottom: 16 }}>{fmtDate(selectedDate)}</p>
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
              <div style={{ fontSize: 14, opacity: 0.9, marginTop: 3 }}>{fmtDate(selectedDate)}</div>
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
