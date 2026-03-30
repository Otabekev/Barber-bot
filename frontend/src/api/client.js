import axios from "axios";

// VITE_API_URL is set in .env.local
// - Leave unset for desktop browser (Vite proxy handles /api → localhost:8000)
// - Set to your backend ngrok URL when testing via Telegram on mobile
const BASE_URL = "https://surprising-magic-production-2dbb.up.railway.app/api";

// When true, the 401 handler does NOT reload the page (avoids loop with fake dev token)
const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_TELEGRAM === "true";

console.log("[API] BASE_URL:", BASE_URL);
console.log("[API] DEV_BYPASS:", DEV_BYPASS);

const api = axios.create({ baseURL: BASE_URL });

// ── Request interceptor: attach JWT ─────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  // Never send a stale token to auth endpoints — it belongs to a different user
  // and would confuse the server even though those routes don't require auth.
  const isAuthRoute = config.url === "/auth/telegram" || config.url === "/auth/dev-login";
  if (token && token !== "__dev_no_token__" && !isAuthRoute) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (import.meta.env.DEV) {
    console.log(`[API] → ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  }
  return config;
});

// ── Response interceptor: handle 401 ───────────────────────────────────────
api.interceptors.response.use(
  (res) => {
    if (import.meta.env.DEV) {
      console.log(`[API] ← ${res.status} ${res.config.url}`);
    }
    return res;
  },
  (err) => {
    const status = err.response?.status;
    const url = err.config?.url;
    console.warn(`[API] ← ${status} ${url}`, err.response?.data?.detail || err.message);

    // Reload on 401 from protected routes only — NOT from /auth/* endpoints.
    // If /auth/telegram itself returns 401 (e.g. HMAC mismatch), let App.jsx
    // catch block handle it; reloading here would cause an infinite reload loop.
    const isAuthRoute = url === "/auth/telegram" || url === "/auth/dev-login";
    if (status === 401 && !DEV_BYPASS && !isAuthRoute) {
      console.warn("[API] 401 on protected route — clearing token and reloading");
      localStorage.removeItem("access_token");
      window.location.reload();
    }

    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authTelegram = (init_data) =>
  api.post("/auth/telegram", { init_data }).then((r) => r.data);

export const authDevLogin = () =>
  api.post("/auth/dev-login").then((r) => r.data);

// ── Shop ─────────────────────────────────────────────────────────────────────
export const getMyShop = () => api.get("/shops/my").then((r) => r.data);
export const createShop = (data) => api.post("/shops/", data).then((r) => r.data);
export const updateShop = (data) => api.put("/shops/my", data).then((r) => r.data);
export const getAvailableSlots = (shopId, date) =>
  api.get(`/shops/${shopId}/available-slots`, { params: { date } }).then((r) => r.data);

export const uploadShopPhoto = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/shops/my/photo", form).then((r) => r.data);
};
export const deleteShopPhoto = () => api.delete("/shops/my/photo").then((r) => r.data);
// Returns the direct URL of a shop's cover photo (usable in <img src> or bot fetch)
export const getShopPhotoUrl = (shopId) => `${BASE_URL}/shops/${shopId}/photo`;

// ── Schedule ──────────────────────────────────────────────────────────────────
export const getMySchedule = () => api.get("/schedules/my").then((r) => r.data);
export const updateSchedule = (schedules) =>
  api.put("/schedules/my", { schedules }).then((r) => r.data);

// ── Bookings ──────────────────────────────────────────────────────────────────
export const getShopBookings = (params) =>
  api.get("/bookings/my-shop", { params }).then((r) => r.data);
export const updateBookingStatus = (id, status) =>
  api.patch(`/bookings/${id}/status`, { status }).then((r) => r.data);
export const createBooking = (data) =>
  api.post("/bookings/", data).then((r) => r.data);

// ── Blocked Slots ─────────────────────────────────────────────────────────────
export const getBlockedSlots = (params) =>
  api.get("/slots/blocked", { params }).then((r) => r.data);
export const blockSlots = (block_date, time_slots) =>
  api.post("/slots/block", { block_date, time_slots }).then((r) => r.data);
export const unblockSlots = (block_date, time_slots) =>
  api.post("/slots/unblock", { block_date, time_slots }).then((r) => r.data);

// ── Customer bookings ─────────────────────────────────────────────────────────
export const getMyBookings = () =>
  api.get("/bookings/my").then((r) => r.data);
export const cancelMyBooking = (id) =>
  api.patch(`/bookings/${id}/cancel`).then((r) => r.data);

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminGetShops = () =>
  api.get("/admin/shops").then((r) => r.data);
export const adminApproveShop = (id) =>
  api.patch(`/admin/shops/${id}/approve`).then((r) => r.data);
export const adminRejectShop = (id) =>
  api.patch(`/admin/shops/${id}/reject`).then((r) => r.data);
export const adminGetStats = () =>
  api.get("/admin/stats").then((r) => r.data);
export const adminGetUsers = () =>
  api.get("/admin/users").then((r) => r.data);

export default api;
