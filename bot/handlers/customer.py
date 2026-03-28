from aiogram import Router, F
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
)

from bot.i18n import t
from bot.api_client import BackendClient
from bot.handlers.start import get_lang

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


@router.callback_query(F.data.startswith("region:"))
async def handle_region_pick(callback: CallbackQuery, backend: BackendClient, mini_app_url: str):
    region = callback.data[len("region:"):]
    lang = get_lang(callback.from_user.id)

    shops = await backend.get_shops(region)

    if not shops:
        await callback.message.edit_text(
            t("no_shops", lang),
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text=t("back", lang), callback_data="menu:find_barber")]
            ]),
            parse_mode="HTML",
        )
        await callback.answer()
        return

    await callback.message.edit_text(
        t("shops_in_region", lang, region=region),
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text=t("back", lang), callback_data="menu:find_barber")]
        ]),
    )

    # Send each shop as a separate message with a "Book" WebApp button
    for shop in shops:
        book_url = f"{mini_app_url}/book?shop_id={shop['id']}"
        await callback.message.answer(
            t("shop_card", lang,
              name=shop["name"],
              city=shop["city"],
              address=shop["address"],
              phone=shop["phone"]),
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(
                    text=t("book_button", lang),
                    web_app=WebAppInfo(url=book_url),
                )]
            ]),
        )

    await callback.answer()


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
