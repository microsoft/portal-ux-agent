import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_USER_ID } from '../shared/config.js';
import { loadTemplate } from '../templates/template-loader.js';
// Note: We purposefully do not use the generic Component shape from component-mapper
// here because UIComposition expects strongly typed UiComponentSpec items (discriminated union).
import { UiComponentSpecArraySchema, type UiComponentSpec } from '../ui-component-library/specs.js';
import { getCompositionByUser, setCompositionForUser, type UIComposition } from './ui-renderer.js';

const moduleDir = dirname(fileURLToPath(import.meta.url));

const COMPONENT_PATHS = [
  resolve(process.cwd(), 'src', 'data', 'default_ui', 'components.json'),
  resolve(moduleDir, '..', 'data', 'default_ui', 'components.json')
];

const TEMPLATE_PATHS = [
  resolve(process.cwd(), 'src', 'data', 'default_ui', 'template.txt'),
  resolve(moduleDir, '..', 'data', 'default_ui', 'template.txt')
];

function findFirstExisting(paths: string[]): string | undefined {
  for (const candidate of paths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function loadTemplateId(): string {
  const envTemplate = (process.env.DEFAULT_UI_TEMPLATE || '').trim();
  if (envTemplate) {
    return envTemplate;
  }

  const templatePath = findFirstExisting(TEMPLATE_PATHS);
  if (templatePath) {
    const raw = readFileSync(templatePath, 'utf-8').trim();
    if (raw) {
      return raw;
    }
  }

  return 'dashboard-cards-grid';
}

function loadComponentSpecs(): UiComponentSpec[] {
  const componentPath = findFirstExisting(COMPONENT_PATHS);
  if (!componentPath) {
    throw new Error('Static UI components file not found at expected locations');
  }

  const raw = readFileSync(componentPath, 'utf-8');
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse JSON in ${componentPath}: ${(err as Error).message}`);
  }

  const parsed = UiComponentSpecArraySchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Static UI components failed validation: ${parsed.error.message}`);
  }

  return parsed.data;
}

export async function seedStaticCompositionIfNeeded(userId: string = DEFAULT_USER_ID): Promise<boolean> {
  const shouldSeed = (process.env.SEED_STATIC_UI ?? '1') !== '0';
  if (!shouldSeed) {
    return false;
  }

  if (getCompositionByUser(userId)) {
    return false;
  }

  try {
    const specs = loadComponentSpecs();
    if (!specs.length) {
      console.warn('[seed.static] Component list was empty; nothing to seed');
      return false;
    }

    const templateId = loadTemplateId();
    const template = await loadTemplate(templateId);
    const sessionId = uuidv4();

    // Ensure every spec has a stable id; reuse validated spec objects directly.
    const components: UiComponentSpec[] = specs.map((spec, index) => {
      const id = spec.id && spec.id.trim() ? spec.id : `${spec.type}-${index}-${sessionId.slice(0, 8)}`;
      return { ...spec, id };
    });

    const composition: UIComposition = {
      sessionId,
      userId,
      template: template.id,
      components,
      styles: template.styles || [],
      scripts: template.scripts || [],
      templateData: template
    };

    setCompositionForUser(userId, composition);
    console.log(`[seed.static] Seeded static UI for user "${userId}" using template "${template.id}"`);
    return true;
  } catch (error) {
    console.warn('[seed.static] Failed to seed static UI:', (error as Error)?.message || error);
    return false;
  }
}

