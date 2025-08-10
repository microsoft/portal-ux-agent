import { Intent } from '../agent/intent-processor.js';
import { loadTemplate, Template } from '../templates/template-loader.js';
import { mapDataToComponents, Component } from '../components/component-mapper.js';
import { v4 as uuidv4 } from 'uuid';

export interface UIComposition {
  sessionId: string;
  template: string;
  components: Component[];
  styles: string[];
  scripts: string[];
  templateData: Template;
}

// In-memory storage for compositions (use Redis in production)
const compositions = new Map<string, UIComposition>();

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
  
  // Store composition
  compositions.set(sessionId, composition);
  
  return composition;
}

export function getComposition(sessionId: string): UIComposition | undefined {
  return compositions.get(sessionId);
}
