let currentUser = null;

// Theme management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.body.classList.toggle('dark-theme', savedTheme === 'dark');
  updateThemeIcon();
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon();
}

function updateThemeIcon() {
  const toggle = document.getElementById('theme-toggle');
  const isDark = document.body.classList.contains('dark-theme');
  toggle.textContent = isDark ? '☀️' : '🌙';
}

// Initialize theme on load
document.addEventListener('DOMContentLoaded', initTheme);

// Theme toggle event
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

async function selectUser(name) {
  currentUser = name;
  document.getElementById('user-select').classList.add('hidden');
  const dashboard = document.getElementById('dashboard');
  dashboard.classList.remove('hidden');
  dashboard.classList.add('fade-in');
  document.getElementById('greeting').textContent = `Hello, ${currentUser}!`;
  await refreshAll();
}

function goBack() {
  currentUser = null;
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('user-select').classList.remove('hidden');
  document.getElementById('form-container').innerHTML = '';
  document.getElementById('tx-body').innerHTML = '';
}

async function refreshAll() {
  if (!currentUser) return;
  await Promise.all([loadSummary(), loadTransactions()]);
}

async function loadSummary() {
  const res = await fetch(`/api/summary/${currentUser}`);
  const data = await res.json();
  const balanceEl = document.getElementById('wallet-balance');
  balanceEl.textContent = data.walletBalance.toFixed(2);
  balanceEl.classList.add('fade-in');
}

async function loadTransactions() {
  const res = await fetch(`/api/transactions?person=${encodeURIComponent(
    currentUser
  )}`);
  const data = await res.json();
  const tbody = document.getElementById('tx-body');
  tbody.innerHTML = '';

  data.forEach(tx => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(tx.DateTime).toLocaleString()}</td>
      <td>${tx.From}</td>
      <td>${tx.To}</td>
      <td>${tx.Action}</td>
      <td>${Number(tx.Amount).toFixed(2)}</td>
      <td>${tx.Category || ''}</td>
      <td>${tx.Note || ''}</td>
    `;
    tr.classList.add('fade-in');
    tbody.appendChild(tr);
  });
}

function showForm(action) {
  if (!currentUser) return;
  const container = document.getElementById('form-container');
  let html = '';

  if (action === 'EARN') {
    html = `
      <h3>Add Income</h3>
      <form id="tx-form">
        <label>Amount (₹):
          <input type="number" step="0.01" name="amount" required>
        </label>
        <label>Source:
          <input type="text" name="category" placeholder="Salary, Gift, etc.">
        </label>
        <label>Note:
          <input type="text" name="note">
        </label>
        <button type="submit">Save Income</button>
      </form>
    `;
  } else if (action === 'SPEND') {
    html = `
      <h3>Add Expense</h3>
      <form id="tx-form">
        <label>Amount (₹):
          <input type="number" step="0.01" name="amount" required>
        </label>
        <label>Category:
          <input type="text" name="category" placeholder="Food, Current bill, etc.">
        </label>
        <label>Note:
          <input type="text" name="note">
        </label>
        <button type="submit">Save Expense</button>
      </form>
    `;
  } else if (action === 'BORROW') {
    html = `
      <h3>Borrow from Bank / Lender</h3>
      <form id="tx-form">
        <label>Amount (₹):
          <input type="number" step="0.01" name="amount" required>
        </label>
        <label>From (Bank / Lender name):
          <input type="text" name="lender" placeholder="HDFC, Weekly lender, etc." required>
        </label>
        <label>Note:
          <input type="text" name="note">
        </label>
        <button type="submit">Save Borrow</button>
      </form>
    `;
  } else if (action === 'TRANSFER') {
    const spouse = currentUser === 'Punitha' ? 'Charles' : 'Punitha';
    html = `
      <h3>Give Money to ${spouse}</h3>
      <form id="tx-form">
        <label>Amount (₹):
          <input type="number" step="0.01" name="amount" required>
        </label>
        <label>Reason:
          <input type="text" name="category" placeholder="Repay, Household, Gift, etc.">
        </label>
        <label>Note:
          <input type="text" name="note">
        </label>
        <button type="submit">Save Transfer</button>
      </form>
    `;
  }

  container.innerHTML = html;
  container.classList.add('slide-down');
  const form = document.getElementById('tx-form');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const formData = new FormData(form);
    const amount = formData.get('amount');
    const category = formData.get('category') || '';
    const note = formData.get('note') || '';

    if (action === 'EARN') {
      submitTransaction({
        from: 'WORLD',
        to: currentUser,
        action,
        amount,
        category,
        note,
      });
    } else if (action === 'SPEND') {
      submitTransaction({
        from: currentUser,
        to: 'WORLD',
        action,
        amount,
        category,
        note,
      });
    } else if (action === 'BORROW') {
      const lender = formData.get('lender');
      submitTransaction({
        from: lender,
        to: currentUser,
        action,
        amount,
        category: lender,
        note,
      });
    } else if (action === 'TRANSFER') {
      const spouse = currentUser === 'Punitha' ? 'Charles' : 'Punitha';
      submitTransaction({
        from: currentUser,
        to: spouse,
        action,
        amount,
        category,
        note,
      });
    }
  });
}

async function submitTransaction(payload) {
  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Error saving transaction');
      return;
    }

    document.getElementById('form-container').innerHTML = '';
    await refreshAll();
  } catch (err) {
    console.error(err);
    alert('Network error');
  }
}