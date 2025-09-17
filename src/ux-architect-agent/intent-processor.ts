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

export async function processUserIntent(message: string): Promise<Intent> {
  try {
    const raw = await generateIntentLLM(message, { force: true });
    const parsed = IntentSchema.safeParse(raw);
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
