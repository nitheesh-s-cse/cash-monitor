const express = require('express');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.xlsx');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure Excel file exists with header row
function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    const wb = XLSX.utils.book_new();
    const header = [['DateTime', 'From', 'To', 'Action', 'Amount', 'Category', 'Note']];
    const ws = XLSX.utils.aoa_to_sheet(header);
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, DATA_FILE);
    console.log('Created new data.xlsx file');
  }
}

function readTransactions() {
  ensureDataFile();
  const wb = XLSX.readFile(DATA_FILE);
  const ws = wb.Sheets['Transactions'];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }); // array of objects
  return rows;
}

function writeTransactions(transactions) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(transactions, {
    header: ['DateTime', 'From', 'To', 'Action', 'Amount', 'Category', 'Note'],
  });
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  XLSX.writeFile(wb, DATA_FILE);
}

// GET /api/transactions?person=Aunt
app.get('/api/transactions', (req, res) => {
  try {
    const person = req.query.person;
    const rows = readTransactions();
    let result = rows;

    if (person) {
      result = rows.filter(r => r.From === person || r.To === person);
    }

    // Sort newest first
    result.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read transactions' });
  }
});

// POST /api/transactions
app.post('/api/transactions', (req, res) => {
  try {
    const { from, to, action, amount, category, note } = req.body;
    const amt = parseFloat(amount);

    if (!from || !to || !action || isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Invalid data' });
    }

    const newRow = {
      DateTime: new Date().toISOString(),
      From: from,
      To: to,
      Action: action.toUpperCase(), // EARN / SPEND / BORROW / TRANSFER
      Amount: amt,
      Category: category || '',
      Note: note || '',
    };

    const rows = readTransactions();
    rows.push(newRow);
    writeTransactions(rows);

    res.json({ success: true, transaction: newRow });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save transaction' });
  }
});

// GET /api/summary/Aunt or /api/summary/Uncle
app.get('/api/summary/:person', (req, res) => {
  try {
    const person = req.params.person;
    const rows = readTransactions();

    let inflow = 0;
    let outflow = 0;
    let totalEarn = 0;
    let totalSpend = 0;

    rows.forEach(r => {
      const amt = Number(r.Amount) || 0;

      if (r.To === person) inflow += amt;
      if (r.From === person) outflow += amt;

      if (r.To === person && r.Action === 'EARN') totalEarn += amt;
      if (r.From === person && r.Action === 'SPEND') totalSpend += amt;
    });

    const walletBalance = inflow - outflow;

    res.json({
      person,
      walletBalance,
      totalEarn,
      totalSpend,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute summary' });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
  ensureDataFile();
});