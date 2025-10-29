export const config = {
  jwtSecret: process.env.JWT_SECRET || 'change_this_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  // Refresh token expiry in days
  refreshTokenExpiresDays: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10),
  // Login code expiry in minutes
  loginCodeExpiryMinutes: parseInt(process.env.LOGIN_CODE_EXPIRY_MINUTES || '10', 10),
  // Email verification token expiry in hours
  emailVerificationExpiryHours: parseInt(process.env.EMAIL_VERIFICATION_EXPIRY_HOURS || '24', 10),
  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
    secure: (process.env.SMTP_SECURE || 'false') === 'true',
    authUser: process.env.SMTP_USER || undefined,
    authPass: process.env.SMTP_PASS || undefined,
    from: process.env.SMTP_FROM || 'no-reply@example.com',
  },
};
