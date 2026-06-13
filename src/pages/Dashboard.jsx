import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import api from "../services/api";
import { getUser, logout } from "../services/auth";

const cats = ["Food", "Travel", "Bills", "Entertainment", "Shopping"];
const cash = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const prettyDate = (date) => {
  if (!date) return "No Date";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Invalid Date";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
};

const fresh = () => ({
  title: "",
  amount: "",
  category: "Food",
  type: "expense",
  date: new Date().toISOString().slice(0, 10),
});

function Icon({ name }) {
  const paths = {
    wallet: "M4 7h16v12H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12v3m3 4h-4v4h4",
    up: "m7 11 5-5 5 5M12 6v12",
    down: "m7 13 5 5 5-5M12 18V6",
    plus: "M12 5v14M5 12h14",
    search: "m21 21-4-4m2-5.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
    edit: "M13.5 6.5l4 4M4 20l4.5-1 10-10a2.8 2.8 0 0 0-4-4l-10 10L4 20Z",
    trash: "M4 7h16m-10 4v5m4-5v5M9 7l1-3h4l1 3m3 0-1 13H7L6 7",
    chart: "M4 19V9m6 10V5m6 14v-7m4 7H2",
    close: "M6 6l12 12M18 6 6 18",
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(fresh),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState("newest");
  const [editing, setEditing] = useState(null),
    [deleting, setDeleting] = useState(null),
    [undo, setUndo] = useState(null),
    [error, setError] = useState("");
  const [budget, setBudget] = useState(
      () => Number(localStorage.getItem("monthly-budget")) || 10000
    ),
    [budgetDraft, setBudgetDraft] = useState("");

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await api.get("/transactions");
      const safeData = res.data.map((item) => ({
        ...item,
        amount: Number(item.amount || 0),
        date: item.date || "",
      }));
      setItems(safeData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => localStorage.setItem("monthly-budget", budget), [budget]);
  useEffect(() => {
    if (!undo) return;
    const id = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(id);
  }, [undo]);

  const totals = useMemo(() => {
    let income = 0,
      expense = 0;
    items.forEach((x) =>
      x.type === "income" ? (income += x.amount) : (expense += x.amount)
    );
    return { income, expense, balance: income - expense };
  }, [items]);

  const categoryData = useMemo(
    () =>
      items
        .filter((x) => x.type === "expense")
        .reduce((a, x) => ({ ...a, [x.category]: (a[x.category] || 0) + x.amount }), {}),
    [items]
  );

  const monthly = useMemo(() => {
    const data = {};
    items.forEach((x) => {
      const key = x.date.slice(0, 7);
      data[key] ??= { income: 0, expense: 0 };
      data[key][x.type] += x.amount;
    });
    return Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6);
  }, [items]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthExpense = items
    .filter((x) => x.type === "expense" && x.date.startsWith(currentMonth))
    .reduce((s, x) => s + x.amount, 0);
  const budgetPercent = budget ? Math.min((monthExpense / budget) * 100, 100) : 0;
  const remaining = budget - monthExpense;
  const topCategory = Object.entries(categoryData).sort((a, b) => b[1] - a[1])[0];

  const visible = useMemo(
    () =>
      items
        .filter(
          (x) =>
            (filter === "all" || x.type === filter || x.category === filter) &&
            (!query.trim() || `${x.title} ${x.category}`.toLowerCase().includes(query.toLowerCase()))
        )
        .sort((a, b) =>
          sort === "oldest"
            ? a.date.localeCompare(b.date)
            : sort === "highest"
            ? b.amount - a.amount
            : sort === "lowest"
            ? a.amount - b.amount
            : b.date.localeCompare(a.date)
        ),
    [items, query, filter, sort]
  );

  const maxCat = Math.max(...Object.values(categoryData), 1);
  const maxMonth = Math.max(...monthly.flatMap(([, x]) => [x.income, x.expense]), 1);

  const change = (e, setter = setForm) => {
    const { name, value } = e.target;
    setError("");
    setter((x) => ({
      ...x,
      [name]: value,
      ...(name === "type" && value === "expense" && x.category === "Income" ? { category: "Food" } : {}),
    }));
  };

  const valid = (x) => x.title.trim() && Number(x.amount) > 0 && x.date;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid(form)) {
      setError("Please enter a title, valid amount and date.");
      return;
    }

    try {
      const payload = {
        title: form.title.trim(),
        amount: Number(form.amount),
        type: form.type,
        category: form.type === "income" ? "Income" : form.category,
        date: form.date,
      };

      await api.post("/transactions", payload);
      await fetchTransactions();
      setForm(fresh());
      setError("");
    } catch (err) {
      console.error(err.response?.data || err.message);
      setError(err.response?.data?.message || "Failed to save transaction");
    }
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/transactions/${editing._id}`, {
        title: editing.title,
        amount: Number(editing.amount),
        type: editing.type,
        category: editing.type === "income" ? "Income" : editing.category,
        date: editing.date,
      });
      await fetchTransactions();
      setEditing(null);
    } catch (err) {
      console.error(err);
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/transactions/${deleting._id}`);
      fetchTransactions();
      setDeleting(null);
    } catch (err) {
      console.error(err);
    }
  };

  const restore = () => {
    setItems((x) => [undo, ...x]);
    setUndo(null);
  };

  const setNewBudget = (e) => {
    e.preventDefault();
    const value = Number(budgetDraft);
    if (value > 0) {
      setBudget(value);
      setBudgetDraft("");
    }
  };

  return (
    <main className="app-shell">
      <div className="dashboard">
        <header className="topbar">
          <div className="brand">
            <span className="brand-icon">
              <Icon name="chart" />
            </span>
            <div>
              <strong>Smart</strong>
              <small>Expense tracker</small>
            </div>
          </div>
          <div className="profile">
            <span>{user?.name?.[0]?.toUpperCase() || "U"}</span>
            <div>
              <strong>
                Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
              </strong>
              <small>Manage money smarter</small>
            </div>
            <button className="logout-button" type="button" onClick={() => { logout(); navigate("/login"); }}>
              Logout
            </button>
          </div>
        </header>
        <section className="intro">
          <div>
            <span className="eyebrow">Financial overview</span>
            <h1>Your money, clearly managed.</h1>
            <p>Track every transaction and understand where your money goes.</p>
          </div>
          <div className="today">
            <small>Today</small>
            <strong>{prettyDate(new Date().toISOString().slice(0, 10))}</strong>
          </div>
        </section>
        <section className="summary-grid">
          {[
            ["Available balance", totals.balance, "wallet", "purple"],
            ["Total income", totals.income, "up", "green"],
            ["Total expenses", totals.expense, "down", "red"],
          ].map(([label, value, icon, color]) => (
            <article className={`summary-card ${color}`} key={label}>
              <span className="summary-icon">
                <Icon name={icon} />
              </span>
              <div>
                <small>{label}</small>
                <h2>{cash.format(value)}</h2>
                <p>All time</p>
              </div>
            </article>
          ))}
        </section>
        <section className="analytics-grid">
          <article className="panel budget-panel">
            <PanelTitle
              icon="wallet"
              title="Monthly budget"
              text="Keep this month's spending on track"
            />
            <div className="budget-values">
              <div>
                <small>Spent</small>
                <strong>{cash.format(monthExpense)}</strong>
              </div>
              <div>
                <small>{remaining >= 0 ? "Remaining" : "Over budget"}</small>
                <strong className={remaining < 0 ? "negative" : ""}>
                  {cash.format(Math.abs(remaining))}
                </strong>
              </div>
            </div>
            <div className="budget-track">
              <i className={budgetPercent >= 90 ? "danger" : ""} style={{ width: `${budgetPercent}%` }} />
            </div>
            <p className="budget-status">
              {Math.round(budgetPercent)}% of {cash.format(budget)} used
            </p>
            <form className="budget-form" onSubmit={setNewBudget}>
              <input
                type="number"
                min="1"
                value={budgetDraft}
                onChange={(e) => setBudgetDraft(e.target.value)}
                placeholder="Set new budget"
                aria-label="New monthly budget"
              />
              <button>Update</button>
            </form>
          </article>
          <article className="panel trend-panel">
            <PanelTitle
              icon="chart"
              title="Monthly cash flow"
              text="Income versus expenses for the last 6 months"
            />
            <div className="month-chart">
              {monthly.length ? (
                monthly.map(([month, data]) => (
                  <div className="month-column" key={month}>
                    <div className="month-bars">
                      <i
                        className="income-bar"
                        style={{ height: `${Math.max((data.income / maxMonth) * 100, 3)}%` }}
                        title={`Income ${cash.format(data.income)}`}
                      />
                      <i
                        className="expense-bar"
                        style={{ height: `${Math.max((data.expense / maxMonth) * 100, 3)}%` }}
                        title={`Expense ${cash.format(data.expense)}`}
                      />
                    </div>
                    <small>{new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short" })}</small>
                  </div>
                ))
              ) : (
                <div className="empty">No monthly data yet.</div>
              )}
            </div>
            <div className="chart-legend">
              <span>
                <i className="income-bar" />Income
              </span>
              <span>
                <i className="expense-bar" />Expense
              </span>
            </div>
          </article>
          <article className="panel insight-panel">
            <PanelTitle icon="chart" title="Smart insights" text="Quick signals from your finances" />
            <div className="insight-list">
              <div>
                <span>Savings rate</span>
                <strong>{totals.income ? Math.round(((totals.income - totals.expense) / totals.income) * 100) : 0}%</strong>
                <small>of total income retained</small>
              </div>
              <div>
                <span>Top spending category</span>
                <strong>{topCategory?.[0] || "No data"}</strong>
                <small>{topCategory ? cash.format(topCategory[1]) : "Add an expense to begin"}</small>
              </div>
              <div>
                <span>Average expense</span>
                <strong>{cash.format(totals.expense / (items.filter((x) => x.type === "expense").length || 1))}</strong>
                <small>per expense transaction</small>
              </div>
            </div>
          </article>
        </section>
        <section className="main-grid">
          <article className="panel">
            <PanelTitle icon="plus" title="Add transaction" text="Record a new income or expense" />
            <TransactionForm data={form} change={change} submit={submit} error={error} button="Add transaction" />
          </article>
          <article className="panel">
            <PanelTitle icon="chart" title="Expense breakdown" text="Spending by category" badge={cash.format(totals.expense)} />
            <div className="chart-list">
              {!Object.keys(categoryData).length && <div className="empty">No expense data yet.</div>}
              {Object.entries(categoryData)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, value], i) => (
                  <div className="bar-item" key={cat}>
                    <div>
                      <span>
                        <i className={`dot color-${i}`} />
                        {cat}
                      </span>
                      <strong>{cash.format(value)}</strong>
                    </div>
                    <div className="bar">
                      <i className={`color-${i}`} style={{ width: `${(value / maxCat) * 100}%` }} />
                    </div>
                    <small>{totals.expense ? Math.round((value / totals.expense) * 100) : 0}% of expenses</small>
                  </div>
                ))}
            </div>
          </article>
        </section>
        <section className="panel history-panel">
          <PanelTitle icon="wallet" title="Transaction history" text={`${items.length} transactions recorded`} />
          <div className="toolbar">
            <label className="search">
              <Icon name="search" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search transactions..."
                aria-label="Search transactions"
              />
            </label>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
              <option value="all">All transactions</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
              {cats.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest amount</option>
              <option value="lowest">Lowest amount</option>
            </select>
          </div>
          <div className="transaction-list">
            {!visible.length && <div className="empty">No matching transactions found.</div>}
            {visible.map((x) => (
              <article className="transaction" key={x._id}>
                <span className={`type-icon ${x.type}`}>
                  <Icon name={x.type === "income" ? "up" : "down"} />
                </span>
                <div className="transaction-info">
                  <h3>{x.title}</h3>
                  <p>
                    {x.category}
                    <i />
                    {prettyDate(x.date)}
                  </p>
                </div>
                <div className={`amount ${x.type}`}>
                  <strong>{x.type === "income" ? "+" : "-"}{cash.format(x.amount)}</strong>
                  <small>{x.type}</small>
                </div>
                <div className="row-actions">
                  <button onClick={() => setEditing({ ...x })} aria-label={`Edit ${x.title}`}>
                    <Icon name="edit" />
                  </button>
                  <button className="delete" onClick={() => setDeleting(x)} aria-label={`Delete ${x.title}`}>
                    <Icon name="trash" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <footer>Smart expense tracker <span>•</span> Built for smarter money decisions</footer>
      </div>
      {editing && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true">
            <button className="modal-close" onClick={() => setEditing(null)} aria-label="Close">
              <Icon name="close" />
            </button>
            <h2>Edit transaction</h2>
            <p>Update the transaction details below.</p>
            <TransactionForm data={editing} change={(e) => change(e, setEditing)} submit={save} button="Save changes" />
            <button className="secondary-button" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </section>
        </div>
      )}
      {deleting && (
        <div className="modal-backdrop">
          <section className="confirm-modal" role="alertdialog" aria-modal="true">
            <span className="danger-icon">
              <Icon name="trash" />
            </span>
            <h2>Delete transaction?</h2>
            <p>
              <strong>{deleting.title}</strong> will be removed from your records.
            </p>
            <div>
              <button className="secondary-button" onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button className="danger-button" onClick={remove}>
                Delete
              </button>
            </div>
          </section>
        </div>
      )}
      {undo && (
        <div className="toast" role="status">
          <span>Transaction deleted</span>
          <button onClick={restore}>Undo</button>
        </div>
      )}
    </main>
  );
}

function PanelTitle({ icon, title, text, badge }) {
  return (
    <div className="panel-title">
      <span>
        <Icon name={icon} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      {badge && <b>{badge}</b>}
    </div>
  );
}

function TransactionForm({ data, change, submit, error, button }) {
  return (
    <form className="transaction-form" onSubmit={submit}>
      <label className="full">
        <span>Transaction title</span>
        <input name="title" value={data.title} onChange={change} placeholder="e.g. Grocery shopping" />
      </label>
      <label>
        <span>Amount</span>
        <div className="money-input">
          <i>₹</i>
          <input name="amount" type="number" min="1" value={data.amount} onChange={change} placeholder="0" />
        </div>
      </label>
      <label>
        <span>Transaction type</span>
        <select name="type" value={data.type} onChange={change}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </label>
      {data.type === "expense" && (
        <label>
          <span>Category</span>
          <select name="category" value={data.category} onChange={change}>
            {cats.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      )}
      <label className={data.type === "income" ? "full" : ""}>
        <span>Date</span>
        <input name="date" type="date" value={data.date} onChange={change} />
      </label>
      {error && <p className="form-error full">{error}</p>}
      <button className="primary-button full" type="submit">
        <Icon name="plus" />
        {button}
      </button>
    </form>
  );
}

export default Dashboard;
