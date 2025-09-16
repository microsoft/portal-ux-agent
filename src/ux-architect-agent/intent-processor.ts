import { z } from 'zod';
import { generateIntentLLM, SUPPORTED_TEMPLATES, SUPPORTED_COMPONENTS } from './llm-intent.js';

// Intent schema
const IntentSchema = z.object({
	userGoal: z.string(),
	dataStructure: z.enum(['list', 'grid', 'kanban', 'chart', 'form', 'unknown']),
	suggestedTemplate: z.string(),
	components: z.array(z.string()),
	extractedData: z.any().optional()
});

export type Intent = z.infer<typeof IntentSchema>;

// Legacy keyword intent removed per requirement: LLM path only.

function normalizeIntent(raw: Intent): Intent {
  // Clamp template
  const template = SUPPORTED_TEMPLATES.includes(raw.suggestedTemplate as any)
    ? raw.suggestedTemplate
    : 'dashboard-cards-grid';
  // Filter components
  const components = (raw.components || []).filter(c => (SUPPORTED_COMPONENTS as readonly string[]).includes(c));
  // Clamp dataStructure
  const allowedStructures = ['list', 'grid', 'kanban', 'chart', 'form', 'unknown'] as const;
  const dataStructure = (allowedStructures as readonly string[]).includes(raw.dataStructure)
    ? raw.dataStructure
    : 'unknown';
  return {
    userGoal: raw.userGoal || '',
    dataStructure,
    suggestedTemplate: template,
    components: components.length ? components : ['card'],
    extractedData: raw.extractedData ?? null,
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
