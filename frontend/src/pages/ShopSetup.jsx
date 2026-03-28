import { useState, useEffect } from "react";
import useStore from "../store/useStore";
import { createShop, updateShop } from "../api/client";
import { toast } from "../components/Layout";

const SLOT_OPTIONS = [15, 20, 30, 45, 60];

const REGIONS = [
  "Toshkent shahri",
  "Toshkent viloyati",
  "Samarqand",
  "Buxoro",
  "Farg'ona",
  "Andijon",
  "Namangan",
  "Qashqadaryo",
  "Surxondaryo",
  "Xorazm",
  "Navoiy",
  "Jizzax",
  "Sirdaryo",
  "Qoraqalpog'iston",
];

const EMPTY = { name: "", region: "Toshkent shahri", city: "", address: "", phone: "", slot_duration: 30 };

export default function ShopSetup() {
  const { shop, setShop } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (shop) {
      setForm({
        name: shop.name,
        region: shop.region ?? "Toshkent shahri",
        city: shop.city,
        address: shop.address,
        phone: shop.phone,
        slot_duration: shop.slot_duration,
      });
    }
  }, [shop]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function validate() {
    const e = {};
    if (!form.name.trim())    e.name = "Required";
    if (!form.city.trim())    e.city = "Required";
    if (!form.address.trim()) e.address = "Required";
    if (!form.phone.trim())   e.phone = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const data = { ...form, slot_duration: Number(form.slot_duration) };
      const result = shop ? await updateShop(data) : await createShop(data);
      setShop(result);
      toast(shop ? "Shop updated!" : "Shop created!");
    } catch (err) {
      toast(err.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="section-title">{shop ? "Edit Shop" : "Create Shop"}</h1>

      {shop && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: "var(--hint)" }}>Status</span>
            <span className={`badge ${shop.is_approved ? "badge-approved" : "badge-pending-approval"}`}>
              {shop.is_approved ? "Approved ✓" : "Awaiting approval"}
            </span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="card">
          <p className="card-title">Shop Info</p>

          <div className="form-group">
            <label className="form-label">Shop Name</label>
            <input
              className="form-input"
              placeholder="e.g. Classic Cuts"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
            {errors.name && <p style={{ color: "#ff3b30", fontSize: 12, marginTop: 4 }}>{errors.name}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Region</label>
            <select
              className="form-input form-select"
              value={form.region}
              onChange={(e) => set("region", e.target.value)}
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">City</label>
            <input
              className="form-input"
              placeholder="e.g. Tashkent"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
            {errors.city && <p style={{ color: "#ff3b30", fontSize: 12, marginTop: 4 }}>{errors.city}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <input
              className="form-input"
              placeholder="Street, building, room"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
            {errors.address && <p style={{ color: "#ff3b30", fontSize: 12, marginTop: 4 }}>{errors.address}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Phone</label>
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
          <p className="card-title">Booking Settings</p>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Slot Duration</label>
            <select
              className="form-input form-select"
              value={form.slot_duration}
              onChange={(e) => set("slot_duration", e.target.value)}
            >
              {SLOT_OPTIONS.map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
            <p style={{ fontSize: 12, color: "var(--hint)", marginTop: 6 }}>
              Each booking slot will last this long.
            </p>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : shop ? "Save Changes" : "Create Shop"}
        </button>
      </form>
    </div>
  );
}
