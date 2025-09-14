import React from 'react';

export const KpiCard: React.FC<{ title: string; value: string; trend?: string; icon?: string }> = ({ title, value, trend = 'neutral' }) => (
  <div className="card kpi-card">
    <h3>{title}</h3>
    <div className="value">{value}</div>
    <div className={`trend trend-${trend}`}>{trend}</div>
  </div>
);

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

export const Card: React.FC<{ title: string; content?: string; actions?: any[] }> = ({ title, content = '', actions = [] }) => (
  <div className="card">
    <h3>{title}</h3>
    <p>{content}</p>
    {actions.length > 0 && (
      <div className="card-actions">
        {actions.map((action, i) => (
          <button key={i} style={{ marginRight: '8px', padding: '4px 8px' }}>
            {action.label || 'Action'}
          </button>
        ))}
      </div>
    )}
  </div>
);

export const NavItem: React.FC<{ label: string; href?: string; icon?: string }> = ({ label, href = '#', icon = 'item' }) => (
  <div style={{ padding: '8px 0' }}>
    <a href={href} style={{ textDecoration: 'none', color: '#333' }}>
      {icon && <span style={{ marginRight: '8px' }}>📄</span>}
      {label}
    </a>
  </div>
);

export const KanbanColumn: React.FC<{ title: string; cards?: any[]; limit?: number | null }> = ({ title, cards = [], limit = null }) => (
  <div style={{ minWidth: '250px', background: '#f8f9fa', padding: '16px', borderRadius: '8px' }}>
    <h4>{title} {limit && `(${cards.length}/${limit})`}</h4>
    <div>
      {cards.map((card, i) => (
        <div key={i} style={{ background: 'white', margin: '8px 0', padding: '12px', borderRadius: '4px', border: '1px solid #ddd' }}>
          {card.title || 'Card'}
        </div>
      ))}
    </div>
  </div>
);

export const KanbanCard: React.FC<{ title: string; description?: string; assignee?: string; priority?: string }> = ({ 
  title, 
  description = '', 
  assignee = '', 
  priority = 'medium' 
}) => (
  <div style={{ background: 'white', padding: '12px', borderRadius: '4px', border: '1px solid #ddd', margin: '8px 0' }}>
    <h5 style={{ margin: '0 0 8px 0' }}>{title}</h5>
    {description && <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>{description}</p>}
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888' }}>
      {assignee && <span>👤 {assignee}</span>}
      <span className={`priority-${priority}`}>🔸 {priority}</span>
    </div>
  </div>
);

export class ComponentRegistry {
  private static components = new Map<string, React.ComponentType<any>>([
    ['KpiCard', KpiCard],
    ['Chart', Chart],
    ['Table', Table],
    ['Card', Card],
    ['NavItem', NavItem],
    ['KanbanColumn', KanbanColumn],
    ['KanbanCard', KanbanCard]
  ]);

  static get(componentType: string): React.ComponentType<any> | undefined {
    return this.components.get(componentType);
  }

  static register(componentType: string, component: React.ComponentType<any>): void {
    this.components.set(componentType, component);
  }
}
