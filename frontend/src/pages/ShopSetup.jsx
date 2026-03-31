import { useState, useEffect, useRef } from "react";
import useStore from "../store/useStore";
import {
  createShop, updateShop,
  uploadShopPhoto, deleteShopPhoto, getShopPhotoUrl,
} from "../api/client";
import { toast } from "../components/Layout";
import { t } from "../i18n";
import DISTRICTS from "../districts";

const SLOT_OPTIONS = [15, 20, 30, 45, 60];

const REGIONS = Object.keys(DISTRICTS);

const EMPTY = {
  name: "", region: "Toshkent shahri", district: "", city: "", address: "",
  phone: "", slot_duration: 30, beard_duration: "", description: "",
};

export default function ShopSetup() {
  const { user, shop, setShop } = useStore();
  const lang = user?.language || "uz";
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    if (shop) {
      setForm({
        name: shop.name,
        region: shop.region ?? "Toshkent shahri",
        district: shop.district || "",
        city: shop.city,
        address: shop.address,
        phone: shop.phone,
        slot_duration: shop.slot_duration,
        beard_duration: shop.beard_duration ?? "",
        description: shop.description || "",
      });
      if (shop.has_photo) setPhotoPreview(getShopPhotoUrl(shop.id));
    }
  }, [shop]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function validate() {
    const e = {};
    if (!form.name.trim())    e.name    = t("required", lang);
    if (!form.city.trim())    e.city    = t("required", lang);
    if (!form.address.trim()) e.address = t("required", lang);
    if (!form.phone.trim())   e.phone   = t("required", lang);
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        slot_duration: Number(form.slot_duration),
        beard_duration: form.beard_duration ? Number(form.beard_duration) : null,
        description: form.description.trim() || null,
      };
      const result = shop ? await updateShop(data) : await createShop(data);
      setShop(result);
      toast(shop ? t("shop_saved", lang) : t("shop_created", lang));
    } catch (err) {
      toast(err.response?.data?.detail || t("save_failed", lang));
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoUploading(true);
    try {
      const updated = await uploadShopPhoto(file);
      setShop(updated);
      toast(t("photo_uploaded", lang));
    } catch (err) {
      toast(err.response?.data?.detail || t("photo_upload_error", lang));
      setPhotoPreview(shop?.has_photo ? getShopPhotoUrl(shop.id) : null);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handlePhotoDelete() {
    setPhotoUploading(true);
    try {
      const updated = await deleteShopPhoto();
      setShop(updated);
      setPhotoPreview(null);
      toast(t("photo_deleted", lang));
    } catch {
      toast(t("photo_upload_error", lang));
    } finally {
      setPhotoUploading(false);
    }
  }

  const descLen = form.description.length;

  return (
    <div>
      <h1 className="section-title">
        {shop ? t("edit_shop", lang) : t("create_shop", lang)}
      </h1>

      {shop && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: "var(--hint)" }}>{t("status_label", lang)}</span>
            <span className={`badge ${shop.is_approved ? "badge-approved" : "badge-pending-approval"}`}>
              {shop.is_approved ? t("approved_check", lang) : t("awaiting_approval", lang)}
            </span>
          </div>
        </div>
      )}

      {/* ── Cover photo (only shown when editing an existing shop) ── */}
      {shop && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="card-title">{t("photo_label", lang)}</p>

          {photoPreview ? (
            <div style={{ position: "relative", marginBottom: 12 }}>
              <img
                src={photoPreview}
                alt="cover"
                style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 10, display: "block" }}
              />
              {photoUploading && (
                <div style={{
                  position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
                  borderRadius: 10, display: "flex", alignItems: "center",
                  justifyContent: "center", color: "#fff", fontSize: 14,
                }}>
                  {t("uploading", lang)}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              width: "100%", height: 120, borderRadius: 10, marginBottom: 12,
              background: "var(--border)", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 6,
              color: "var(--hint)", fontSize: 13,
            }}>
              <span style={{ fontSize: 32 }}>🏪</span>
              <span>{t("no_photo_yet", lang)}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              disabled={photoUploading}
              onClick={() => fileRef.current?.click()}
            >
              {photoPreview ? t("change_photo", lang) : t("upload_photo", lang)}
            </button>
            {photoPreview && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={photoUploading}
                onClick={handlePhotoDelete}
                style={{ padding: "0 14px" }}
              >
                🗑
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
          <p style={{ fontSize: 12, color: "var(--hint)", marginTop: 8 }}>{t("photo_hint", lang)}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="card">
          <p className="card-title">{t("shop_info_title", lang)}</p>

          <div className="form-group">
            <label className="form-label">{t("shop_name_label", lang)}</label>
            <input
              className="form-input"
              placeholder={t("shop_name_placeholder", lang)}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
            {errors.name && <p style={{ color: "#ff3b30", fontSize: 12, marginTop: 4 }}>{errors.name}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">{t("description_label", lang)}</label>
            <textarea
              className="form-input"
              rows={3}
              maxLength={300}
              placeholder={t("description_placeholder", lang)}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              style={{ resize: "vertical", minHeight: 72 }}
            />
            <p style={{
              fontSize: 12, marginTop: 4, textAlign: "right",
              color: descLen > 260 ? "#ff9500" : "var(--hint)",
            }}>
              {descLen}/300
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">{t("region_label", lang)}</label>
            <select
              className="form-input form-select"
              value={form.region}
              onChange={(e) => { set("region", e.target.value); set("district", ""); }}
            >
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t("district_label", lang)}</label>
            <select
              className="form-input form-select"
              value={form.district}
              onChange={(e) => set("district", e.target.value)}
            >
              <option value="">{t("district_any", lang)}</option>
              {(DISTRICTS[form.region] || []).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t("city_label", lang)}</label>
            <input
              className="form-input"
              placeholder={t("city_placeholder", lang)}
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
            {errors.city && <p style={{ color: "#ff3b30", fontSize: 12, marginTop: 4 }}>{errors.city}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">{t("address_label", lang)}</label>
            <input
              className="form-input"
              placeholder={t("address_placeholder", lang)}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
            {errors.address && <p style={{ color: "#ff3b30", fontSize: 12, marginTop: 4 }}>{errors.address}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">{t("phone_label", lang)}</label>
            <input
              className="form-input"
              type="tel"
              placeholder="+998 90 123 45 67"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
            {errors.phone && <p style={{ color: "#ff3b30", fontSize: 12, marginTop: 4 }}>{errors.phone}</p>}
          </div>
        </div>

        <div className="card">
          <p className="card-title">{t("booking_settings_title", lang)}</p>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t("slot_duration_label", lang)}</label>
            <select
              className="form-input form-select"
              value={form.slot_duration}
              onChange={(e) => set("slot_duration", e.target.value)}
            >
              {SLOT_OPTIONS.map((m) => <option key={m} value={m}>{m} {t("minutes", lang)}</option>)}
            </select>
            <p style={{ fontSize: 12, color: "var(--hint)", marginTop: 6 }}>{t("slot_duration_hint", lang)}</p>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t("beard_duration_label", lang)}</label>
            <select
              className="form-input form-select"
              value={form.beard_duration}
              onChange={(e) => set("beard_duration", e.target.value)}
            >
              <option value="">{t("beard_duration_none", lang)}</option>
              <option value="5">5 {t("minutes", lang)}</option>
              <option value="10">10 {t("minutes", lang)}</option>
              <option value="15">15 {t("minutes", lang)}</option>
            </select>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t("saving", lang) : shop ? t("save_changes", lang) : t("create_shop_btn", lang)}
        </button>
      </form>
    </div>
  );
}
