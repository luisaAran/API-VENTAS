# API Endpoints Documentation

## Base URL
```
http://localhost:3000
```

---

## 🔐 Authentication Endpoints (`/api/auth`)

### 1. Register
Registra un nuevo usuario en el sistema y envía un email de verificación con un enlace clickeable. El usuario no puede iniciar sesión hasta que verifique su email.

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "password": "securePassword123"
}
```

**Validation Rules:**
- `name`: 2-100 caracteres, requerido
- `email`: Formato email válido, requerido
- `password`: 8-100 caracteres, debe contener al menos una mayúscula, una minúscula y un número, requerido

**Success Response (201):**
```json
{
  "ok": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "userId": 1
}
```

**Email Sent:**
El usuario recibe un email HTML con:
- Mensaje de bienvenida personalizado
- Botón clickeable para verificar email
- Link alternativo si el botón no funciona
- El link expira en 24 horas

**Error Responses:**
- `400 VALIDATION_ERROR`: Datos de registro inválidos (ver reglas de validación)
- `409 CONFLICT`: Email ya está registrado
- `500 INTERNAL_ERROR`: Error al crear usuario o enviar email

---

### 2. Verify Email
Verifica el email del usuario mediante un token JWT enviado por query parameter. Este endpoint es llamado cuando el usuario hace click en el link del email.

**Endpoint:** `GET /api/auth/verify-email?token={jwt_token}`

**Query Parameters:**
- `token` (string, required): Token JWT de verificación

**Success Response (200):**
```json
{
  "ok": true,
  "message": "Email verified successfully"
}
```

**Error Responses:**
- `400 VALIDATION_ERROR`: Token inválido o propósito incorrecto
- `401 AUTHENTICATION_ERROR`: Token expirado o inválido

---

### 3. Login (Request 2FA Code)
Valida credenciales y envía un código de 6 dígitos al email del usuario para autenticación de dos factores.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Success Response (200):**
```json
{
  "ok": true,
  "message": "Login code sent to your email"
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Credenciales inválidas
- `401 AUTHENTICATION_ERROR`: Email no verificado
- `500 INTERNAL_ERROR`: Error al enviar el código

---

### 4. Verify Login Code
Verifica el código de 2FA y genera tokens JWT (access + refresh) que se almacenan en cookies HTTP-only.

**Endpoint:** `POST /api/auth/verify-code`

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Success Response (200):**
```json
{
  "ok": true,
  "message": "Login successful"
}
```

**Cookies Set:**
- `accessToken`: JWT con duración de 1 hora (HTTP-only, secure en producción)
- `refreshToken`: JWT con duración de 7 días (HTTP-only, secure en producción)

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Código inválido o expirado
- `404 NOT_FOUND`: Usuario no encontrado

---

### 5. Refresh Token
Refresca el access token usando el refresh token almacenado en cookies. Implementa rotación de tokens (genera nuevo access + nuevo refresh).

**Endpoint:** `POST /api/auth/refresh`

**Request:** No requiere body, el refresh token se lee de las cookies

**Success Response (200):**
```json
{
  "ok": true,
  "message": "Tokens refreshed"
}
```

**Cookies Set:**
- `accessToken`: Nuevo JWT de acceso (1 hora)
- `refreshToken`: Nuevo JWT de refresco (7 días)

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Refresh token no encontrado en cookies
- `401 AUTHENTICATION_ERROR`: Refresh token expirado o inválido
- `400 VALIDATION_ERROR`: Tipo de token incorrecto
- `404 NOT_FOUND`: Usuario no encontrado

---

## 👥 Users Endpoints (`/api/users`)

### 1. List Users
Obtiene la lista de todos los usuarios registrados (sin incluir contraseñas).

**Endpoint:** `GET /api/users`

**Success Response (200):**
```json
[
  {
    "id": 1,
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "balance": 1000,
    "emailVerified": true
  },
  {
    "id": 2,
    "name": "María García",
    "email": "maria@example.com",
    "balance": 500,
    "emailVerified": false
  }
]
```

**Error Responses:**
- `500 INTERNAL_ERROR`: Error al obtener usuarios

---

## 📦 Products Endpoints (`/api/products`)

### 1. List Products
Obtiene la lista de todos los productos disponibles. **Requiere autenticación** - usuarios y admins pueden ver productos.

**Endpoint:** `GET /api/products`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`.

**Success Response (200):**
```json
[
  {
    "id": 1,
    "name": "Laptop HP",
    "description": "Laptop HP 15.6 pulgadas, 8GB RAM, 256GB SSD",
    "price": 599.99,
    "stock": 50
  },
  {
    "id": 2,
    "name": "Mouse Logitech",
    "description": "Mouse inalámbrico Logitech MX Master 3",
    "price": 99.99,
    "stock": 150
  }
]
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `500 INTERNAL_ERROR`: Error al obtener productos

---

### 2. Create Product
Crea un nuevo producto en el catálogo. **Requiere autenticación** - usuarios y admins pueden crear productos.

**Endpoint:** `POST /api/products`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`.

**Request Body:**
```json
{
  "name": "Laptop HP",
  "description": "Laptop HP 15.6 pulgadas, 8GB RAM, 256GB SSD",
  "price": 599.99,
  "stock": 50
}
```

**Validation Rules:**
- `name`: 2-200 caracteres, requerido
- `description`: 10-1000 caracteres, requerido
- `price`: Número positivo, máximo 1,000,000, requerido
- `stock`: Entero no negativo, máximo 1,000,000, requerido

**Success Response (201):**
```json
{
  "id": 1,
  "name": "Laptop HP",
  "description": "Laptop HP 15.6 pulgadas, 8GB RAM, 256GB SSD",
  "price": 599.99,
  "stock": 50
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `400 VALIDATION_ERROR`: Datos del producto inválidos (ver reglas de validación)
- `500 INTERNAL_ERROR`: Error al crear producto

---

## 👥 Users Endpoints (`/api/users`)

### 1. List Users
Obtiene la lista de todos los usuarios registrados (sin incluir contraseñas). **Requiere autenticación de ADMIN** - solo administradores pueden ver la lista completa de usuarios.

**Endpoint:** `GET /api/users`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos + rol `admin`.

**Success Response (200):**
```json
[
  {
    "id": 1,
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "balance": 1000,
    "role": "user",
    "emailVerified": true
  },
  {
    "id": 2,
    "name": "María García",
    "email": "maria@example.com",
    "balance": 500,
    "role": "admin",
    "emailVerified": false
  }
]
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `403 AUTHENTICATION_ERROR`: Permisos insuficientes (no es admin)
- `500 INTERNAL_ERROR`: Error al obtener usuarios

---

## 🏠 Health Check

### Root Endpoint
Endpoint de salud para verificar que la API está funcionando.

**Endpoint:** `GET /`

**Success Response (200):**
```json
{
  "ok": true,
  "msg": "Ventas API"
}
```

---

## 📋 Error Response Format

Todos los endpoints pueden retornar errores en el siguiente formato:

```json
{
  "type": "ERROR_TYPE",
  "message": "Descripción del error",
  "timestamp": "2025-10-28T10:30:00.000Z",
  "details": {
    // Detalles adicionales (solo para errores operacionales)
  }
}
```

### Validation Errors:
Los errores de validación (400 VALIDATION_ERROR) incluyen detalles específicos sobre cada campo:

```json
{
  "type": "VALIDATION_ERROR",
  "message": "Validation failed",
  "timestamp": "2025-10-28T10:30:00.000Z",
  "details": {
    "body.email": "Invalid email format",
    "body.password": "Password must be at least 8 characters"
  }
}
```

### Error Types:
- `VALIDATION_ERROR` (400): Error en la validación de datos
- `AUTHENTICATION_ERROR` (401): Error de autenticación
- `AUTHORIZATION_ERROR` (403): Error de permisos
- `NOT_FOUND` (404): Recurso no encontrado
- `CONFLICT` (409): Conflicto (ej: email duplicado)
- `INTERNAL_ERROR` (500): Error interno del servidor

---

## 🔒 Authentication Flow

### Flujo completo de autenticación:

1. **Registro con Verificación de Email**: 
   - Usuario se registra → `POST /api/auth/register`
   - Sistema crea cuenta (rol `user` por defecto) y envía email con HTML + link de verificación
   - Usuario recibe email con botón clickeable
   - Usuario hace click en link → `GET /api/auth/verify-email?token=xxx`
   - Email queda verificado

2. **Login con 2FA**:
   - Usuario envía credenciales → `POST /api/auth/login`
   - Sistema valida que el email esté verificado
   - Usuario recibe código de 6 dígitos por email
   - Usuario envía código → `POST /api/auth/verify-code`
   - Sistema genera tokens JWT en cookies (incluyen `userId`, `email`, `role`)

3. **Acceso a Rutas Protegidas**:
   - Cliente incluye automáticamente las cookies en cada request
   - Middleware `requireAuth()` valida el `accessToken`
   - **Si el `accessToken` está expirado**:
     - Middleware verifica automáticamente el `refreshToken`
     - Si es válido, genera nuevos tokens (rotación)
     - Actualiza las cookies
     - Continúa con el request original
   - **Si ambos tokens son inválidos/expirados**:
     - Retorna 401 y pide al usuario que haga login nuevamente

4. **Refresh Manual** (opcional):
   - Si el cliente detecta un token expirado
   - Cliente llama → `POST /api/auth/refresh`
   - Sistema genera nuevos tokens (rotación)

### Renovación Automática de Tokens:

El sistema implementa **auto-refresh transparente**:
- Los endpoints protegidos con `requireAuth()` verifican ambos tokens
- Si `accessToken` expiró pero `refreshToken` es válido, se renuevan ambos automáticamente
- El cliente NO necesita manejar la renovación manualmente
- Solo si ambos tokens expiran, se requiere login completo

---

## 🍪 Cookies

La API utiliza cookies HTTP-only para almacenar tokens JWT:

### `accessToken`
- **Duración**: 1 hora
- **Contenido**: `{ userId, email, role, type: 'access' }`
- **Uso**: Autenticación en cada request
- **Flags**: `httpOnly`, `secure` (en producción), `sameSite: lax`
- **Renovación**: Automática si `refreshToken` es válido

### `refreshToken`
- **Duración**: 7 días
- **Contenido**: `{ userId, email, role, type: 'refresh' }`
- **Uso**: Refrescar el access token automáticamente o manualmente
- **Flags**: `httpOnly`, `secure` (en producción), `sameSite: lax`
- **Rotación**: Se genera un nuevo refresh token en cada renovación

### Roles disponibles:
- `user`: Usuario regular (rol por defecto al registrarse)
- `admin`: Administrador con permisos especiales

---

## 🔧 Environment Variables Required

```bash
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=secret
DB_NAME=ventas_db

# App
PORT=3000
APP_URL=http://localhost:3000
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=1h

# Tokens
REFRESH_TOKEN_EXPIRES_DAYS=7
LOGIN_CODE_EXPIRY_MINUTES=10
EMAIL_VERIFICATION_EXPIRY_HOURS=24

# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM="Ventas <no-reply@example.com>"
```

---

## 📝 Notes

- Todos los endpoints están protegidos con manejo de errores tipados
- Los errores internos NO exponen detalles sensibles al cliente
- Las contraseñas se hashean con bcrypt (10 rounds)
- Los códigos 2FA expiran en 10 minutos
- Los links de verificación de email expiran en 24 horas
- Se implementa rotación de refresh tokens para mayor seguridad
