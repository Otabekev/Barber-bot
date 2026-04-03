from aiogram import Router, F
from aiogram.filters import CommandStart, CommandObject
from aiogram.types import (
    Message,
    CallbackQuery,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardMarkup,
    KeyboardButton,
    WebAppInfo,
)

from bot.i18n import t
from bot.api_client import BackendClient

router = Router()

# User language cache: {telegram_id: "uz"|"ru"|"en"}
_lang_cache: dict[int, str] = {}

# Button texts for all languages — used in the filter below
RESTART_BUTTON_TEXTS = {"🔄 Boshlash", "🔄 Начать заново", "🔄 Restart"}


def get_lang(telegram_id: int) -> str:
    return _lang_cache.get(telegram_id, "uz")


def set_lang(telegram_id: int, lang: str):
    _lang_cache[telegram_id] = lang


def _language_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🇺🇿 O'zbek", callback_data="lang:uz"),
            InlineKeyboardButton(text="🇷🇺 Русский", callback_data="lang:ru"),
            InlineKeyboardButton(text="🇬🇧 English", callback_data="lang:en"),
        ]
    ])


def main_menu_keyboard(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t("find_barber", lang), callback_data="menu:find_barber")],
        [InlineKeyboardButton(text=t("register_shop", lang), callback_data="menu:register_shop")],
        [InlineKeyboardButton(text=t("help_button", lang), callback_data="menu:help")],
    ])


def persistent_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="🔄 Boshlash")]],
        resize_keyboard=True,
        persistent=True,
    )


@router.message(F.text.in_(RESTART_BUTTON_TEXTS))
async def handle_restart(message: Message):
    # Re-attach the persistent keyboard in case it was dismissed, then show language pick
    await message.answer(
        t("restart_button", "uz"),
        reply_markup=persistent_keyboard(),
    )
    await message.answer(
        t("choose_language", "uz"),
        reply_markup=_language_keyboard(),
    )


@router.message(CommandStart(deep_link=True, magic=F.args.startswith("join_")))
async def cmd_start_invite(message: Message, command: CommandObject, backend: BackendClient, mini_app_url: str):
    """Deep link: t.me/BOT?start=join_TOKEN — show invite info and a button to open JoinShop."""
    token = command.args[len("join_"):]
    lang = get_lang(message.from_user.id)

    invite_info = await backend.get_invite_info(token)

    await message.answer(
        t("restart_button", "uz"),
        reply_markup=persistent_keyboard(),
    )

    if invite_info is None:
        await message.answer(t("invite_not_found_bot", lang))
        return

    if invite_info.get("is_expired"):
        await message.answer(t("invite_expired_bot", lang))
        return

    if invite_info.get("is_used"):
        await message.answer(t("invite_used_bot", lang))
        return

    shop_name = invite_info.get("shop_name", "")
    join_url = f"{mini_app_url}/?join={token}"

    await message.answer(
        t("invite_bot_msg", lang, shop=shop_name),
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(
                text=t("invite_open_btn", lang),
                web_app=WebAppInfo(url=join_url),
            )]
        ]),
        parse_mode="HTML",
    )


@router.message(CommandStart())
async def cmd_start(message: Message):
    # Attach the persistent reply keyboard first so it stays visible
    await message.answer(
        t("restart_button", "uz"),
        reply_markup=persistent_keyboard(),
    )
    await message.answer(
        t("choose_language", "uz"),
        reply_markup=_language_keyboard(),
    )


@router.callback_query(F.data.startswith("lang:"))
async def handle_language_pick(callback: CallbackQuery, backend: BackendClient):
    lang = callback.data.split(":")[1]
    user = callback.from_user
    set_lang(user.id, lang)

    # Save to backend (fire and forget — don't block the response)
    await backend.set_language(
        telegram_id=user.id,
        language=lang,
        full_name=user.full_name or "",
    )

    await callback.message.edit_text(
        t("language_set", lang),
    )
    await callback.message.answer(
        t("main_menu", lang, name=user.first_name or user.full_name or ""),
        reply_markup=main_menu_keyboard(lang),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data == "menu:help")
async def handle_help(callback: CallbackQuery):
    lang = get_lang(callback.from_user.id)
    await callback.message.answer(
        t("help_text", lang),
        parse_mode="HTML",
    )
    await callback.answer()


@router.message()
async def handle_unknown(message: Message):
    """Catch-all: any unrecognised text re-attaches the persistent keyboard and shows the main menu."""
    lang = get_lang(message.from_user.id)
    name = message.from_user.first_name or message.from_user.full_name or ""
    await message.answer(
        t("restart_button", "uz"),
        reply_markup=persistent_keyboard(),
    )
    await message.answer(
        t("main_menu", lang, name=name),
        reply_markup=main_menu_keyboard(lang),
        parse_mode="HTML",
    )
