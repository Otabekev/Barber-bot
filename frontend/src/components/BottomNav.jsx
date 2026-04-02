import { NavLink } from "react-router-dom";
import {
  Home,
  Store,
  Calendar,
  ClipboardList,
  Ban,
  CalendarCheck,
  ShieldCheck,
} from "lucide-react";
import useStore from "../store/useStore";
import { t } from "../i18n";

const ICON_SIZE = 20;
const ICON_COLOR = "currentColor";

export default function BottomNav() {
  const user = useStore((s) => s.user);
  const shop = useStore((s) => s.shop);
  const lang = user?.language || "uz";

  const BARBER_ITEMS = [
    { to: "/",           label: t("nav_home", lang),      icon: <Home size={ICON_SIZE} color={ICON_COLOR} /> },
    { to: "/shop",       label: t("nav_shop", lang),      icon: <Store size={ICON_SIZE} color={ICON_COLOR} /> },
    { to: "/schedule",   label: t("nav_schedule", lang),  icon: <Calendar size={ICON_SIZE} color={ICON_COLOR} /> },
    { to: "/bookings",   label: t("nav_bookings", lang),  icon: <ClipboardList size={ICON_SIZE} color={ICON_COLOR} /> },
    { to: "/block-slots",label: t("nav_block", lang),     icon: <Ban size={ICON_SIZE} color={ICON_COLOR} /> },
  ];

  const CUSTOMER_ITEMS = [
    { to: "/",           label: t("nav_home", lang),         icon: <Home size={ICON_SIZE} color={ICON_COLOR} /> },
    { to: "/my-bookings",label: t("nav_my_bookings", lang),  icon: <CalendarCheck size={ICON_SIZE} color={ICON_COLOR} /> },
  ];

  const ADMIN_ITEM = {
    to: "/admin",
    label: t("nav_admin", lang),
    icon: <ShieldCheck size={ICON_SIZE} color={ICON_COLOR} />,
  };

  const baseItems = shop || user?.is_admin ? BARBER_ITEMS : CUSTOMER_ITEMS;
  const items = user?.is_admin ? [...baseItems, ADMIN_ITEM] : baseItems;

  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
        >
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
