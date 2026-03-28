# Deploy to Railway (3 services + PostgreSQL)

## One-time setup

### 1. Push code to GitHub
```bash
git init
git add .
git commit -m "initial commit"
gh repo create barber-bot --public --push
```

### 2. Create Railway project
1. Go to railway.app → New Project → Deploy from GitHub repo
2. Select your repo

### 3. Add PostgreSQL
- In Railway dashboard → click your project → **+ New** → **Database** → **PostgreSQL**
- Railway automatically sets `DATABASE_URL` env var on all services

### 4. Set environment variables

**backend service:**
| Variable | Value |
|---|---|
| `BOT_TOKEN` | Your bot token from @BotFather |
| `SECRET_KEY` | Random 32+ char string |
| `BOT_SECRET` | Random 32+ char string (same value in bot service) |
| `MINI_APP_URL` | Your frontend Railway URL (set after frontend deploys) |
| `DEV_MODE` | `false` |

**bot service:**
| Variable | Value |
|---|---|
| `BOT_TOKEN` | Same as backend |
| `BACKEND_URL` | Your backend Railway URL (e.g. `https://backend.up.railway.app`) |
| `BOT_SECRET` | Same as backend |
| `MINI_APP_URL` | Your frontend Railway URL |

**frontend service:**
| Variable | Value |
|---|---|
| `VITE_API_URL` | Your backend Railway URL + `/api` (e.g. `https://backend.up.railway.app/api`) |

### 5. Configure Telegram bot
1. Open @BotFather → your bot → **Edit Bot** → **Bot Menu Button** (or use inline keyboard)
2. Set Web App URL to your **frontend Railway URL**
3. Done — the bot now opens the Mini App

---

## Local dev with Docker Compose

```bash
# 1. Copy and fill env file
cp backend/.env.example .env
# Edit .env: set BOT_TOKEN, SECRET_KEY, BOT_SECRET

# 2. Start everything
docker-compose --env-file .env up --build

# Frontend: http://localhost
# Backend:  http://localhost:8000
# Docs:     http://localhost:8000/docs
```

## Local dev without Docker (faster)

**Backend:**
```bash
cd backend
python -m venv .venv
.venv/Scripts/activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Bot:**
```bash
cd bot
pip install -r requirements.txt
BOT_TOKEN=xxx BACKEND_URL=http://localhost:8000 BOT_SECRET=xxx MINI_APP_URL=http://localhost:5173 python -m bot.main
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Make yourself admin

After first login via Telegram, run this SQL on your DB:

```sql
UPDATE users SET is_admin = true WHERE telegram_id = YOUR_TELEGRAM_ID;
```

On Railway: open PostgreSQL service → **Query** tab → paste and run.
