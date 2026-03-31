"""Database connection and shared state."""
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'medscribe_db')]

# Directories
UPLOAD_DIR = ROOT_DIR / "uploads"
ENCRYPTED_DIR = ROOT_DIR / "encrypted_storage"
UPLOAD_DIR.mkdir(exist_ok=True)
ENCRYPTED_DIR.mkdir(exist_ok=True)
