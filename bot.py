import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

import config
from data.storage import init_db
from handlers import start, order, catalog, delivery, shops, contact

logging.basicConfig(level=logging.INFO)


async def main():
    init_db()

    bot = Bot(
        token=config.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher(storage=MemoryStorage())

    # Порядок підключення роутерів важливий:
    # 1) start — щоб "🏠 Головне меню" працювало навіть посеред замовлення;
    # 2) order — щоб під час FSM-кроків оформлення замовлення бот
    #    не плутав текст користувача з натисканням кнопок меню;
    # 3) решта — звичайні розділи меню.
    dp.include_router(start.router)
    dp.include_router(order.router)
    dp.include_router(catalog.router)
    dp.include_router(delivery.router)
    dp.include_router(shops.router)
    dp.include_router(contact.router)

    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
