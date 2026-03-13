from src.storage import get_db

if __name__ == "__main__":
    print("Initializing database...")
    db = get_db()
    print("Database initialized successfully.")