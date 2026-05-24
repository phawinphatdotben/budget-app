import { useState, useEffect, useCallback } from "react";
import BudgetStatus from "./components/BudgetStatus";
import BudgetSettings from "./components/BudgetSettings";
import TransactionForm from "./components/TransactionForm";
import TransactionList from "./components/TransactionList";
import "./index.css";

const API = "/api";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function App() {
  const [status, setStatus] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [month, setMonth] = useState(currentMonth);
  const [error, setError] = useState(null);

  const fetchBudget = useCallback(async () => {
    try {
      const res = await fetch(`${API}/budget`);
      if (!res.ok) throw new Error("Cannot reach API");
      setStatus(await res.json());
      setError(null);
    } catch {
      setError("Cannot connect to backend. Is the server running?");
    }
  }, []);

  const fetchTransactions = useCallback(async (m) => {
    try {
      const res = await fetch(`${API}/transactions?month=${m}`);
      setTransactions(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchBudget(); }, [fetchBudget]);
  useEffect(() => { fetchTransactions(month); }, [fetchTransactions, month]);

  function handleCreated({ transaction, budget_status }) {
    setStatus(budget_status);
    const txMonth = transaction.created_at.slice(0, 7);
    if (txMonth === month) {
      setTransactions(prev => [transaction, ...prev]);
    }
  }

  function handleDeleted(id, newStatus) {
    setStatus(newStatus);
    setTransactions(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div className="app">
      <h1>Budget Tracker</h1>

      {error && <div className="alert over">{error}</div>}

      <BudgetStatus status={status} />
      <BudgetSettings status={status} onUpdate={setStatus} />
      <TransactionForm onCreated={handleCreated} />
      <TransactionList
        transactions={transactions}
        month={month}
        onMonthChange={m => { setMonth(m); fetchTransactions(m); }}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
