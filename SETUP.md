# Budget App — Setup & Deploy Guide

---

## Part 1 — Google Sheets credentials (one-time, ~10 min)

### 1. Create a Google Cloud service account

1. Go to https://console.cloud.google.com/
2. **Select a project** → **New Project** → name it "Budget App" → Create
3. Left menu → **APIs & Services** → **Library** → search **Google Sheets API** → Enable
4. Left menu → **APIs & Services** → **Credentials** → **Create Credentials** → **Service Account**
5. Name: "budget-app" → Done
6. Click the service account email in the list → **Keys** tab → **Add Key** → **Create new key** → **JSON** → Create
7. A file downloads — save it as `backend/credentials.json`

### 2. Create and share a Google Sheet

1. Go to https://sheets.google.com → create a **blank** spreadsheet → name it "Budget Tracker"
2. Copy the **Spreadsheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/ *** THIS PART *** /edit`
3. Open `backend/credentials.json`, find the `"client_email"` value, copy it
4. In your Google Sheet → **Share** → paste the service account email → **Editor** → Share

---

## Part 2 — Local development (PC only)

Create `backend/.env`:
```
SPREADSHEET_ID=paste_your_id_here
GOOGLE_CREDENTIALS_JSON=   ← leave blank for local (uses credentials.json file)
```

Run in **two separate terminals**:

```
# Terminal 1 — API
cd D:\Claude\budget-app
node api/index.js

# Terminal 2 — Frontend
cd D:\Claude\budget-app\frontend
npm run dev
```

Open http://localhost:5173 — or the **Network** URL Vite prints for phone access on same WiFi.

---

## Part 3 — Deploy to Vercel (no PC required, free)

### 1. Push to GitHub

```bash
cd D:\Claude\budget-app
git init
git add .
git commit -m "Initial budget app"
```

Go to https://github.com/new → create a repo → then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/budget-app.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to https://vercel.com → sign up / log in with GitHub
2. **Add New Project** → select your `budget-app` repo → **Import**
3. Vercel auto-detects the settings from `vercel.json` — don't change anything
4. Before clicking Deploy, add **Environment Variables**:

| Name | Value |
|------|-------|
| `SPREADSHEET_ID` | your spreadsheet ID |
| `GOOGLE_CREDENTIALS_JSON` | *(paste the entire contents of `credentials.json`)* |

5. Click **Deploy** — done!

Your app will be live at `https://budget-app-xyz.vercel.app` (or a custom domain).

### 3. Every future update

Just push to GitHub — Vercel redeploys automatically:

```bash
git add .
git commit -m "update something"
git push
```

---

## How it all fits together

```
Your phone / PC / any browser
        ↓
https://your-app.vercel.app
        ↓
Vercel (frontend: React)  +  Vercel Serverless API
                                     ↓
                            Google Sheets (your data)
```

No PC needs to be on. Data is always in Google Sheets — open the sheet yourself anytime to see/edit raw data.
