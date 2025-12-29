const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// --- SET UP SQLITE DATABASE --- //
const db = new Database(path.join(__dirname, 'data.db')); // this is your SQL DB file

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    datetime TEXT NOT NULL,
    from_person TEXT NOT NULL,
    to_person TEXT NOT NULL,
    action TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT,
    note TEXT
  );
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API: GET /api/transactions?person=Aunt --- //
app.get('/api/transactions', (req, res) => {
  try {
    const person = req.query.person;
    let rows;

    if (person) {
      const stmt = db.prepare(`
        SELECT
          datetime AS DateTime,
          from_person AS "From",
          to_person AS "To",
          action AS Action,
          amount AS Amount,
          category AS Category,
          note AS Note
        FROM transactions
        WHERE from_person = ? OR to_person = ?
        ORDER BY datetime DESC
      `);
      rows = stmt.all(person, person);
    } else {
      const stmt = db.prepare(`
        SELECT
          datetime AS DateTime,
          from_person AS "From",
          to_person AS "To",
          action AS Action,
          amount AS Amount,
          category AS Category,
          note AS Note
        FROM transactions
        ORDER BY datetime DESC
      `);
      rows = stmt.all();
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read transactions' });
  }
});

// --- API: POST /api/transactions --- //
app.post('/api/transactions', (req, res) => {
  try {
    const { from, to, action, amount, category, note } = req.body;
    const amt = parseFloat(amount);

    if (!from || !to || !action || isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Invalid data' });
    }

    const datetime = new Date().toISOString();
    const upperAction = action.toUpperCase();

    const stmt = db.prepare(`
      INSERT INTO transactions (datetime, from_person, to_person, action, amount, category, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(datetime, from, to, upperAction, amt, category || null, note || null);

    const newTx = {
      DateTime: datetime,
      From: from,
      To: to,
      Action: upperAction,
      Amount: amt,
      Category: category || '',
      Note: note || '',
    };

    res.json({ success: true, transaction: newTx });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save transaction' });
  }
});

// --- API: GET /api/summary/Aunt --- //
app.get('/api/summary/:person', (req, res) => {
  try {
    const person = req.params.person;

    const inflowStmt = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE to_person = ?
    `);
    const outflowStmt = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE from_person = ?
    `);
    const earnStmt = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE to_person = ? AND action = 'EARN'
    `);
    const spendStmt = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE from_person = ? AND action = 'SPEND'
    `);

    const inflow = inflowStmt.get(person).total;
    const outflow = outflowStmt.get(person).total;
    const totalEarn = earnStmt.get(person).total;
    const totalSpend = spendStmt.get(person).total;

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

// --- START SERVER --- //
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});