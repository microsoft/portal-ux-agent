import { Intent } from '../agent/intent-processor.js';
import { loadTemplate, Template } from '../templates/template-loader.js';
import { mapDataToComponents, Component } from '../components/component-mapper.js';
import { v4 as uuidv4 } from 'uuid';
import { setComposition as storeSetComposition, getComposition as storeGetComposition } from '../shared/composition-store.js';

export interface UIComposition {
  sessionId: string;
  template: string;
  components: Component[];
  styles: string[];
  scripts: string[];
  templateData: Template;
}

export async function renderUI(intent: Intent): Promise<UIComposition> {
  const sessionId = uuidv4();
  
  // Load the template
  const template = await loadTemplate(intent.suggestedTemplate);
  
  // Map data to components
  const components = await mapDataToComponents(
    intent.components,
    intent.extractedData,
    template.slots
  );
  
  // Create composition
  const composition: UIComposition = {
    sessionId,
    template: intent.suggestedTemplate,
    components,
    styles: template.styles || [],
    scripts: template.scripts || [],
    templateData: template
  };
  
  // Store composition in the shared store
  storeSetComposition({
    sessionId,
    template: composition.template,
    components: composition.components.map(c => ({ id: c.id, type: c.type, props: c.props, slot: c.slot })),
    styles: composition.styles,
    scripts: composition.scripts,
    templateData: composition.templateData,
    userMessage: intent.userGoal,
    createdAt: Date.now(),
  });
  
  return composition;
}

export function getComposition(sessionId: string): UIComposition | undefined {
  const stored = storeGetComposition(sessionId) as any;
  if (!stored) return undefined;
  // Best-effort cast back to UIComposition
  return {
    sessionId: stored.sessionId,
    template: stored.template,
    components: stored.components,
    styles: stored.styles || [],
    scripts: stored.scripts || [],
    templateData: stored.templateData,
  } as UIComposition;
}
