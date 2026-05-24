require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
const path = require("path");

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

// --- Google Sheets setup ---
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const TX_SHEET = "transactions";
const SET_SHEET = "budget_settings";

if (!SPREADSHEET_ID) {
  console.error("\n[ERROR] SPREADSHEET_ID is not set in .env — see SETUP.md\n");
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_CREDENTIALS || path.join(__dirname, "credentials.json"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

let sheets;

async function getSheets() {
  if (!sheets) sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

// --- Spreadsheet initialisation ---
async function initSpreadsheet() {
  const s = await getSheets();
  const info = await s.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = info.data.sheets.map((sh) => sh.properties.title);
  const requests = [];

  if (!existing.includes(TX_SHEET))
    requests.push({ addSheet: { properties: { title: TX_SHEET } } });
  if (!existing.includes(SET_SHEET))
    requests.push({ addSheet: { properties: { title: SET_SHEET } } });

  if (requests.length) {
    await s.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
  }

  // Seed headers + default settings if sheet is empty
  const txRows = await readRange(`${TX_SHEET}!A1:E1`);
  if (!txRows.length) {
    await writeRange(`${TX_SHEET}!A1:E1`, [
      ["id", "description", "amount", "category", "created_at"],
    ]);
  }

  const setRows = await readRange(`${SET_SHEET}!A1:B2`);
  if (!setRows.length) {
    await writeRange(`${SET_SHEET}!A1:B2`, [
      ["monthly_limit", "warn_at_percent"],
      ["1000", "80"],
    ]);
  } else if (setRows.length === 1) {
    await writeRange(`${SET_SHEET}!A2:B2`, [["1000", "80"]]);
  }
}

// --- Sheet helpers ---
async function readRange(range) {
  const s = await getSheets();
  const res = await s.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return res.data.values || [];
}

async function writeRange(range, values) {
  const s = await getSheets();
  await s.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

async function appendRow(sheet, values) {
  const s = await getSheets();
  await s.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

async function deleteRow(sheet, rowIndex) {
  // rowIndex is 0-based (0 = first row including header)
  const s = await getSheets();
  const info = await s.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetId = info.data.sheets.find(
    (sh) => sh.properties.title === sheet
  )?.properties.sheetId;

  await s.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
}

// --- Domain helpers ---
function rowToTx([id, description, amount, category, created_at]) {
  return { id, description, amount: parseFloat(amount), category, created_at };
}

async function getAllTx() {
  const rows = await readRange(`${TX_SHEET}!A2:E`);
  return rows.map(rowToTx);
}

async function getSettings() {
  const rows = await readRange(`${SET_SHEET}!A2:B2`);
  if (!rows.length) return { monthly_limit: 1000, warn_at_percent: 80 };
  return {
    monthly_limit: parseFloat(rows[0][0]) || 1000,
    warn_at_percent: parseInt(rows[0][1]) || 80,
  };
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

async function buildStatus(settings, txList) {
  const month = currentMonth();
  const spent = txList
    .filter((t) => t.created_at.slice(0, 7) === month)
    .reduce((s, t) => s + t.amount, 0);

  const { monthly_limit, warn_at_percent } = settings;
  const roundedSpent = Math.round(spent * 100) / 100;
  const remaining = Math.round((monthly_limit - roundedSpent) * 100) / 100;
  const percent_used =
    monthly_limit > 0
      ? Math.round((roundedSpent / monthly_limit) * 1000) / 10
      : 0;

  let warning = null;
  if (roundedSpent >= monthly_limit) warning = "over_budget";
  else if (percent_used >= warn_at_percent) warning = "approaching_limit";

  return {
    monthly_limit,
    warn_at_percent,
    spent_this_month: roundedSpent,
    remaining,
    percent_used,
    warning,
  };
}

function uniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// --- Routes ---
app.get("/budget", async (req, res, next) => {
  try {
    const settings = await getSettings();
    const txList = await getAllTx();
    res.json(await buildStatus(settings, txList));
  } catch (e) {
    next(e);
  }
});

app.put("/budget", async (req, res, next) => {
  try {
    const { monthly_limit, warn_at_percent = 80 } = req.body;
    if (!monthly_limit || monthly_limit <= 0)
      return res.status(400).json({ detail: "monthly_limit must be positive" });
    if (warn_at_percent < 1 || warn_at_percent > 99)
      return res.status(400).json({ detail: "warn_at_percent must be 1–99" });

    await writeRange(`${SET_SHEET}!A2:B2`, [
      [String(Math.round(monthly_limit * 100) / 100), String(warn_at_percent)],
    ]);

    const settings = { monthly_limit, warn_at_percent };
    const txList = await getAllTx();
    res.json(await buildStatus(settings, txList));
  } catch (e) {
    next(e);
  }
});

app.get("/transactions", async (req, res, next) => {
  try {
    const txList = await getAllTx();
    const { month } = req.query;
    const filtered = month
      ? txList.filter((t) => t.created_at.startsWith(month))
      : txList;
    // Most recent first
    res.json(filtered.slice().reverse().slice(0, 100));
  } catch (e) {
    next(e);
  }
});

app.post("/transactions", async (req, res, next) => {
  try {
    const { description, amount, category = "General" } = req.body;
    if (!description?.trim())
      return res.status(400).json({ detail: "description is required" });
    if (!amount || amount <= 0)
      return res.status(400).json({ detail: "amount must be positive" });

    const id = uniqueId();
    const rounded = Math.round(amount * 100) / 100;
    const created_at = new Date().toISOString().replace(/\.\d+Z$/, "Z");

    await appendRow(TX_SHEET, [
      id,
      description.trim(),
      String(rounded),
      category,
      created_at,
    ]);

    const transaction = { id, description: description.trim(), amount: rounded, category, created_at };
    const settings = await getSettings();
    const txList = await getAllTx();
    res.status(201).json({ transaction, budget_status: await buildStatus(settings, txList) });
  } catch (e) {
    next(e);
  }
});

app.delete("/transactions/:id", async (req, res, next) => {
  try {
    const rows = await readRange(`${TX_SHEET}!A2:E`);
    const rowIdx = rows.findIndex((r) => r[0] === req.params.id);
    if (rowIdx === -1)
      return res.status(404).json({ detail: "Transaction not found" });

    // +1 because header is row 0, our data starts at index 1 (0-based)
    await deleteRow(TX_SHEET, rowIdx + 1);

    const settings = await getSettings();
    const txList = await getAllTx();
    res.json(await buildStatus(settings, txList));
  } catch (e) {
    next(e);
  }
});

// Error handler
app.use((err, req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ detail: err.message });
});

// --- Startup ---
initSpreadsheet()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`\nBudget API running on http://localhost:${PORT}`);
      console.log("Spreadsheet: https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID);
    });
  })
  .catch((err) => {
    console.error("\n[ERROR] Failed to connect to Google Sheets:", err.message);
    console.error("Check your credentials.json and SPREADSHEET_ID in .env\n");
    process.exit(1);
  });
