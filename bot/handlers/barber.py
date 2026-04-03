from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import (
    CallbackQuery,
    Message,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardMarkup,
    KeyboardButton,
    WebAppInfo,
)

from bot.i18n import t
from bot.api_client import BackendClient
from bot.handlers.start import get_lang, persistent_keyboard

router = Router()


@router.callback_query(F.data == "menu:register_shop")
async def handle_register_shop(callback: CallbackQuery, mini_app_url: str):
    lang = get_lang(callback.from_user.id)
    manage_url = f"{mini_app_url}/"
    await callback.message.answer(
        t("open_app_button", lang),
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(
                text=t("open_app_button", lang),
                web_app=WebAppInfo(url=manage_url),
            )]
        ]),
    )
    await callback.answer()


@router.message(Command("setlocation"))
async def cmd_setlocation(message: Message):
    lang = get_lang(message.from_user.id)
    await message.answer(
        t("setlocation_prompt", lang),
        reply_markup=ReplyKeyboardMarkup(
            keyboard=[[KeyboardButton(text=t("setlocation_button", lang), request_location=True)]],
            resize_keyboard=True,
            one_time_keyboard=True,
        ),
    )


@router.message(F.location)
async def handle_location(message: Message, backend: BackendClient):
    lang = get_lang(message.from_user.id)
    lat = message.location.latitude
    lng = message.location.longitude

    ok = await backend.set_shop_location(message.from_user.id, lat, lng)
    if ok:
        await message.answer(
            t("setlocation_saved", lang),
            reply_markup=persistent_keyboard(),
        )
    else:
        await message.answer(
            t("setlocation_no_shop", lang),
            reply_markup=persistent_keyboard(),
        )


@router.message(Command("bugun"))
async def cmd_today(message: Message, backend: BackendClient):
    lang = get_lang(message.from_user.id)
    data = await backend.get_barber_today(message.from_user.id)

    if not data:
        await message.answer(t("today_not_registered", lang))
        return

    msg = data.get("message")
    if msg == "not_registered":
        await message.answer(t("today_not_registered", lang))
        return
    if msg == "no_shop":
        await message.answer(t("today_no_shop", lang))
        return

    bookings = data.get("bookings", [])
    if not bookings:
        await message.answer(
            t("today_header", lang, date=data["date"], shop=data["shop_name"]) +
            t("today_empty", lang),
            parse_mode="HTML",
        )
        return

    lines = t("today_header", lang, date=data["date"], shop=data["shop_name"])
    for b in bookings:
        icon = t(f"status_{b['status']}", lang) if b["status"] in ("pending", "confirmed") else "✅"
        lines += t("today_booking", lang,
                   time=b["time"],
                   name=b["name"],
                   phone=b["phone"],
                   status_icon=icon)

    await message.answer(lines, parse_mode="HTML")
