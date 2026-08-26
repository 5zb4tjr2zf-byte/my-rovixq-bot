import logging
import os
import sqlite3
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

REFERRAL_BONUS = 0.7  # $ за каждого реферала

DB_PATH = "bot_data.db"

# ---------- База данных ----------

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            balance REAL DEFAULT 0,
            referred_by INTEGER,
            referral_count INTEGER DEFAULT 0,
            credited INTEGER DEFAULT 0
        )
        """
    )
    conn.commit()
    conn.close()


def get_user(user_id: int):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT user_id, balance, referred_by, referral_count, credited FROM users WHERE user_id = ?",
        (user_id,),
    )
    row = cur.fetchone()
    conn.close()
    return row


def create_user(user_id: int, referred_by: int = None):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT OR IGNORE INTO users (user_id, balance, referred_by, referral_count, credited) VALUES (?, 0, ?, 0, 0)",
        (user_id, referred_by),
    )
    conn.commit()
    conn.close()


def mark_credited(user_id: int):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("UPDATE users SET credited = 1 WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()


def credit_referrer(referrer_id: int, amount: float):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "UPDATE users SET balance = balance + ?, referral_count = referral_count + 1 WHERE user_id = ?",
        (amount, referrer_id),
    )
    conn.commit()
    conn.close()


# ---------- Клавиатуры ----------

BALANCE_BUTTON = "💰 Баланс"
INVITE_BUTTON = "🔗 Пригласить друзей"

KEYBOARD = ReplyKeyboardMarkup(
    [[BALANCE_BUTTON, INVITE_BUTTON]],
    resize_keyboard=True,
)

SUBSCRIBE_KEYBOARD = InlineKeyboardMarkup(
    [
        [InlineKeyboardButton("📢 Подписаться на канал", url=CHANNEL_LINK)],
        [InlineKeyboardButton("✅ Я подписался", callback_data="check_subscription")],
    ]
)


async def is_subscribed(user_id: int, context: ContextTypes.DEFAULT_TYPE) -> bool:
    try:
        member = await context.bot.get_chat_member(chat_id=f"@{CHANNEL_USERNAME}", user_id=user_id)
        return member.status in ("member", "administrator", "creator")
    except Exception as e:
        logging.error(f"Ошибка проверки подписки: {e}")
        return False


async def try_credit_referral(user_id: int, context: ContextTypes.DEFAULT_TYPE):
    """Если пользователь подписан и ещё не был засчитан как реферал — начисляем бонус пригласившему."""
    row = get_user(user_id)
    if not row:
        return
    _, _, referred_by, _, credited = row
    if referred_by and not credited:
        if await is_subscribed(user_id, context):
            credit_referrer(referred_by, REFERRAL_BONUS)
            mark_credited(user_id)
            try:
                await context.bot.send_message(
                    chat_id=referred_by,
                    text=(
                        f"🎉 Приглашённый тобой пользователь подписался на канал!\n"
                        f"+{REFERRAL_BONUS}$ на баланс 💰"
                    ),
                )
            except Exception as e:
                logging.error(f"Не удалось уведомить реферера: {e}")


# ---------- Хендлеры ----------

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    existing = get_user(user.id)

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

    if await is_subscribed(user.id, context):
        await try_credit_referral(user.id, context)
        await update.message.reply_text(
            f"Привет, {user.first_name}! 👋\n\n"
            "Приглашай друзей и получай бонусы на баланс за каждого, "
            "кто подпишется на канал по твоей ссылке.",
            reply_markup=KEYBOARD,
        )
    else:
        await update.message.reply_text(
            f"Привет, {user.first_name}! 👋\n\n"
            f"Чтобы пользоваться ботом, подпишись на канал @{CHANNEL_USERNAME}.",
            reply_markup=SUBSCRIBE_KEYBOARD,
        )


async def check_subscription_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user = query.from_user
    await query.answer()

    if await is_subscribed(user.id, context):
        await try_credit_referral(user.id, context)
        await query.edit_message_text("✅ Спасибо за подписку! Теперь бот доступен.")
        await context.bot.send_message(
            chat_id=user.id,
            text="Приглашай друзей и получай бонусы 👇",
            reply_markup=KEYBOARD,
        )
    else:
        await query.answer("Ты ещё не подписался на канал 🙁", show_alert=True)


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    text = update.message.text

    if not get_user(user.id):
        create_user(user.id)

    if not await is_subscribed(user.id, context):
        await update.message.reply_text(
            f"Чтобы пользоваться ботом, подпишись на канал @{CHANNEL_USERNAME}.",
            reply_markup=SUBSCRIBE_KEYBOARD,
        )
        return

    await try_credit_referral(user.id, context)

    if text == BALANCE_BUTTON:
        row = get_user(user.id)
        balance = row[1] if row else 0
        ref_count = row[3] if row else 0
        await update.message.reply_text(
            f"💰 Твой баланс: {balance:.2f}$\n👥 Приглашено друзей: {ref_count}",
            reply_markup=KEYBOARD,
        )
        return

    if text == INVITE_BUTTON:
        link = f"https://t.me/{BOT_USERNAME}?start=ref_{user.id}"
        await update.message.reply_text(
            f"🔗 Твоя реферальная ссылка:\n{link}\n\n"
            f"За каждого друга, который перейдёт по ссылке и подпишется на канал, "
            f"ты получишь {REFERRAL_BONUS}$ на баланс 💰",
            reply_markup=KEYBOARD,
            disable_web_page_preview=True,
        )
        return

    await update.message.reply_text(
        "Используй кнопки снизу 👇",
        reply_markup=KEYBOARD,
    )


def main():
    if not TOKEN:
        raise ValueError("Не найден BOT_TOKEN!")

    init_db()

    app = ApplicationBuilder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(check_subscription_callback, pattern="check_subscription"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("Бот запущен...")
    app.run_polling()


if __name__ == "__main__":
    main()
