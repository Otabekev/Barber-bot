import { useState, useEffect } from "react";
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
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2>{t("book_done_title", lang)}</h2>
        <p style={{ color: "var(--hint)", margin: "8px 0 24px" }}>
          {fmtDate(selectedDate)}, {selectedSlot}
        </p>
        <p style={{ color: "var(--hint)", fontSize: 14, marginBottom: 24 }}>
          {t("book_done_hint", lang)}
        </p>
        <button className="btn btn-primary" onClick={() => navigate("/my-bookings")}>
          {t("book_my_bookings_btn", lang)}
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
          <div
            style={{
              background: "var(--card)",
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 20,
              color: "var(--hint)",
              fontSize: 14,
            }}
          >
            {fmtDate(selectedDate)} — {selectedSlot}
          </div>
          <form onSubmit={submitBooking}>
            <div className="form-group">
              <label>{t("book_name_label", lang)}</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("book_name_placeholder", lang)}
                required
              />
            </div>
            <div className="form-group">
              <label>{t("book_phone_label", lang)}</label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("book_phone_placeholder", lang)}
                type="tel"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 8 }}
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
