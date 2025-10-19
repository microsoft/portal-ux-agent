import React from 'react';

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

export default KanbanCard;
