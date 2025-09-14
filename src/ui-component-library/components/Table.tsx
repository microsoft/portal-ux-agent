import React from 'react';

export const Table: React.FC<{ columns?: string[]; data?: any[]; sortable?: boolean }> = ({ columns = [], data = [], sortable = true }) => (
  <div className="card table-card">
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {columns.map((col, i) => (
            <th key={i} style={{ padding: '8px', borderBottom: '1px solid #ddd', textAlign: 'left' }}>
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {columns.map((col, j) => (
              <td key={j} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                {row[col] || '-'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default Table;
