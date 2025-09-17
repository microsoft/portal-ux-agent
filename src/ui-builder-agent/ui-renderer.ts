import { Intent } from '../ux-architect-agent/intent-processor.js';
import { loadTemplate, Template } from '../templates/template-loader.js';
import type { UiComponentSpec } from '../ui-component-library/specs.js';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_USER_ID } from '../shared/config.js';

export interface UIComposition {
  sessionId: string; // internal tracking id
  userId: string;    // primary lookup key
  template: string;
  components: UiComponentSpec[];
  styles: string[];
  scripts: string[];
  templateData: Template;
}

const compositionsByUser = new Map<string, UIComposition>();

export async function renderUI(intent: Intent, userId: string = DEFAULT_USER_ID): Promise<UIComposition> {
  const sessionId = uuidv4();
  const template = await loadTemplate(intent.template);
  const components = intent.components.map((component, index) => ({
    ...component,
    id: component.id && component.id.trim() ? component.id : `${component.type}-${index}-${sessionId.slice(0, 8)}`,
  }));
  const composition: UIComposition = {
    sessionId,
    userId,
    template: intent.template,
    components,
    styles: Array.from(new Set([...(template.styles || []), ...(intent.styles || [])])),
    scripts: Array.from(new Set([...(template.scripts || []), ...(intent.scripts || [])])),
    templateData: template
  };
  compositionsByUser.set(userId, composition);
  return composition;
}

export function getCompositionByUser(userId: string): UIComposition | undefined {
  return compositionsByUser.get(userId);
}

export function setCompositionForUser(userId: string, composition: UIComposition): void {
  compositionsByUser.set(userId, composition);
}

export function listUserIds(): string[] {
  return Array.from(compositionsByUser.keys());
}
