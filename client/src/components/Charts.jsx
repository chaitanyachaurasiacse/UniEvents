import React, { useEffect, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";
import { api } from "../api";

const COLORS = ['#5b4fe0', '#f59e0b', '#10b981', '#ec4899', '#38bdf8', '#8b5cf6'];
const short = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Registrations per day (30 days) and registrations by category. Scope follows the signed-in role. */
export function OverviewCharts({ onStats }) {
  const [data, setData] = useState(null),
    [error, setError] = useState('');
  useEffect(() => {
    api
      .get('/stats/overview')
      .then((x) => {
        setData(x);
        onStats?.(x);
      })
      .catch((e) => setError(e.message));
  }, []);
  if (error) return <div className="alert error">Charts could not load: {error}</div>;
  if (!data) return <div className="chart-grid"><div className="loading" style={{ minHeight: 300 }} /><div className="loading" style={{ minHeight: 300 }} /></div>;
  const total = data.trend.reduce((a, x) => a + x.value, 0);
  const catTotal = data.byCategory.reduce((a, x) => a + x.value, 0);
  return (
    <div className="chart-grid">
      <div className="chart-card">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Registrations per day</h3>
          <span className="muted small">{total} in the last 30 days</span>
        </div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <AreaChart data={data.trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="regFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#5b4fe0" stopOpacity={0.35} />
                  <stop offset="1" stopColor="#5b4fe0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={short} tick={{ fontSize: 11, fill: 'var(--muted)' }} interval={6} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <Tooltip labelFormatter={short} formatter={(v) => [v, 'Registrations']} contentStyle={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)' }} />
              <Area type="monotone" dataKey="value" stroke="#5b4fe0" strokeWidth={2.5} fill="url(#regFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="chart-card">
        <h3>By category</h3>
        {catTotal ? (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 150, height: 150 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data.byCategory} dataKey="value" nameKey="name" innerRadius={46} outerRadius={70} paddingAngle={2} stroke="none">
                    {data.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="legend" style={{ flex: 1, minWidth: 140 }}>
              {data.byCategory.map((x, i) => (
                <div key={x.name}>
                  <i style={{ background: COLORS[i % COLORS.length] }} />
                  {x.name}
                  <b>{x.value}</b>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="muted small">No registrations yet.</p>
        )}
      </div>
    </div>
  );
}
