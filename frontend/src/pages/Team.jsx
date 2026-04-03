import { useEffect, useState, useCallback } from "react";
import { Users, UserPlus, Trash2, Copy, Check, Star, Crown, Clock } from "lucide-react";
import useStore from "../store/useStore";
import { getShopStaff, createInvite, removeStaff, getStaffPhotoUrl } from "../api/client";
import { t } from "../i18n";

const MUTED = "var(--hint)";

function StaffCard({ member, isOwner, onRemove, lang }) {
  const isOwnerMember = member.is_owner;
  const isPending = !member.is_approved && !member.is_rejected;
  const isRejected = member.is_rejected;

  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: "50%", overflow: "hidden",
        background: "var(--secondary)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {member.has_photo
          ? <img src={getStaffPhotoUrl(member.id)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <Users size={20} color={MUTED} />
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {member.display_name || t("unnamed_staff", lang)}
          </span>
          {isOwnerMember && <Crown size={13} color="#f59e0b" title="Owner" />}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
          {isPending && (
            <span style={{ fontSize: 11, background: "#fef9c3", color: "#854d0e", borderRadius: 6, padding: "1px 6px" }}>
              <Clock size={10} style={{ marginRight: 2 }} />
              {t("staff_pending", lang)}
            </span>
          )}
          {isRejected && (
            <span style={{ fontSize: 11, background: "#fee2e2", color: "#991b1b", borderRadius: 6, padding: "1px 6px" }}>
              {t("staff_rejected", lang)}
            </span>
          )}
          {member.avg_rating && (
            <span style={{ fontSize: 11, color: MUTED, display: "flex", alignItems: "center", gap: 2 }}>
              <Star size={10} color="#f59e0b" fill="#f59e0b" />
              {member.avg_rating} ({member.review_count})
            </span>
          )}
        </div>
      </div>

      {/* Remove button — owner cannot remove themselves */}
      {isOwner && !isOwnerMember && (
        <button
          onClick={() => onRemove(member.id, member.display_name)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#ef4444" }}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

export default function Team() {
  const { user, staffRecord } = useStore();
  const lang = user?.language || "uz";
  const isOwner = staffRecord?.is_owner;

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null); // { id, name }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getShopStaff();
      setStaff(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleGenerateInvite() {
    setInviteLoading(true);
    try {
      const data = await createInvite();
      setInvite(data);
    } catch (e) {
      alert(e.response?.data?.detail || t("error_generic", lang));
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(invite.deep_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  async function handleRemove(staffId, name) {
    setConfirmRemove({ id: staffId, name });
  }

  async function confirmRemoveStaff() {
    if (!confirmRemove) return;
    try {
      await removeStaff(confirmRemove.id);
      setStaff((prev) => prev.filter((s) => s.id !== confirmRemove.id));
    } catch (e) {
      alert(e.response?.data?.detail || t("error_generic", lang));
    } finally {
      setConfirmRemove(null);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{t("team_title", lang)}</h1>
        <p style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>{t("team_subtitle", lang)}</p>
      </div>

      {loading ? (
        <div className="loader">{t("loading", lang)}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {staff.map((member) => (
            <StaffCard
              key={member.id}
              member={member}
              isOwner={isOwner}
              onRemove={handleRemove}
              lang={lang}
            />
          ))}
          {staff.length === 0 && (
            <div className="empty-state">
              <Users size={36} color={MUTED} />
              <p style={{ marginTop: 10 }}>{t("team_empty", lang)}</p>
            </div>
          )}
        </div>
      )}

      {/* Invite section — owner only */}
      {isOwner && (
        <div style={{ marginTop: 24 }}>
          <button
            className="btn btn-primary"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            onClick={handleGenerateInvite}
            disabled={inviteLoading}
          >
            <UserPlus size={16} />
            {inviteLoading ? t("loading", lang) : t("team_invite_btn", lang)}
          </button>

          {invite && (
            <div className="card" style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>{t("team_invite_desc", lang)}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  readOnly
                  value={invite.deep_link}
                  style={{
                    flex: 1, background: "var(--secondary)", border: "none",
                    borderRadius: 8, padding: "8px 10px", fontSize: 12,
                    color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis",
                  }}
                />
                <button
                  onClick={handleCopy}
                  style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#22c55e" : "var(--btn)" }}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
              <p style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
                {t("team_invite_expires", lang)}: {new Date(invite.expires_at).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Confirm remove dialog */}
      {confirmRemove && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "flex-end", zIndex: 1000,
        }}>
          <div style={{ background: "var(--bg)", width: "100%", borderRadius: "16px 16px 0 0", padding: 24 }}>
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>{t("team_remove_title", lang)}</h3>
            <p style={{ color: MUTED, fontSize: 14, marginBottom: 20 }}>
              {t("team_remove_confirm", lang).replace("{name}", confirmRemove.name || t("unnamed_staff", lang))}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmRemove(null)}>
                {t("cancel", lang)}
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmRemoveStaff}>
                {t("team_remove_btn", lang)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
