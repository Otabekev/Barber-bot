import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Users, CheckCircle, XCircle, Clock } from "lucide-react";
import useStore from "../store/useStore";
import { getInviteInfo, acceptInvite } from "../api/client";
import { t } from "../i18n";

const MUTED = "var(--hint)";

export default function JoinShop() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("join");
  const { user } = useStore();
  const lang = user?.language || "uz";

  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setError(t("invite_not_found", lang));
      setLoading(false);
      return;
    }
    getInviteInfo(token)
      .then(setInfo)
      .catch(() => setError(t("invite_not_found", lang)))
      .finally(() => setLoading(false));
  }, [token, lang]);

  async function handleAccept() {
    setJoining(true);
    try {
      await acceptInvite(token);
      setJoined(true);
    } catch (e) {
      setError(e.response?.data?.detail || t("error_generic", lang));
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return <div className="loader">{t("loading", lang)}</div>;
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", gap: 16 }}>
        <XCircle size={48} color="#ef4444" />
        <h2 style={{ fontWeight: 700, textAlign: "center" }}>{t("invite_invalid_title", lang)}</h2>
        <p style={{ color: MUTED, textAlign: "center", fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  if (joined) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", gap: 16 }}>
        <CheckCircle size={48} color="#22c55e" />
        <h2 style={{ fontWeight: 700, textAlign: "center" }}>{t("invite_accepted_title", lang)}</h2>
        <p style={{ color: MUTED, textAlign: "center", fontSize: 14 }}>
          {t("invite_accepted_msg", lang).replace("{shop}", info?.shop_name || "")}
        </p>
        <div style={{
          background: "#fef9c3", color: "#854d0e", borderRadius: 10,
          padding: "12px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 8,
        }}>
          <Clock size={14} />
          {t("invite_pending_approval", lang)}
        </div>
      </div>
    );
  }

  if (info?.is_expired || info?.is_used) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", gap: 16 }}>
        <XCircle size={48} color="#ef4444" />
        <h2 style={{ fontWeight: 700, textAlign: "center" }}>
          {info.is_expired ? t("invite_expired_title", lang) : t("invite_used_title", lang)}
        </h2>
        <p style={{ color: MUTED, textAlign: "center", fontSize: 14 }}>
          {info.is_expired ? t("invite_expired_msg", lang) : t("invite_used_msg", lang)}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", gap: 20 }}>
      <Users size={48} color="var(--btn)" />
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>{t("invite_title", lang)}</h2>
        <p style={{ color: MUTED, fontSize: 14 }}>
          {t("invite_msg", lang).replace("{shop}", info?.shop_name || "")}
        </p>
      </div>

      <div className="card" style={{ width: "100%", textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{info?.shop_name}</div>
        <div style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>{info?.shop_city}</div>
      </div>

      <p style={{ fontSize: 12, color: MUTED, textAlign: "center" }}>
        {t("invite_expires", lang)}: {new Date(info?.expires_at).toLocaleString()}
      </p>

      <button
        className="btn btn-primary"
        style={{ width: "100%" }}
        onClick={handleAccept}
        disabled={joining}
      >
        {joining ? t("loading", lang) : t("invite_accept_btn", lang)}
      </button>
    </div>
  );
}
