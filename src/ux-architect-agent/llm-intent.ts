import { INTENT_LOG_PROMPT, INTENT_TIMEOUT_MS, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_API_VERSION, isAzureOpenAIConfigured } from '../shared/config.js';

export const SUPPORTED_TEMPLATES = ['dashboard-cards-grid', 'portal-leftnav', 'board-kanban'] as const;
export const SUPPORTED_COMPONENTS = [
  'kpi-card', 'chart', 'table', 'nav-item', 'kanban-column', 'kanban-card', 'card', 'content-area'
] as const;

type ChatMessage = { role: 'system' | 'user'; content: string };

function buildPrompt(message: string): ChatMessage[] {
  const system = `You are an intent extraction service for a Portal UI generator.
Return ONLY compact JSON matching this TypeScript type, no extra text:
{
  "userGoal": string,
  "dataStructure": "list" | "grid" | "kanban" | "chart" | "form" | "unknown",
  "suggestedTemplate": string, // one of: ${SUPPORTED_TEMPLATES.join(', ')}
  "components": string[],       // subset of: ${SUPPORTED_COMPONENTS.join(', ')}
  "extractedData"?: any
}

Guidance:
- dashboard / metrics / KPI → template: dashboard-cards-grid; components: ["kpi-card","chart","table"].
- kanban / board → template: board-kanban; components: ["kanban-column","kanban-card"].
- portal / navigation → template: portal-leftnav; components: ["nav-item","table"].
Prefer concise decisions; do not include explanations.`;

  const user = `User message: ${message}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export function azureOpenAIEnabled(): boolean {
  return isAzureOpenAIConfigured();
}

export async function generateIntentLLM(message: string): Promise<unknown> {
  if (!azureOpenAIEnabled()) {
    throw new Error('Azure OpenAI is not configured');
  }

  const url = `${AZURE_OPENAI_ENDPOINT.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(AZURE_OPENAI_DEPLOYMENT)}/chat/completions?api-version=${encodeURIComponent(AZURE_OPENAI_API_VERSION)}`;
  const body: any = {
    messages: buildPrompt(message),
    temperature: 0.2,
    response_format: { type: 'json_object' }
  };

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), INTENT_TIMEOUT_MS);
  try {
    if (INTENT_LOG_PROMPT) {
      // eslint-disable-next-line no-console
      console.log('[intent.llm] prompt', JSON.stringify(body.messages));
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Azure OpenAI error ${res.status}: ${text}`);
    }
    const data = await res.json();
    const contentText: string | undefined = data?.choices?.[0]?.message?.content;
    if (!contentText) {
      throw new Error('No content returned from Azure OpenAI');
    }
    const parsed = JSON.parse(contentText);
    if (INTENT_LOG_PROMPT) {
      // eslint-disable-next-line no-console
      console.log('[intent.llm] parsed', parsed);
    }
    return parsed;
  } finally {
    clearTimeout(to);
  }
}

