import React from 'react';

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

export default Card;
