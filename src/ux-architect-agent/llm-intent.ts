import { DefaultAzureCredential } from '@azure/identity';
import type { AccessToken } from '@azure/core-auth';
import {
  INTENT_LOG_PROMPT,
  INTENT_TIMEOUT_MS,
  AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_DEPLOYMENT,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_SCOPE,
  AZURE_OPENAI_USE_AAD,
  isAzureOpenAIConfigured
} from '../shared/config.js';

export const SUPPORTED_TEMPLATES = ['dashboard-cards-grid', 'portal-leftnav', 'board-kanban'] as const;
export const SUPPORTED_COMPONENTS = [
  'kpi-card',
  'chart',
  'table',
  'nav-item',
  'kanban-column',
  'kanban-card',
  'card',
  'content-area'
] as const;

type ChatMessage = { role: 'system' | 'user'; content: string };

function buildPrompt(message: string): ChatMessage[] {
  const system = `You are an intent-to-UI planner for a Portal UI generator.
Return ONLY one compact JSON object (no prose, no markdown) with this shape:
{
  "userGoal": string,
  "dataStructure": "list" | "grid" | "kanban" | "chart" | "form" | "unknown",
  "suggestedTemplate": string,        // one of: ${SUPPORTED_TEMPLATES.join(', ')}
  "components": string[],             // hyphen-case IDs, subset of: ${SUPPORTED_COMPONENTS.join(', ')}
  "extractedData": {
    // optional structured information
    "componentsDetailed"?: [
      {
        "type": "KpiCard" | "Chart" | "Table" | "Card" | "NavItem" | "KanbanColumn" | "KanbanCard",
        "library": "shadcn",
        "slot": string,               // valid slot for template (see Slots below)
        "props": object               // must match Component Props below
      }
    ]
  }
}

Slots by template:
- dashboard-cards-grid
  - header: accepts [title, toolbar]
  - kpiRow: accepts [kpi-card, metric]
  - cardsGrid: accepts [card, chart, table]
- portal-leftnav
  - nav: accepts [nav-item]
  - header: accepts [title, user-menu]
  - content: accepts [page, form, table, chart]
- board-kanban
  - toolbar: accepts [button, filter]
  - columns: accepts [kanban-column]
  - cards: accepts [kanban-card]

Component Props (must conform):
- kpi-card -> type: KpiCard
  props: { title: string, value: string|number, trend: "up"|"down"|"neutral", icon?: string }
- chart -> type: Chart
  props: { type: "line"|"bar"|"pie", title?: string, data: any[] }
- table -> type: Table
  props: { columns: (string|object)[], data: any[], sortable?: boolean }
- card -> type: Card
  props: { title?: string, content?: string, actions?: any[] }
- nav-item -> type: NavItem
  props: { label: string, href?: string, icon?: string }
- kanban-column -> type: KanbanColumn
  props: { title: string, limit?: number|null, cards: any[] }
- kanban-card -> type: KanbanCard
  props: { title: string, description?: string, assignee?: string, priority?: "low"|"medium"|"high" }

Rules:
- Pick the best template; set dataStructure.
- Fill "components" with compatible hyphen-case IDs for backward compatibility.
- If possible, provide "extractedData.componentsDetailed" with fully specified elements ready to render.
- No explanations or comments — JSON object only.`;\r\n\r\n  const user = `User message: ${message}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

let aadCredential: DefaultAzureCredential | undefined;
let cachedAccessToken: AccessToken | undefined;

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (AZURE_OPENAI_USE_AAD) {
    aadCredential ??= new DefaultAzureCredential();
    const now = Date.now();
    const expiresOn = cachedAccessToken?.expiresOnTimestamp ?? 0;
    if (!cachedAccessToken || expiresOn - 60_000 <= now) {
      const token = await aadCredential.getToken(AZURE_OPENAI_SCOPE);
      if (!token?.token) {
        throw new Error('Unable to acquire Azure AD access token for Azure OpenAI');
      }
      cachedAccessToken = token;
    }
    headers.Authorization = `Bearer ${cachedAccessToken.token}`;
  } else {
    if (!AZURE_OPENAI_API_KEY) {
      throw new Error('Azure OpenAI API key is not configured');
    }
    headers['api-key'] = AZURE_OPENAI_API_KEY;
  }

  return headers;
}

function buildCompletionsUrl(): string {
  const trimmedEndpoint = AZURE_OPENAI_ENDPOINT.replace(/\/+$/, '');
  return `${trimmedEndpoint}/openai/deployments/${encodeURIComponent(
    AZURE_OPENAI_DEPLOYMENT
  )}/chat/completions?api-version=${encodeURIComponent(AZURE_OPENAI_API_VERSION)}`;
}

export function azureOpenAIEnabled(): boolean {
  return isAzureOpenAIConfigured();
}

export async function generateIntentLLM(message: string): Promise<unknown> {
  if (!azureOpenAIEnabled()) {
    throw new Error('Azure OpenAI is not configured');
  }

  const url = buildCompletionsUrl();
  const body: Record<string, unknown> = {
    messages: buildPrompt(message),
    temperature: 0.2,
    response_format: { type: 'json_object' }
  };

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), INTENT_TIMEOUT_MS);

  try {
    if (INTENT_LOG_PROMPT) {
      // eslint-disable-next-line no-console
      console.log('[intent.llm] prompt', JSON.stringify(body.messages));
    }

    const headers = await buildAuthHeaders();
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal
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
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Azure OpenAI request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}



