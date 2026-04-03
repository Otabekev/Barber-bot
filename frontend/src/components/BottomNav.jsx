import { NavLink } from "react-router-dom";
import {
  Home,
  Store,
  Calendar,
  ClipboardList,
  Ban,
  CalendarCheck,
  ShieldCheck,
  Users,
  User,
} from "lucide-react";
import useStore from "../store/useStore";
import { t } from "../i18n";

const ICON_SIZE = 20;
const ICON_COLOR = "currentColor";

export default function BottomNav() {
  const user = useStore((s) => s.user);
  const shop = useStore((s) => s.shop);
  const staffRecord = useStore((s) => s.staffRecord);
  const shopStaff = useStore((s) => s.shopStaff);
  const lang = user?.language || "uz";

  // isOwner: user owns the shop
  const isOwner = shop && staffRecord && shop.owner_id === staffRecord.user_id;
  // hasTeam: shop has >1 active approved staff
  const hasTeam = shopStaff.filter((s) => s.is_active && s.is_approved).length > 1;

  // Staff member (not owner): show staffRecord-based nav
  const isBarber = !!staffRecord;

  const BARBER_ITEMS = [
    { to: "/",            label: t("nav_home", lang),      icon: <Home size={ICON_SIZE} color={ICON_COLOR} /> },
    { to: "/schedule",    label: t("nav_schedule", lang),  icon: <Calendar size={ICON_SIZE} color={ICON_COLOR} /> },
    { to: "/bookings",    label: t("nav_bookings", lang),  icon: <ClipboardList size={ICON_SIZE} color={ICON_COLOR} /> },
    { to: "/block-slots", label: t("nav_block", lang),     icon: <Ban size={ICON_SIZE} color={ICON_COLOR} /> },
    { to: "/profile",     label: t("nav_profile", lang),   icon: <User size={ICON_SIZE} color={ICON_COLOR} /> },
  ];

  // Owner-specific items in addition to barber items
  const OWNER_EXTRA_ITEMS = [
    { to: "/shop",        label: t("nav_shop", lang),      icon: <Store size={ICON_SIZE} color={ICON_COLOR} /> },
  ];
  const TEAM_ITEM = {
    to: "/team",
    label: t("nav_team", lang),
    icon: <Users size={ICON_SIZE} color={ICON_COLOR} />,
  };

  const CUSTOMER_ITEMS = [
    { to: "/",            label: t("nav_home", lang),         icon: <Home size={ICON_SIZE} color={ICON_COLOR} /> },
    { to: "/my-bookings", label: t("nav_my_bookings", lang),  icon: <CalendarCheck size={ICON_SIZE} color={ICON_COLOR} /> },
  ];

  const ADMIN_ITEM = {
    to: "/admin",
    label: t("nav_admin", lang),
    icon: <ShieldCheck size={ICON_SIZE} color={ICON_COLOR} />,
  };

  let items;
  if (isBarber) {
    items = [...BARBER_ITEMS];
    if (isOwner) {
      // Insert Shop item after Home
      items.splice(1, 0, ...OWNER_EXTRA_ITEMS);
      if (hasTeam) {
        items.push(TEAM_ITEM);
      }
    }
  } else if (shop) {
    // Has shop but no staff record yet (shouldn't happen after migration, but fallback)
    items = [
      { to: "/",            label: t("nav_home", lang),      icon: <Home size={ICON_SIZE} color={ICON_COLOR} /> },
      { to: "/shop",        label: t("nav_shop", lang),      icon: <Store size={ICON_SIZE} color={ICON_COLOR} /> },
    ];
  } else {
    items = CUSTOMER_ITEMS;
  }

  if (user?.is_admin) {
    items = [...items, ADMIN_ITEM];
  }

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
