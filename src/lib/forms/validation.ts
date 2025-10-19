import { z } from 'zod';

export const goalDynamicStatusSchema = z.enum(['ok', 'warn', 'risk']);

export const goalFormSchema = z.object({
  name: z
    .string()
    .min(1, 'A goal name is required.')
    .max(120, 'Keep goal names under 120 characters.'),
  owner: z
    .string()
    .min(1, 'An owner is required.')
    .max(80, 'Owner value should be concise.'),
  dynamicStatus: goalDynamicStatusSchema,
  audits: z.number().min(0, 'Audits cannot be negative.')
});

export type GoalFormValues = z.infer<typeof goalFormSchema>;

export const coerceGoalFormSchema = goalFormSchema.extend({
  audits: z
    .preprocess(value => {
      if (value === '' || value === null || value === undefined) {
        return undefined;
      }
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? value : parsed;
      }
      return value;
    }, goalFormSchema.shape.audits)
});
