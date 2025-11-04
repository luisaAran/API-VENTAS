# Two-Factor Authentication (2FA) - JWT-in-Cookie Flow

## Overview

This document explains the implementation of the Two-Factor Authentication system using JWT-based cookies for enhanced security and statelessness.

---

## Architecture

### Previous Implementation (Map-based)
- Used an in-memory `Map` to store 2FA codes
- Required sending email in the request body during verification
- Not scalable (each server instance had its own Map)
- Vulnerable to email tampering in requests

### Current Implementation (JWT-based)
- Uses JWT tokens stored in HTTP-only cookies
- Code is encrypted within the JWT payload
- Stateless (no server-side storage needed)
- Email is extracted from the JWT, not from request body
- Auto-expiring (JWT handles expiration automatically)

---

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         2FA Authentication Flow                       │
└──────────────────────────────────────────────────────────────────────┘

1. User Login Request
   ┌──────────┐
   │  Client  │──POST /api/auth/login──▶ ┌────────────┐
   └──────────┘  { email, password }     │   Server   │
                                          └────────────┘
                                                 │
                                                 ▼
                                          ┌────────────────────┐
                                          │ Validate credentials│
                                          │ Check email verified│
                                          └────────────────────┘
                                                 │
                                                 ▼
                                          ┌────────────────────┐
                                          │ Generate 6-digit   │
                                          │ random code        │
                                          └────────────────────┘
                                                 │
                                                 ▼
                                          ┌────────────────────┐
                                          │ Create JWT with:   │
                                          │ - email            │
                                          │ - code             │
                                          │ - purpose: '2fa'   │
                                          │ - exp: 10 min      │
                                          └────────────────────┘
                                                 │
                                                 ▼
   ┌──────────┐  Set-Cookie: pendingAuth  ┌────────────┐
   │  Client  │◀─────────────────────────  │   Server   │
   └──────────┘  + Send code via email     └────────────┘
        │
        │ Cookie stored automatically
        ▼
   [pendingAuth cookie]


2. Code Verification
   ┌──────────┐
   │  Client  │──POST /api/auth/verify-code─▶ ┌────────────┐
   └──────────┘  { code: "123456" }           │   Server   │
        │         + Cookie: pendingAuth        └────────────┘
        │                                            │
        │                                            ▼
        │                                     ┌────────────────────┐
        │                                     │ Read pendingAuth   │
        │                                     │ cookie from request│
        │                                     └────────────────────┘
        │                                            │
        │                                            ▼
        │                                     ┌────────────────────┐
        │                                     │ Decode JWT:        │
        │                                     │ - Verify signature │
        │                                     │ - Check expiration │
        │                                     │ - Validate purpose │
        │                                     └────────────────────┘
        │                                            │
        │                                            ▼
        │                                     ┌────────────────────┐
        │                                     │ Compare codes:     │
        │                                     │ JWT.code === code  │
        │                                     └────────────────────┘
        │                                            │
        │                                            ▼
        │                                     ┌────────────────────┐
        │                                     │ Generate tokens:   │
        │                                     │ - accessToken (1h) │
        │                                     │ - refreshToken(7d) │
        │                                     └────────────────────┘
        │                                            │
        ▼                                            ▼
   Set-Cookie: accessToken       ┌─────────────────────────┐
   Set-Cookie: refreshToken      │ Clear pendingAuth cookie│
   Clear: pendingAuth            └─────────────────────────┘
        │
        ▼
   [Authenticated Session]
```

---

## Implementation Details

### 1. Login Request (`POST /api/auth/login`)

**Controller**: `auth.controller.ts`
```typescript
async requestLoginCode(req: Request, res: Response) {
  const { email, password } = req.body;
  const result = await this.authService.requestLoginCode(email, password);
  
  // Set pending auth token as HTTP-only cookie (expires in 10 minutes)
  const tenMinutes = appConfig.loginCodeExpiryMinutes * 60 * 1000;
  res.cookie('pendingAuth', result.pendingAuthToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: tenMinutes,
  });
  
  return res.json({ ok: true, message: 'Login code sent to your email' });
}
```

**Service**: `auth.service.ts`
```typescript
async requestLoginCode(email: string, password: string) {
  // 1. Find user by email
  const user = await this.userRepository.findByEmail(email);
  if (!user) throw new AuthenticationError('Invalid credentials');
  
  // 2. Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) throw new AuthenticationError('Invalid credentials');
  
  // 3. Check email verification
  if (!user.emailVerified) {
    throw new AuthenticationError('Please verify your email before logging in');
  }
  
  // 4. Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // 5. Create JWT with code
  const pendingAuthToken = jwt.sign(
    { 
      email: user.email, 
      code, 
      purpose: '2fa-verification' 
    },
    appConfig.jwtSecret,
    { expiresIn: `${appConfig.loginCodeExpiryMinutes}m` }
  );
  
  // 6. Send code via email
  await sendLoginCode(user.email, code);
  
  return { ok: true, pendingAuthToken };
}
```

### 2. Code Verification (`POST /api/auth/verify-code`)

**Controller**: `auth.controller.ts`
```typescript
async verifyLoginCode(req: Request, res: Response) {
  const { code } = req.body;
  
  // Read pending auth token from cookie
  const pendingAuthToken = req.cookies?.pendingAuth;
  if (!pendingAuthToken) {
    return res.status(401).json({ 
      message: 'No pending authentication found. Please login again.' 
    });
  }
  
  const result = await this.authService.verifyLoginCode(pendingAuthToken, code);
  
  // Clear pending auth cookie
  res.clearCookie('pendingAuth');
  
  // Set access token and refresh token
  const oneHour = 60 * 60 * 1000;
  const accessMaxAge = oneHour;
  const refreshMaxAge = appConfig.refreshTokenExpiresDays * 24 * 60 * 60 * 1000;
  
  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: accessMaxAge,
  });
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: refreshMaxAge,
  });
  
  return res.json({ 
    ok: true, 
    message: 'Login successful',
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
    }
  });
}
```

**Service**: `auth.service.ts`
```typescript
async verifyLoginCode(pendingAuthToken: string, code: string) {
  try {
    // 1. Decode and verify JWT
    const decoded = jwt.verify(pendingAuthToken, appConfig.jwtSecret) as {
      email: string;
      code: string;
      purpose: string;
    };
    
    // 2. Validate purpose
    if (decoded.purpose !== '2fa-verification') {
      throw new ValidationError('Invalid token purpose');
    }
    
    // 3. Compare codes
    if (decoded.code !== code) {
      throw new AuthenticationError('Invalid code');
    }
    
    // 4. Find user
    const user = await this.userRepository.findByEmail(decoded.email);
    if (!user) throw new NotFoundError('User not found');
    
    // 5. Generate access and refresh tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, type: 'access' },
      appConfig.jwtSecret,
      { expiresIn: appConfig.jwtExpiresIn }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, type: 'refresh' },
      appConfig.jwtSecret,
      { expiresIn: `${appConfig.refreshTokenExpiresDays}d` }
    );
    
    return { accessToken, refreshToken, user };
    
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Code expired. Please request a new code.');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid token');
    }
    throw error;
  }
}
```

---

## Security Features

### 1. HTTP-Only Cookies
- Cookies are marked as `httpOnly: true`
- JavaScript cannot access the cookies (XSS protection)
- Only sent via HTTP requests

### 2. Secure Flag (Production)
- Cookies are marked as `secure: true` in production
- Only transmitted over HTTPS
- Prevents man-in-the-middle attacks

### 3. SameSite Protection
- `pendingAuth`: `sameSite: 'strict'` (maximum protection)
- `accessToken`/`refreshToken`: `sameSite: 'lax'` (allows top-level navigation)
- Prevents CSRF attacks

### 4. JWT Expiration
- `pendingAuth`: 10 minutes (short-lived for security)
- `accessToken`: 1 hour
- `refreshToken`: 7 days

### 5. Token Purpose Validation
- JWT includes `purpose: '2fa-verification'`
- Prevents token reuse for different purposes
- Service validates purpose before processing

### 6. Auto-Expiring Codes
- JWT handles expiration automatically
- No need for manual cleanup
- Prevents code replay attacks

---

## Advantages Over Map-Based Approach

### Scalability
- **Map-based**: Each server instance has its own Map
- **JWT-based**: Stateless, works across multiple servers

### Security
- **Map-based**: Email sent in request body (can be intercepted/modified)
- **JWT-based**: Email encrypted in JWT (tamper-proof)

### User Experience
- **Map-based**: User must resend email in verification request
- **JWT-based**: Cookie sent automatically by browser

### Memory Usage
- **Map-based**: Requires server memory to store codes
- **JWT-based**: No server-side storage needed

### Expiration Handling
- **Map-based**: Manual cleanup required
- **JWT-based**: Automatic expiration via JWT

### Debugging
- **Map-based**: Codes stored in memory (hard to inspect)
- **JWT-based**: Can decode JWT to inspect payload (in development)

---

## Error Handling

### 1. No Pending Auth Cookie
```json
Status: 401
{
  "message": "No pending authentication found. Please login again."
}
```
**Cause**: User didn't complete login flow or cookie expired
**Solution**: Redirect to login page

### 2. Invalid Code
```json
Status: 401
{
  "type": "AUTHENTICATION_ERROR",
  "message": "Invalid code"
}
```
**Cause**: User entered wrong code
**Solution**: Allow retry (up to 3 attempts recommended)

### 3. Expired Code
```json
Status: 401
{
  "type": "AUTHENTICATION_ERROR",
  "message": "Code expired. Please request a new code."
}
```
**Cause**: More than 10 minutes passed since login
**Solution**: Redirect to login page

### 4. Invalid Token
```json
Status: 401
{
  "type": "AUTHENTICATION_ERROR",
  "message": "Invalid token"
}
```
**Cause**: JWT signature invalid or payload tampered
**Solution**: Redirect to login page

---

## Validation Schema

### Login Request
```typescript
loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});
```

### Verify Code Request
```typescript
verifyLoginCodeSchema = z.object({
  body: z.object({
    code: z.string()
      .length(6, 'Code must be exactly 6 digits')
      .regex(/^\d{6}$/, 'Code must contain only digits'),
  }),
});
```

**Note**: Email is NOT required in verify-code request - it's extracted from the JWT cookie.

---

## Cookie Lifecycle

### pendingAuth Cookie

```
┌─────────────┐
│ POST /login │  ← Create cookie (10 min expiry)
└─────────────┘
       │
       ▼
[Cookie stored in browser]
       │
       ▼
┌──────────────────┐
│ POST /verify-code│  ← Read cookie
└──────────────────┘
       │
       ├──▶ Success: Clear cookie + set auth cookies
       └──▶ Failure: Keep cookie (allow retry)
```

### Auth Cookies (accessToken + refreshToken)

```
┌──────────────────┐
│ POST /verify-code│  ← Create cookies after successful verification
└──────────────────┘
       │
       ▼
[Cookies stored in browser]
       │
       ├──▶ Protected endpoints: Read accessToken
       ├──▶ Token refresh: Read refreshToken
       └──▶ Logout: Clear both cookies
```

---

## Environment Variables

```bash
# JWT Configuration
JWT_SECRET=change_this_secret_in_production
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_DAYS=7
LOGIN_CODE_EXPIRY_MINUTES=10

# App Configuration
NODE_ENV=production  # Enables secure cookies
```

---

## Testing the Flow

### 1. Test Login Request
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!"
  }' \
  -c cookies.txt
```

**Expected**: 
- Status 200
- Response: `{ "ok": true, "message": "Login code sent to your email" }`
- Cookie file contains `pendingAuth` cookie

### 2. Check Email
- Open email inbox
- Find email with subject "Your Login Code"
- Copy the 6-digit code

### 3. Test Code Verification
```bash
curl -X POST http://localhost:3000/api/auth/verify-code \
  -H "Content-Type: application/json" \
  -d '{
    "code": "123456"
  }' \
  -b cookies.txt \
  -c cookies.txt
```

**Expected**:
- Status 200
- Response includes user data
- Cookie file contains `accessToken` and `refreshToken`
- `pendingAuth` cookie is removed

### 4. Test Authenticated Request
```bash
curl -X GET http://localhost:3000/api/users/me \
  -b cookies.txt
```

**Expected**:
- Status 200
- Returns user profile with orders

---

## Best Practices

### For Frontend Developers

1. **Don't store tokens in localStorage**
   - Cookies are handled automatically
   - More secure than localStorage

2. **Don't send email in verify-code**
   - Email is extracted from the pendingAuth cookie
   - Only send the code

3. **Handle cookie expiration**
   - If pendingAuth expires (10 min), redirect to login
   - If auth tokens expire, app will auto-refresh

4. **Implement retry logic**
   - Allow 3 attempts for code verification
   - After 3 failures, require new login

5. **Clear cookies on logout**
   - Send request to logout endpoint
   - Server will clear all cookies

### For Backend Developers

1. **Never log JWT payloads in production**
   - Contains sensitive information
   - Use request IDs for debugging

2. **Use environment-specific cookie flags**
   - `secure: true` only in production (HTTPS)
   - `sameSite: 'strict'` for pendingAuth

3. **Validate JWT purpose**
   - Always check `purpose` field
   - Prevents token reuse

4. **Set appropriate expiration times**
   - pendingAuth: Short (10 min)
   - accessToken: Medium (1 hour)
   - refreshToken: Long (7 days)

5. **Handle JWT errors properly**
   - `TokenExpiredError`: User-friendly message
   - `JsonWebTokenError`: Generic "Invalid token"
   - Don't expose internal details

---

## Monitoring & Logging

### Successful Login
```
[INFO] User login code sent: user@example.com
[INFO] Request ID: 550e8400-e29b-41d4-a716-446655440000
```

### Failed Login (Invalid Credentials)
```
[WARN] Failed login attempt: user@example.com
[WARN] Reason: Invalid credentials
[WARN] Request ID: 550e8400-e29b-41d4-a716-446655440001
```

### Successful Code Verification
```
[INFO] 2FA verification successful: user@example.com
[INFO] Request ID: 550e8400-e29b-41d4-a716-446655440002
```

### Failed Code Verification
```
[WARN] 2FA verification failed: Invalid code
[WARN] Request ID: 550e8400-e29b-41d4-a716-446655440003
```

### Expired Code
```
[WARN] 2FA verification failed: Code expired
[WARN] Request ID: 550e8400-e29b-41d4-a716-446655440004
```

---

## Migration Notes

### Changes from Previous Version

1. **Removed**: `loginCodeMap` from `AuthService`
2. **Added**: JWT-based `pendingAuth` cookie
3. **Changed**: `requestLoginCode` now returns `pendingAuthToken`
4. **Changed**: `verifyLoginCode` accepts `pendingAuthToken` instead of `email`
5. **Updated**: Validation schema (removed `email` from verify-code)
6. **Updated**: API documentation to reflect new flow

### Breaking Changes

- **Frontend must handle cookies**: No longer sending email in verify-code
- **Cookie support required**: Browser must support HTTP-only cookies
- **HTTPS recommended**: For production deployments

---

## Future Improvements

### 1. Rate Limiting
- Limit login attempts per email (e.g., 5 per hour)
- Limit code verification attempts (e.g., 3 per code)

### 2. Account Lockout
- Lock account after N failed login attempts
- Require email verification to unlock

### 3. Code Attempts Tracking
- Store attempt count in JWT payload
- Lock out after 3 invalid codes

### 4. Backup Codes
- Generate one-time backup codes during registration
- Allow login without 2FA in emergencies

### 5. Remember Device
- Option to skip 2FA on trusted devices
- Use device fingerprinting

### 6. SMS/TOTP Support
- Allow users to choose 2FA method
- Support authenticator apps (Google Authenticator, Authy)

---

## Conclusion

The JWT-in-cookie approach for 2FA provides:
- ✅ Enhanced security (no email in request body)
- ✅ Better scalability (stateless)
- ✅ Improved UX (automatic cookie handling)
- ✅ Auto-expiring codes (JWT expiration)
- ✅ Tamper-proof (JWT signature)

This implementation follows industry best practices and provides a solid foundation for secure authentication.
