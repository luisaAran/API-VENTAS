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

### 3. Login (Request 2FA Code or Direct Login)
Valida credenciales. Si el dispositivo es de confianza (tiene `trustedDevice` cookie válida), inicia sesión directamente sin 2FA. Si no, envía un código de 6 dígitos al email para autenticación de dos factores.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Success Response (Trusted Device) - 200:**
```json
{
  "ok": true,
  "skipTwoFactor": true,
  "message": "Login successful (trusted device)",
  "user": {
    "id": 1,
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "role": "user"
  }
}
```

**Cookies Set (Trusted Device):**
- `accessToken`: JWT con duración de 1 hora
- `refreshToken`: JWT con duración de 7 días

**Success Response (New/Untrusted Device) - 200:**
```json
{
  "ok": true,
  "skipTwoFactor": false,
  "message": "Login code sent to your email"
}
```

**Cookies Set (New Device):**
- `pendingAuth`: JWT con código encriptado, duración de 10 minutos (HTTP-only, secure en producción, sameSite: strict)

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Credenciales inválidas
- `401 AUTHENTICATION_ERROR`: Email no verificado
- `500 INTERNAL_ERROR`: Error al enviar el código

---

### 4. Verify Login Code
Verifica el código de 2FA leyendo el JWT de la cookie `pendingAuth` y comparando el código. Si es válido, genera tokens JWT (access + refresh) que se almacenan en cookies HTTP-only y elimina la cookie `pendingAuth`. **Opcionalmente**, puede marcar el dispositivo como confiable para omitir 2FA en futuros inicios de sesión.

**Endpoint:** `POST /api/auth/verify-code`

**Request Body:**
```json
{
  "code": "123456",
  "rememberDevice": true
}
```

**Validation Rules:**
- `code`: 6 dígitos numéricos, requerido
- `rememberDevice`: Boolean, opcional (default: false)

**Success Response (200):**
```json
{
  "ok": true,
  "message": "Login successful",
  "trustedDevice": true,
  "user": {
    "id": 1,
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "role": "user"
  }
}
```

**Cookies Set:**
- `accessToken`: JWT con duración de 1 hora (HTTP-only, secure en producción)
- `refreshToken`: JWT con duración de 7 días (HTTP-only, secure en producción)
- `trustedDevice` (si `rememberDevice: true`): JWT con duración de 30 días (HTTP-only, secure en producción, sameSite: strict)

**Cookies Removed:**
- `pendingAuth`: Se elimina después de la verificación exitosa

**Notes:**
- El `trustedDevice` token persiste incluso después de hacer logout (a menos que se use `forgetDevice: true`)
- Permite inicios de sesión sin 2FA en el mismo dispositivo/navegador durante 30 días
- Ideal para dispositivos personales del usuario

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: No hay cookie `pendingAuth` (usuario debe hacer login primero)
- `401 AUTHENTICATION_ERROR`: Código inválido
- `401 AUTHENTICATION_ERROR`: JWT expirado (código caducó después de 10 minutos)
- `401 AUTHENTICATION_ERROR`: JWT inválido o manipulado
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

### 6. Verify Order Payment
Verifica el pago de una orden mediante un token JWT enviado por email. Después de crear una orden sin dispositivo de pago confiable, el usuario recibe un email con un link de verificación. Este endpoint completa el pago deduciendo el balance del usuario y el stock de productos.

**Endpoint:** `GET /api/auth/verify-order?token={jwt_token}&remember={true|false}`

**Query Parameters:**
- `token` (string, required): Token JWT de verificación de pago
- `remember` (string, optional): "true" para marcar el dispositivo como confiable para pagos futuros, "false" o ausente para verificación única

**Success Response - Primera Verificación (200):**
```json
{
  "ok": true,
  "message": "Payment verified successfully",
  "trustedDevice": true,
  "order": {
    "id": 123,
    "status": "completed",
    "total": 699.98,
    "createdAt": "2025-10-30T10:30:00.000Z",
    "user": {
      "id": 1,
      "name": "Juan Pérez",
      "balance": 300.02
    },
    "items": [
      {
        "id": 1,
        "quantity": 1,
        "unitPrice": 599.99,
        "product": {
          "id": 1,
          "name": "Laptop HP",
          "price": 599.99,
          "stock": 49
        }
      },
      {
        "id": 2,
        "quantity": 1,
        "unitPrice": 99.99,
        "product": {
          "id": 2,
          "name": "Mouse Logitech",
          "price": 99.99,
          "stock": 149
        }
      }
    ]
  }
}
```

**Success Response - Link Ya Usado (200):**
Si el usuario vuelve a usar el mismo link después de haber verificado:
```json
{
  "ok": true,
  "message": "This order was already verified and completed."
}
```

**Response Fields (Primera Verificación):**
- `trustedDevice`: `true` si `remember=true` en el query parameter, `false` en caso contrario
- `order.status`: Estado actual de la orden ("completed", "pending", "cancelled")
- `order.total`: Total pagado por la orden
- `order.createdAt`: Timestamp de creación de la orden
- `order.user.id`: ID del usuario
- `order.user.name`: Nombre del usuario
- `order.user.balance`: Balance actual del usuario **después del pago**
- `order.items`: Array con los productos comprados
  - `quantity`: Cantidad comprada
  - `unitPrice`: Precio unitario al momento de la compra
  - `product`: Información del producto (ID, nombre, precio actual, stock actual)

**Security & Privacy:**
- ❌ NO se incluye: email, contraseña, rol, tokens de confianza
- ✅ Solo se muestra: estado de orden, balance actual, productos comprados, timestamp

**Cookies Set (if remember=true):**
- `trustedPayment`: JWT con duración de 30 días (HTTP-only, secure en producción, sameSite: strict)

**Error Response - Orden Cancelada (400):**
```json
{
  "ok": false,
  "message": "This order has been cancelled. This could be due to: verification timeout (>5 minutes), insufficient balance, or manual cancellation.",
  "error": "ORDER_CANCELLED"
}
```

**Other Error Responses:**
- `400 VALIDATION_ERROR`: Token con propósito incorrecto
- `401 AUTHENTICATION_ERROR`: Token expirado (>5 minutos) - La orden es cancelada automáticamente
- `401 AUTHENTICATION_ERROR`: Token inválido o manipulado
- `404 NOT_FOUND`: Orden o usuario no encontrado

**Notes:**
- El link de verificación expira en **5 minutos**
- Si el token expira, la orden se marca automáticamente como `cancelled`
- Si el balance es insuficiente al verificar, la orden se cancela
- Con `remember=true`, futuros pagos en ese dispositivo se auto-aprueban sin verificación
- **El link puede usarse múltiples veces**: Si el usuario ya verificó la orden y vuelve a hacer click en el link:
  - ✅ Retorna status 200 con mensaje simple: `"This order was already verified and completed."`
  - ✅ NO devuelve información de la orden (por seguridad y simplicidad)
  - ✅ NO intenta cobrar nuevamente
  - ✅ NO genera error ni cookie de dispositivo de confianza
- **Mensajes amigables**: El sistema detecta si la orden ya fue completada y devuelve un mensaje claro y conciso

---

### 7. Logout
Cierra la sesión del usuario eliminando las cookies de autenticación (`accessToken` y `refreshToken`). Opcionalmente puede eliminar también los tokens de dispositivo de confianza (2FA y pagos).

**Endpoint:** `POST /api/auth/logout`

**Request Body (opcional):**
```json
{
  "forgetDevice": true
}
```

**Validation Rules:**
- `forgetDevice`: Boolean, opcional (default: false)

**Success Response (Normal Logout) - 200:**
```json
{
  "ok": true,
  "message": "Logout successful"
}
```

**Success Response (Forget Device) - 200:**
```json
{
  "ok": true,
  "message": "Logout successful and device forgotten"
}
```

**Cookies Cleared:**
- `accessToken`: Siempre se elimina
- `refreshToken`: Siempre se elimina
- `trustedDevice`: Solo se elimina si `forgetDevice: true` (cookie de 2FA)
- `trustedPayment`: Solo se elimina si `forgetDevice: true` (cookie de pagos)

**Notes:**
- **Logout normal**: Cierra sesión pero mantiene los dispositivos como confiables. Próximos logins y pagos sin verificación adicional.
- **Forget device**: Cierra sesión y elimina tokens de confianza. Próximo login requerirá 2FA y próximas compras requerirán verificación por email.
- Este endpoint siempre retorna éxito, incluso si no hay cookies para limpiar
- No requiere autenticación previa (cualquiera puede llamarlo)
- Útil en dispositivos compartidos o públicos usar `forgetDevice: true`

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

### 1. List Products (with filters)
Obtiene la lista de todos los productos disponibles con filtros opcionales. **Requiere autenticación** - usuarios y admins pueden ver productos.

**Endpoint:** `GET /api/products`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`.

**Query Parameters (opcional):**
- `name` (string): Busca productos por nombre (búsqueda parcial)
- `minPrice` (number): Filtra productos con precio mayor o igual
- `maxPrice` (number): Filtra productos con precio menor o igual

**Examples:**
```
GET /api/products
GET /api/products?name=laptop
GET /api/products?minPrice=100&maxPrice=500
GET /api/products?name=mouse&maxPrice=100
```

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
- `400 VALIDATION_ERROR`: Query params inválidos
- `500 INTERNAL_ERROR`: Error al obtener productos

---

### 2. Get Product by ID
Obtiene un producto específico por su ID. **Requiere autenticación** - usuarios y admins pueden ver un producto.

**Endpoint:** `GET /api/products/:id`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`.

**URL Parameters:**
- `id` (number, required): ID del producto

**Success Response (200):**
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
- `400 VALIDATION_ERROR`: ID inválido
- `404 NOT_FOUND`: Producto no encontrado
- `500 INTERNAL_ERROR`: Error al obtener producto

---

### 3. Create Product
Crea un nuevo producto en el catálogo. **Requiere autenticación de ADMIN** - solo administradores pueden crear productos.

**Endpoint:** `POST /api/products`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `admin`.

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
- `403 AUTHENTICATION_ERROR`: Permisos insuficientes (no es admin)
- `400 VALIDATION_ERROR`: Datos del producto inválidos (ver reglas de validación)
- `500 INTERNAL_ERROR`: Error al crear producto

---

### 4. Update Product
Actualiza un producto existente. **Requiere autenticación de ADMIN** - solo administradores pueden editar productos.

**Endpoint:** `PUT /api/products/:id`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `admin`.

**URL Parameters:**
- `id` (number, required): ID del producto

**Request Body (todos los campos opcionales):**
```json
{
  "name": "Laptop HP Actualizada",
  "description": "Nueva descripción",
  "price": 649.99,
  "stock": 40
}
```

**Validation Rules:**
- `name`: 2-200 caracteres, opcional
- `description`: 10-1000 caracteres, opcional
- `price`: Número positivo, máximo 1,000,000, opcional
- `stock`: Entero no negativo, máximo 1,000,000, opcional

**Success Response (200):**
```json
{
  "id": 1,
  "name": "Laptop HP Actualizada",
  "description": "Nueva descripción",
  "price": 649.99,
  "stock": 40
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `403 AUTHENTICATION_ERROR`: Permisos insuficientes (no es admin)
- `400 VALIDATION_ERROR`: Datos inválidos
- `404 NOT_FOUND`: Producto no encontrado
- `500 INTERNAL_ERROR`: Error al actualizar producto

---

### 5. Delete Product
Elimina un producto del catálogo. **Requiere autenticación de ADMIN** - solo administradores pueden eliminar productos.

**Endpoint:** `DELETE /api/products/:id`

**Authentication:** Requiere cookies con `accessToken` or `refreshToken` válidos. Roles permitidos: `admin`.

**URL Parameters:**
- `id` (number, required): ID del producto

**Success Response (200):**
```json
{
  "ok": true,
  "message": "Product deleted successfully"
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `403 AUTHENTICATION_ERROR`: Permisos insuficientes (no es admin)
- `400 VALIDATION_ERROR`: ID inválido
- `404 NOT_FOUND`: Producto no encontrado
- `500 INTERNAL_ERROR`: Error al eliminar producto

---

## 👥 Users Endpoints (`/api/users`)

### 1. Get My Profile
Obtiene el perfil del usuario autenticado incluyendo todas sus órdenes. **Requiere autenticación** - usuarios y admins pueden ver su propio perfil.

**Endpoint:** `GET /api/users/me`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`.

**Success Response (200):**
```json
{
  "id": 1,
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "balance": 1000,
  "role": "user",
  "emailVerified": true,
  "orders": [
    {
      "id": 1,
      "createdAt": "2025-10-28T10:30:00.000Z",
      "total": 699.98,
      "status": "pending",
      "items": [
        {
          "id": 1,
          "quantity": 1,
          "unitPrice": 599.99,
          "product": {
            "id": 1,
            "name": "Laptop HP",
            "description": "Laptop HP 15.6 pulgadas",
            "price": 599.99,
            "stock": 49
          }
        },
        {
          "id": 2,
          "quantity": 1,
          "unitPrice": 99.99,
          "product": {
            "id": 2,
            "name": "Mouse Logitech",
            "description": "Mouse inalámbrico",
            "price": 99.99,
            "stock": 149
          }
        }
      ]
    }
  ]
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `404 NOT_FOUND`: Usuario no encontrado
- `500 INTERNAL_ERROR`: Error al obtener perfil

---

### 2. List Users
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

## � Users Endpoints (`/api/users`)

### 1. Get My Profile
Obtiene el perfil del usuario autenticado, incluyendo su balance actual y sus órdenes.

**Endpoint:** `GET /api/users/me`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`.

**Success Response (200):**
```json
{
  "id": 1,
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "balance": 500.50,
  "emailVerified": true,
  "role": "user",
  "orders": [
    {
      "id": 1,
      "createdAt": "2025-10-30T10:30:00.000Z",
      "total": "150.00",
      "status": "completed"
    }
  ]
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `404 NOT_FOUND`: Usuario no encontrado
- `500 INTERNAL_ERROR`: Error al obtener perfil

---

### 2. Add Balance
Permite al usuario agregar dinero a su cuenta. Simula un depósito o recarga de balance. **Envía un email de confirmación** con el balance actualizado y sugerencias de productos dentro del rango de precio del usuario.

**Endpoint:** `POST /api/users/balance`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`.

**Request Body:**
```json
{
  "amount": 100.50
}
```

**Validation Rules:**
- `amount`: Número positivo, máximo $999,000,000 por transacción
- Debe tener máximo 2 decimales (centavos)

**Success Response (200):**
```json
{
  "message": "Balance added successfully",
  "newBalance": 600.50
}
```

**Email Sent:**
El usuario recibe un email HTML con:
- Confirmación del monto añadido
- Nuevo balance total
- **Sección "Te puede interesar"** (opcional): Muestra hasta 3 productos aleatorios que el usuario puede comprar con su balance actual
  - Se muestra solo si existen productos dentro del rango de precio
  - Incluye: ID del producto, nombre, precio y stock disponible
  - Si no hay productos disponibles o todos están fuera del rango de precio, se omite esta sección

**Error Responses:**
- `400 VALIDATION_ERROR`: Monto inválido (negativo, mayor a $999,000,000, más de 2 decimales)
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `404 NOT_FOUND`: Usuario no encontrado
- `500 INTERNAL_ERROR`: Error al actualizar balance o enviar email

---

### 3. Update User (Admin Only)
Permite a los administradores actualizar la información de cualquier usuario, incluyendo nombre, email, balance y preferencias de notificación. **Solo ADMINS**. 

⚠️ **Nota**: El campo `role` NO puede ser actualizado a través de este endpoint (está excluido del esquema de validación).

**Endpoint:** `PUT /api/users/:id`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `admin`.

**URL Parameters:**
- `id` (number, required): ID del usuario a actualizar

**Request Body (todos los campos opcionales):**
```json
{
  "name": "Juan Pérez Actualizado",
  "email": "nuevo-email@example.com",
  "balance": 1500.00,
  "notifyBalanceUpdates": false
}
```

**Validation Rules:**
- `name`: 2-100 caracteres, opcional
- `email`: Formato email válido, opcional (verifica que no esté en uso por otro usuario)
- `balance`: Número no negativo, máximo $999,000,000, opcional
- `notifyBalanceUpdates`: Boolean, opcional
- **Al menos un campo debe ser proporcionado**
- ❌ **`role` no está permitido**: Si se envía este campo, será ignorado por el esquema de validación

**Success Response (200):**
```json
{
  "message": "User updated successfully",
  "user": {
    "id": 1,
    "name": "Juan Pérez Actualizado",
    "email": "nuevo-email@example.com",
    "balance": 1500.00,
    "role": "user",
    "emailVerified": true,
    "notifyBalanceUpdates": false
  }
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `403 AUTHENTICATION_ERROR`: Permisos insuficientes (no es admin)
- `400 VALIDATION_ERROR`: Datos inválidos o ningún campo proporcionado
- `404 NOT_FOUND`: Usuario no encontrado
- `409 CONFLICT`: Email ya está en uso por otro usuario
- `500 INTERNAL_ERROR`: Error al actualizar usuario

**Notes:**
- � **El rol NO puede ser actualizado** a través de este endpoint (por seguridad y simplicidad)
- Si necesitas cambiar roles, considera crear un endpoint separado como `PATCH /api/users/:id/role`
- El email se valida para evitar duplicados
- Se invalida el caché de Redis automáticamente al actualizar
- El balance puede ser ajustado directamente (útil para correcciones administrativas)

**Examples:**

✅ **Admin actualiza nombre y balance de un usuario:**
```bash
PUT /api/users/3
{
  "name": "Nuevo Nombre",
  "balance": 500.00
}

Response: 200 OK
```

❌ **Intentar enviar `role` en el body (será rechazado por validación):**
```bash
PUT /api/users/3
{
  "name": "Nuevo Nombre",
  "role": "admin"  # ← Este campo no es reconocido por el esquema
}

Response: 400 VALIDATION_ERROR (campo desconocido)
```

---

### 4. Delete User (Admin Only) - Soft Delete
Marca un usuario como eliminado **preservando su historial de órdenes** mediante Soft Delete. **Solo ADMINS**. ✅ Esta operación **puede revertirse** si es necesario.

**Endpoint:** `DELETE /api/users/:id`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `admin`.

**URL Parameters:**
- `id` (number, required): ID del usuario a eliminar

**Success Response (200):**
```json
{
  "ok": true,
  "message": "User deleted successfully (soft delete - order history preserved)"
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `403 AUTHENTICATION_ERROR`: Permisos insuficientes (no es admin)
- `400 VALIDATION_ERROR`: ID inválido
- `400 VALIDATION_ERROR`: Usuario ya está eliminado ("User is already deleted")
- `400 VALIDATION_ERROR`: Intentando eliminar su propia cuenta ("You cannot delete your own account")
- `400 VALIDATION_ERROR`: Intentando eliminar otro admin ("Cannot delete another admin account. Demote to user first.")
- `404 NOT_FOUND`: Usuario no encontrado
- `500 INTERNAL_ERROR`: Error al eliminar usuario

**Soft Delete Behavior:**
```
User (SOFT DELETE)
  ├─► isDeleted: true
  ├─► deletedAt: timestamp
  ├─► Cannot login
  ├─► Hidden from user lists
  └─► Orders preserved (SET NULL on user reference)
```

**What happens:**
1. **User** marcado como eliminado (`isDeleted: true`, `deletedAt: timestamp`)
2. **Usuario ya no puede autenticarse** (filtrado en login)
3. **No aparece en listados** de usuarios activos
4. **Orders preservadas** con referencia a usuario en NULL
5. **Historial de compras mantenido** para auditoría y compliance

**What remains intact:**
- **Order history** (todas las órdenes del usuario se mantienen)
- **OrderItems** (items de órdenes preservados)
- **Products** (productos no afectados)
- **User data** (nombre, email, etc. permanecen en base de datos)

**Security Validations:**
- 🔒 **Cannot delete self**: Admin no puede eliminar su propia cuenta (previene bloqueo accidental)
- 🔒 **Cannot delete other admins**: Solo se pueden eliminar usuarios con rol `user`
- 🔒 **Cannot delete twice**: Previene eliminar un usuario ya eliminado
- 💡 **Workaround**: Para eliminar un admin, primero cambiar su rol a `user` usando endpoint de actualización de roles

**Notes:**
- ✅ **REVERSIBLE**: Soft delete permite recuperar el usuario si es necesario (modificando `isDeleted` y `deletedAt` en base de datos)
- 📊 **Historial preservado**: Todas las órdenes del usuario se mantienen para análisis y compliance
- 🔐 **GDPR Compliance**: Para eliminación permanente (right to be forgotten), usar borrado físico de base de datos directamente
- 🔒 **Cache**: Se invalida automáticamente el caché de Redis del usuario eliminado
- 🚫 **Login bloqueado**: Usuario eliminado no puede autenticarse (filtrado en `findByEmail`)

**Use Cases:**
- Suspender cuentas temporalmente
- Cumplir con políticas de retención de datos
- Mantener integridad referencial del historial de ventas
- Análisis de comportamiento de usuarios inactivos

**Advantages over CASCADE DELETE:**
- ✅ Preserva historial de órdenes para reportes
- ✅ Permite análisis de ventas incluso de usuarios eliminados
- ✅ Cumple con auditorías financieras
- ✅ Datos pueden recuperarse si fue eliminación accidental
- ✅ Compatible con regulaciones de retención de datos

---

## 🛒 Orders Endpoints (`/api/orders`)

### 1. Create Order
Crea una nueva orden de compra con **verificación de pago por email**. **Requiere autenticación** - usuarios y admins pueden crear órdenes. El sistema valida balance del usuario y stock disponible, pero NO descuenta hasta verificar el pago.

**Endpoint:** `POST /api/orders`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`. Opcionalmente cookie `trustedPayment` para auto-aprobar.

**Request Body:**
```json
{
  "items": [
    {
      "productId": 1,
      "quantity": 2
    },
    {
      "productId": 3,
      "quantity": 1
    }
  ]
}
```

**Validation Rules:**
- `items`: Array de 1-50 items, requerido
- `productId`: Número entero positivo, requerido
- `quantity`: Número entero entre 1-1000, requerido

**Success Response - Dispositivo Confiable (201):**
Si el usuario tiene cookie `trustedPayment` válida, la orden se completa inmediatamente:
```json
{
  "order": {
    "id": 1,
    "createdAt": "2025-10-30T10:30:00.000Z",
    "total": 1299.97,
    "status": "completed",
    "user": {
      "id": 1,
      "name": "Juan Pérez",
      "email": "juan@example.com"
    },
    "items": [
      {
        "id": 1,
        "quantity": 2,
        "unitPrice": 599.99,
        "product": {
          "id": 1,
          "name": "Laptop HP",
          "price": 599.99,
          "stock": 48
        }
      }
    ]
  },
  "requiresVerification": false
}
```

**Success Response - Requiere Verificación (201):**
Si NO tiene cookie `trustedPayment`, la orden queda pendiente y se envía email de verificación:
```json
{
  "order": {
    "id": 1,
    "createdAt": "2025-10-30T10:30:00.000Z",
    "total": 1299.97,
    "status": "pending",
    "user": {
      "id": 1,
      "name": "Juan Pérez",
      "email": "juan@example.com"
    },
    "items": [...]
  },
  "requiresVerification": true,
  "message": "Order created. Please check your email to verify payment within 5 minutes."
}
```

**Email Sent (if requiresVerification: true):**
El usuario recibe un email HTML con:
- Detalles de la orden (ID, total, items)
- **Dos opciones de verificación:**
  1. **"Verify Payment"**: Verificación única (no guarda dispositivo)
  2. **"Verify & Trust This Device"**: Marca dispositivo como confiable (30 días)
- Advertencia de expiración (5 minutos)
- Nota de auto-cancelación si no verifica

**Order Status Lifecycle:**
1. **`pending`**: Orden creada, esperando verificación de pago (stock NO descontado, balance NO descontado)
2. **`completed`**: Pago verificado, balance y stock descontados
3. **`cancelled`**: Token de verificación expiró (>5 minutos) o balance insuficiente al verificar

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `400 VALIDATION_ERROR`: Datos de la orden inválidos
- `404 NOT_FOUND`: Producto no encontrado
- `400 VALIDATION_ERROR`: Stock insuficiente para uno o más productos
- `400 VALIDATION_ERROR`: Balance insuficiente (no se crea la orden)
- `500 INTERNAL_ERROR`: Error al crear orden o enviar email

**Notes:**
- **Balance**: Se valida ANTES de crear la orden, pero NO se descuenta hasta verificar
- **Stock**: Se valida ANTES de crear la orden, pero NO se descuenta hasta verificar
- **Verificación**: El usuario tiene **5 minutos** para verificar el pago
- **Auto-cancelación**: Si pasan 5 minutos sin verificar, la orden se marca como `cancelled`
- **Dispositivo confiable**: Con cookie `trustedPayment`, las compras se completan instantáneamente sin email
- **Duración cookie**: 30 días (configurable con `TRUSTED_PAYMENT_EXPIRES_DAYS`)

---

### 2. List All Orders (Admin Only)
Obtiene la lista de todas las órdenes con filtros opcionales. **Requiere autenticación de ADMIN** - solo administradores pueden ver todas las órdenes.

**Endpoint:** `GET /api/orders`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `admin`.

**Query Parameters (opcional):**
- `userId` (number): Filtra órdenes por ID de usuario
- `status` (string): Filtra por estado (`pending`, `completed`, `cancelled`)
- `minTotal` (number): Filtra órdenes con total mayor o igual
- `maxTotal` (number): Filtra órdenes con total menor o igual

**Examples:**
```
GET /api/orders
GET /api/orders?userId=1
GET /api/orders?status=pending
GET /api/orders?minTotal=100&maxTotal=500
GET /api/orders?userId=1&status=completed
```

**Success Response (200):**
```json
[
  {
    "id": 1,
    "createdAt": "2025-10-29T10:30:00.000Z",
    "total": 1299.97,
    "status": "pending",
    "user": {
      "id": 1,
      "name": "Juan Pérez",
      "email": "juan@example.com"
    },
    "items": [...]
  },
  {
    "id": 2,
    "createdAt": "2025-10-29T11:00:00.000Z",
    "total": 599.99,
    "status": "completed",
    "user": {
      "id": 2,
      "name": "María García",
      "email": "maria@example.com"
    },
    "items": [...]
  }
]
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `403 AUTHENTICATION_ERROR`: Permisos insuficientes (no es admin)
- `400 VALIDATION_ERROR`: Query params inválidos
- `500 INTERNAL_ERROR`: Error al obtener órdenes

---

### 3. Get Order by ID
Obtiene una orden específica por su ID. **Requiere autenticación** - usuarios y admins pueden ver órdenes.

**Endpoint:** `GET /api/orders/:id`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`.

**URL Parameters:**
- `id` (number, required): ID de la orden

**Success Response (200):**
```json
{
  "id": 1,
  "createdAt": "2025-10-29T10:30:00.000Z",
  "total": 1299.97,
  "status": "pending",
  "user": {
    "id": 1,
    "name": "Juan Pérez",
    "email": "juan@example.com"
  },
  "items": [
    {
      "id": 1,
      "quantity": 2,
      "unitPrice": 599.99,
      "product": {
        "id": 1,
        "name": "Laptop HP",
        "price": 599.99,
        "stock": 48
      }
    }
  ]
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `400 VALIDATION_ERROR`: ID inválido
- `404 NOT_FOUND`: Orden no encontrada
- `500 INTERNAL_ERROR`: Error al obtener orden

---

### 4. Update Order (Admin Only)
Actualiza una orden existente. **Requiere autenticación de ADMIN** - solo administradores pueden editar órdenes. Al actualizar items, restaura el stock de los items antiguos y aplica los nuevos.

**Endpoint:** `PUT /api/orders/:id`

**Authentication:** Requiere cookies con `accessToken` or `refreshToken` válidos. Roles permitidos: `admin`.

**URL Parameters:**
- `id` (number, required): ID de la orden

**Request Body (todos los campos opcionales):**
```json
{
  "status": "completed",
  "items": [
    {
      "productId": 1,
      "quantity": 1
    }
  ]
}
```

**Validation Rules:**
- `status`: Debe ser `pending`, `completed` o `cancelled`, opcional
- `items`: Array de 1-50 items, opcional (si se envía, reemplaza todos los items)

**Success Response (200):**
```json
{
  "id": 1,
  "createdAt": "2025-10-29T10:30:00.000Z",
  "total": 599.99,
  "status": "completed",
  "user": {...},
  "items": [...]
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `403 AUTHENTICATION_ERROR`: Permisos insuficientes (no es admin)
- `400 VALIDATION_ERROR`: Datos inválidos
- `404 NOT_FOUND`: Orden o producto no encontrado
- `400 VALIDATION_ERROR`: Stock insuficiente
- `500 INTERNAL_ERROR`: Error al actualizar orden

---

### 5. Delete Order (Admin Only)
Elimina una orden y restaura el stock de los productos. **Requiere autenticación de ADMIN** - solo administradores pueden eliminar órdenes.

**Endpoint:** `DELETE /api/orders/:id`

**Authentication:** Requiere cookies con `accessToken` or `refreshToken` válidos. Roles permitidos: `admin`.

**URL Parameters:**
- `id` (number, required): ID de la orden

**Success Response (200):**
```json
{
  "ok": true,
  "message": "Order deleted successfully and stock restored"
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `403 AUTHENTICATION_ERROR`: Permisos insuficientes (no es admin)
- `400 VALIDATION_ERROR`: ID inválido
- `404 NOT_FOUND`: Orden no encontrada
- `500 INTERNAL_ERROR`: Error al eliminar orden

---

### 6. Cancel Order (User)
Permite a un usuario cancelar su propia orden en estado pendiente. Solo se pueden cancelar órdenes que pertenezcan al usuario autenticado y que estén en estado `pending`. Por seguridad, si la orden no pertenece al usuario, se devuelve un error genérico de "orden no encontrada".

**Endpoint:** `POST /api/orders/cancel`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`.

**Request Body:**
```json
{
  "orderId": 123
}
```

**Validation Rules:**
- `orderId`: Número entero positivo, requerido

**Success Response (200):**
```json
{
  "message": "Orden cancelada exitosamente",
  "order": {
    "id": 123,
    "createdAt": "2025-11-03T10:30:00.000Z",
    "total": 599.99,
    "status": "cancelled",
    "user": {
      "id": 1,
      "name": "Juan Pérez",
      "email": "juan@example.com"
    },
    "items": [
      {
        "id": 1,
        "quantity": 1,
        "unitPrice": 599.99,
        "product": {
          "id": 1,
          "name": "Laptop HP",
          "price": 599.99,
          "stock": 50
        }
      }
    ]
  }
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `400 VALIDATION_ERROR`: orderId no es un número válido o está ausente
- `404 NOT_FOUND`: Orden no encontrada o no pertenece al usuario (mensaje genérico por seguridad)
- `400 VALIDATION_ERROR`: La orden no está en estado pendiente (ya fue completada o cancelada)
- `500 INTERNAL_ERROR`: Error al cancelar orden

**Notes:**
- Solo se pueden cancelar órdenes en estado `pending`
- Si la orden no pertenece al usuario, se devuelve un error 404 genérico ("Order") por seguridad
- Si la orden está en estado `completed` o `cancelled`, se devuelve un mensaje descriptivo del estado actual
- La cancelación no requiere verificación adicional más allá de la autenticación del usuario
- El stock NO se restaura al cancelar porque nunca fue descontado (solo se descuenta al completar la orden)
- Máximo de 5 órdenes pendientes por usuario: al cancelar órdenes, se libera espacio para crear nuevas

---

## � Cart Endpoints (`/api/cart`)

### 1. Get Cart
Obtiene el carrito de compras del usuario autenticado. Retorna un carrito vacío si no existe.

**Endpoint:** `GET /api/cart`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`.

**Success Response - Cart with Items (200):**
```json
{
  "userId": 1,
  "items": [
    {
      "productId": 1,
      "quantity": 2,
      "addedAt": "2025-11-04T10:30:00.000Z"
    },
    {
      "productId": 3,
      "quantity": 1,
      "addedAt": "2025-11-04T11:00:00.000Z"
    }
  ],
  "updatedAt": "2025-11-04T11:00:00.000Z"
}
```

**Success Response - Empty Cart (200):**
```json
{
  "userId": 1,
  "items": [],
  "updatedAt": "2025-11-04T10:00:00.000Z"
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `500 INTERNAL_ERROR`: Error al obtener carrito

**Notes:**
- El carrito se almacena en Redis con TTL de 7 días
- Si no existe carrito, retorna un carrito vacío (no es error)
- El carrito expira automáticamente después de 7 días de inactividad

---

### 2. Get Cart Summary
Obtiene el carrito con detalles completos de productos, precios, subtotales y total. Ideal para mostrar en la UI antes del checkout.

**Endpoint:** `GET /api/cart/summary`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`.

**Success Response (200):**
```json
{
  "userId": 1,
  "items": [
    {
      "productId": 1,
      "productName": "Laptop HP",
      "productPrice": 599.99,
      "productStock": 50,
      "quantity": 2,
      "subtotal": 1199.98,
      "addedAt": "2025-11-04T10:30:00.000Z"
    },
    {
      "productId": 3,
      "productName": "Mouse Logitech",
      "productPrice": 99.99,
      "productStock": 150,
      "quantity": 1,
      "subtotal": 99.99,
      "addedAt": "2025-11-04T11:00:00.000Z"
    }
  ],
  "total": 1299.97,
  "itemCount": 3,
  "updatedAt": "2025-11-04T11:00:00.000Z"
}
```

**Success Response - Empty Cart (200):**
```json
{
  "userId": 1,
  "items": [],
  "total": 0,
  "itemCount": 0,
  "updatedAt": "2025-11-04T10:00:00.000Z"
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `404 NOT_FOUND`: Uno o más productos en el carrito ya no existen
- `500 INTERNAL_ERROR`: Error al obtener resumen del carrito

**Notes:**
- Obtiene información actualizada de productos desde la base de datos
- Calcula subtotales por item y total general
- `itemCount` es la suma de cantidades de todos los items
- Si un producto fue eliminado, se lanza error 404

---

### 3. Add Item to Cart
Agrega un producto al carrito o incrementa su cantidad si ya existe. Valida stock disponible.

**Endpoint:** `POST /api/cart/items`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`.

**Request Body:**
```json
{
  "productId": 1,
  "quantity": 2
}
```

**Validation Rules:**
- `productId`: Número entero positivo, requerido
- `quantity`: Número entero positivo, requerido

**Success Response (201):**
```json
{
  "message": "Item added to cart",
  "cart": {
    "userId": 1,
    "items": [
      {
        "productId": 1,
        "quantity": 2,
        "addedAt": "2025-11-04T10:30:00.000Z"
      }
    ],
    "updatedAt": "2025-11-04T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `400 VALIDATION_ERROR`: productId o quantity inválidos
- `404 NOT_FOUND`: Producto no encontrado
- `400 VALIDATION_ERROR`: Stock insuficiente
- `500 INTERNAL_ERROR`: Error al agregar item

**Notes:**
- Si el producto ya existe en el carrito, incrementa la cantidad existente
- Valida que haya stock suficiente antes de agregar
- El carrito se guarda en Redis con TTL de 7 días
- Cada vez que se modifica el carrito, el TTL se reinicia

---

### 4. Update Item Quantity
Actualiza la cantidad de un producto en el carrito. **Reemplaza** la cantidad existente (no suma).

**Endpoint:** `PUT /api/cart/items`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`.

**Request Body:**
```json
{
  "productId": 1,
  "quantity": 3
}
```

**Validation Rules:**
- `productId`: Número entero positivo, requerido
- `quantity`: Número entero positivo, requerido

**Success Response (200):**
```json
{
  "message": "Item quantity updated",
  "cart": {
    "userId": 1,
    "items": [
      {
        "productId": 1,
        "quantity": 3,
        "addedAt": "2025-11-04T10:30:00.000Z"
      }
    ],
    "updatedAt": "2025-11-04T12:00:00.000Z"
  }
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `400 VALIDATION_ERROR`: productId o quantity inválidos
- `404 NOT_FOUND`: Producto no encontrado o no está en el carrito
- `400 VALIDATION_ERROR`: Stock insuficiente
- `500 INTERNAL_ERROR`: Error al actualizar item

**Notes:**
- **Importante**: Este endpoint REEMPLAZA la cantidad, no la suma
- Si quieres incrementar, usa `POST /api/cart/items`
- Valida stock disponible antes de actualizar
- Si el producto no está en el carrito, retorna error 404

---

### 5. Remove Item from Cart
Elimina un producto del carrito. Si era el único item, elimina todo el carrito de Redis.

**Endpoint:** `DELETE /api/cart/items`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`.

**Request Body:**
```json
{
  "productId": 1
}
```

**Validation Rules:**
- `productId`: Número entero positivo, requerido

**Success Response (200):**
```json
{
  "message": "Item removed from cart",
  "cart": {
    "userId": 1,
    "items": [
      {
        "productId": 3,
        "quantity": 1,
        "addedAt": "2025-11-04T11:00:00.000Z"
      }
    ],
    "updatedAt": "2025-11-04T12:30:00.000Z"
  }
}
```

**Success Response - Last Item Removed (200):**
```json
{
  "message": "Item removed from cart. Cart is now empty.",
  "cart": {
    "userId": 1,
    "items": [],
    "updatedAt": "2025-11-04T12:30:00.000Z"
  }
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `400 VALIDATION_ERROR`: productId inválido
- `404 NOT_FOUND`: Producto no está en el carrito
- `500 INTERNAL_ERROR`: Error al eliminar item

**Notes:**
- Si era el último producto, el carrito se elimina completamente de Redis
- Retorna el carrito actualizado después de eliminar
- Si el carrito queda vacío, el mensaje indica que está vacío

---

### 6. Clear Cart
Elimina completamente el carrito del usuario de Redis.

**Endpoint:** `DELETE /api/cart`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`.

**Success Response (200):**
```json
{
  "message": "Cart cleared successfully"
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `500 INTERNAL_ERROR`: Error al limpiar carrito

**Notes:**
- Elimina el carrito completo de Redis
- Si no existía carrito, retorna éxito de todas formas
- Útil para "vaciar carrito" o después de checkout manual

---

### 7. Checkout
Convierte el carrito en una orden de compra. Valida stock y balance, crea la orden usando el servicio de órdenes, y limpia el carrito después del éxito.

**Endpoint:** `POST /api/cart/checkout`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `user`, `admin`. Opcionalmente cookie `trustedPayment` para auto-aprobar.

**Request Body:**
No requiere body, usa el carrito actual del usuario.

**Success Response - Dispositivo Confiable (201):**
Si el usuario tiene cookie `trustedPayment` válida:
```json
{
  "message": "Order created successfully",
  "order": {
    "id": 123,
    "createdAt": "2025-11-04T12:00:00.000Z",
    "total": 1299.97,
    "status": "completed",
    "user": {
      "id": 1,
      "name": "Juan Pérez",
      "email": "juan@example.com"
    },
    "items": [
      {
        "id": 1,
        "quantity": 2,
        "unitPrice": 599.99,
        "product": {
          "id": 1,
          "name": "Laptop HP",
          "price": 599.99,
          "stock": 48
        }
      }
    ]
  },
  "requiresVerification": false
}
```

**Success Response - Requiere Verificación (201):**
Si NO tiene cookie `trustedPayment`:
```json
{
  "message": "Order created. Please check your email to verify payment within 5 minutes.",
  "order": {
    "id": 123,
    "createdAt": "2025-11-04T12:00:00.000Z",
    "total": 1299.97,
    "status": "pending",
    "user": {
      "id": 1,
      "name": "Juan Pérez",
      "email": "juan@example.com"
    },
    "items": [...]
  },
  "requiresVerification": true
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `400 VALIDATION_ERROR`: Carrito vacío
- `404 NOT_FOUND`: Producto en carrito no encontrado
- `400 VALIDATION_ERROR`: Stock insuficiente para uno o más productos
- `400 VALIDATION_ERROR`: Balance insuficiente
- `400 VALIDATION_ERROR`: Usuario tiene 5 órdenes pendientes (máximo alcanzado)
- `500 INTERNAL_ERROR`: Error al crear orden

**Notes:**
- Convierte items del carrito al formato de OrdersService
- Valida stock y balance antes de crear la orden
- **Con `trustedPayment` cookie**: Pago instantáneo, orden `completed`, balance/stock descontados inmediatamente
- **Sin `trustedPayment` cookie**: Orden `pending`, envía email de verificación, expira en 5 minutos
- Después de crear la orden exitosamente, el carrito se limpia automáticamente
- Si la creación de orden falla, el carrito se mantiene intacto
- Ver documentación de `POST /api/orders` para más detalles sobre el flujo de verificación

---

## �📊 Bull Board Dashboard (Admin Only)

### Queue Monitoring Dashboard
Dashboard web para monitorear las colas de jobs en tiempo real. Permite inspeccionar, gestionar y hacer retry de jobs.

**Endpoint:** `GET /admin/queues`

**Authentication:** Requiere cookies con `accessToken` o `refreshToken` válidos. Roles permitidos: `admin`.

**Features:**
- 📊 Vista en tiempo real de todas las colas
- 🔍 Inspección detallada de jobs
- 🔄 Retry manual de jobs fallidos
- 🗑️ Limpieza de jobs antiguos
- 📈 Estadísticas y métricas
- ⏱️ Timeline de jobs delayed

**Colas Disponibles:**
- `order-expiration`: Jobs para cancelación automática de órdenes pendientes

**Acceso:**
1. Iniciar sesión como admin mediante `/api/auth/login`
2. Navegar a `http://localhost:3000/admin/queues` en el navegador
3. Ver y gestionar todas las colas activas

**UI Sections:**
- **Queues**: Lista de todas las colas con contadores
- **Jobs**: Vista de jobs por estado (active, waiting, delayed, completed, failed)
- **Job Details**: Información completa del job (data, logs, stack trace)
- **Actions**: Retry, Delete, Promote, Clean

**Security:**
- ✅ Autenticación JWT requerida
- ✅ Solo usuarios con rol `admin`
- ⚠️ En producción, considerar protección adicional (Basic Auth, IP Whitelist, VPN)

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Token faltante, inválido o expirado
- `403 AUTHENTICATION_ERROR`: Permisos insuficientes (no es admin)

**Notes:**
- El dashboard es una SPA (Single Page Application) servida por Bull Board
- Actualizaciones en tiempo real mediante polling
- Útil para debugging y monitoreo de jobs
- Ver [JOB_QUEUES.md](./JOB_QUEUES.md) para más información sobre las colas

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

## 🔒 Authentication & Payment Flow

### Flujo completo de autenticación:

1. **Registro con Verificación de Email**: 
   - Usuario se registra → `POST /api/auth/register`
   - Sistema crea cuenta (rol `user` por defecto) y envía email con HTML + link de verificación
   - Usuario recibe email con botón clickeable
   - Usuario hace click en link → `GET /api/auth/verify-email?token=xxx`
   - Email queda verificado

2. **Login con 2FA o Dispositivo de Confianza**:
   - Usuario envía credenciales → `POST /api/auth/login`
   - Sistema valida que el email esté verificado
   - **Si el dispositivo es de confianza** (tiene cookie `trustedDevice` válida):
     - Sistema genera tokens JWT directamente en cookies (incluyen `userId`, `email`, `role`)
     - Usuario inicia sesión inmediatamente sin 2FA
   - **Si el dispositivo NO es de confianza**:
     - Sistema genera un JWT con el código encriptado y lo almacena en cookie `pendingAuth` (expira en 10 minutos)
     - Usuario recibe código de 6 dígitos por email
     - Usuario envía código → `POST /api/auth/verify-code` con `{ code, rememberDevice }`
     - Sistema lee el JWT de la cookie `pendingAuth`, valida el código
     - Si es válido, elimina la cookie `pendingAuth` y genera tokens JWT en cookies
     - Si `rememberDevice: true`, genera cookie `trustedDevice` (válida por 30 días)

### Flujo de Verificación de Pagos:

3. **Crear Orden con Verificación de Pago**:
   - Usuario autenticado crea orden → `POST /api/orders`
   - Sistema valida balance del usuario y stock de productos
   - **Si el dispositivo tiene pago confiable** (cookie `trustedPayment` válida):
     - ✅ Descuenta balance del usuario inmediatamente
     - ✅ Descuenta stock de productos inmediatamente
     - ✅ Crea orden con status `completed`
     - ✅ Retorna: `{ order, requiresVerification: false }`
   - **Si el dispositivo NO tiene pago confiable**:
     - ⏸️ NO descuenta balance ni stock todavía
     - ⏸️ Crea orden con status `pending`
     - 📧 Genera JWT token de verificación (expira en 5 minutos)
     - 📧 Envía email HTML con dos opciones:
       1. "Verify Payment" (link: `/api/auth/verify-order?token=xxx&remember=false`)
       2. "Verify & Trust This Device" (link: `/api/auth/verify-order?token=xxx&remember=true`)
     - ⏰ Inicia temporizador de 5 minutos para auto-cancelación
     - Retorna: `{ order, requiresVerification: true, message: "Check email..." }`

4. **Verificar Pago de Orden**:
   - Usuario hace click en link del email → `GET /api/auth/verify-order?token=xxx&remember=true`
   - **Si el token es válido (< 5 minutos)**:
     - ✅ Descuenta balance del usuario
     - ✅ Descuenta stock de productos
     - ✅ Actualiza orden a status `completed`
     - ✅ Si `remember=true`: genera cookie `trustedPayment` (30 días)
     - Retorna: `{ ok: true, message: "Payment verified", order, trustedDevice }`
   - **Si el token expiró (> 5 minutos)**:
     - ❌ Marca orden como `cancelled`
     - ❌ Retorna error: "Verification link expired. Order has been cancelled."
   - **Si el balance es insuficiente al verificar**:
     - ❌ Marca orden como `cancelled`
     - ❌ Retorna error: "Insufficient balance"

5. **Acceso a Rutas Protegidas**:
   - Cliente incluye automáticamente las cookies en cada request
   - Middleware `requireAuth()` valida el `accessToken`
   - **Si el `accessToken` está expirado**:
     - Middleware verifica automáticamente el `refreshToken`
     - Si es válido, genera nuevos tokens (rotación)
     - Actualiza las cookies
     - Continúa con el request original
   - **Si ambos tokens son inválidos/expirados**:
     - Retorna 401 y pide al usuario que haga login nuevamente

6. **Refresh Manual** (opcional):
   - Si el cliente detecta un token expirado
   - Cliente llama → `POST /api/auth/refresh`
   - Sistema genera nuevos tokens (rotación)

7. **Logout**:
   - Usuario cierra sesión → `POST /api/auth/logout` con `{ forgetDevice }`
   - Sistema elimina las cookies `accessToken` y `refreshToken`
   - **Si `forgetDevice: false` (default)**: 
     - Mantiene cookies `trustedDevice` y `trustedPayment`
     - Próximo login sin 2FA
     - Próximas compras sin verificación de pago
   - **Si `forgetDevice: true`**: 
     - Elimina cookies `trustedDevice` y `trustedPayment`
     - Próximo login con 2FA completo
     - Próximas compras con verificación por email
   - Recomendado usar `forgetDevice: true` en dispositivos compartidos o públicos

### Renovación Automática de Tokens:

El sistema implementa **auto-refresh transparente**:
- Los endpoints protegidos con `requireAuth()` verifican ambos tokens
- Si `accessToken` expiró pero `refreshToken` es válido, se renuevan ambos automáticamente
- El cliente NO necesita manejar la renovación manualmente
- Solo si ambos tokens expiran, se requiere login completo

---

## 🍪 Cookies

La API utiliza cookies HTTP-only para almacenar tokens JWT:

### `pendingAuth`
- **Duración**: 10 minutos
- **Contenido**: `{ email, code, purpose: '2fa-verification' }`
- **Uso**: Almacenar temporalmente el código 2FA durante el proceso de login
- **Flags**: `httpOnly`, `secure` (en producción), `sameSite: strict`
- **Ciclo de vida**: Se crea en `/api/auth/login` (dispositivos no confiables), se valida y elimina en `/api/auth/verify-code`

### `trustedDevice`
- **Duración**: 30 días (configurable con `TRUSTED_DEVICE_EXPIRES_DAYS`)
- **Contenido**: `{ userId, email, purpose: 'trusted-device' }`
- **Uso**: Identificar dispositivos de confianza para omitir 2FA
- **Flags**: `httpOnly`, `secure` (en producción), `sameSite: strict`
- **Ciclo de vida**: 
  - Se crea en `/api/auth/verify-code` si `rememberDevice: true`
  - Persiste entre sesiones (no se elimina con logout normal)
  - Se elimina solo con `POST /api/auth/logout` + `forgetDevice: true`
  - Permite login sin 2FA durante 30 días
- **Recomendaciones**:
  - ✅ Activar en dispositivos personales (laptop, móvil personal)
  - ❌ NO activar en dispositivos compartidos o públicos

### `trustedPayment`
- **Duración**: 30 días (configurable con `TRUSTED_PAYMENT_EXPIRES_DAYS`)
- **Contenido**: `{ userId, purpose: 'trusted-payment' }`
- **Uso**: Identificar dispositivos de confianza para omitir verificación de pago por email
- **Flags**: `httpOnly`, `secure` (en producción), `sameSite: strict`
- **Ciclo de vida**: 
  - Se crea en `/api/auth/verify-order` si `remember=true`
  - Persiste entre sesiones (no se elimina con logout normal)
  - Se elimina solo con `POST /api/auth/logout` + `forgetDevice: true`
  - Permite pagos instantáneos sin verificación por email durante 30 días
- **Beneficios**:
  - ✅ Compras instantáneas sin esperar email de verificación
  - ✅ Mejor UX para usuarios frecuentes en dispositivos personales
  - ✅ Balance y stock se deducen inmediatamente
  - ✅ Orden se marca como `completed` al instante
- **Recomendaciones**:
  - ✅ Activar en dispositivos personales de uso frecuente
  - ❌ NO activar en dispositivos compartidos o públicos
  - ⚠️ El usuario debe tener cuidado con la seguridad de su dispositivo

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
TRUSTED_DEVICE_EXPIRES_DAYS=30
ORDER_VERIFICATION_EXPIRY_MINUTES=5
TRUSTED_PAYMENT_EXPIRES_DAYS=30

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
- Los tokens de verificación de pago expiran en 5 minutos (configurable)
- Los tokens de dispositivo de confianza (2FA y pagos) expiran en 30 días (configurable)
- Se implementa rotación de refresh tokens para mayor seguridad
- Sistema de dispositivos de confianza permite omitir 2FA en dispositivos conocidos
- Sistema de pagos confiables permite compras instantáneas sin verificación por email
- Las órdenes se cancelan automáticamente si no se verifica el pago en 5 minutos
- Balance y stock NO se deducen hasta que el pago es verificado (órdenes `pending`)
- Balance y stock se deducen inmediatamente en dispositivos con `trustedPayment` cookie
