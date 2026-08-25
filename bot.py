import logging
import os
import sqlite3
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
BOT_USERNAME = "rovixq_bot"

CHANNEL_USERNAME = "rxchanel"
CHANNEL_LINK = f"https://t.me/{CHANNEL_USERNAME}"

REFERRAL_BONUS = 0.7  # $ за кожного реферала

DB_PATH = "bot_data.db"

# ---------- База даних ----------

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            balance REAL DEFAULT 0,
            referred_by INTEGER,
            referral_count INTEGER DEFAULT 0
        )
        """
    )
    conn.commit()
    conn.close()


def get_user(user_id: int):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT user_id, balance, referred_by, referral_count FROM users WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()
    return row


def create_user(user_id: int, referred_by: int = None):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT OR IGNORE INTO users (user_id, balance, referred_by, referral_count) VALUES (?, 0, ?, 0)",
        (user_id, referred_by),
    )
    conn.commit()
    conn.close()


def add_balance_and_referral(user_id: int, amount: float):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "UPDATE users SET balance = balance + ?, referral_count = referral_count + 1 WHERE user_id = ?",
        (amount, user_id),
    )
    conn.commit()
    conn.close()


# ---------- Клавіатури ----------

COINS = {
    "₿ Bitcoin": {"id": "bitcoin", "name": "Bitcoin (BTC)", "emoji": "₿"},
    "Ξ Ethereum": {"id": "ethereum", "name": "Ethereum (ETH)", "emoji": "Ξ"},
    "💎 Toncoin": {"id": "the-open-network", "name": "Toncoin (TON)", "emoji": "💎"},
    "◎ Solana": {"id": "solana", "name": "Solana (SOL)", "emoji": "◎"},
}
ALL_BUTTON = "📊 Всі монети"
BALANCE_BUTTON = "💰 Баланс"
INVITE_BUTTON = "🔗 Запросити друзів"

keys = list(COINS.keys())
KEYBOARD = ReplyKeyboardMarkup(
    [
        [keys[0], keys[1]],
        [keys[2], keys[3]],
        [ALL_BUTTON],
        [BALANCE_BUTTON, INVITE_BUTTON],
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
        member = await context.bot.get_chat_member(chat_id=f"@{CHANNEL_USERNAME}", user_id=user_id)
        return member.status in ("member", "administrator", "creator")
    except Exception as e:
        logging.error(f"Помилка перевірки підписки: {e}")
        return False


# ---------- Хендлери ----------

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    existing = get_user(user.id)

    # Якщо це новий користувач — перевіряємо, чи прийшов за рефералкою
    if not existing:
        referred_by = None
        if context.args:
            param = context.args[0]
            if param.startswith("ref_"):
                try:
                    ref_id = int(param.replace("ref_", ""))
                    if ref_id != user.id:
                        referred_by = ref_id
                except ValueError:
                    pass
        create_user(user.id, referred_by)

        # Нараховуємо бонус рефереру одразу при першому запуску
        if referred_by:
            referrer = get_user(referred_by)
            if referrer:
                add_balance_and_referral(referred_by, REFERRAL_BONUS)
                try:
                    await context.bot.send_message(
                        chat_id=referred_by,
                        text=(
                            f"🎉 За твоїм посиланням приєднався новий користувач!\n"
                            f"+{REFERRAL_BONUS}$ на баланс 💰"
                        ),
                    )
                except Exception as e:
                    logging.error(f"Не вдалось сповістити реферера: {e}")

    if await is_subscribed(user.id, context):
        await update.message.reply_text(
            f"Привіт, {user.first_name}! 👋\nОбери монету кнопкою знизу 👇",
            reply_markup=KEYBOARD,
        )
    else:
        await update.message.reply_text(
            f"Привіт, {user.first_name}! 👋\n\n"
            f"Щоб користуватись ботом, підпишись на канал @{CHANNEL_USERNAME}.",
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
            text="Обери монету кнопкою знизу 👇",
            reply_markup=KEYBOARD,
        )
    else:
        await query.answer("Ти ще не підписався на канал 🙁", show_alert=True)


def format_coin(name: str, emoji: str, coin_id: str, data: dict) -> str:
    usd = data[coin_id]["usd"]
    uah = data[coin_id]["uah"]
    change = data[coin_id]["usd_24h_change"]
    arrow = "🟢📈" if change >= 0 else "🔴📉"
    if usd >= 1:
        usd_str, uah_str = f"{usd:,.2f}", f"{uah:,.2f}"
    else:
        usd_str, uah_str = f"{usd:.6f}", f"{uah:.6f}"
    return f"{emoji} *{name}*\n💵 {usd_str} USD\n💴 {uah_str} UAH\n{arrow} {change:+.2f}% за 24 год"


def get_prices(coin_ids: list) -> dict:
    response = requests.get(
        "https://api.coingecko.com/api/v3/simple/price",
        params={"ids": ",".join(coin_ids), "vs_currencies": "usd,uah", "include_24hr_change": "true"},
        timeout=10,
    )
    return response.json()


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    text = update.message.text

    if not get_user(user.id):
        create_user(user.id)

    if not await is_subscribed(user.id, context):
        await update.message.reply_text(
            f"Щоб користуватись ботом, підпишись на канал @{CHANNEL_USERNAME}.",
            reply_markup=SUBSCRIBE_KEYBOARD,
        )
        return

    if text in COINS:
        coin = COINS[text]
        try:
            data = get_prices([coin["id"]])
            reply = format_coin(coin["name"], coin["emoji"], coin["id"], data)
            await update.message.reply_text(reply, parse_mode="Markdown", reply_markup=KEYBOARD)
        except Exception as e:
            logging.error(f"Помилка отримання ціни: {e}")
            await update.message.reply_text("Не вдалось отримати ціну 😕", reply_markup=KEYBOARD)
        return

    if text == ALL_BUTTON:
        try:
            coin_ids = [c["id"] for c in COINS.values()]
            data = get_prices(coin_ids)
            parts = [format_coin(c["name"], c["emoji"], c["id"], data) for c in COINS.values()]
            await update.message.reply_text("\n\n".join(parts), parse_mode="Markdown", reply_markup=KEYBOARD)
        except Exception as e:
            logging.error(f"Помилка отримання цін: {e}")
            await update.message.reply_text("Не вдалось отримати ціни 😕", reply_markup=KEYBOARD)
        return

    if text == BALANCE_BUTTON:
        row = get_user(user.id)
        balance = row[1] if row else 0
        ref_count = row[3] if row else 0
        await update.message.reply_text(
            f"💰 Твій баланс: *{balance:.2f}$*\n👥 Запрошено друзів: *{ref_count}*",
            parse_mode="Markdown",
            reply_markup=KEYBOARD,
        )
        return

    if text == INVITE_BUTTON:
        link = f"https://t.me/{BOT_USERNAME}?start=ref_{user.id}"
        await update.message.reply_text(
            f"🔗 Твоє реферальне посилання:\n{link}\n\n"
            f"За кожного друга, який запустить бота за цим посиланням, "
            f"ти отримаєш {REFERRAL_BONUS}$ на баланс 💰",
            reply_markup=KEYBOARD,
            disable_web_page_preview=True,
        )
        return

    await update.message.reply_text(f"Ти написав: {text}", reply_markup=KEYBOARD)


def main():
    if not TOKEN:
        raise ValueError("Не знайдено BOT_TOKEN!")

    init_db()

    app = ApplicationBuilder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(check_subscription_callback, pattern="check_subscription"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("Бот запущено...")
    app.run_polling()


if __name__ == "__main__":
    main()
