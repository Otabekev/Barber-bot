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

  // ── Shop state ──────────────────────────────────────────────────────────
  shop: null,
  shopLoading: false,
  setShop: (shop) => set({ shop }),
  setShopLoading: (v) => set({ shopLoading: v }),

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
