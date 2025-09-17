import { Intent } from '../ux-architect-agent/intent-processor.js';
import { loadTemplate, Template } from '../templates/template-loader.js';
import { mapDataToComponents, Component } from '../ui-component-library/component-mapper.js';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_USER_ID } from '../shared/config.js';

export interface UIComposition {
  sessionId: string; // internal tracking id
  userId: string;    // primary lookup key
  template: string;
  components: Component[];
  styles: string[];
  scripts: string[];
  templateData: Template;
}

const compositionsByUser = new Map<string, UIComposition>();

export async function renderUI(intent: Intent, userId: string = DEFAULT_USER_ID): Promise<UIComposition> {
  const sessionId = uuidv4();
  const template = await loadTemplate(intent.suggestedTemplate);
  const components = await mapDataToComponents(
    intent.components,
    intent.extractedData,
    template.slots
  );
  const composition: UIComposition = {
    sessionId,
    userId,
    template: intent.suggestedTemplate,
    components,
    styles: template.styles || [],
    scripts: template.scripts || [],
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
