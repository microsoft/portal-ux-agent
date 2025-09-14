import React from 'react';

export const NavItem: React.FC<{ label: string; href?: string; icon?: string }> = ({ label, href = '#', icon = 'item' }) => (
  <div style={{ padding: '8px 0' }}>
    <a href={href} style={{ textDecoration: 'none', color: '#333' }}>
      {icon && <span style={{ marginRight: '8px' }}>📄</span>}
      {label}
    </a>
  </div>
);

export default NavItem;
