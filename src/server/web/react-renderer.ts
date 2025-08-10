import React from 'react';
import { renderToString } from 'react-dom/server';
import { UIComposition } from '../../rendering/ui-renderer.js';
import { ComponentRegistry } from './component-registry.js';

export async function renderReactUI(composition: UIComposition): Promise<string> {
  // Create the React component tree based on composition
  const componentElements = composition.components.map(component => {
    const ComponentClass = ComponentRegistry.get(component.type);
    if (!ComponentClass) {
      return React.createElement('div', { key: component.id }, `Unknown component: ${component.type}`);
    }
    
    return React.createElement(ComponentClass, {
      key: component.id,
      ...component.props
    });
  });

  // Group components by slot
  const slotComponents: Record<string, React.ReactElement[]> = {};
  composition.components.forEach((component, index) => {
    if (!slotComponents[component.slot]) {
      slotComponents[component.slot] = [];
    }
    slotComponents[component.slot].push(componentElements[index]);
  });

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
      ${composition.styles.map(style => `<link rel="stylesheet" href="${style}">`).join('')}
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
        .kanban-board { padding: 20px; }
        .board-columns { display: flex; gap: 20px; }
        .card { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      </style>
    </head>
    <body>
      ${finalHTML}
      ${composition.scripts.map(script => `<script src="${script}"></script>`).join('')}
    </body>
    </html>
  `;

  return fullHTML;
}
