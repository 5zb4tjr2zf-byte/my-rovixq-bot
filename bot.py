import logging
import os
from telegram import Update
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)

TOKEN = os.environ.get("BOT_TOKEN")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    await update.message.reply_text(
        f"Привіт, {user.first_name}! 👋\n"
        "Я простий бот. Напиши мені щось, і я відповім тим самим повідомленням.\n\n"
        "Команди:\n"
        "/start — почати\n"
        "/help — допомога"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Просто напиши мені будь-який текст — я його повторю. "
        "Це базовий шаблон, який можна розширювати."
    )


async def echo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    await update.message.reply_text(f"Ти написав: {text}")


def main():
    if not TOKEN:
        raise ValueError(
            "Не знайдено BOT_TOKEN! Додай змінну середовища BOT_TOKEN зі своїм токеном від @BotFather."
        )

    app = ApplicationBuilder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, echo))

    print("Бот запущено... Натисни Ctrl+C щоб зупинити.")
    app.run_polling()


if __name__ == "__main__":
    main()
