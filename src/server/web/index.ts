// Temporary workaround: re-export symbols via namespace import to avoid TS export resolution bug
import * as RegistryModule from './component-registry.js';

export const { ComponentRegistry, KpiCard, Chart, Table, Card, NavItem, KanbanColumn, KanbanCard } = RegistryModule as any;
