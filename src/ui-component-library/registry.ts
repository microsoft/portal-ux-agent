import React from 'react';
import { KpiCard } from './components/KpiCard.js';
import { Chart } from './components/Chart.js';
import { Table } from './components/Table.js';
import { Card } from './components/Card.js';
import { NavItem } from './components/NavItem.js';
import { KanbanColumn } from './components/KanbanColumn.js';
import { KanbanCard } from './components/KanbanCard.js';
import { Input } from './components/Input.js';
import { Textarea } from './components/Textarea.js';
import { Select } from './components/Select.js';
import { Combobox } from './components/Combobox.js';
import { Checkbox } from './components/Checkbox.js';
import { RadioGroup } from './components/RadioGroup.js';
import { Switch } from './components/Switch.js';
import { Alert } from './components/Alert.js';
import { AlertDialog } from './components/AlertDialog.js';
import { SearchBox } from './components/SearchBox.js';

export class ComponentRegistry {
  private static components = new Map<string, React.ComponentType<any>>([
    ['KpiCard', KpiCard],
    ['Chart', Chart],
    ['Table', Table],
    ['Card', Card],
    ['NavItem', NavItem],
    ['KanbanColumn', KanbanColumn],
    ['KanbanCard', KanbanCard],
    ['Input', Input],
    ['Textarea', Textarea],
    ['Select', Select],
    ['Combobox', Combobox],
    ['Checkbox', Checkbox],
    ['RadioGroup', RadioGroup],
    ['Switch', Switch],
    ['Alert', Alert],
    ['AlertDialog', AlertDialog],
    ['SearchBox', SearchBox]
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
export * from './components/Input.js';
export * from './components/Textarea.js';
export * from './components/Select.js';
export * from './components/Combobox.js';
export * from './components/Checkbox.js';
export * from './components/RadioGroup.js';
export * from './components/Switch.js';
export * from './components/Alert.js';
export * from './components/AlertDialog.js';
export * from './components/SearchBox.js';
