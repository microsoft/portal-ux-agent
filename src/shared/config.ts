export const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || 'default';

// Azure OpenAI (Azure AI Foundry) configuration
export const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || '';
export const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY || '';
export const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-5-mini';
export const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
export const AZURE_OPENAI_SCOPE = process.env.AZURE_OPENAI_SCOPE || 'https://cognitiveservices.azure.com/.default';
export const AZURE_OPENAI_USE_AAD = (process.env.AZURE_OPENAI_USE_AAD || '0') === '1';

// Intent generation runtime flags
export const INTENT_TIMEOUT_MS = Number(process.env.INTENT_TIMEOUT_MS || 50000);
// Default logging ON by default so that prompt + meta tracing is always captured unless explicitly disabled.
export const INTENT_LOG_PROMPT = (process.env.INTENT_LOG_PROMPT || '1') === '1';

export function isAzureOpenAIConfigured(): boolean {
  return Boolean(
    AZURE_OPENAI_ENDPOINT &&
    AZURE_OPENAI_DEPLOYMENT &&
    (AZURE_OPENAI_API_KEY || AZURE_OPENAI_USE_AAD)
  );
}
