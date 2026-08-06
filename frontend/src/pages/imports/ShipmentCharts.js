import React from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const fmt = (n) => `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { maximumFractionDigits: 0 })}`;

const COST_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#6366f1', '#6b7280'];
const PROFIT_COLORS = ['#ef4444', '#22c55e'];

export default function ShipmentCharts({ productCostGhs, shippingCost, customsDuty, localCosts, otherFees, totalLandedCost, projectedRevenue, projectedProfit }) {
  const costData = [
    { name: 'Product Cost', value: productCostGhs },
    { name: 'Shipping', value: shippingCost },
    { name: 'Customs & Duty', value: customsDuty },
    { name: 'Local Transport', value: localCosts },
    { name: 'Other', value: otherFees },
  ].filter(d => d.value > 0);

  const revenueVsCost = [
    { name: 'Landed Cost', value: totalLandedCost },
    { name: 'Revenue', value: projectedRevenue },
    { name: 'Profit', value: projectedProfit },
  ];

  const profitDist = [
    { name: 'Cost', value: Math.max(totalLandedCost, 0) },
    { name: 'Profit', value: Math.max(projectedProfit, 0) },
  ].filter(d => d.value > 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Cost Breakdown</div>
        {costData.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={costData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                {costData.map((entry, i) => <Cell key={i} fill={COST_COLORS[i % COST_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Revenue vs Cost</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={revenueVsCost}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {revenueVsCost.map((entry, i) => (
                <Cell key={i} fill={entry.name === 'Profit' ? (entry.value >= 0 ? '#22c55e' : '#ef4444') : entry.name === 'Revenue' ? '#3b82f6' : '#f59e0b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Profit Distribution</div>
        {profitDist.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={profitDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                {profitDist.map((entry, i) => <Cell key={i} fill={entry.name === 'Profit' ? PROFIT_COLORS[1] : PROFIT_COLORS[0]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function EmptyChart() {
  return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12 }}>Add costs to see this chart</div>;
}
