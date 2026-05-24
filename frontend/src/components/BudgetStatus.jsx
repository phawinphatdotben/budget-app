export default function BudgetStatus({ status }) {
  if (!status) return null;

  const { monthly_limit, spent_this_month, remaining, percent_used, warn_at_percent, warning } = status;
  const fillClass = warning === "over_budget" ? "over" : warning === "approaching_limit" ? "warn" : "ok";
  const fillWidth = Math.min(percent_used, 100);

  return (
    <div className="card">
      <h2>This month's spending</h2>
      <div className="status-row">
        <span className="status-spent">฿{spent_this_month.toFixed(2)}</span>
        <span className="status-numbers">
          limit ฿{monthly_limit.toFixed(2)} &nbsp;|&nbsp; {percent_used}% used
        </span>
      </div>

      <div className="progress-track">
        <div
          className={`progress-fill ${fillClass}`}
          style={{ width: `${fillWidth}%` }}
        />
      </div>

      <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
        {remaining >= 0
          ? `฿${remaining.toFixed(2)} remaining`
          : `฿${Math.abs(remaining).toFixed(2)} over budget`}
      </div>

      {warning === "over_budget" && (
        <div className="alert over">
          You have exceeded your monthly budget of ฿{monthly_limit.toFixed(2)}!
        </div>
      )}
      {warning === "approaching_limit" && (
        <div className="alert warn">
          Warning: you have used {percent_used}% of your ฿{monthly_limit.toFixed(2)} monthly budget.
        </div>
      )}
    </div>
  );
}
