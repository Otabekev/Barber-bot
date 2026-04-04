import { useEffect, useState, useRef } from "react";
import { Camera, Save, Check } from "lucide-react";
import useStore from "../store/useStore";
import { updateMyStaffProfile, uploadStaffPhoto, getStaffPhotoUrl } from "../api/client";
import { toast } from "../components/Layout";
import { t } from "../i18n";

export default function StaffProfile() {
  const { user, staffRecord, setStaffRecord } = useStore();
  const lang = user?.language || "uz";

  const [form, setForm] = useState({ display_name: "", phone: "", bio: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoKey, setPhotoKey] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (staffRecord) {
      setForm({
        display_name: staffRecord.display_name || "",
        phone: staffRecord.phone || "",
        bio: staffRecord.bio || "",
      });
      if (staffRecord.has_photo) {
        setPhotoPreview(`${getStaffPhotoUrl(staffRecord.id)}?t=0`);
      }
    }
  }, [staffRecord]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateMyStaffProfile(form);
      setStaffRecord(updated);
      setSaved(true);
      toast(t("saved", lang));
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast(err.response?.data?.detail || t("save_failed", lang));
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show local preview instantly
    setPhotoPreview(URL.createObjectURL(file));
    setUploadingPhoto(true);
    try {
      await uploadStaffPhoto(file);
      const nextKey = photoKey + 1;
      setPhotoKey(nextKey);
      setPhotoPreview(`${getStaffPhotoUrl(staffRecord.id)}?t=${nextKey}`);
      if (staffRecord) setStaffRecord({ ...staffRecord, has_photo: true });
      toast(t("photo_uploaded", lang));
    } catch (err) {
      toast(err.response?.data?.detail || t("photo_upload_error", lang));
      setPhotoPreview(staffRecord?.has_photo ? `${getStaffPhotoUrl(staffRecord.id)}?t=${photoKey}` : null);
    } finally {
      setUploadingPhoto(false);
    }
  }

  const bioLen = form.bio.length;

  return (
    <div>
      <h1 className="section-title">{t("profile_title", lang)}</h1>

      {/* ── Profile photo ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="card-title">{t("photo_label", lang)}</p>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          {/* Avatar with camera overlay */}
          <div style={{ position: "relative" }}>
            <div style={{
              width: 100, height: 100, borderRadius: "50%", overflow: "hidden",
              background: "var(--secondary-bg)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "3px solid var(--border)",
            }}>
              {photoPreview ? (
                <>
                  <img
                    key={photoKey}
                    src={photoPreview}
                    alt="profile"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  {uploadingPhoto && (
                    <div style={{
                      position: "absolute", inset: 0, borderRadius: "50%",
                      background: "rgba(0,0,0,0.45)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 12,
                    }}>
                      {t("uploading", lang)}
                    </div>
                  )}
                </>
              ) : (
                <span style={{ fontSize: 40 }}>👤</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingPhoto}
              style={{
                position: "absolute", bottom: 2, right: 2,
                width: 32, height: 32, borderRadius: "50%",
                background: "var(--btn)", border: "2px solid var(--bg)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "var(--btn-text)",
              }}
            >
              <Camera size={15} />
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ minWidth: 160 }}
            disabled={uploadingPhoto}
            onClick={() => fileRef.current?.click()}
          >
            {photoPreview ? t("change_photo", lang) : t("upload_photo", lang)}
          </button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
        <p style={{ fontSize: 12, color: "var(--hint)", marginTop: 12, textAlign: "center" }}>
          {t("photo_hint", lang)}
        </p>
      </div>

      {/* ── Info form ── */}
      <form onSubmit={handleSave} noValidate>
        <div className="card">
          <p className="card-title">{t("profile_info_title", lang)}</p>

          <div className="form-group">
            <label className="form-label">{t("profile_display_name", lang)}</label>
            <input
              className="form-input"
              value={form.display_name}
              onChange={(e) => set("display_name", e.target.value)}
              placeholder={t("profile_display_name_placeholder", lang)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t("profile_phone", lang)}</label>
            <input
              className="form-input"
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+998 90 123 45 67"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t("profile_bio", lang)}</label>
            <textarea
              className="form-input"
              rows={3}
              maxLength={300}
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              placeholder={t("profile_bio_placeholder", lang)}
              style={{ resize: "vertical", minHeight: 72 }}
            />
            <p style={{
              fontSize: 12, marginTop: 4, textAlign: "right",
              color: bioLen > 260 ? "#ff9500" : "var(--hint)",
            }}>
              {bioLen}/300
            </p>
          </div>
        </div>

        <button
          type="submit"
          className={`btn ${saved ? "btn-success" : "btn-primary"}`}
          disabled={saving}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saving ? t("saving", lang) : saved ? t("saved", lang) : t("save_changes", lang)}
        </button>
      </form>
    </div>
  );
}
