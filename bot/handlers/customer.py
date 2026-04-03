from datetime import date as _date

from aiogram import Router, F
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    BufferedInputFile,
)

from bot.i18n import t
from bot.api_client import BackendClient
from bot.handlers.start import get_lang
from bot.constants import DISTRICTS

router = Router()

REGIONS = [
    "Toshkent shahri",
    "Toshkent viloyati",
    "Farg'ona",
    "Andijon",
    "Namangan",
]


def _regions_keyboard(lang: str) -> InlineKeyboardMarkup:
    """2-column grid of regions."""
    rows = []
    for i in range(0, len(REGIONS), 2):
        row = [InlineKeyboardButton(
            text=REGIONS[i],
            callback_data=f"region:{REGIONS[i]}",
        )]
        if i + 1 < len(REGIONS):
            row.append(InlineKeyboardButton(
                text=REGIONS[i + 1],
                callback_data=f"region:{REGIONS[i + 1]}",
            ))
        rows.append(row)
    rows.append([InlineKeyboardButton(text=t("back", lang), callback_data="menu:back")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


@router.callback_query(F.data == "menu:find_barber")
async def handle_find_barber(callback: CallbackQuery):
    lang = get_lang(callback.from_user.id)
    await callback.message.edit_text(
        t("choose_region", lang),
        reply_markup=_regions_keyboard(lang),
    )
    await callback.answer()


def _districts_keyboard(region: str, lang: str) -> InlineKeyboardMarkup:
    """2-column grid of districts for the given region."""
    districts = DISTRICTS.get(region, [])
    rows = []
    for i in range(0, len(districts), 2):
        row = [InlineKeyboardButton(
            text=districts[i],
            callback_data=f"district:{region}:{districts[i]}",
        )]
        if i + 1 < len(districts):
            row.append(InlineKeyboardButton(
                text=districts[i + 1],
                callback_data=f"district:{region}:{districts[i + 1]}",
            ))
        rows.append(row)
    # "All in region" option + back
    rows.append([InlineKeyboardButton(
        text=t("all_districts", lang),
        callback_data=f"district:{region}:__all__",
    )])
    rows.append([InlineKeyboardButton(text=t("back", lang), callback_data="menu:find_barber")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


@router.callback_query(F.data.startswith("region:"))
async def handle_region_pick(callback: CallbackQuery):
    region = callback.data[len("region:"):]
    lang = get_lang(callback.from_user.id)
    await callback.message.edit_text(
        t("choose_district", lang, region=region),
        reply_markup=_districts_keyboard(region, lang),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data.startswith("district:"))
async def handle_district_pick(callback: CallbackQuery, backend: BackendClient, mini_app_url: str):
    parts = callback.data.split(":", 2)  # ["district", region, district_or_all]
    region = parts[1]
    district_raw = parts[2] if len(parts) > 2 else "__all__"
    district = None if district_raw == "__all__" else district_raw
    lang = get_lang(callback.from_user.id)
    await _show_shops(callback, region=region, district=district, lang=lang,
                      back_cb=f"region:{region}", backend=backend, mini_app_url=mini_app_url)
    await callback.answer()


async def _show_shops(callback: CallbackQuery, region: str, district, lang: str,
                      back_cb: str, backend: BackendClient, mini_app_url: str):
    """Fetch and display shop cards. district=None means whole region."""
    shops = await backend.get_shops(region, district)

    location_label = district or region
    if not shops:
        await callback.message.edit_text(
            t("no_shops", lang),
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text=t("back", lang), callback_data=back_cb)]
            ]),
            parse_mode="HTML",
        )
        return

    await callback.message.edit_text(
        t("shops_in_region", lang, region=location_label),
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text=t("back", lang), callback_data=back_cb)]
        ]),
    )

    today_str = str(_date.today())

    # Send each shop as a separate message with a "Book" WebApp button
    for shop in shops:
        staff_list = shop.get("staff") or []
        has_beard = 1 if shop.get("beard_duration") else 0
        multi_staff = len(staff_list) > 1

        if multi_staff:
            # Show barber picker buttons
            barber_rows = []
            for s in staff_list:
                name = s.get("display_name") or "Barber"
                barber_rows.append([InlineKeyboardButton(
                    text=f"✂️ {name}",
                    callback_data=f"pick_barber:{shop['id']}:{s['id']}:{today_str}:{has_beard}",
                )])
            barber_rows.append([InlineKeyboardButton(
                text=t("book_button", lang),
                web_app=WebAppInfo(url=f"{mini_app_url}/book?shop_id={shop['id']}"),
            )])
            markup = InlineKeyboardMarkup(inline_keyboard=barber_rows)
        else:
            # Single staff (or none) — use original flow, embed staff_id if available
            sid = staff_list[0]["id"] if staff_list else None
            book_url = f"{mini_app_url}/book?shop_id={shop['id']}" + (f"&staff_id={sid}" if sid else "")
            markup = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(
                    text=t("book_button", lang),
                    web_app=WebAppInfo(url=book_url),
                )],
                [InlineKeyboardButton(
                    text=t("quick_slots_btn", lang),
                    callback_data=f"qsvc:{shop['id']}:{sid or ''}:{today_str}:{has_beard}",
                )],
            ])

        desc = (shop.get("description") or "").strip()
        approved_mark = " ✅" if shop.get("is_approved") else ""
        card_text = t("shop_card", lang,
                      name=shop["name"] + approved_mark,
                      city=shop["city"],
                      address=shop["address"],
                      phone=shop["phone"])
        # Show rating if available
        avg = shop.get("avg_rating")
        cnt = shop.get("review_count") or 0
        if avg and cnt:
            card_text += "\n" + t("rating_line", lang, rating=f"{avg:.1f}", count=cnt)
        if desc:
            card_text = card_text + f"\n\n📝 <i>{desc[:280]}</i>"

        if shop.get("has_photo") and backend:
            photo_bytes = await backend.get_shop_photo(shop["id"])
            if photo_bytes:
                await callback.message.answer_photo(
                    photo=BufferedInputFile(photo_bytes, filename="shop.jpg"),
                    caption=card_text,
                    parse_mode="HTML",
                    reply_markup=markup,
                )
                if shop.get("latitude") and shop.get("longitude"):
                    await callback.message.answer_location(
                        latitude=shop["latitude"],
                        longitude=shop["longitude"],
                    )
                continue

        await callback.message.answer(card_text, parse_mode="HTML", reply_markup=markup)
        if shop.get("latitude") and shop.get("longitude"):
            await callback.message.answer_location(
                latitude=shop["latitude"],
                longitude=shop["longitude"],
            )


@router.callback_query(F.data.startswith("pick_barber:"))
async def handle_pick_barber(callback: CallbackQuery, mini_app_url: str):
    """Customer picked a specific barber — show quick slots or open mini app."""
    # callback_data: "pick_barber:{shop_id}:{staff_id}:{date}:{has_beard}"
    parts = callback.data.split(":")
    shop_id = int(parts[1])
    staff_id = int(parts[2])
    date_str = parts[3]
    has_beard = parts[4] == "1" if len(parts) > 4 else False
    lang = get_lang(callback.from_user.id)

    book_url = f"{mini_app_url}/book?shop_id={shop_id}&staff_id={staff_id}"
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text=t("book_button", lang),
            web_app=WebAppInfo(url=book_url),
        )],
        [InlineKeyboardButton(
            text=t("quick_slots_btn", lang),
            callback_data=f"qsvc:{shop_id}:{staff_id}:{date_str}:{1 if has_beard else 0}",
        )],
    ])
    await callback.message.answer(
        t("pick_barber_bot", lang),
        reply_markup=markup,
    )
    await callback.answer()


@router.callback_query(F.data.startswith("qsvc:"))
async def handle_service_select(callback: CallbackQuery, backend: BackendClient, mini_app_url: str):
    """Show service selection buttons, or skip straight to slots if no beard service."""
    parts = callback.data.split(":")  # ["qsvc", shop_id, staff_id_or_empty, date, has_beard]
    shop_id = int(parts[1])
    # staff_id may be empty string if no staff was selected
    staff_id_raw = parts[2] if len(parts) > 2 else ""
    staff_id = int(staff_id_raw) if staff_id_raw.isdigit() else None
    date_str = parts[3] if len(parts) > 3 else str(_date.today())
    has_beard = parts[4] == "1" if len(parts) > 4 else False
    lang = get_lang(callback.from_user.id)

    if not has_beard:
        # No beard service — jump straight to haircut slots
        slots = await backend.get_quick_slots(shop_id, date_str, service="haircut", staff_id=staff_id)
        if not slots:
            await callback.answer(t("no_slots_today", lang), show_alert=True)
            return
        await _send_slots_keyboard(callback, shop_id, date_str, "haircut", slots, lang, mini_app_url, staff_id=staff_id)
        await callback.answer()
        return

    # Has beard service — ask which service
    sid_part = f":{staff_id}" if staff_id else ":"
    rows = [
        [InlineKeyboardButton(
            text=t("svc_haircut", lang),
            callback_data=f"qslots:{shop_id}{sid_part}:{date_str}:haircut",
        )],
        [InlineKeyboardButton(
            text=t("svc_beard", lang),
            callback_data=f"qslots:{shop_id}{sid_part}:{date_str}:beard",
        )],
        [InlineKeyboardButton(
            text=t("svc_combo", lang),
            callback_data=f"qslots:{shop_id}{sid_part}:{date_str}:combo",
        )],
    ]
    await callback.message.answer(
        t("choose_service", lang),
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("qslots:"))
async def handle_quick_slots(callback: CallbackQuery, backend: BackendClient, mini_app_url: str):
    """Fetch and show available slots for the chosen service."""
    # Format: "qslots:{shop_id}:{staff_id_or_empty}:{date}:{service}"
    parts = callback.data.split(":")
    shop_id = int(parts[1])
    staff_id_raw = parts[2] if len(parts) > 2 else ""
    staff_id = int(staff_id_raw) if staff_id_raw.isdigit() else None
    date_str = parts[3] if len(parts) > 3 else str(_date.today())
    service = parts[4] if len(parts) > 4 else "haircut"
    lang = get_lang(callback.from_user.id)

    slots = await backend.get_quick_slots(shop_id, date_str, service=service, staff_id=staff_id)

    if not slots:
        await callback.answer(t("no_slots_today", lang), show_alert=True)
        return

    await _send_slots_keyboard(callback, shop_id, date_str, service, slots, lang, mini_app_url, staff_id=staff_id)
    await callback.answer()


async def _send_slots_keyboard(
    callback: CallbackQuery,
    shop_id: int,
    date_str: str,
    service: str,
    slots: list,
    lang: str,
    mini_app_url: str,
    staff_id: int | None = None,
):
    """Build and send the inline keyboard of slot buttons."""
    rows = []
    row = []
    sid_suffix = f":{staff_id}" if staff_id else ":"
    for slot in slots:
        # callback_data: "book_slot:{shop_id}:{staff_id_or_empty}:{date}:{HH}:{MM}:{service}"
        h, m = slot.split(":")
        row.append(InlineKeyboardButton(
            text=slot,
            callback_data=f"book_slot:{shop_id}{sid_suffix}:{date_str}:{h}:{m}:{service}",
        ))
        if len(row) == 3:
            rows.append(row)
            row = []
    if row:
        rows.append(row)

    book_url = f"{mini_app_url}/book?shop_id={shop_id}" + (f"&staff_id={staff_id}" if staff_id else "")
    rows.append([InlineKeyboardButton(
        text=t("book_button", lang),
        web_app=WebAppInfo(url=book_url),
    )])

    await callback.message.answer(
        t("slots_header", lang, date=date_str),
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
        parse_mode="HTML",
    )


@router.callback_query(F.data.startswith("book_slot:"))
async def handle_book_slot(callback: CallbackQuery, mini_app_url: str):
    """Open mini app pre-filled with chosen date + slot + service."""
    # callback_data format: "book_slot:{shop_id}:{staff_id_or_empty}:{date}:{HH}:{MM}:{service}"
    parts = callback.data.split(":", 7)
    shop_id = parts[1]
    staff_id_raw = parts[2] if len(parts) > 2 else ""
    staff_id = staff_id_raw if staff_id_raw.isdigit() else None
    date_str = parts[3] if len(parts) > 3 else ""
    hh = parts[4] if len(parts) > 4 else "00"
    mm = parts[5] if len(parts) > 5 else "00"
    slot = f"{hh}:{mm}"
    service = parts[6] if len(parts) > 6 else "haircut"

    url = f"{mini_app_url}/book?shop_id={shop_id}&date={date_str}&slot={slot}&service={service}"
    if staff_id:
        url += f"&staff_id={staff_id}"
    lang = get_lang(callback.from_user.id)

    await callback.answer()
    await callback.message.answer(
        t("slot_selected", lang, slot=slot),
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(
                text=t("open_booking_form", lang),
                web_app=WebAppInfo(url=url),
            )]
        ]),
        parse_mode="HTML",
    )


@router.callback_query(F.data.startswith("remind_yes:"))
async def handle_remind_yes(callback: CallbackQuery):
    """User confirmed they're coming — just acknowledge, no cancellation."""
    lang = get_lang(callback.from_user.id)
    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.answer(t("remind_confirmed", lang))
    await callback.answer()


@router.callback_query(F.data.startswith("remind_no:"))
async def handle_remind_no(callback: CallbackQuery, backend: BackendClient):
    """User said they can't come — cancel the booking via backend."""
    lang = get_lang(callback.from_user.id)
    booking_id = int(callback.data.split(":")[1])

    result = await backend.cancel_from_reminder(
        booking_id=booking_id,
        telegram_id=callback.from_user.id,
    )

    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.answer(t("remind_cancelled_customer", lang))
    await callback.answer()


@router.callback_query(F.data == "menu:back")
async def handle_back(callback: CallbackQuery):
    from bot.handlers.start import main_menu_keyboard
    lang = get_lang(callback.from_user.id)
    name = callback.from_user.first_name or callback.from_user.full_name or ""
    await callback.message.edit_text(
        t("main_menu", lang, name=name),
        reply_markup=main_menu_keyboard(lang),
        parse_mode="HTML",
    )
    await callback.answer()
