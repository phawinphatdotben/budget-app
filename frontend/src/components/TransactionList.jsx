const API = "/api";

const ICONS = {
  Food: "🍔", Transport: "🚌", Housing: "🏠", Entertainment: "🎬",
  Health: "💊", Shopping: "🛍️", Other: "📦", General: "💳",
};

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TransactionList({ transactions, month, onMonthChange, onDeleted }) {
  async function handleDelete(id) {
    if (!confirm("Delete this transaction?")) return;
    try {
      const res = await fetch(`${API}/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      const status = await res.json();
      onDeleted(id, status);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="card">
      <h2>Transactions</h2>
      <div className="month-row">
        <label style={{ marginBottom: 0, whiteSpace: "nowrap" }}>Filter month</label>
        <input type="month" value={month} onChange={e => onMonthChange(e.target.value)} />
      </div>

      {transactions.length === 0 ? (
        <p className="empty">No transactions yet.</p>
      ) : (
        <ul className="tx-list">
          {transactions.map(tx => (
            <li key={tx.id} className="tx-item">
              <div className="tx-icon">{ICONS[tx.category] ?? "💳"}</div>
              <div className="tx-desc">
                <strong>{tx.description}</strong>
                <span>{tx.category} &middot; {fmtDate(tx.created_at)}</span>
              </div>
              {tx.person && tx.person !== "Unknown" && (
                <span className={`person-badge ${tx.person === "Dad" ? "dad" : "mom"}`}>
                  {tx.person === "Dad" ? "👨" : "👩"} {tx.person}
                </span>
              )}
              <span className="tx-amount">-฿{tx.amount.toFixed(2)}</span>
              <button className="tx-delete" onClick={() => handleDelete(tx.id)} title="Delete">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
