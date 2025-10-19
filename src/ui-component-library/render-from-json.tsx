import React from 'react';
import { renderToString } from 'react-dom/server';
import { ComponentRegistry } from './registry.js';
import type { UiComponentSpec } from './specs.js';

export function specToReactElement(spec: UiComponentSpec): React.ReactElement {
  const Cmp = ComponentRegistry.get(spec.type);
  if (!Cmp) {
    return React.createElement('div', null, `Unknown component: ${spec.type}`);
  }
  return React.createElement(Cmp as any, { ...(spec.props as any), key: (spec as any).id });
}

export function groupBySlot(specs: UiComponentSpec[]): Record<string, React.ReactElement[]> {
  const out: Record<string, React.ReactElement[]> = {};
  for (const spec of specs) {
    if (!out[spec.slot]) out[spec.slot] = [];
    out[spec.slot].push(specToReactElement(spec));
  }
  return out;
}

export function renderSlotElements(elements: React.ReactElement[]): string {
  return elements.map(el => renderToString(el)).join('');
}

