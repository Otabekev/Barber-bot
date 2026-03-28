# Barber Shop Telegram Mini App

A full-stack Telegram Mini App for barber shop owners to manage their shop, schedule, and bookings.

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI + async SQLAlchemy + aiosqlite |
| Frontend | React + Vite + Telegram WebApp SDK |
| Auth | Telegram initData → JWT |
| DB | SQLite (swap `DATABASE_URL` for PostgreSQL in prod) |

---

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app + lifespan
│   │   ├── config.py         # Pydantic settings (.env)
│   │   ├── database.py       # Async engine + Base + init_db
│   │   ├── auth.py           # initData validation + JWT
│   │   ├── deps.py           # get_current_user dependency
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic request/response models
│   │   └── routers/          # auth, shops, schedules, bookings, slots
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/client.js     # Axios wrapper for all endpoints
    │   ├── store/useStore.js # Zustand global state
    │   ├── components/       # Layout, BottomNav
    │   └── pages/            # Dashboard, ShopSetup, Schedule, Bookings, BlockSlots
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Quick Start

### 1. Backend

```bash
cd backend

# Create and activate virtualenv
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install deps
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env: set BOT_TOKEN and SECRET_KEY

# Run
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

> **Note:** The Vite dev server proxies `/api` → `http://localhost:8000`, so no CORS issues locally.

---

## API Reference

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/telegram` | Validate initData, return JWT |

### Shop
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/shops/my` | Get owner's shop |
| POST | `/api/shops/` | Create shop |
| PUT | `/api/shops/my` | Update shop |
| GET | `/api/shops/{id}/available-slots?date=YYYY-MM-DD` | Available time slots |

### Schedule
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/schedules/my` | Get weekly schedule |
| PUT | `/api/schedules/my` | Replace full schedule |

### Bookings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bookings/my-shop` | List shop bookings (filterable) |
| POST | `/api/bookings/` | Create booking (customer) |
| PATCH | `/api/bookings/{id}/status` | Update status |
| GET | `/api/bookings/my` | My bookings as customer |

### Slots
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/slots/blocked` | List blocked slots |
| POST | `/api/slots/block` | Block slots |
| POST | `/api/slots/unblock` | Unblock slots |

---

## Auth Flow

```
Frontend                        Backend
   |                               |
   |  window.Telegram.WebApp       |
   |  .initData  ─────────────►    |  HMAC-SHA256 verify with BOT_TOKEN
   |                               |  Upsert User row
   |  ◄── { access_token, user } ──|
   |                               |
   |  Authorization: Bearer <jwt>  |
   |  ──────────────────────────►  |  Decode JWT → telegram_id → User
```

---

## Deployment

### Backend (example with Render / Railway)
- Set `BOT_TOKEN`, `SECRET_KEY`, `DATABASE_URL` env vars
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- For production use PostgreSQL: `DATABASE_URL=postgresql+asyncpg://...`

### Frontend
- Build: `npm run build` → static files in `dist/`
- Set `VITE_API_URL=https://your-backend.com/api` in build env
- Deploy `dist/` to any static host (Vercel, Netlify, Cloudflare Pages)

### Telegram Bot Setup
1. Create a bot with @BotFather
2. Set the Web App URL: `/setmenubutton` or via inline keyboard
3. Use your deployed frontend URL as the Mini App URL

---

## Database Models

```
User          telegram_id (unique), full_name, language, is_admin
Shop          owner_id→User, name, city, address, phone, slot_duration, is_approved, is_active
WorkSchedule  shop_id→Shop, day_of_week (0-6), open_time, close_time, is_working
Booking       customer_id→User, shop_id→Shop, booking_date, time_slot, status, customer_name, customer_phone
BlockedSlot   shop_id→Shop, block_date, time_slot
```
