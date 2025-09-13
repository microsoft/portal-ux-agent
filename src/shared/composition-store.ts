// Shared in-memory composition store for single-process, two-ports setup

export interface StoredComponent {
  id: string;
  type: string;
  props: Record<string, any>;
  slot: string;
}

export interface StoredComposition {
  sessionId: string;
  template: string;
  components: StoredComponent[];
  // Optional fields used by the SSR path
  styles?: string[];
  scripts?: string[];
  templateData?: any;
  // Optional metadata
  userMessage?: string;
  createdAt: number;
}

const compositions = new Map<string, StoredComposition>();

export function setComposition(comp: StoredComposition): void {
  compositions.set(comp.sessionId, comp);
}

export function upsertComposition(partial: Partial<StoredComposition> & { sessionId: string }): StoredComposition {
  const existing = compositions.get(partial.sessionId);
  const merged: StoredComposition = {
    sessionId: partial.sessionId,
    template: partial.template ?? existing?.template ?? 'unknown',
    components: partial.components ?? existing?.components ?? [],
    styles: partial.styles ?? existing?.styles,
    scripts: partial.scripts ?? existing?.scripts,
    templateData: partial.templateData ?? existing?.templateData,
    userMessage: partial.userMessage ?? existing?.userMessage,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  compositions.set(merged.sessionId, merged);
  return merged;
}

export function getComposition(sessionId: string): StoredComposition | undefined {
  return compositions.get(sessionId);
}

export function hasComposition(sessionId: string): boolean {
  return compositions.has(sessionId);
}

export function deleteComposition(sessionId: string): boolean {
  return compositions.delete(sessionId);
}

export function listCompositionIds(): string[] {
  return Array.from(compositions.keys());
}

// Optional: cleanup compositions older than ttlMs (default: no-op if ttlMs <= 0)
export function cleanupExpired(ttlMs = 0): number {
  if (ttlMs <= 0) return 0;
  const now = Date.now();
  let removed = 0;
  for (const [id, comp] of compositions) {
    if (now - comp.createdAt > ttlMs) {
      compositions.delete(id);
      removed++;
    }
  }
  return removed;
}

