import React from 'react';

type ColumnConfig =
  | string
  | {
      key?: string;
      accessor?: string;
      label?: string;
    };

interface TableProps {
  columns?: ColumnConfig[];
  data?: any[];
  sortable?: boolean;
}

interface NormalizedColumn {
  header: string;
  accessor?: string;
}

function normalizeColumns(columns: ColumnConfig[] = []): NormalizedColumn[] {
  return columns.map((col, index) => {
    if (typeof col === 'string') {
      return { header: col, accessor: col };
    }

    if (col && typeof col === 'object') {
      const accessor = typeof col.accessor === 'string' ? col.accessor : typeof col.key === 'string' ? col.key : undefined;
      const header = typeof col.label === 'string' ? col.label : accessor ?? `Column ${index + 1}`;
      return { header, accessor };
    }

    return { header: `Column ${index + 1}` };
  });
}

function formatCellValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export const Table: React.FC<TableProps> = ({ columns = [], data = [], sortable = true }) => {
  const normalized = normalizeColumns(columns);

  return (
    <div className="card table-card">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {normalized.map((col, i) => (
              <th key={col.accessor ?? i} style={{ padding: '8px', borderBottom: '1px solid #ddd', textAlign: 'left' }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {normalized.map((col, j) => {
                const rawValue = col.accessor ? (row?.[col.accessor]) : undefined;
                return (
                  <td key={`${i}-${col.accessor ?? j}`} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                    {formatCellValue(rawValue)}
                  </td>
                );
              })}
            </tr>
          ))}
          {!data.length && (
            <tr>
              <td colSpan={normalized.length || 1} style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>
                {sortable ? 'No data available' : 'No rows to display'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;