"""
Send Telegram messages to users via the Bot API.
Called by the backend after booking events — no bot library needed, just httpx.
"""
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"

# Per-language message templates
TELEGRAM_API_SEND = "https://api.telegram.org/bot{token}/sendMessage"

_MESSAGES = {
    "new_booking": {
        "uz": "📅 <b>Yangi bron!</b>\n\n👤 {name}\n📞 {phone}\n🗓 {date} — {time}\n\nBronni tasdiqlang yoki bekor qiling.",
        "ru": "📅 <b>Новая запись!</b>\n\n👤 {name}\n📞 {phone}\n🗓 {date} — {time}\n\nПодтвердите или отмените запись.",
        "en": "📅 <b>New booking!</b>\n\n👤 {name}\n📞 {phone}\n🗓 {date} — {time}\n\nPlease confirm or cancel.",
    },
    "booking_confirmed": {
        "uz": "✅ <b>Broningiz tasdiqlandi!</b>\n\n🏪 {shop}\n🗓 {date} soat {time}\n📍 {address}",
        "ru": "✅ <b>Ваша запись подтверждена!</b>\n\n🏪 {shop}\n🗓 {date} в {time}\n📍 {address}",
        "en": "✅ <b>Your booking is confirmed!</b>\n\n🏪 {shop}\n🗓 {date} at {time}\n📍 {address}",
    },
    "booking_cancelled": {
        "uz": "❌ <b>Bron bekor qilindi.</b>\n\n🏪 {shop}\n🗓 {date} soat {time}",
        "ru": "❌ <b>Запись отменена.</b>\n\n🏪 {shop}\n🗓 {date} в {time}",
        "en": "❌ <b>Booking cancelled.</b>\n\n🏪 {shop}\n🗓 {date} at {time}",
    },
    "booking_completed": {
        "uz": "🎉 <b>Tashrif tugadi!</b> Rahmat!\n\n🏪 {shop}",
        "ru": "🎉 <b>Визит завершён!</b> Спасибо!\n\n🏪 {shop}",
        "en": "🎉 <b>Visit completed!</b> Thank you!\n\n🏪 {shop}",
    },
    "customer_cancelled": {
        "uz": "❌ <b>Mijoz bronni bekor qildi!</b>\n\n👤 {name}\n📞 {phone}\n🗓 {date} — {time}",
        "ru": "❌ <b>Клиент отменил запись!</b>\n\n👤 {name}\n📞 {phone}\n🗓 {date} — {time}",
        "en": "❌ <b>Customer cancelled their booking!</b>\n\n👤 {name}\n📞 {phone}\n🗓 {date} — {time}",
    },
    "reminder": {
        "uz": "⏰ <b>Eslatma!</b>\n\nBugun soat {time} da {shop} sartaroshxonasiga yozilgansiz.\n📍 {address}\n\nKelasizmi?",
        "ru": "⏰ <b>Напоминание!</b>\n\nСегодня в {time} у вас запись в барбершоп {shop}.\n📍 {address}\n\nВы придёте?",
        "en": "⏰ <b>Reminder!</b>\n\nYou have a booking at {shop} today at {time}.\n📍 {address}\n\nWill you come?",
    },
    "remind_yes_btn": {"uz": "✅ Ha, kelaman", "ru": "✅ Да, приду", "en": "✅ Yes, I'll come"},
    "remind_no_btn":  {"uz": "❌ Kela olmayman", "ru": "❌ Не смогу", "en": "❌ Can't make it"},
    "remind_confirmed": {
        "uz": "👍 Siz kelishingizni tasdiqladi. Sartarosh kutadi!",
        "ru": "👍 Вы подтвердили визит. Барбер ждёт!",
        "en": "👍 You confirmed your visit. See you there!",
    },
    "remind_cancelled_customer": {
        "uz": "Bron bekor qilindi. Keyingi safar ko'rishguncha! ✌️",
        "ru": "Запись отменена. До следующего раза! ✌️",
        "en": "Booking cancelled. See you next time! ✌️",
    },
}


async def _send(telegram_id: int, text: str) -> None:
    url = TELEGRAM_API.format(token=settings.BOT_TOKEN)
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(url, json={
                "chat_id": telegram_id,
                "text": text,
                "parse_mode": "HTML",
            })
            if resp.status_code != 200:
                logger.warning("Telegram sendMessage failed: %s", resp.text)
    except Exception as e:
        logger.warning("Failed to send Telegram notification: %s", e)


async def notify_barber_new_booking(
    barber_telegram_id: int,
    customer_name: str,
    customer_phone: str,
    booking_date: str,
    time_slot: str,
    barber_language: str = "uz",
) -> None:
    lang = barber_language if barber_language in ("uz", "ru", "en") else "uz"
    text = _MESSAGES["new_booking"][lang].format(
        name=customer_name,
        phone=customer_phone,
        date=booking_date,
        time=time_slot,
    )
    await _send(barber_telegram_id, text)


async def notify_barber_customer_cancelled(
    barber_telegram_id: int,
    customer_name: str,
    customer_phone: str,
    booking_date: str,
    time_slot: str,
    barber_language: str = "uz",
) -> None:
    lang = barber_language if barber_language in ("uz", "ru", "en") else "uz"
    text = _MESSAGES["customer_cancelled"][lang].format(
        name=customer_name,
        phone=customer_phone,
        date=booking_date,
        time=time_slot,
    )
    await _send(barber_telegram_id, text)


async def send_reminder(
    customer_telegram_id: int,
    booking_id: int,
    shop_name: str,
    shop_address: str,
    time_slot: str,
    customer_language: str = "uz",
) -> None:
    """Send a 5-hour reminder with Yes/No inline buttons."""
    lang = customer_language if customer_language in ("uz", "ru", "en") else "uz"
    text = _MESSAGES["reminder"][lang].format(
        shop=shop_name,
        address=shop_address,
        time=time_slot,
    )
    yes_text = _MESSAGES["remind_yes_btn"][lang]
    no_text  = _MESSAGES["remind_no_btn"][lang]
    url = TELEGRAM_API.format(token=settings.BOT_TOKEN)
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(url, json={
                "chat_id": customer_telegram_id,
                "text": text,
                "parse_mode": "HTML",
                "reply_markup": {
                    "inline_keyboard": [[
                        {"text": yes_text, "callback_data": f"remind_yes:{booking_id}"},
                        {"text": no_text,  "callback_data": f"remind_no:{booking_id}"},
                    ]]
                },
            })
            if resp.status_code != 200:
                logger.warning("Reminder sendMessage failed: %s", resp.text)
    except Exception as e:
        logger.warning("Failed to send reminder: %s", e)


async def notify_customer_status_change(
    customer_telegram_id: int,
    new_status: str,
    shop_name: str,
    shop_address: str,
    booking_date: str,
    time_slot: str,
    customer_language: str = "uz",
) -> None:
    lang = customer_language if customer_language in ("uz", "ru", "en") else "uz"
    template_key = {
        "confirmed": "booking_confirmed",
        "cancelled": "booking_cancelled",
        "completed": "booking_completed",
    }.get(new_status)
    if not template_key:
        return
    text = _MESSAGES[template_key][lang].format(
        shop=shop_name,
        address=shop_address,
        date=booking_date,
        time=time_slot,
    )
    await _send(customer_telegram_id, text)
