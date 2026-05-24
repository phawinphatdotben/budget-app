import { useState } from "react";

const API = "/api";

export default function BudgetSettings({ status, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState("");
  const [warnAt, setWarnAt] = useState("");
  const [saving, setSaving] = useState(false);

  function handleOpen() {
    setLimit(status?.monthly_limit ?? "");
    setWarnAt(status?.warn_at_percent ?? 80);
    setOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API}/budget`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthly_limit: parseFloat(limit), warn_at_percent: parseInt(warnAt) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onUpdate(data);
      setOpen(false);
    } catch (err) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="settings-toggle" onClick={open ? () => setOpen(false) : handleOpen}>
        {open ? "Cancel" : "Change budget limit"}
      </button>

      {open && (
        <div className="card">
          <h2>Budget settings</h2>
          <form onSubmit={handleSave}>
            <div className="form-row">
              <div>
                <label>Monthly limit (฿)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={limit}
                  onChange={e => setLimit(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Warn when % used reaches</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={warnAt}
                  onChange={e => setWarnAt(e.target.value)}
                  required
                />
              </div>
            </div>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
