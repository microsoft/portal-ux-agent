import { processUserIntent } from '../../ux-architect-agent/intent-processor.js';
import { renderUI } from '../../ui-builder-agent/ui-renderer.js';
import { DEFAULT_USER_ID } from '../../shared/config.js';

export interface CreatePortalUiArgs {
  message: string;
  userId?: string;
}

export interface CreatePortalUiResult {
  success: boolean;
  userId: string;
  sessionId: string;
  viewUrl: string;
  composition: any;
}

export const toolsDescriptor = [
  {
    name: 'create_portal_ui',
    description: 'Create a portal UI based on user requirements',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'User message describing the UI to create' },
        userId: { type: 'string', description: 'Optional user id (defaults to "default")' }
      },
      required: ['message']
    }
  }
];

export async function handleCreatePortalUi(args: CreatePortalUiArgs): Promise<CreatePortalUiResult> {
  if (!args?.message || !args.message.trim()) {
    throw new Error('message is required');
  }
  const userId = (args.userId && args.userId.trim()) || DEFAULT_USER_ID;
  const intent = await processUserIntent(args.message);
  const composition = await renderUI(intent, userId);
  const uiPort = Number(process.env.UI_PORT) || 3000;
  return {
    success: true,
    userId,
    sessionId: composition.sessionId,
    viewUrl: `http://localhost:${uiPort}/ui/${encodeURIComponent(userId)}`,
    composition
  };
}
