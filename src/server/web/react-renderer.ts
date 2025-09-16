import React from 'react';
import { renderToString } from 'react-dom/server';
import { UIComposition } from '../../ui-builder-agent/ui-renderer.js';
import { ComponentRegistry } from '../../ui-component-library/registry.js';
import { groupBySlot, specToReactElement } from '../../ui-component-library/render-from-json.js';
import type { UiComponentSpec } from '../../ui-component-library/specs.js';

export async function renderReactUI(composition: UIComposition): Promise<string> {
  // Create the React component tree based on composition
  const specs = (composition.components as unknown as UiComponentSpec[]);
  const componentElements = specs.map(specToReactElement);
  const slotComponents = groupBySlot(specs);

  // Render the template with components in slots
  const templateHTML = composition.templateData.html;
  
  // Simple slot replacement (in production, use a proper template engine)
  let finalHTML = templateHTML;
  for (const [slotName, components] of Object.entries(slotComponents)) {
    const slotPlaceholder = `<slot name="${slotName}"></slot>`;
    const componentHTML = components.map(comp => renderToString(comp)).join('');
    finalHTML = finalHTML.replace(slotPlaceholder, componentHTML);
  }

  // Wrap in full HTML document
  const fullHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Portal UI - ${composition.sessionId}</title>
  ${composition.styles.map((style: string) => `<link rel="stylesheet" href="${style}">`).join('')}
      <style>
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .dashboard-container { padding: 20px; }
        .dashboard-header { margin-bottom: 20px; }
        .kpi-row { display: flex; gap: 20px; margin-bottom: 20px; }
        .cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .portal-container { display: flex; height: 100vh; }
        .left-nav { width: 250px; background: #f5f5f5; padding: 20px; }
        .main-content { flex: 1; display: flex; flex-direction: column; }
        .top-header { padding: 20px; border-bottom: 1px solid #ddd; }
        .content-area { flex: 1; padding: 20px; }
      </style>
    </head>
    <body>
      <div class="portal-container">
        <div class="left-nav">
          ${renderToString(slotComponents['nav'] ? React.createElement(React.Fragment, null, ...slotComponents['nav']) : React.createElement('div', null))}
        </div>
        <div class="main-content">
          <div class="top-header">
            ${renderToString(slotComponents['header'] ? React.createElement(React.Fragment, null, ...slotComponents['header']) : React.createElement('div', null))}
          </div>
          <div class="content-area">
            ${renderToString(slotComponents['main'] ? React.createElement(React.Fragment, null, ...slotComponents['main']) : React.createElement('div', null))}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return fullHTML;
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
