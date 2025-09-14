import React from 'react';

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

export default KanbanColumn;
