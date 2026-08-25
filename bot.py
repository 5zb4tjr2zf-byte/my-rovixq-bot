import logging
import os
import requests
from telegram import Update, ReplyKeyboardMarkup, InlineKeyboardMarkup, InlineKeyboardButton
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

TOKEN = os.environ.get("BOT_TOKEN")

# Канал, підписку на який перевіряємо (без @ для API-виклику)
CHANNEL_USERNAME = "rxchanel"
CHANNEL_LINK = f"https://t.me/{CHANNEL_USERNAME}"

# Відповідність кнопок і ID монет на CoinGecko
COINS = {
    "₿ Bitcoin": {"id": "bitcoin", "name": "Bitcoin (BTC)", "emoji": "₿"},
    "Ξ Ethereum": {"id": "ethereum", "name": "Ethereum (ETH)", "emoji": "Ξ"},
    "💎 Toncoin": {"id": "the-open-network", "name": "Toncoin (TON)", "emoji": "💎"},
    "◎ Solana": {"id": "solana", "name": "Solana (SOL)", "emoji": "◎"},
}

ALL_BUTTON = "📊 Всі монети"

keys = list(COINS.keys())
KEYBOARD = ReplyKeyboardMarkup(
    [
        [keys[0], keys[1]],
        [keys[2], keys[3]],
        [ALL_BUTTON],
    ],
    resize_keyboard=True,
)

SUBSCRIBE_KEYBOARD = InlineKeyboardMarkup(
    [
        [InlineKeyboardButton("📢 Підписатись на канал", url=CHANNEL_LINK)],
        [InlineKeyboardButton("✅ Я підписався", callback_data="check_subscription")],
    ]
)


async def is_subscribed(user_id: int, context: ContextTypes.DEFAULT_TYPE) -> bool:
    try:
        member = await context.bot.get_chat_member(
            chat_id=f"@{CHANNEL_USERNAME}", user_id=user_id
        )
        return member.status in ("member", "administrator", "creator")
    except Exception as e:
        logging.error(f"Помилка перевірки підписки: {e}")
        return False


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if await is_subscribed(user.id, context):
        await update.message.reply_text(
            f"Привіт, {user.first_name}! 👋\n"
            "Обери монету кнопкою знизу, щоб дізнатись ціну 👇",
            reply_markup=KEYBOARD,
        )
    else:
        await update.message.reply_text(
            f"Привіт, {user.first_name}! 👋\n\n"
            f"Щоб користуватись ботом, спочатку підпишись на канал @{CHANNEL_USERNAME}.",
            reply_markup=SUBSCRIBE_KEYBOARD,
        )


async def check_subscription_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user = query.from_user
    await query.answer()

    if await is_subscribed(user.id, context):
        await query.edit_message_text("✅ Дякую за підписку! Тепер бот доступний.")
        await context.bot.send_message(
            chat_id=user.id,
            text="Обери монету кнопкою знизу, щоб дізнатись ціну 👇",
            reply_markup=KEYBOARD,
        )
    else:
        await query.answer("Ти ще не підписався на канал 🙁", show_alert=True)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not await is_subscribed(user.id, context):
        await update.message.reply_text(
            f"Щоб користуватись ботом, підпишись на канал @{CHANNEL_USERNAME}.",
            reply_markup=SUBSCRIBE_KEYBOARD,
        )
        return
    await update.message.reply_text(
        "Натисни кнопку внизу, щоб дізнатись ціну монети, або обери «Всі монети».",
        reply_markup=KEYBOARD,
    )


def format_coin(name: str, emoji: str, coin_id: str, data: dict) -> str:
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


def get_prices(coin_ids: list) -> dict:
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


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    text = update.message.text

    # Перевірка підписки перед будь-якою дією бота
    if not await is_subscribed(user.id, context):
        await update.message.reply_text(
            f"Щоб користуватись ботом, підпишись на канал @{CHANNEL_USERNAME}.",
            reply_markup=SUBSCRIBE_KEYBOARD,
        )
        return

    # Одна конкретна монета
    if text in COINS:
        coin = COINS[text]
        try:
            data = get_prices([coin["id"]])
            reply = format_coin(coin["name"], coin["emoji"], coin["id"], data)
            await update.message.reply_text(reply, parse_mode="Markdown", reply_markup=KEYBOARD)
        except Exception as e:
            logging.error(f"Помилка отримання ціни: {e}")
            await update.message.reply_text(
                "Не вдалось отримати ціну 😕 Спробуй ще раз трохи пізніше.",
                reply_markup=KEYBOARD,
            )
        return

    # Всі монети одразу
    if text == ALL_BUTTON:
        try:
            coin_ids = [c["id"] for c in COINS.values()]
            data = get_prices(coin_ids)
            parts = [
                format_coin(c["name"], c["emoji"], c["id"], data)
                for c in COINS.values()
            ]
            reply = "\n\n".join(parts)
            await update.message.reply_text(reply, parse_mode="Markdown", reply_markup=KEYBOARD)
        except Exception as e:
            logging.error(f"Помилка отримання цін: {e}")
            await update.message.reply_text(
                "Не вдалось отримати ціни 😕 Спробуй ще раз трохи пізніше.",
                reply_markup=KEYBOARD,
            )
        return

    # Будь-який інший текст
    await update.message.reply_text(f"Ти написав: {text}", reply_markup=KEYBOARD)


def main():
    if not TOKEN:
        raise ValueError(
            "Не знайдено BOT_TOKEN! Додай змінну середовища BOT_TOKEN зі своїм токеном від @BotFather."
        )

    app = ApplicationBuilder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CallbackQueryHandler(check_subscription_callback, pattern="check_subscription"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("Бот запущено... Натисни Ctrl+C щоб зупинити.")
    app.run_polling()


if __name__ == "__main__":
    main()
