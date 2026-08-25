import logging
import os
import requests
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
        "/help — допомога\n"
        "/btc — поточна ціна біткоїна"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Напиши /btc, щоб дізнатись поточну ціну біткоїна.\n"
        "Або просто напиши будь-який текст — я його повторю."
    )


async def btc_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        response = requests.get(
            "https://api.coingecko.com/api/v3/simple/price",
            params={
                "ids": "bitcoin",
                "vs_currencies": "usd,uah",
                "include_24hr_change": "true",
            },
            timeout=10,
        )
        data = response.json()
        usd = data["bitcoin"]["usd"]
        uah = data["bitcoin"]["uah"]
        change = data["bitcoin"]["usd_24h_change"]

        arrow = "🟢📈" if change >= 0 else "🔴📉"

        text = (
            "₿ *Bitcoin (BTC)*\n\n"
            f"💵 {usd:,.0f} USD\n"
            f"💴 {uah:,.0f} UAH\n"
            f"{arrow} {change:+.2f}% за 24 год"
        )
        await update.message.reply_text(text, parse_mode="Markdown")
    except Exception as e:
        logging.error(f"Помилка отримання ціни BTC: {e}")
        await update.message.reply_text(
            "Не вдалось отримати ціну біткоїна 😕 Спробуй ще раз трохи пізніше."
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
    app.add_handler(CommandHandler("btc", btc_price))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, echo))

    print("Бот запущено... Натисни Ctrl+C щоб зупинити.")
    app.run_polling()


if __name__ == "__main__":
    main()
