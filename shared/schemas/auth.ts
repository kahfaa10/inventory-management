import { z } from 'zod'

export const loginSchema = z.strictObject({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .email('Enter a valid email address.')
    .max(254, 'Email must be at most 254 characters.'),
  password: z
    .string()
    .min(1, 'Password is required.')
    .max(256, 'Password must be at most 256 characters.'),
})

export type LoginInput = z.infer<typeof loginSchema>
