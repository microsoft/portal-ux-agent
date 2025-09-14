import React from 'react';
import { KpiCard } from './components/KpiCard.js';
import { Chart } from './components/Chart.js';
import { Table } from './components/Table.js';
import { Card } from './components/Card.js';
import { NavItem } from './components/NavItem.js';
import { KanbanColumn } from './components/KanbanColumn.js';
import { KanbanCard } from './components/KanbanCard.js';

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

export * from './components/KpiCard.js';
export * from './components/Chart.js';
export * from './components/Table.js';
export * from './components/Card.js';
export * from './components/NavItem.js';
export * from './components/KanbanColumn.js';
export * from './components/KanbanCard.js';
