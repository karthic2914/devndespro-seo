# devndespro SEO Tool

Full-stack SEO dashboard with Google Auth, PostgreSQL, and Claude AI.

## Tech Stack
- **Frontend**: React + Vite → deploy on Vercel
- **Backend**: Node.js + Express → deploy on Railway
- **Database**: PostgreSQL → Railway
- **Auth**: Google OAuth 2.0
- **AI**: Claude (Anthropic API)

---

## Step 1 — Google OAuth Setup

1. Go to https://console.cloud.google.com
2. Create a new project → "devndespro-seo"
3. APIs & Services → Credentials → Create OAuth 2.0 Client ID
4. Application type: **Web application**
5. Authorized JavaScript origins:
   - http://localhost:5173
   - https://your-vercel-app.vercel.app (add after deploy)
6. Authorized redirect URIs:
   - http://localhost:5173
7. Copy the **Client ID**

---

## Step 2 — Backend Setup (Local)

```bash
cd backend
npm install
cp .env.example .env
# Fill in your .env values
npm run dev
```

Your backend runs on http://localhost:4000

---

## Step 3 — Frontend Setup (Local)

```bash
cd frontend
npm install
cp .env.example .env
# Add your VITE_GOOGLE_CLIENT_ID
npm run dev
```

Your frontend runs on http://localhost:5173

---

## Step 4 — Get Railway PostgreSQL connection string

1. Go to railway.app → your project
2. Click your PostgreSQL service
3. Connect tab → copy **DATABASE_URL**
4. Paste into backend `.env`

---

## Step 5 — Deploy Backend to Railway

1. Push backend folder to GitHub
2. Railway → New Project → Deploy from GitHub
3. Set all environment variables in Railway dashboard
4. Railway will auto-deploy

---

## Step 6 — Deploy Frontend to Vercel

1. Push frontend folder to GitHub
2. Vercel → New Project → Import
3. Set VITE_GOOGLE_CLIENT_ID environment variable
4. Set VITE_API_URL to your Railway backend URL
5. Update vite.config.js proxy target to Railway URL for production

---

## Environment Variables

### Backend (.env)
| Variable | Description |
|---|---|
| DATABASE_URL | Railway PostgreSQL connection string |
| GOOGLE_CLIENT_ID | Google OAuth Client ID |
| JWT_SECRET | Random secret string for JWT |
| ANTHROPIC_API_KEY | Your Anthropic API key |
| ALLOWED_EMAILS | Comma-separated allowed emails |
| FRONTEND_URL | http://localhost:5173 (local) or Vercel URL |
| PORT | 4000 |

### Frontend (.env)
| Variable | Description |
|---|---|
| VITE_GOOGLE_CLIENT_ID | Same Google OAuth Client ID |

---

## Giving Access to Others

Add their Google email to `ALLOWED_EMAILS` in backend `.env` (or Railway env vars):

```
ALLOWED_EMAILS=hello@devndespro.com,client@example.com,team@company.com
```

If `ALLOWED_EMAILS` is empty, **all** Google accounts can log in.

---

## Project Structure

```
seo-tool/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx      # Sidebar + navigation
│   │   │   └── UI.jsx          # Shared components
│   │   ├── hooks/
│   │   │   └── useAuth.jsx     # Auth context + hook
│   │   ├── pages/
│   │   │   ├── Login.jsx       # Google sign-in
│   │   │   ├── Dashboard.jsx   # Overview + metrics
│   │   │   ├── Keywords.jsx    # Keyword tracker
│   │   │   ├── Backlinks.jsx   # Backlink monitor
│   │   │   ├── Competitors.jsx # Competitor DR tracker
│   │   │   ├── Actions.jsx     # Task manager
│   │   │   └── AiAssistant.jsx # Claude AI chat
│   │   ├── utils/
│   │   │   └── api.js          # Axios instance
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/
│   ├── server.js               # All API routes + DB
│   ├── package.json
│   └── .env.example
└── README.md
```
