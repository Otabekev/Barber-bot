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
        book_url = f"{mini_app_url}/book?shop_id={shop['id']}"
        markup = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(
                text=t("book_button", lang),
                web_app=WebAppInfo(url=book_url),
            )],
            [InlineKeyboardButton(
                text=t("quick_slots_btn", lang),
                callback_data=f"slots:{shop['id']}:{today_str}",
            )],
        ])

        desc = (shop.get("description") or "").strip()
        approved_mark = " ✅" if shop.get("is_approved") else ""
        card_text = t("shop_card", lang,
                      name=shop["name"] + approved_mark,
                      city=shop["city"],
                      address=shop["address"],
                      phone=shop["phone"])
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
                continue

        await callback.message.answer(card_text, parse_mode="HTML", reply_markup=markup)


@router.callback_query(F.data.startswith("slots:"))
async def handle_quick_slots(callback: CallbackQuery, backend: BackendClient, mini_app_url: str):
    """Show today's available slots as inline keyboard buttons."""
    parts = callback.data.split(":")  # ["slots", shop_id, date]
    shop_id = int(parts[1])
    date_str = parts[2]
    lang = get_lang(callback.from_user.id)

    slots = await backend.get_quick_slots(shop_id, date_str)

    if not slots:
        await callback.answer(t("no_slots_today", lang), show_alert=True)
        return

    # Build rows of 3 buttons each
    rows = []
    row = []
    for slot in slots:
        row.append(InlineKeyboardButton(
            text=slot,
            callback_data=f"book_slot:{shop_id}:{date_str}:{slot}",
        ))
        if len(row) == 3:
            rows.append(row)
            row = []
    if row:
        rows.append(row)

    rows.append([InlineKeyboardButton(
        text=t("book_button", lang),
        web_app=WebAppInfo(url=f"{mini_app_url}/book?shop_id={shop_id}"),
    )])

    await callback.message.answer(
        t("slots_header", lang, date=date_str),
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data.startswith("book_slot:"))
async def handle_book_slot(callback: CallbackQuery, mini_app_url: str):
    """Open mini app pre-filled with chosen date + slot."""
    # callback_data format: "book_slot:{shop_id}:{date}:{HH}:{MM}"
    # split into at most 5 parts to handle the colon in "HH:MM"
    parts = callback.data.split(":", 4)
    shop_id = parts[1]
    date_str = parts[2]
    slot = f"{parts[3]}:{parts[4]}"  # reassemble "HH:MM"

    url = f"{mini_app_url}/book?shop_id={shop_id}&date={date_str}&slot={slot}"
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
