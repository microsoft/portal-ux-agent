import { z } from 'zod';
import { loadTemplate } from '../templates/template-loader.js';
import { mapDataToComponents } from '../components/component-mapper.js';

// Intent schema
const IntentSchema = z.object({
  userGoal: z.string(),
  dataStructure: z.enum(['list', 'grid', 'kanban', 'chart', 'form', 'unknown']),
  suggestedTemplate: z.string(),
  components: z.array(z.string()),
  extractedData: z.any().optional()
});

export type Intent = z.infer<typeof IntentSchema>;

export async function processUserIntent(message: string): Promise<Intent> {
  // For now, implement a simple rule-based intent processor
  // In production, you would use an LLM like OpenAI or Anthropic
  
  const intent: Intent = {
    userGoal: message,
    dataStructure: 'unknown',
    suggestedTemplate: 'dashboard-cards-grid',
    components: ['card', 'chart'],
    extractedData: null
  };

  // Simple keyword matching for demo
  if (message.toLowerCase().includes('dashboard')) {
    intent.dataStructure = 'grid';
    intent.suggestedTemplate = 'dashboard-cards-grid';
    intent.components = ['kpi-card', 'chart', 'table'];
  } else if (message.toLowerCase().includes('kanban') || message.toLowerCase().includes('board')) {
    intent.dataStructure = 'kanban';
    intent.suggestedTemplate = 'board-kanban';
    intent.components = ['kanban-column', 'kanban-card'];
  } else if (message.toLowerCase().includes('portal') || message.toLowerCase().includes('navigation')) {
    intent.dataStructure = 'list';
    intent.suggestedTemplate = 'portal-leftnav';
    intent.components = ['nav-item', 'content-area'];
  }

  return intent;
}
