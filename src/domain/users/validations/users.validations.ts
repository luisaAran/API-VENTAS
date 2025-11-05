import { z } from 'zod';

export const addBalanceSchema = z.object({
  body: z.object({
    amount: z
      .number()
      .positive('Amount must be positive')
      .max(999_000_000, 'Maximum amount is $999,000,000 per transaction')
      .refine(
        (val) => {
          // Check if the number has at most 2 decimal places
          const rounded = Math.round(val * 100) / 100;
          return Math.abs(val - rounded) < 0.0001;
        },
        'Amount must have at most 2 decimal places'
      ),
  }),
});

export const updateNotificationPreferencesSchema = z.object({
  body: z.object({
    notifyBalanceUpdates: z.boolean({
      required_error: 'notifyBalanceUpdates is required',
      invalid_type_error: 'notifyBalanceUpdates must be a boolean',
    }),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number'),
  }),
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
    email: z.string().email('Invalid email format').optional(),
    balance: z
      .number()
      .nonnegative('Balance cannot be negative')
      .max(999_000_000, 'Maximum balance is $999,000,000')
      .optional(),
    notifyBalanceUpdates: z.boolean().optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    'At least one field must be provided for update'
  ),
});

export const deleteUserSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number'),
  }),
});

export type AddBalanceInput = z.infer<typeof addBalanceSchema>['body'];
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>['body'];
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
