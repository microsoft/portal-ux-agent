export interface Template {
  id: string;
  name: string;
  description: string;
  slots: Array<{
    name: string;
    accepts: string[];
  }>;
  styles?: string[];
  scripts?: string[];
  html: string;
}

// In-memory template storage (in production, load from files or database)
const templates = new Map<string, Template>([
  ['dashboard-cards-grid', {
    id: 'dashboard-cards-grid',
    name: 'Dashboard Cards Grid',
    description: 'A responsive grid layout for dashboard cards and charts',
    slots: [
      { name: 'header', accepts: ['title', 'toolbar'] },
      { name: 'kpiRow', accepts: ['kpi-card', 'metric'] },
      { name: 'cardsGrid', accepts: ['card', 'chart', 'table'] }
    ],
    styles: ['/styles/dashboard.css'],
    html: `
      <div class="dashboard-container">
        <header class="dashboard-header">
          <slot name="header"></slot>
        </header>
        <section class="kpi-row">
          <slot name="kpiRow"></slot>
        </section>
        <main class="cards-grid">
          <slot name="cardsGrid"></slot>
        </main>
      </div>
    `
  }],
  ['portal-leftnav', {
    id: 'portal-leftnav',
    name: 'Portal Left Navigation',
    description: 'Enterprise portal with left navigation sidebar',
    slots: [
      { name: 'nav', accepts: ['nav-item'] },
      { name: 'header', accepts: ['title', 'user-menu'] },
      { name: 'content', accepts: ['page', 'form', 'table', 'chart'] }
    ],
    styles: ['/styles/portal.css'],
    html: `
      <div class="portal-container">
        <nav class="left-nav">
          <slot name="nav"></slot>
        </nav>
        <div class="main-content">
          <header class="top-header">
            <slot name="header"></slot>
          </header>
          <main class="content-area">
            <slot name="content"></slot>
          </main>
        </div>
      </div>
    `
  }],
  ['board-kanban', {
    id: 'board-kanban',
    name: 'Kanban Board',
    description: 'Kanban board with drag-and-drop columns and cards',
    slots: [
      { name: 'toolbar', accepts: ['button', 'filter'] },
      { name: 'columns', accepts: ['kanban-column'] },
      { name: 'cards', accepts: ['kanban-card'] }
    ],
    styles: ['/styles/kanban.css'],
    scripts: ['/scripts/kanban.js'],
    html: `
      <div class="kanban-board">
        <div class="board-toolbar">
          <slot name="toolbar"></slot>
        </div>
        <div class="board-columns">
          <slot name="columns"></slot>
        </div>
      </div>
    `
  }]
]);

export async function loadTemplate(templateId: string): Promise<Template> {
  const template = templates.get(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  return template;
}

export function listTemplates(): Template[] {
  return Array.from(templates.values());
}
