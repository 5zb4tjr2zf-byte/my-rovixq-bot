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

# Відповідність команд і ID монет на CoinGecko
COINS = {
    "btc": {"id": "bitcoin", "name": "Bitcoin (BTC)", "emoji": "₿"},
    "eth": {"id": "ethereum", "name": "Ethereum (ETH)", "emoji": "Ξ"},
    "ton": {"id": "the-open-network", "name": "Toncoin (TON)", "emoji": "💎"},
    "sol": {"id": "solana", "name": "Solana (SOL)", "emoji": "◎"},
}


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    await update.message.reply_text(
        f"Привіт, {user.first_name}! 👋\n"
        "Я простий бот. Напиши мені щось, і я відповім тим самим повідомленням.\n\n"
        "Команди:\n"
        "/start — почати\n"
        "/help — допомога\n"
        "/btc — ціна Bitcoin\n"
        "/eth — ціна Ethereum\n"
        "/ton — ціна Toncoin\n"
        "/sol — ціна Solana\n"
        "/crypto — всі монети одразу"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Напиши /btc, /eth, /ton або /sol, щоб дізнатись ціну конкретної монети.\n"
        "Або /crypto, щоб побачити всі одразу.\n"
        "Просто текст — я його повторю."
    )


def format_coin(coin_id: str, name: str, emoji: str, data: dict) -> str:
    usd = data[coin_id]["usd"]
    uah = data[coin_id]["uah"]
    change = data[coin_id]["usd_24h_change"]
    arrow = "🟢📈" if change >= 0 else "🔴📉"

    if usd >= 1:
        usd_str = f"{usd:,.2f}"
        uah_str = f"{uah:,.2f}"
    else:
        usd_str = f"{usd:.6f}"
        uah_str = f"{uah:.6f}"

    return (
        f"{emoji} *{name}*\n"
        f"💵 {usd_str} USD\n"
        f"💴 {uah_str} UAH\n"
        f"{arrow} {change:+.2f}% за 24 год"
    )


async def get_prices(coin_ids: list) -> dict:
    response = requests.get(
        "https://api.coingecko.com/api/v3/simple/price",
        params={
            "ids": ",".join(coin_ids),
            "vs_currencies": "usd,uah",
            "include_24hr_change": "true",
        },
        timeout=10,
    )
    return response.json()


async def coin_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    command = update.message.text.replace("/", "").split("@")[0].lower()
    coin = COINS.get(command)
    if not coin:
        return

    try:
        data = await get_prices([coin["id"]])
        text = format_coin(coin["id"], coin["name"], coin["emoji"], data)
        await update.message.reply_text(text, parse_mode="Markdown")
    except Exception as e:
        logging.error(f"Помилка отримання ціни {command}: {e}")
        await update.message.reply_text(
            "Не вдалось отримати ціну 😕 Спробуй ще раз трохи пізніше."
        )


async def crypto_all(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        coin_ids = [c["id"] for c in COINS.values()]
        data = await get_prices(coin_ids)

        parts = []
        for coin in COINS.values():
            parts.append(format_coin(coin["id"], coin["name"], coin["emoji"], data))

        text = "\n\n".join(parts)
        await update.message.reply_text(text, parse_mode="Markdown")
    except Exception as e:
        logging.error(f"Помилка отримання цін: {e}")
        await update.message.reply_text(
            "Не вдалось отримати ціни 😕 Спробуй ще раз трохи пізніше."
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
    app.add_handler(CommandHandler("btc", coin_price))
    app.add_handler(CommandHandler("eth", coin_price))
    app.add_handler(CommandHandler("ton", coin_price))
    app.add_handler(CommandHandler("sol", coin_price))
    app.add_handler(CommandHandler("crypto", crypto_all))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, echo))

    print("Бот запущено... Натисни Ctrl+C щоб зупинити.")
    app.run_polling()


if __name__ == "__main__":
    main()
