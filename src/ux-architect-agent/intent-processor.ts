import { z } from 'zod';
import { UiComponentSpecArraySchema, type UiComponentSpec } from '../ui-component-library/specs.js';
import { generateIntentLLM, SUPPORTED_TEMPLATES } from './llm-intent.js';

const IntentSchema = z.object({
  template: z.string(),
  components: UiComponentSpecArraySchema,
  styles: z.array(z.string()).optional(),
  scripts: z.array(z.string()).optional(),
});

export type LlmIntentPayload = z.infer<typeof IntentSchema>;

export interface Intent {
  template: (typeof SUPPORTED_TEMPLATES)[number];
  components: UiComponentSpec[];
  styles: string[];
  scripts: string[];
}

function normalizeIntent(raw: LlmIntentPayload): Intent {
  const template = SUPPORTED_TEMPLATES.includes(raw.template as any)
    ? (raw.template as (typeof SUPPORTED_TEMPLATES)[number])
    : 'dashboard-cards-grid';

  const components = raw.components.map((component, index) => ({
    ...component,
    id: component.id && component.id.trim().length > 0
      ? component.id.trim()
      : `${component.type}-${index}`,
    library: component.library ?? 'shadcn',
  }));

  const uniqueStrings = (values: string[] | undefined): string[] =>
    Array.from(new Set((values || []).map(v => v.trim()).filter(Boolean)));

  return {
    template,
    components,
    styles: uniqueStrings(raw.styles),
    scripts: uniqueStrings(raw.scripts),
  };
}

function defaultSlotFor(template: string, type: string): string {
  switch (template) {
    case 'dashboard-cards-grid':
      return type === 'KpiCard' ? 'kpiRow' : 'cardsGrid';
    case 'portal-leftnav':
      return type === 'NavItem' ? 'nav' : 'content';
    case 'board-kanban':
      if (type === 'KanbanColumn') return 'columns';
      if (type === 'KanbanCard') return 'cards';
      return 'toolbar';
    default:
      return 'content';
  }
}

function sanitizeRawIntent(raw: any) {
  const template = typeof raw?.template === 'string' ? raw.template : 'dashboard-cards-grid';
  const list = Array.isArray(raw?.components) ? raw.components : [];
  const components = list
    .filter((component: any) => component && typeof component === 'object')
    .map((component: any, index: number) => {
      const type = typeof component.type === 'string' ? component.type.trim() : '';
      const slot =
        typeof component.slot === 'string' && component.slot.trim().length > 0
          ? component.slot.trim()
          : defaultSlotFor(template, type);
      const id = typeof component.id === 'string' && component.id.trim().length > 0 ? component.id.trim() : component.id;
      const library = component.library ?? 'shadcn';
      const props = component.props && typeof component.props === 'object' ? component.props : {};
      return { ...component, type, slot, id, library, props, index };
    })
    .filter((component: any) => typeof component.type === 'string' && component.type.length > 0)
    .map(({ index, ...component }: any) => component);
  const styles = Array.isArray(raw?.styles) ? raw.styles.filter((s: any) => typeof s === 'string') : [];
  const scripts = Array.isArray(raw?.scripts) ? raw.scripts.filter((s: any) => typeof s === 'string') : [];
  return { template, components, styles, scripts } as LlmIntentPayload;
}

export async function processUserIntent(message: string): Promise<Intent> {
  try {
    const raw = await generateIntentLLM(message, { force: true });
    const sanitized = sanitizeRawIntent(raw as any);
    const parsed = IntentSchema.safeParse(sanitized);
    if (!parsed.success) {
      console.error('[intent] LLM returned invalid schema:', parsed.error.flatten());
      throw new Error('LLM intent JSON did not match schema');
    }
    return normalizeIntent(parsed.data);
  } catch (e: any) {
    console.error('[intent] LLM intent generation failed (no fallback):', e?.message || e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}
