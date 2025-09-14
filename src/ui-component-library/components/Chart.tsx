import React from 'react';

export const Chart: React.FC<{ title: string; type?: string; data?: any[] }> = ({ title, type = 'line', data = [] }) => (
  <div className="card chart-card">
    <h3>{title}</h3>
    <div className="chart-placeholder">
      <p>Chart ({type}) - {data.length} data points</p>
      <div style={{ height: '200px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Chart visualization would go here
      </div>
    </div>
  </div>
);

export default Chart;
