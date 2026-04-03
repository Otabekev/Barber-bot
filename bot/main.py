import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from bot.config import load_config
from bot.api_client import BackendClient
from bot.handlers import start, customer, barber

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


async def main():
    config = load_config()
    backend = BackendClient(config)

    bot = Bot(
        token=config.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )

    dp = Dispatcher()

    # Pass shared dependencies into all handlers via middleware data
    dp["backend"] = backend
    dp["mini_app_url"] = config.MINI_APP_URL

    # barber and customer first — start.router has a catch-all that must come last
    dp.include_router(barber.router)
    dp.include_router(customer.router)
    dp.include_router(start.router)

    logger.info("Bot starting...")
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
