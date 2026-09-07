import logging
import os
from telegram import (
    Update,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardMarkup,
    KeyboardButton,
    WebAppInfo,
)
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters,
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)

BOT_TOKEN = os.environ.get("BOT_TOKEN")

CHANNEL_USERNAME = "craftco1n"
CHANNEL_LINK = f"https://t.me/{CHANNEL_USERNAME}"

# Ссылка на мини-приложение (GitHub Pages)
WEBAPP_URL = "https://5zb4tjr2zf-byte.github.io/my-rovixq-bot/"

SUBSCRIBE_KEYBOARD = InlineKeyboardMarkup(
    [
        [InlineKeyboardButton("📢 Подписаться на канал", url=CHANNEL_LINK)],
        [InlineKeyboardButton("✅ Я подписался", callback_data="check_subscription")],
    ]
)

OPEN_APP_KEYBOARD = ReplyKeyboardMarkup(
    [[KeyboardButton("🎮 Открыть игру", web_app=WebAppInfo(url=WEBAPP_URL))]],
    resize_keyboard=True,
)


async def is_subscribed(user_id: int, context: ContextTypes.DEFAULT_TYPE) -> bool:
    try:
        member = await context.bot.get_chat_member(chat_id=f"@{CHANNEL_USERNAME}", user_id=user_id)
        return member.status in ("member", "administrator", "creator")
    except Exception as e:
        logging.error(f"Ошибка проверки подписки: {e}")
        return False


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user

    if await is_subscribed(user.id, context):
        await update.message.reply_text(
            f"Привет, {user.first_name}! 👋\n\n"
            "Добро пожаловать в CraftCoin ⛏️\n"
            "Копай блоки, собирай ресурсы и зарабатывай CC!\n\n"
            "Нажми кнопку ниже, чтобы начать игру 👇",
            reply_markup=OPEN_APP_KEYBOARD,
        )
    else:
        await update.message.reply_text(
            f"Привет, {user.first_name}! 👋\n\n"
            "Добро пожаловать в CraftCoin ⛏️\n\n"
            f"Чтобы пользоваться ботом, подпишись на канал @{CHANNEL_USERNAME}.",
            reply_markup=SUBSCRIBE_KEYBOARD,
        )


async def check_subscription_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user = query.from_user
    await query.answer()

    if await is_subscribed(user.id, context):
        await query.edit_message_text("✅ Спасибо за подписку! Теперь бот доступен.")
        await context.bot.send_message(
            chat_id=user.id,
            text=(
                f"Отлично, {user.first_name}! Всё готово 🎉\n\n"
                "Нажми кнопку ниже, чтобы начать копать 👇"
            ),
            reply_markup=OPEN_APP_KEYBOARD,
        )
    else:
        await query.answer("Ты ещё не подписался на канал 🙁", show_alert=True)


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user

    if not await is_subscribed(user.id, context):
        await update.message.reply_text(
            f"Чтобы пользоваться ботом, подпишись на канал @{CHANNEL_USERNAME}.",
            reply_markup=SUBSCRIBE_KEYBOARD,
        )
        return

    await update.message.reply_text(
        "Используй кнопку ниже, чтобы открыть игру 👇",
        reply_markup=OPEN_APP_KEYBOARD,
    )


def main():
    if not BOT_TOKEN:
        raise ValueError("Не найден BOT_TOKEN!")

    app = ApplicationBuilder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(check_subscription_callback, pattern="check_subscription"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("Бот запущен...")
    app.run_polling()


if __name__ == "__main__":
    main()
