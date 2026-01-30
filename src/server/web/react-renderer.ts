import React from 'react';
import { renderToString } from 'react-dom/server';
import { UIComposition } from '../../ui-builder-agent/ui-renderer.js';
import { ComponentRegistry } from '../../ui-component-library/registry.js';
import { groupBySlot, specToReactElement } from '../../ui-component-library/render-from-json.js';
import type { UiComponentSpec } from '../../ui-component-library/specs.js';

export async function renderReactUI(composition: UIComposition): Promise<string> {
  const specs = (composition.components as unknown as UiComponentSpec[]);
  const slotComponents = groupBySlot(specs);

  const templateHTML = composition.templateData.html;
  const slots = composition.templateData.slots || [];

  let filledHTML = templateHTML;

  for (const slot of slots) {
    const slotName = slot.name;
    const elements = slotComponents[slotName] || [];
    const rendered = elements.map(el => renderToString(el)).join('');
    const placeholder = new RegExp(`<slot\\s+name=\"${slotName}\"\s*><\\/slot>`, 'gi');
    filledHTML = filledHTML.replace(placeholder, rendered);
    delete slotComponents[slotName];
  }

  filledHTML = filledHTML.replace(/<slot[^>]*><\/slot>/gi, '');

  const leftover = Object.entries(slotComponents)
    .map(([slotName, elements]) => `<!-- unplaced slot: ${slotName} -->${elements.map(el => renderToString(el)).join('')}`)
    .join('');

  const styleLinks = (composition.styles || []).map((style: string) => `<link rel="stylesheet" href="${style}">`).join('');
  const scriptTags = (composition.scripts || []).map((script: string) => `<script src="${script}"><\/script>`).join('\n  ');

  // Chat panel HTML
  const chatPanelHTML = `
    <div id="chat-panel" class="collapsed">
      <div class="chat-header">UX Agent Chat</div>
      <div class="chat-messages"></div>
      <div class="chat-input-area">
        <textarea class="chat-input" placeholder="Describe the UI you want..." rows="1"></textarea>
        <button class="chat-send-btn" title="Send">➤</button>
      </div>
    </div>
    <button id="chat-toggle-btn" title="Toggle Chat">💬</button>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portal UI - ${composition.sessionId}</title>
  ${styleLinks}
  <link rel="stylesheet" href="/styles/chat.css">
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #111827; }
    a { color: inherit; }
  </style>
</head>
<body>
  ${filledHTML}
  ${leftover}
  ${chatPanelHTML}
  <script src="/scripts/chat.js"><\/script>
  ${scriptTags}
</body>
</html>`;
}

export function renderComponent(component: any): string {
  const Component = ComponentRegistry.get(component.type);
  if (!Component) {
    return `<div class="missing-component">Missing component: ${component.type}</div>`;
  }
  try {
    return renderToString(React.createElement(Component as any, component.props || {}));
  } catch (err) {
    return `<div class="component-error">Error rendering ${component.type}: ${(err as Error).message}</div>`;
  }
}

export function renderLayout(layout: any): string {
  if (!layout || !layout.rows) return '<div class="empty-layout">No layout defined</div>';
  return layout.rows.map((row: any) => `
    <div class="row" style="display:flex; gap:16px; margin-bottom:16px;">
      ${row.columns.map((col: any) => `
        <div class="col" style="flex:${col.size || 1}; display:flex; flex-direction:column; gap:16px;">
          ${(col.components || []).map((c: any) => `
            <div class="component-wrapper">${renderComponent(c)}</div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `).join('');
}

export function renderNavigation(nav: any): string {
  if (!nav || !nav.items) return '';
  return `
    <nav style="width:220px; padding:16px; background:#fff; border-right:1px solid #eee;">
      <h3 style="margin-top:0">${nav.title || 'Navigation'}</h3>
      ${(nav.items || []).map((item: any) => renderComponent({ type: 'NavItem', props: item })).join('')}
    </nav>
  `;
}

export function renderHeader(header: any): string {
  if (!header) return '';
  return `
    <header style="padding:16px; background:#fff; border-bottom:1px solid #eee; display:flex; align-items:center; justify-content:space-between;">
      <h1 style="margin:0; font-size:20px;">${header.title || 'Portal'}</h1>
      <div class="header-actions">
        ${(header.actions || []).map((action: any) => `
          <button style="margin-left:8px; padding:6px 12px;">${action.label || 'Action'}</button>
        `).join('')}
      </div>
    </header>
  `;
}

export function renderKanban(kanban: any): string {
  if (!kanban || !kanban.columns) return '';
  return `
    <div class="kanban" style="display:flex; gap:16px; overflow-x:auto; padding:8px;">
      ${(kanban.columns || []).map((col: any) => renderComponent({ type: 'KanbanColumn', props: col })).join('')}
    </div>
  `;
}

export function renderPage(ui: any): string {
  const navigation = renderNavigation(ui.navigation);
  const header = renderHeader(ui.header);
  const layout = renderLayout(ui.layout);
  const kanban = renderKanban(ui.kanban);

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${ui.title || 'Portal UI'}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; background: #f3f4f6; color: #1f2937; }
      .row { }
      .card { background: white; padding: 16px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
      .kpi-card .value { font-size: 28px; font-weight: bold; margin: 8px 0; }
      nav a { display:block; padding:8px 4px; border-radius:4px; }
      nav a:hover { background:#f0f0f0; }
      .trend-positive { color: green; }
      .trend-negative { color: red; }
      .trend-neutral { color: gray; }
      .kanban { margin-top:16px; }
    </style>
  </head>
  <body>
    <div style="display:flex; min-height:100vh;">
      ${navigation}
      <div style="flex:1; display:flex; flex-direction:column;">
        ${header}
        <main style="padding:16px; flex:1;">
          ${layout}
          ${kanban}
        </main>
      </div>
    </div>
  </body>
  </html>
  `;
}
