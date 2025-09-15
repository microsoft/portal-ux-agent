import { z } from 'zod';
import { generateIntentLLM, azureOpenAIEnabled, SUPPORTED_TEMPLATES, SUPPORTED_COMPONENTS } from './llm-intent.js';

// Intent schema
const IntentSchema = z.object({
	userGoal: z.string(),
	dataStructure: z.enum(['list', 'grid', 'kanban', 'chart', 'form', 'unknown']),
	suggestedTemplate: z.string(),
	components: z.array(z.string()),
	extractedData: z.any().optional()
});

export type Intent = z.infer<typeof IntentSchema>;

function legacyRuleIntent(message: string): Intent {
  const intent: Intent = {
    userGoal: message,
    dataStructure: 'unknown',
    suggestedTemplate: 'dashboard-cards-grid',
    components: ['card', 'chart'],
    extractedData: null,
  };
  const lower = message.toLowerCase();
  if (lower.includes('dashboard') || lower.includes('metrics') || lower.includes('kpi')) {
    intent.dataStructure = 'grid';
    intent.suggestedTemplate = 'dashboard-cards-grid';
    intent.components = ['kpi-card', 'chart', 'table'];
  } else if (lower.includes('kanban') || lower.includes('board')) {
    intent.dataStructure = 'kanban';
    intent.suggestedTemplate = 'board-kanban';
    intent.components = ['kanban-column', 'kanban-card'];
  } else if (lower.includes('portal') || lower.includes('navigation')) {
    intent.dataStructure = 'list';
    intent.suggestedTemplate = 'portal-leftnav';
    intent.components = ['nav-item', 'content-area'];
  }
  return intent;
}

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
  // Try LLM first if configured
  if (azureOpenAIEnabled()) {
    try {
      const raw = await generateIntentLLM(message);
      const parsed = IntentSchema.safeParse(raw);
      if (parsed.success) {
        return normalizeIntent(parsed.data);
      }
    } catch (err) {
      // fall through to legacy
    }
  }
  // Fallback to legacy keyword rules
  return legacyRuleIntent(message);
}
