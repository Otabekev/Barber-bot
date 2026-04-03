import { create } from "zustand";

const useStore = create((set, get) => ({
  // ── Auth state ──────────────────────────────────────────────────────────
  user: null,
  token: localStorage.getItem("access_token") || null,
  isAuthLoading: true,
  authError: null,

  setAuth: (token, user) => {
    localStorage.setItem("access_token", token);
    set({ token, user, isAuthLoading: false, authError: null });
  },
  setAuthError: (msg) => set({ authError: msg, isAuthLoading: false }),
  clearAuth: () => {
    localStorage.removeItem("access_token");
    set({ token: null, user: null });
  },
  setAuthLoading: (v) => set({ isAuthLoading: v }),
  setUserLang: (lang) => set((s) => ({ user: s.user ? { ...s.user, language: lang } : s.user })),

  // ── Shop state ──────────────────────────────────────────────────────────
  shop: null,
  shopLoading: false,
  setShop: (shop) => set({ shop }),
  setShopLoading: (v) => set({ shopLoading: v }),

  // ── Staff state ──────────────────────────────────────────────────────────
  staffRecord: null,       // current user's own Staff row
  shopStaff: [],           // all staff for the shop (owner view)
  setStaffRecord: (staffRecord) => set({ staffRecord }),
  setShopStaff: (shopStaff) => set({ shopStaff }),
  // isOwner: derived — true when the user's shop.owner_id === staffRecord.user_id
  get isOwner() {
    const { shop, staffRecord } = get();
    return !!(shop && staffRecord && shop.owner_id === staffRecord.user_id);
  },
  // hasTeam: derived — true when the shop has more than one approved active staff member
  get hasTeam() {
    const { shopStaff } = get();
    return shopStaff.filter((s) => s.is_active && s.is_approved).length > 1;
  },

  // ── Schedule state ──────────────────────────────────────────────────────
  schedule: [],
  setSchedule: (schedule) => set({ schedule }),

  // ── Bookings state ──────────────────────────────────────────────────────
  bookings: [],
  bookingsLoading: false,
  setBookings: (bookings) => set({ bookings }),
  setBookingsLoading: (v) => set({ bookingsLoading: v }),
  updateBookingInList: (updated) =>
    set((state) => ({
      bookings: state.bookings.map((b) => (b.id === updated.id ? updated : b)),
    })),
}));

export default useStore;
