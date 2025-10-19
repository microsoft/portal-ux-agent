import React from 'react';

export const KpiCard: React.FC<{ title: string; value: string; trend?: string; icon?: string }> = ({ title, value, trend = 'neutral' }) => (
  <div className="card kpi-card">
    <h3>{title}</h3>
    <div className="value">{value}</div>
    <div className={`trend trend-${trend}`}>{trend}</div>
  </div>
);

export default KpiCard;
