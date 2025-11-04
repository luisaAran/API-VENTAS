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

export type AddBalanceInput = z.infer<typeof addBalanceSchema>['body'];
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>['body'];
