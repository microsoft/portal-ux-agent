export interface Component {
  id: string;
  type: string;
  library: string;
  props: Record<string, any>;
  slot: string;
}

export interface ComponentMapping {
  componentType: string;
  defaultProps: Record<string, any>;
  dataMapping?: Record<string, string>;
}

// Component mappings for different types
const componentMappings = new Map<string, ComponentMapping>([
  ['kpi-card', {
    componentType: 'KpiCard',
    defaultProps: {
      title: 'Metric',
      value: '0',
      trend: 'neutral',
      icon: 'chart'
    },
    dataMapping: {
      'value': 'value',
      'title': 'label',
      'change': 'trend'
    }
  }],
  ['chart', {
    componentType: 'Chart',
    defaultProps: {
      type: 'line',
      data: [],
      title: 'Chart'
    },
    dataMapping: {
      'data': 'dataset',
      'title': 'title',
      'type': 'chartType'
    }
  }],
  ['table', {
    componentType: 'Table',
    defaultProps: {
      columns: [],
      data: [],
      sortable: true
    },
    dataMapping: {
      'data': 'rows',
      'columns': 'headers'
    }
  }],
  ['card', {
    componentType: 'Card',
    defaultProps: {
      title: 'Card Title',
      content: 'Card content',
      actions: []
    }
  }],
  ['nav-item', {
    componentType: 'NavItem',
    defaultProps: {
      label: 'Navigation Item',
      href: '#',
      icon: 'item'
    }
  }],
  ['kanban-column', {
    componentType: 'KanbanColumn',
    defaultProps: {
      title: 'Column',
      cards: [],
      limit: null
    }
  }],
  ['kanban-card', {
    componentType: 'KanbanCard',
    defaultProps: {
      title: 'Task',
      description: '',
      assignee: '',
      priority: 'medium'
    }
  }]
]);

export async function mapDataToComponents(
  componentTypes: string[],
  extractedData: any,
  templateSlots: Array<{ name: string; accepts: string[] }>
): Promise<Component[]> {
  const components: Component[] = [];

  for (const componentType of componentTypes) {
    const mapping = componentMappings.get(componentType);
    if (!mapping) {
      console.warn(`Unknown component type: ${componentType}`);
      continue;
    }

    // Find appropriate slot for this component
    const slot = templateSlots.find(s => s.accepts.includes(componentType))?.name || 'default';

    // Create component with mapped data
    const component: Component = {
      id: `${componentType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: mapping.componentType,
      library: 'shadcn', // Default library
      props: { ...mapping.defaultProps },
      slot
    };

    // Map extracted data to component props if available
    if (extractedData && mapping.dataMapping) {
      for (const [propKey, dataKey] of Object.entries(mapping.dataMapping)) {
        if (extractedData[dataKey] !== undefined) {
          component.props[propKey] = extractedData[dataKey];
        }
      }
    }

    components.push(component);
  }

  return components;
}
