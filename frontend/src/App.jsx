import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import useStore from "./store/useStore";
import { authTelegram, authDevLogin, getMyShop, getMyStaffRecord, getShopStaff } from "./api/client";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ShopSetup from "./pages/ShopSetup";
import Schedule from "./pages/Schedule";
import Bookings from "./pages/Bookings";
import BlockSlots from "./pages/BlockSlots";
import BookingFlow from "./pages/BookingFlow";
import MyBookings from "./pages/MyBookings";
import AdminPanel from "./pages/AdminPanel";
import ReviewPage from "./pages/ReviewPage";
import Team from "./pages/Team";
import JoinShop from "./pages/JoinShop";
import StaffProfile from "./pages/StaffProfile";

// Set VITE_DEV_BYPASS_TELEGRAM=true in frontend/.env.local to skip Telegram auth
const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_TELEGRAM === "true";

function log(...args) {
  // Always log — visible in browser DevTools and Telegram's debug console
  console.log("[BarberApp]", ...args);
}

function AppRoutes() {
  const [searchParams] = useSearchParams();
  const shopId = searchParams.get("shop_id");
  const reviewBookingId = searchParams.get("booking_id");
  // Read join token from URL query param OR from Telegram's start_param
  // (Telegram passes the deep link payload via initDataUnsafe.start_param when
  //  the mini app is launched via t.me/BOT?start=join_TOKEN)
  const tgStartParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param || "";
  const joinToken = searchParams.get("join") ||
    (tgStartParam.startsWith("join_") ? tgStartParam.slice(5) : null);

  if (shopId) {
    return (
      <Layout>
        <Routes>
          <Route path="*" element={<Navigate to={`/book?shop_id=${shopId}`} replace />} />
          <Route path="/book" element={<BookingFlow />} />
        </Routes>
      </Layout>
    );
  }
  if (reviewBookingId) {
    return (
      <Layout>
        <Routes>
          <Route path="*" element={<Navigate to={`/review?booking_id=${reviewBookingId}`} replace />} />
          <Route path="/review" element={<ReviewPage />} />
        </Routes>
      </Layout>
    );
  }
  if (joinToken) {
    return (
      <Layout>
        <Routes>
          <Route path="*" element={<Navigate to={`/join?join=${joinToken}`} replace />} />
          <Route path="/join" element={<JoinShop />} />
        </Routes>
      </Layout>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/"            element={<Dashboard />} />
        <Route path="/shop"        element={<ShopSetup />} />
        <Route path="/schedule"    element={<Schedule />} />
        <Route path="/bookings"    element={<Bookings />} />
        <Route path="/block-slots" element={<BlockSlots />} />
        <Route path="/book"        element={<BookingFlow />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/review"      element={<ReviewPage />} />
        <Route path="/admin"       element={<AdminPanel />} />
        <Route path="/team"        element={<Team />} />
        <Route path="/join"        element={<JoinShop />} />
        <Route path="/profile"     element={<StaffProfile />} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const { setAuth, setAuthError, setShop, setStaffRecord, setShopStaff, isAuthLoading, authError } = useStore();
  const [initDone, setInitDone] = useState(false);

  useEffect(() => {
    async function init() {
      // ── MODE B: Local browser dev bypass ──────────────────────────────
      if (DEV_BYPASS) {
        log("DEV_BYPASS=true — skipping Telegram auth");

        const storedToken = localStorage.getItem("access_token");
        if (storedToken) {
          log("Reusing stored token from localStorage");
          // Optimistically set auth; if token is expired the 401 handler clears it
          setAuth(storedToken, {
            full_name: "Dev User",
            telegram_id: 0,
            id: 0,
            language: "en",
            is_admin: false,
          });
          const shop = await getMyShop().catch((e) => {
            log("getMyShop failed (expected if no real token):", e.message);
            return null;
          });
          if (shop) setShop(shop);
          const staffRec = await getMyStaffRecord().catch(() => null);
          if (staffRec) {
            setStaffRecord(staffRec);
            const allStaff = await getShopStaff().catch(() => []);
            setShopStaff(allStaff);
          }
        } else {
          log("No stored token — calling /auth/dev-login to get a real JWT");
          try {
            const { access_token, user } = await authDevLogin();
            log("Dev login success, user:", user.full_name);
            setAuth(access_token, user);
            const shop = await getMyShop().catch(() => null);
            if (shop) setShop(shop);
            const staffRec2 = await getMyStaffRecord().catch(() => null);
            if (staffRec2) {
              setStaffRecord(staffRec2);
              const allStaff2 = await getShopStaff().catch(() => []);
              setShopStaff(allStaff2);
            }
          } catch (e) {
            const detail = e.response?.data?.detail || e.message;
            log("Dev login failed:", detail);
            setAuthError(`Dev login failed: ${detail} — make sure DEV_MODE=true is set in backend .env`);
          }
        }

        setInitDone(true);
        return;
      }

      // ── MODE A: Real Telegram Mini App mode ───────────────────────────
      log("window.Telegram defined?", typeof window.Telegram !== "undefined");
      log("window.Telegram.WebApp defined?", typeof window.Telegram?.WebApp !== "undefined");

      const tg = window.Telegram?.WebApp;

      if (!tg) {
        log("ERROR: window.Telegram.WebApp not found — telegram-web-app.js may not have loaded");
        setAuthError("Telegram SDK not found. Please open this app from Telegram.");
        setInitDone(true);
        return;
      }

      const initData = tg.initData ?? "";
      log("initData present:", !!initData);
      log("initData length:", initData.length);
      if (initData) {
        log("initData preview (first 120 chars):", initData.slice(0, 120));
      }

      // Tell Telegram the app is ready to be shown
      tg.ready();
      tg.expand();

      if (!initData) {
        log(
          "ERROR: initData is empty. " +
            "This happens when the app is NOT opened as a proper Telegram Web App. " +
            "Make sure you configured the Web App URL in BotFather."
        );
        setAuthError(
          "initData is missing. Open this app from your Telegram bot (not as a direct link)."
        );
        setInitDone(true);
        return;
      }

      try {
        log("Sending initData to backend for validation...");
        const { access_token, user } = await authTelegram(initData);
        log("Auth success! user:", user.full_name, "id:", user.telegram_id);
        setAuth(access_token, user);

        const shop = await getMyShop().catch((e) => {
          log("getMyShop failed (user has no shop yet):", e.message);
          return null;
        });
        if (shop) {
          log("Shop loaded:", shop.name);
          setShop(shop);
        }
        const staffRec = await getMyStaffRecord().catch(() => null);
        if (staffRec) {
          setStaffRecord(staffRec);
          const allStaff = await getShopStaff().catch(() => []);
          setShopStaff(allStaff);
        }
      } catch (e) {
        const detail =
          e.response?.data?.detail ||
          e.message ||
          "Authentication failed";
        log("ERROR: Auth failed:", detail);
        log("Response status:", e.response?.status);
        log(
          "Tip: If you see 'Invalid initData signature', your backend BOT_TOKEN " +
            "does not match the bot that opened this Mini App."
        );
        setAuthError(`Auth failed: ${detail}`);
      }

      setInitDone(true);
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!initDone || isAuthLoading) {
    return (
      <div className="loader" style={{ height: "100dvh" }}>
        Loading…
      </div>
    );
  }

  if (authError) {
    return (
      <div
        className="loader"
        style={{ height: "100dvh", flexDirection: "column", gap: 12, padding: 24 }}
      >
        <span style={{ fontSize: 36 }}>⚠️</span>
        <p style={{ color: "var(--hint)", textAlign: "center", maxWidth: 300, fontSize: 14 }}>
          {authError}
        </p>
        {import.meta.env.DEV && (
          <p style={{ fontSize: 12, color: "var(--hint)", textAlign: "center", maxWidth: 300 }}>
            Dev tip: set <code>VITE_DEV_BYPASS_TELEGRAM=true</code> in{" "}
            <code>frontend/.env.local</code> to skip Telegram auth.
          </p>
        )}
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
