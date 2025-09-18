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
  type: z.enum(['line', 'bar', 'pie', 'area', 'radar', 'radial']).default('line'),
  title: z.string().optional(),
  data: z.array(z.any()).default([]),
  xKey: z.string().optional(),
  yKeys: z.array(z.string()).optional(),
  valueKey: z.string().optional(),
  labelKey: z.string().optional(),
  stacked: z.boolean().optional(),
  colors: z.array(z.string()).optional(),
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

export const InputPropsSchema = z.object({
  label: z.string().optional(),
  type: z.enum(['text', 'password', 'email', 'number', 'search']).default('text'),
  value: z.union([z.string(), z.number()]).optional(),
  placeholder: z.string().optional(),
  disabled: z.boolean().default(false),
});
export type InputProps = z.infer<typeof InputPropsSchema>;

export const TextareaPropsSchema = z.object({
  label: z.string().optional(),
  value: z.string().optional(),
  placeholder: z.string().optional(),
  rows: z.number().int().positive().default(4),
  disabled: z.boolean().default(false),
});
export type TextareaProps = z.infer<typeof TextareaPropsSchema>;

export const SelectOptionSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
});

export const SelectPropsSchema = z.object({
  label: z.string().optional(),
  value: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]).optional(),
  placeholder: z.string().optional(),
  disabled: z.boolean().default(false),
  multiple: z.boolean().default(false),
  options: z.array(SelectOptionSchema).default([]),
});
export type SelectProps = z.infer<typeof SelectPropsSchema>;

export const ComboboxPropsSchema = z.object({
  label: z.string().optional(),
  value: z.union([z.string(), z.number()]).optional(),
  placeholder: z.string().optional(),
  disabled: z.boolean().default(false),
  options: z.array(SelectOptionSchema).default([]),
});
export type ComboboxProps = z.infer<typeof ComboboxPropsSchema>;

export const CheckboxPropsSchema = z.object({
  label: z.string(),
  checked: z.boolean().default(false),
  disabled: z.boolean().default(false),
});
export type CheckboxProps = z.infer<typeof CheckboxPropsSchema>;

export const RadioGroupOptionSchema = SelectOptionSchema;

export const RadioGroupPropsSchema = z.object({
  label: z.string().optional(),
  value: z.union([z.string(), z.number()]).optional(),
  disabled: z.boolean().default(false),
  options: z.array(RadioGroupOptionSchema).default([]),
});
export type RadioGroupProps = z.infer<typeof RadioGroupPropsSchema>;

export const SwitchPropsSchema = z.object({
  label: z.string().optional(),
  checked: z.boolean().default(false),
  disabled: z.boolean().default(false),
});
export type SwitchProps = z.infer<typeof SwitchPropsSchema>;

export const AlertPropsSchema = z.object({
  variant: z.enum(['info', 'success', 'warning', 'destructive']).default('info'),
  title: z.string().optional(),
  description: z.string().optional(),
});
export type AlertProps = z.infer<typeof AlertPropsSchema>;

export const AlertDialogPropsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  confirmLabel: z.string().default('Confirm'),
  cancelLabel: z.string().default('Cancel'),
});
export type AlertDialogProps = z.infer<typeof AlertDialogPropsSchema>;

export const SearchBoxPropsSchema = z.object({
  label: z.string().optional(),
  value: z.string().optional(),
  placeholder: z.string().optional(),
  disabled: z.boolean().default(false),
});
export type SearchBoxProps = z.infer<typeof SearchBoxPropsSchema>;

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
  z.object({
    id: z.string().optional(),
    type: z.literal('Input'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: InputPropsSchema,
  }),
  z.object({
    id: z.string().optional(),
    type: z.literal('Textarea'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: TextareaPropsSchema,
  }),
  z.object({
    id: z.string().optional(),
    type: z.literal('Select'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: SelectPropsSchema,
  }),
  z.object({
    id: z.string().optional(),
    type: z.literal('Combobox'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: ComboboxPropsSchema,
  }),
  z.object({
    id: z.string().optional(),
    type: z.literal('Checkbox'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: CheckboxPropsSchema,
  }),
  z.object({
    id: z.string().optional(),
    type: z.literal('RadioGroup'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: RadioGroupPropsSchema,
  }),
  z.object({
    id: z.string().optional(),
    type: z.literal('Switch'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: SwitchPropsSchema,
  }),
  z.object({
    id: z.string().optional(),
    type: z.literal('Alert'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: AlertPropsSchema,
  }),
  z.object({
    id: z.string().optional(),
    type: z.literal('AlertDialog'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: AlertDialogPropsSchema,
  }),
  z.object({
    id: z.string().optional(),
    type: z.literal('SearchBox'),
    library: LibraryIdSchema.default('shadcn'),
    slot: z.string(),
    props: SearchBoxPropsSchema,
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
