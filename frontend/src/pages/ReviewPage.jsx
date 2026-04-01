import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { submitReview } from "../api/client";
import { toast } from "../components/Layout";
import useStore from "../store/useStore";
import { t } from "../i18n";

function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "8px 0 4px" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 44, padding: "4px 2px",
            filter: (hovered || value) >= star ? "none" : "grayscale(1) opacity(0.3)",
            transform: (hovered || value) >= star ? "scale(1.15)" : "scale(1)",
            transition: "transform 0.15s, filter 0.15s",
          }}
        >
          ⭐
        </button>
      ))}
    </div>
  );
}

const LABELS = {
  uz: ["", "Yomon", "Qoniqarsiz", "O'rtacha", "Yaxshi", "A'lo!"],
  ru: ["", "Плохо", "Неплохо", "Нормально", "Хорошо", "Отлично!"],
  en: ["", "Poor", "Fair", "Good", "Great", "Excellent!"],
};

export default function ReviewPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useStore();
  const lang = user?.language || "uz";
  const bookingId = Number(params.get("booking_id"));

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!bookingId) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--hint)" }}>
        {t("load_error", lang)}
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rating) return;
    setSubmitting(true);
    try {
      await submitReview({ booking_id: bookingId, rating, comment: comment.trim() || null });
      setDone(true);
    } catch (err) {
      toast(err.response?.data?.detail || t("review_submit_error", lang));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "32px 24px", textAlign: "center",
      }}>
        <div style={{
          width: 88, height: 88, borderRadius: "50%",
          background: "linear-gradient(135deg, #f59e0b, #ef4444)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 44, marginBottom: 24,
          boxShadow: "0 8px 32px rgba(245,158,11,0.35)",
        }}>⭐</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
          {t("review_thanks", lang)}
        </h2>
        <p style={{ color: "var(--hint)", fontSize: 15, marginBottom: 32 }}>
          {t("review_thanks_hint", lang)}
        </p>
        <button
          className="btn btn-primary"
          style={{ width: "100%", maxWidth: 320, minHeight: 54, fontSize: 16, fontWeight: 700, borderRadius: 16 }}
          onClick={() => navigate("/")}
        >
          {t("book_done_home", lang)}
        </button>
      </div>
    );
  }

  const labelList = LABELS[lang] || LABELS.uz;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 420, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>💈</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
          {t("review_title", lang)}
        </h1>
        <p style={{ fontSize: 14, color: "var(--hint)" }}>
          {t("review_subtitle", lang)}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ textAlign: "center", marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: "var(--hint)", marginBottom: 4 }}>
            {t("review_pick_stars", lang)}
          </p>
          <StarPicker value={rating} onChange={setRating} />
          <p style={{
            fontSize: 16, fontWeight: 700, minHeight: 24, marginTop: 6,
            color: rating ? "var(--text)" : "var(--hint)",
          }}>
            {rating ? labelList[rating] : ""}
          </p>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <label className="form-label">{t("review_comment_label", lang)}</label>
          <textarea
            className="form-input"
            rows={3}
            maxLength={300}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("review_comment_placeholder", lang)}
            style={{ resize: "vertical", minHeight: 80, fontSize: 15 }}
          />
          <p style={{ fontSize: 11, color: "var(--hint)", textAlign: "right", marginTop: 4 }}>
            {comment.length}/300
          </p>
        </div>

        <button
          type="submit"
          disabled={!rating || submitting}
          style={{
            width: "100%", minHeight: 56, border: "none", borderRadius: 16, cursor: "pointer",
            fontSize: 17, fontWeight: 700,
            background: rating
              ? "linear-gradient(135deg, #f59e0b, #ef4444)"
              : "var(--secondary-bg)",
            color: rating ? "#fff" : "var(--hint)",
            boxShadow: rating ? "0 6px 20px rgba(245,158,11,0.35)" : "none",
            transition: "all 0.2s",
          }}
        >
          {submitting ? "…" : t("review_submit", lang)}
        </button>
      </form>
    </div>
  );
}
