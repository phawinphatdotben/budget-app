require("dotenv").config({ path: require("path").join(__dirname, "../backend/.env") });

const express = require("express");
const { google } = require("googleapis");
const path = require("path");

const app = express();
app.use(express.json());

// ── Google Sheets config ────────────────────────────────────────────────────
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const TX_SHEET = "transactions";
const SET_SHEET = "budget_settings";

if (!SPREADSHEET_ID) {
  console.error("[ERROR] SPREADSHEET_ID not set. Check .env or Vercel env vars.");
}

function makeAuth() {
  // Production: credentials stored as JSON string in env var
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  // Local dev: credentials.json file
  return new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, "../backend/credentials.json"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

let _sheets;
async function getSheets() {
  if (!_sheets) _sheets = google.sheets({ version: "v4", auth: makeAuth() });
  return _sheets;
}

// ── Sheet init (runs once per cold start) ──────────────────────────────────
let _initDone = false;
async function ensureInit() {
  if (_initDone) return;
  const s = await getSheets();
  const info = await s.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = info.data.sheets.map((sh) => sh.properties.title);
  const toAdd = [];
  if (!existing.includes(TX_SHEET)) toAdd.push({ addSheet: { properties: { title: TX_SHEET } } });
  if (!existing.includes(SET_SHEET)) toAdd.push({ addSheet: { properties: { title: SET_SHEET } } });
  if (toAdd.length) {
    await s.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: toAdd } });
  }

  const txHead = await readRange(`${TX_SHEET}!A1:F1`);
  if (!txHead.length) {
    await writeRange(`${TX_SHEET}!A1:F1`, [["id", "description", "amount", "category", "created_at", "person"]]);
  } else if (!txHead[0][5]) {
    // Add person column to existing sheet
    await writeRange(`${TX_SHEET}!F1`, [["person"]]);
  }

  const setRows = await readRange(`${SET_SHEET}!A1:B2`);
  if (!setRows.length)
    await writeRange(`${SET_SHEET}!A1:B2`, [["monthly_limit", "warn_at_percent"], ["1000", "80"]]);
  else if (setRows.length === 1)
    await writeRange(`${SET_SHEET}!A2:B2`, [["1000", "80"]]);

  _initDone = true;
}

// ── Low-level sheet helpers ─────────────────────────────────────────────────
async function readRange(range) {
  const s = await getSheets();
  const res = await s.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  return res.data.values || [];
}

async function writeRange(range, values) {
  const s = await getSheets();
  await s.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID, range,
    valueInputOption: "RAW", requestBody: { values },
  });
}

async function appendRow(sheet, values) {
  const s = await getSheets();
  await s.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID, range: `${sheet}!A1`,
    valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

async function deleteSheetRow(sheet, zeroBasedRowIndex) {
  const s = await getSheets();
  const info = await s.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetId = info.data.sheets.find((sh) => sh.properties.title === sheet)?.properties.sheetId;
  await s.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: zeroBasedRowIndex, endIndex: zeroBasedRowIndex + 1 },
        },
      }],
    },
  });
}

// ── Domain helpers ──────────────────────────────────────────────────────────
function rowToTx([id, description, amount, category, created_at, person]) {
  return { id, description, amount: parseFloat(amount), category, created_at, person: person || "Unknown" };
}

async function getAllTx() {
  const rows = await readRange(`${TX_SHEET}!A2:E`);
  return rows.map(rowToTx);
}

async function getSettings() {
  const rows = await readRange(`${SET_SHEET}!A2:B2`);
  if (!rows.length) return { monthly_limit: 1000, warn_at_percent: 80 };
  return { monthly_limit: parseFloat(rows[0][0]) || 1000, warn_at_percent: parseInt(rows[0][1]) || 80 };
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

async function buildStatus(settings, txList) {
  const spent = txList
    .filter((t) => t.created_at.slice(0, 7) === currentMonth())
    .reduce((s, t) => s + t.amount, 0);

  const { monthly_limit, warn_at_percent } = settings;
  const roundedSpent = Math.round(spent * 100) / 100;
  const remaining = Math.round((monthly_limit - roundedSpent) * 100) / 100;
  const percent_used = monthly_limit > 0 ? Math.round((roundedSpent / monthly_limit) * 1000) / 10 : 0;

  let warning = null;
  if (roundedSpent >= monthly_limit) warning = "over_budget";
  else if (percent_used >= warn_at_percent) warning = "approaching_limit";

  return { monthly_limit, warn_at_percent, spent_this_month: roundedSpent, remaining, percent_used, warning };
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Routes (mounted at /api) ────────────────────────────────────────────────
const router = express.Router();

router.use(async (req, res, next) => {
  try { await ensureInit(); next(); } catch (e) { next(e); }
});

router.get("/budget", async (req, res, next) => {
  try {
    const [settings, txList] = await Promise.all([getSettings(), getAllTx()]);
    res.json(await buildStatus(settings, txList));
  } catch (e) { next(e); }
});

router.put("/budget", async (req, res, next) => {
  try {
    const { monthly_limit, warn_at_percent = 80 } = req.body;
    if (!monthly_limit || monthly_limit <= 0)
      return res.status(400).json({ detail: "monthly_limit must be positive" });
    if (warn_at_percent < 1 || warn_at_percent > 99)
      return res.status(400).json({ detail: "warn_at_percent must be 1–99" });

    await writeRange(`${SET_SHEET}!A2:B2`, [[String(Math.round(monthly_limit * 100) / 100), String(warn_at_percent)]]);
    const txList = await getAllTx();
    res.json(await buildStatus({ monthly_limit, warn_at_percent }, txList));
  } catch (e) { next(e); }
});

router.get("/transactions", async (req, res, next) => {
  try {
    const txList = await getAllTx();
    const { month } = req.query;
    const filtered = month ? txList.filter((t) => t.created_at.startsWith(month)) : txList;
    res.json(filtered.reverse().slice(0, 100));
  } catch (e) { next(e); }
});

router.post("/transactions", async (req, res, next) => {
  try {
    const { description, amount, category = "General", person = "Unknown" } = req.body;
    if (!description?.trim()) return res.status(400).json({ detail: "description is required" });
    if (!amount || amount <= 0) return res.status(400).json({ detail: "amount must be positive" });

    const id = uid();
    const rounded = Math.round(amount * 100) / 100;
    const created_at = new Date().toISOString().replace(/\.\d+Z$/, "Z");

    await appendRow(TX_SHEET, [id, description.trim(), String(rounded), category, created_at, person]);

    const transaction = { id, description: description.trim(), amount: rounded, category, created_at, person };
    const [settings, txList] = await Promise.all([getSettings(), getAllTx()]);
    res.status(201).json({ transaction, budget_status: await buildStatus(settings, txList) });
  } catch (e) { next(e); }
});

router.delete("/transactions/:id", async (req, res, next) => {
  try {
    const rows = await readRange(`${TX_SHEET}!A2:E`);
    const rowIdx = rows.findIndex((r) => r[0] === req.params.id);
    if (rowIdx === -1) return res.status(404).json({ detail: "Transaction not found" });

    await deleteSheetRow(TX_SHEET, rowIdx + 1); // +1 for header row
    const [settings, txList] = await Promise.all([getSettings(), getAllTx()]);
    res.json(await buildStatus(settings, txList));
  } catch (e) { next(e); }
});

app.use("/api", router);

// Error handler
app.use((err, req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ detail: err.message });
});

// ── Local dev server ────────────────────────────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\nBudget API → http://localhost:${PORT}`);
    console.log(`Spreadsheet → https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);
  });
}

module.exports = app;
