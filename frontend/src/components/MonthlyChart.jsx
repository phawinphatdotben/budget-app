import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const API = "/api";

function getLast6Months() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function fmtMonth(ym) {
  const [y, m] = ym.split("-");
  return new Date(y, m - 1).toLocaleString("default", { month: "short", year: "2-digit" });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
      <p style={{ marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, margin: "2px 0", fontSize: "0.85rem" }}>
          {p.name}: ฿{Number(p.value).toFixed(2)}
        </p>
      ))}
    </div>
  );
};

export default function MonthlyChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/transactions`);
        const txList = await res.json();

        const months = getLast6Months();
        const grouped = months.map((m) => {
          const monthTx = txList.filter((t) => t.created_at?.startsWith(m));
          const dad = monthTx.filter((t) => t.person === "Dad").reduce((s, t) => s + t.amount, 0);
          const mom = monthTx.filter((t) => t.person === "Mom").reduce((s, t) => s + t.amount, 0);
          return { month: fmtMonth(m), Dad: Math.round(dad * 100) / 100, Mom: Math.round(mom * 100) / 100 };
        });
        setData(grouped);
      } catch {}
    }
    load();
  }, []);

  return (
    <div className="card">
      <h2>Monthly spending — Dad vs Mom</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false}
            tickFormatter={(v) => `฿${v}`} width={60} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
          <Bar dataKey="Dad" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Mom" fill="#ec4899" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
