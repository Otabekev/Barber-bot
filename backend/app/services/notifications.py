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
    "review_request": {
        "uz": "⭐ <b>{shop}</b> da tashrif tugadi!\n\nTajribangizni baholang — bu sartaroshga katta yordam beradi.",
        "ru": "⭐ Ваш визит в <b>{shop}</b> завершён!\n\nОставьте отзыв — это очень поможет барберу.",
        "en": "⭐ Your visit to <b>{shop}</b> is done!\n\nLeave a quick review — it means a lot to the barber.",
    },
    "review_btn": {
        "uz": "⭐ Baho berish",
        "ru": "⭐ Оставить отзыв",
        "en": "⭐ Leave a review",
    },
    "barber_message": {
        "uz": "💬 <b>{shop}</b> dan xabar:\n\n{message}",
        "ru": "💬 Сообщение от <b>{shop}</b>:\n\n{message}",
        "en": "💬 Message from <b>{shop}</b>:\n\n{message}",
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


async def send_review_request(
    customer_telegram_id: int,
    booking_id: int,
    shop_name: str,
    mini_app_url: str,
    customer_language: str = "uz",
) -> None:
    """After booking completed: send message with 'Leave a review' webapp button."""
    lang = customer_language if customer_language in ("uz", "ru", "en") else "uz"
    text = _MESSAGES["review_request"][lang].format(shop=shop_name)
    btn_text = _MESSAGES["review_btn"][lang]
    review_url = f"{mini_app_url}/review?booking_id={booking_id}"
    url = TELEGRAM_API.format(token=settings.BOT_TOKEN)
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(url, json={
                "chat_id": customer_telegram_id,
                "text": text,
                "parse_mode": "HTML",
                "reply_markup": {
                    "inline_keyboard": [[
                        {"text": btn_text, "web_app": {"url": review_url}},
                    ]]
                },
            })
            if resp.status_code != 200:
                logger.warning("Review request sendMessage failed: %s", resp.text)
    except Exception as e:
        logger.warning("Failed to send review request: %s", e)


async def notify_barber_message(
    customer_telegram_id: int,
    shop_name: str,
    message: str,
    customer_language: str = "uz",
) -> None:
    """Send a free-form message from the barber to the customer."""
    lang = customer_language if customer_language in ("uz", "ru", "en") else "uz"
    text = _MESSAGES["barber_message"][lang].format(shop=shop_name, message=message)
    await _send(customer_telegram_id, text)


async def notify_admin_staff_pending(
    staff_name: str,
    shop_id: int,
    db,
) -> None:
    """Alert all admins that a new staff member is awaiting approval."""
    from sqlalchemy import select
    from app.models.user import User
    from app.models.shop import Shop

    shop_result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = shop_result.scalar_one_or_none()
    shop_name = shop.name if shop else f"shop #{shop_id}"

    admin_result = await db.execute(select(User).where(User.is_admin == True))
    admins = admin_result.scalars().all()
    text = (
        f"👤 <b>Yangi xodim kutilmoqda</b>\n\n"
        f"Ism: {staff_name}\n"
        f"Do'kon: {shop_name}\n\n"
        f"Admin paneldan tasdiqlang yoki rad eting."
    )
    for admin in admins:
        await _send(admin.telegram_id, text)


async def notify_staff_approved(
    staff_telegram_id: int,
    shop_name: str,
    language: str = "uz",
) -> None:
    msgs = {
        "uz": f"✅ Siz <b>{shop_name}</b> jamoasiga qo'shildingiz! Endi ilovani ishlatishingiz mumkin.",
        "ru": f"✅ Вы добавлены в команду <b>{shop_name}</b>! Теперь вы можете пользоваться приложением.",
        "en": f"✅ You have joined <b>{shop_name}</b>! You can now use the app.",
    }
    await _send(staff_telegram_id, msgs.get(language, msgs["uz"]))


async def notify_staff_rejected(
    staff_telegram_id: int,
    shop_name: str,
    language: str = "uz",
) -> None:
    msgs = {
        "uz": f"❌ Afsuski, <b>{shop_name}</b> jamoasiga qo'shilish so'rovingiz rad etildi.",
        "ru": f"❌ К сожалению, ваша заявка на вступление в <b>{shop_name}</b> отклонена.",
        "en": f"❌ Your request to join <b>{shop_name}</b> has been declined.",
    }
    await _send(staff_telegram_id, msgs.get(language, msgs["uz"]))


async def notify_owner_staff_joined(
    owner_telegram_id: int,
    staff_name: str,
    language: str = "uz",
) -> None:
    msgs = {
        "uz": f"🎉 <b>{staff_name}</b> sizning jamoangizga qo'shildi va admin tomonidan tasdiqlandi!",
        "ru": f"🎉 <b>{staff_name}</b> присоединился к вашей команде и одобрен администратором!",
        "en": f"🎉 <b>{staff_name}</b> has joined your team and was approved by admin!",
    }
    await _send(owner_telegram_id, msgs.get(language, msgs["uz"]))


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
