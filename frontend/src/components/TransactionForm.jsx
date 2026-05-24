import { useState } from "react";

const API = "/api";

const CATEGORIES = ["General", "Food", "Transport", "Housing", "Entertainment", "Health", "Shopping", "Other"];

const CATEGORY_ICONS = {
  Food: "🍔", Transport: "🚌", Housing: "🏠", Entertainment: "🎬",
  Health: "💊", Shopping: "🛍️", Other: "📦", General: "💳",
};

export default function TransactionForm({ onCreated }) {
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc, amount: parseFloat(amount), category }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Unknown error");
      }
      const data = await res.json();
      onCreated(data);
      setDesc("");
      setAmount("");
      setCategory("General");
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>Add transaction</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Description</label>
          <input
            type="text"
            placeholder="e.g. Grocery run"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <div>
            <label>Amount (฿)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Adding…" : "Add transaction"}
        </button>
      </form>
    </div>
  );
}
