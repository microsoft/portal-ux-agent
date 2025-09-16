import { z } from 'zod';

// Library identifier (kept simple for now)
export const LibraryIdSchema = z.literal('shadcn');
export type LibraryId = z.infer<typeof LibraryIdSchema>;

// Per-component props schemas
export const KpiCardPropsSchema = z.object({
  title: z.string(),
  value: z.union([z.string(), z.number()]),
  trend: z.enum(['up', 'down', 'neutral']).default('neutral'),
  icon: z.string().optional(),
});
export type KpiCardProps = z.infer<typeof KpiCardPropsSchema>;

export const ChartPropsSchema = z.object({
  type: z.enum(['line', 'bar', 'pie']).default('line'),
  title: z.string().optional(),
  data: z.array(z.any()).default([]),
});
export type ChartProps = z.infer<typeof ChartPropsSchema>;

export const TablePropsSchema = z.object({
  columns: z.array(z.union([z.string(), z.any()])).default([]),
  data: z.array(z.any()).default([]),
  sortable: z.boolean().default(true),
});
export type TableProps = z.infer<typeof TablePropsSchema>;

export const CardPropsSchema = z.object({
  title: z.string().optional().default('Card Title'),
  content: z.string().optional().default(''),
  actions: z.array(z.any()).default([]),
});
export type CardProps = z.infer<typeof CardPropsSchema>;

export const NavItemPropsSchema = z.object({
  label: z.string(),
  href: z.string().default('#'),
  icon: z.string().optional(),
});
export type NavItemProps = z.infer<typeof NavItemPropsSchema>;

export const KanbanColumnPropsSchema = z.object({
  title: z.string(),
  cards: z.array(z.any()).default([]),
  limit: z.number().nullable().optional(),
});
export type KanbanColumnProps = z.infer<typeof KanbanColumnPropsSchema>;

export const KanbanCardPropsSchema = z.object({
  title: z.string(),
  description: z.string().optional().default(''),
  assignee: z.string().optional().default(''),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});
export type KanbanCardProps = z.infer<typeof KanbanCardPropsSchema>;

// Discriminated union for spec JSON
export const UiComponentSpecSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().optional(),
    type: z.literal('KpiCard'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: KpiCardPropsSchema,
  }),
  z.object({
    id: z.string().optional(),
    type: z.literal('Chart'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: ChartPropsSchema,
  }),
  z.object({
    id: z.string().optional(),
    type: z.literal('Table'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: TablePropsSchema,
  }),
  z.object({
    id: z.string().optional(),
    type: z.literal('Card'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: CardPropsSchema,
  }),
  z.object({
    id: z.string().optional(),
    type: z.literal('NavItem'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: NavItemPropsSchema,
  }),
  z.object({
    id: z.string().optional(),
    type: z.literal('KanbanColumn'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: KanbanColumnPropsSchema,
  }),
  z.object({
    id: z.string().optional(),
    type: z.literal('KanbanCard'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: KanbanCardPropsSchema,
  }),
]);

export type UiComponentSpec = z.infer<typeof UiComponentSpecSchema>;

export const UiComponentSpecArraySchema = z.array(UiComponentSpecSchema);

export function validateUiComponents(json: unknown): UiComponentSpec[] {
  const parsed = UiComponentSpecArraySchema.safeParse(json);
  if (!parsed.success) {
    throw new Error('Invalid UI component specs: ' + parsed.error.message);
  }
  return parsed.data;
}

