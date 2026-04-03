import { useEffect, useState, useRef } from "react";
import { Camera, Save, User } from "lucide-react";
import useStore from "../store/useStore";
import { updateMyStaffProfile, uploadStaffPhoto, getStaffPhotoUrl } from "../api/client";
import { t } from "../i18n";

const MUTED = "var(--hint)";

export default function StaffProfile() {
  const { user, staffRecord, setStaffRecord } = useStore();
  const lang = user?.language || "uz";

  const [form, setForm] = useState({ display_name: "", phone: "", bio: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoKey, setPhotoKey] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (staffRecord) {
      setForm({
        display_name: staffRecord.display_name || "",
        phone: staffRecord.phone || "",
        bio: staffRecord.bio || "",
      });
    }
  }, [staffRecord]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateMyStaffProfile(form);
      setStaffRecord(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(e.response?.data?.detail || t("error_generic", lang));
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      await uploadStaffPhoto(file);
      setPhotoKey((k) => k + 1);
      // Update store so avatar shows immediately
      if (staffRecord) setStaffRecord({ ...staffRecord, has_photo: true });
    } catch (e) {
      alert(e.response?.data?.detail || t("error_generic", lang));
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{t("profile_title", lang)}</h1>
        <p style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>{t("profile_subtitle", lang)}</p>
      </div>

      {/* Photo */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
        <div style={{ position: "relative" }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%", overflow: "hidden",
            background: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {staffRecord?.has_photo
              ? <img key={photoKey} src={`${getStaffPhotoUrl(staffRecord.id)}?t=${photoKey}`}
                  alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <User size={32} color={MUTED} />
            }
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingPhoto}
            style={{
              position: "absolute", bottom: 0, right: 0, width: 28, height: 28,
              borderRadius: "50%", background: "var(--btn)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#fff",
            }}
          >
            <Camera size={13} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
        </div>
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: "block" }}>
            {t("profile_display_name", lang)}
          </label>
          <input
            className="input"
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            placeholder={t("profile_display_name_placeholder", lang)}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: "block" }}>
            {t("profile_phone", lang)}
          </label>
          <input
            className="input"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+998 90 123 45 67"
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: "block" }}>
            {t("profile_bio", lang)}
          </label>
          <textarea
            className="input"
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            placeholder={t("profile_bio_placeholder", lang)}
            rows={3}
            style={{ resize: "vertical" }}
          />
        </div>

        <button
          className={`btn ${saved ? "btn-success" : "btn-primary"}`}
          onClick={handleSave}
          disabled={saving}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Save size={15} />
          {saving ? t("saving", lang) : saved ? t("saved", lang) : t("save_btn", lang)}
        </button>
      </div>
    </div>
  );
}
