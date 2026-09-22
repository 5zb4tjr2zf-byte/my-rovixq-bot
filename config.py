import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID")
MANAGER_USERNAME = os.getenv("MANAGER_USERNAME", "flowers_manager")

if not BOT_TOKEN:
    raise ValueError(
        "BOT_TOKEN не знайдено. Створіть файл .env на основі .env.example "
        "і вставте туди токен, отриманий від @BotFather."
    )
