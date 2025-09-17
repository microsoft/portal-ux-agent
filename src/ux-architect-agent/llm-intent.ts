import { appendFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
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

const PROMPT_LOG_PATH = process.env.INTENT_PROMPT_LOG || 'logs/intent-prompts.log';

type PromptLogRecord =
  | { kind: 'prompt'; timestamp: string; messages: ChatMessage[]; correlationId: string }
  | { kind: 'request'; timestamp: string; correlationId: string; url: string; method: string; headers: Record<string,string>; body: string }
  | { kind: 'response'; timestamp: string; correlationId: string; status: number; ok: boolean; elapsedMs: number; body: string }
  | { kind: 'parsed'; timestamp: string; correlationId: string; parsed: unknown }
  | { kind: 'error'; timestamp: string; correlationId: string; error: string; aborted?: boolean };

function appendIntentLog(record: PromptLogRecord) {
  if (!INTENT_LOG_PROMPT) return; // safeguard (though default is on)
  try {
    const absolutePath = resolve(process.cwd(), PROMPT_LOG_PATH);
    const directory = dirname(absolutePath);
    if (directory) mkdirSync(directory, { recursive: true });
    appendFileSync(absolutePath, JSON.stringify(record) + '\n');
  } catch (error) {
    console.warn('[intent.llm] failed to append intent log', (error as Error)?.message || error);
  }
}

function logPromptMessages(messages: ChatMessage[], correlationId: string): void {
  appendIntentLog({ kind: 'prompt', timestamp: new Date().toISOString(), messages, correlationId });
}

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
- No explanations or comments — JSON object only.`;

  const user = `User message: ${message}`;
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
  // Correlation ID not yet known here; a temporary one may be generated later. We'll pass placeholder and overwrite if needed.
  // Actual correlationId is created in generateIntentLLM so we only log prompt once the true correlationId is known.
  // So we defer logging; caller passes correlationId.
  return messages;
}

let aadCredential: DefaultAzureCredential | undefined;
let cachedAccessToken: AccessToken | undefined;

function redactHeaders(h: Record<string,string>): Record<string,string> {
  const sensitive = ['authorization','api-key'];
  const out: Record<string,string> = {};
  for (const [k,v] of Object.entries(h)) {
    if (sensitive.includes(k.toLowerCase())) {
      out[k] = '***redacted***';
    } else {
      out[k] = v;
    }
  }
  return out;
}

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

export async function generateIntentLLM(message: string, options?: { force?: boolean }): Promise<unknown> {
  // Removed early configuration throw: always attempt, log when not configured
  if (!azureOpenAIEnabled()) {
    console.warn('[intent.llm] Azure OpenAI not fully configured; attempting call anyway.');
  }

  const url = buildCompletionsUrl();
  const correlationId = Math.random().toString(36).slice(2,10);
  const promptMessages = buildPrompt(message);
  logPromptMessages(promptMessages, correlationId);
  const body: Record<string, unknown> = {
    messages: promptMessages,
    // temperature intentionally omitted (model returns error when provided)
    response_format: { type: 'json_object' }
  };
  const bodyJson = JSON.stringify(body);

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), INTENT_TIMEOUT_MS);

  try {
    const headers = await buildAuthHeaders(); // Will throw if keys / auth missing; that is desired point of failure

    if (INTENT_LOG_PROMPT) {
      const requestRecord: PromptLogRecord = {
        kind: 'request',
        timestamp: new Date().toISOString(),
        correlationId,
        url,
        method: 'POST',
        headers: redactHeaders(headers),
        body: bodyJson
      };
      console.log('[intent.llm] request', JSON.stringify(requestRecord, null, 2));
      appendIntentLog(requestRecord);
    }

    const started = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: bodyJson,
      signal: ctrl.signal
    });
    const elapsedMs = Date.now() - started;
    const rawBody = await res.text().catch(() => '');

    if (INTENT_LOG_PROMPT) {
      const respMeta: PromptLogRecord = {
        kind: 'response',
        timestamp: new Date().toISOString(),
        correlationId,
        status: res.status,
        ok: res.ok,
        elapsedMs,
        body: rawBody
      };
      console.log('[intent.llm] response.full', JSON.stringify(respMeta, null, 2));
      appendIntentLog(respMeta);
    }

    if (!res.ok) {
      throw new Error(`Azure OpenAI error ${res.status}: ${rawBody}`);
    }

    let data: any;
    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseErr) {
      throw new Error('Failed to parse JSON from Azure OpenAI response: ' + (parseErr as Error).message);
    }
    const contentText: string | undefined = data?.choices?.[0]?.message?.content;
    if (!contentText) {
      throw new Error('No content returned from Azure OpenAI');
    }
    const parsed = JSON.parse(contentText);
    if (INTENT_LOG_PROMPT) {
      const parsedRecord: PromptLogRecord = { kind: 'parsed', timestamp: new Date().toISOString(), correlationId, parsed };
      console.log('[intent.llm] parsed', parsedRecord);
      appendIntentLog(parsedRecord);
    }
    return parsed;
  } catch (err: any) {
    if (INTENT_LOG_PROMPT) {
      const errorRecord: PromptLogRecord = {
        kind: 'error',
        timestamp: new Date().toISOString(),
        correlationId,
        error: err?.message || String(err),
        aborted: err?.name === 'AbortError'
      };
      console.error('[intent.llm] failure', errorRecord);
      appendIntentLog(errorRecord);
    }
    if (err?.name === 'AbortError') {
      throw new Error('Azure OpenAI request timed out');
    }
    throw new Error(`[intent.llm] LLM call failed: ${err?.message || String(err)}`);
  } finally {
    clearTimeout(timeout);
  }
}



