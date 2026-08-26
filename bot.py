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

REFERRAL_BONUS = 0.3  # $ за каждого реферала
MIN_WITHDRAW = 3.0    # минимальная сумма вывода

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


def subtract_balance(user_id: int, amount: float):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("UPDATE users SET balance = balance - ? WHERE user_id = ?", (amount, user_id))
    conn.commit()
    conn.close()


def save_withdrawal(user_id: int, amount: float, method: str, details: str):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS withdrawals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount REAL,
            method TEXT,
            details TEXT,
            status TEXT DEFAULT 'pending'
        )
        """
    )
    cur.execute(
        "INSERT INTO withdrawals (user_id, amount, method, details) VALUES (?, ?, ?, ?)",
        (user_id, amount, method, details),
    )
    conn.commit()
    conn.close()


# ---------- Клавиатуры ----------

BALANCE_BUTTON = "💰 Баланс"
INVITE_BUTTON = "🔗 Пригласить друзей"
WITHDRAW_BUTTON = "💸 Вывод"
CANCEL_BUTTON = "❌ Отмена"

KEYBOARD = ReplyKeyboardMarkup(
    [[BALANCE_BUTTON, INVITE_BUTTON], [WITHDRAW_BUTTON]],
    resize_keyboard=True,
)

CANCEL_KEYBOARD = ReplyKeyboardMarkup(
    [[CANCEL_BUTTON]],
    resize_keyboard=True,
)

SUBSCRIBE_KEYBOARD = InlineKeyboardMarkup(
    [
        [InlineKeyboardButton("📢 Подписаться на канал", url=CHANNEL_LINK)],
        [InlineKeyboardButton("✅ Я подписался", callback_data="check_subscription")],
    ]
)

METHOD_KEYBOARD = InlineKeyboardMarkup(
    [
        [InlineKeyboardButton("💳 Карта (Украина)", callback_data="method_card")],
        [InlineKeyboardButton("🪙 Крипта", callback_data="method_crypto")],
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


async def method_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user = query.from_user
    await query.answer()

    method = "Карта (Украина)" if query.data == "method_card" else "Крипта"
    context.user_data["withdraw_method"] = method
    context.user_data["awaiting_withdraw_details"] = True

    if method == "Карта (Украина)":
        prompt = "Введи номер карты для вывода:"
    else:
        prompt = "Введи адрес крипто-кошелька для вывода:"

    await query.edit_message_text(f"Способ оплаты: {method}\n\n{prompt}")


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

    # --- Отмена на любом этапе вывода ---
    if text == CANCEL_BUTTON:
        context.user_data.clear()
        await update.message.reply_text("Отменено.", reply_markup=KEYBOARD)
        return

    # --- Шаг 1: ждём сумму вывода ---
    if context.user_data.get("awaiting_withdraw_amount"):
        row = get_user(user.id)
        balance = row[1] if row else 0
        try:
            amount = float(text.replace(",", ".").replace("$", "").strip())
        except ValueError:
            await update.message.reply_text(
                "Введи сумму числом, например: 5 или 10.5",
                reply_markup=CANCEL_KEYBOARD,
            )
            return

        if amount < MIN_WITHDRAW:
            await update.message.reply_text(
                f"Минимальная сумма вывода — {MIN_WITHDRAW}$. Введи другую сумму:",
                reply_markup=CANCEL_KEYBOARD,
            )
            return

        if amount > balance:
            await update.message.reply_text(
                f"На балансе только {balance:.2f}$. Введи сумму не больше этой:",
                reply_markup=CANCEL_KEYBOARD,
            )
            return

        context.user_data["awaiting_withdraw_amount"] = False
        context.user_data["withdraw_amount"] = amount
        await update.message.reply_text(
            "Выбери способ оплаты:",
            reply_markup=METHOD_KEYBOARD,
        )
        return

    # --- Шаг 3: ждём реквизиты (карта/кошелёк) ---
    if context.user_data.get("awaiting_withdraw_details"):
        amount = context.user_data.get("withdraw_amount")
        method = context.user_data.get("withdraw_method")
        details = text.strip()

        subtract_balance(user.id, amount)
        save_withdrawal(user.id, amount, method, details)
        context.user_data.clear()

        await update.message.reply_text(
            f"✅ Заявка на вывод создана!\n\n"
            f"Сумма: {amount:.2f}$\n"
            f"Способ: {method}\n"
            f"Реквизиты: {details}\n\n"
            f"Заявка в обработке.",
            reply_markup=KEYBOARD,
        )
        return

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

    if text == WITHDRAW_BUTTON:
        row = get_user(user.id)
        balance = row[1] if row else 0
        if balance < MIN_WITHDRAW:
            await update.message.reply_text(
                f"Минимальная сумма вывода — {MIN_WITHDRAW}$.\n"
                f"Твой баланс: {balance:.2f}$. Пригласи ещё друзей 👥",
                reply_markup=KEYBOARD,
            )
            return

        context.user_data["awaiting_withdraw_amount"] = True
        await update.message.reply_text(
            f"Твой баланс: {balance:.2f}$\n"
            f"Введи сумму для вывода (минимум {MIN_WITHDRAW}$):",
            reply_markup=CANCEL_KEYBOARD,
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
    app.add_handler(CallbackQueryHandler(method_callback, pattern="^method_"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("Бот запущен...")
    app.run_polling()


if __name__ == "__main__":
    main()
