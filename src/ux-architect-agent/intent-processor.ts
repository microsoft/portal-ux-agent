import { z } from 'zod';
import { loadTemplate } from '../templates/template-loader.js';

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
	const intent: Intent = {
		userGoal: message,
		dataStructure: 'unknown',
		suggestedTemplate: 'dashboard-cards-grid',
		components: ['card', 'chart'],
		extractedData: null
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
