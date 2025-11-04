# 🛒 Flujos de Lógica de Negocio - E-Commerce API

Este documento describe los **endpoints críticos** y la **arquitectura subyacente** que permite ejecutar la lógica de negocio principal del e-commerce. Se omiten CRUDs básicos y se enfoca en flujos que involucran múltiples capas, servicios y comunicación asíncrona.

---

## 📋 Tabla de Contenidos

1. [Autenticación con 2FA y Dispositivos de Confianza](#1-autenticación-con-2fa-y-dispositivos-de-confianza)
2. [Verificación de Email con JWT](#2-verificación-de-email-con-jwt)
3. [Creación y Verificación de Órdenes con Pagos Confiables](#3-creación-y-verificación-de-órdenes-con-pagos-confiables)
4. [Sistema de Carrito con Checkout](#4-sistema-de-carrito-con-checkout)
5. [Limpieza Automática de Carritos (Cart Cleanup)](#5-limpieza-automática-de-carritos-cart-cleanup)
6. [Expiración Automática de Órdenes](#6-expiración-automática-de-órdenes)
7. [Gestión de Balance con Notificaciones](#7-gestión-de-balance-con-notificaciones)

---

## 1. Autenticación con 2FA y Dispositivos de Confianza

### 🎯 Objetivo
Permitir a los usuarios iniciar sesión de forma segura con autenticación de dos factores (2FA) opcional basada en dispositivos de confianza.

### 📍 Endpoints Involucrados

#### `POST /api/auth/login`
**Responsabilidad:** Validar credenciales y decidir si requiere 2FA o permite acceso directo.

#### `POST /api/auth/verify-code`
**Responsabilidad:** Validar el código 2FA y generar tokens de sesión + opcionalmente marcar dispositivo como confiable.

### 🏗️ Arquitectura del Flujo

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ 1. POST /api/auth/login
       │    { email, password }
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AuthController                               │
│  - Recibe credenciales                                          │
│  - Lee cookie `trustedDevice` (si existe)                       │
│  - Delega validación a AuthService                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AuthService                                 │
│  - Llama a UsersService.findByEmailForAuth() para obtener user  │
│    CON password (bypass de caché)                               │
│  - Valida password con bcrypt                                   │
│  - Verifica que emailVerified === true                          │
│  - Valida cookie `trustedDevice` con JWT si existe              │
│    ├─ Si es válido → Genera tokens y retorna directamente       │
│    └─ Si no es válido o no existe:                              │
│       - Genera código 6 dígitos aleatorio                       │
│       - Crea JWT con { email, code, purpose: '2fa-verification'}│
│       - Almacena JWT en cookie `pendingAuth` (10 min)           │
│       - Encola email con código                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Email Queue (BullMQ)                           │
│  - Job: { to, subject, html, text }                             │
│  - Worker envía email con código 2FA usando Nodemailer          │
│  - Template: login-code.html (tema oscuro Amazon)               │
└─────────────────────────────────────────────────────────────────┘
       │
       │ Cliente recibe email con código
       │
       ▼
┌──────────────┐
│   Cliente    │ 2. POST /api/auth/verify-code
└──────┬───────┘    { code, rememberDevice: true }
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AuthController                               │
│  - Lee cookie `pendingAuth`                                     │
│  - Delega validación a AuthService                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AuthService                                 │
│  - Decodifica JWT de `pendingAuth`                              │
│  - Compara código del JWT con código del body                   │
│  - Si es válido:                                                │
│    ├─ Genera `accessToken` (1 hora)                             │
│    ├─ Genera `refreshToken` (7 días)                            │
│    ├─ Si rememberDevice: genera `trustedDevice` cookie (30 días)│
│    └─ Elimina cookie `pendingAuth`                              │
│  - Retorna user info sin password                               │
└─────────────────────────────────────────────────────────────────┘
```

### 🔑 Comunicación entre Capas

| **Capa**         | **Responsabilidad**                                                     | **Tecnología**       |
|------------------|-------------------------------------------------------------------------|----------------------|
| **Controller**   | Manejo de HTTP (req/res), cookies, delegación a Service                 | Express.js, JWT      |
| **Service**      | Lógica de negocio (validación, generación tokens, encriptación)        | bcrypt, JWT          |
| **Repository**   | Acceso a datos (UsersService → UserRepository → TypeORM)                | TypeORM, MySQL       |
| **Queue**        | Envío asíncrono de emails (BullMQ + Redis)                             | BullMQ, Nodemailer   |
| **Middleware**   | Validación de tokens en rutas protegidas (`requireAuth`)                | JWT, Zod             |

### ✅ Beneficios de la Arquitectura

- **Desacoplamiento:** AuthService no conoce detalles de HTTP (cookies, headers).
- **Seguridad:** Códigos 2FA almacenados en JWT cifrado, nunca en base de datos.
- **Escalabilidad:** Emails enviados por worker asíncrono (BullMQ), no bloquea request.
- **UX Mejorado:** Dispositivos de confianza permiten login directo sin 2FA.

---

## 2. Verificación de Email con JWT

### 🎯 Objetivo
Validar que el usuario es dueño del email registrado mediante un link clickeable con JWT.

### 📍 Endpoints Involucrados

#### `POST /api/auth/register`
**Responsabilidad:** Crear usuario y enviar email de verificación.

#### `GET /api/auth/verify-email?token=xxx`
**Responsabilidad:** Validar token JWT y actualizar `emailVerified` en base de datos.

### 🏗️ Arquitectura del Flujo

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ 1. POST /api/auth/register
       │    { name, email, password }
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AuthController                               │
│  - Valida body con Zod (middleware validateZod)                 │
│  - Delega a AuthService.register()                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AuthService                                 │
│  - Llama a UsersService.createUser()                            │
│    (hash password con bcrypt, rol = 'user', emailVerified=false)│
│  - Genera JWT token con { email, purpose: 'email-verification' }│
│    (expira en 24 horas)                                         │
│  - Construye link: /api/auth/verify-email?token=xxx             │
│  - Encola email con EmailTemplates.emailVerification()          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Email Queue (BullMQ)                           │
│  - Job: { to, subject, html }                                   │
│  - Worker envía email HTML con botón clickeable                 │
│  - Template: email-verification.html (tema oscuro)              │
└─────────────────────────────────────────────────────────────────┘
       │
       │ Usuario recibe email y hace click en link
       │
       ▼
┌──────────────┐
│   Cliente    │ 2. GET /api/auth/verify-email?token=xxx
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AuthController                               │
│  - Extrae token de query params                                 │
│  - Valida con Zod                                               │
│  - Delega a AuthService.verifyEmailToken()                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AuthService                                 │
│  - Decodifica JWT con jwt.verify()                              │
│  - Valida que purpose === 'email-verification'                  │
│  - Llama a UsersService.updateEmailVerification()               │
│    (actualiza emailVerified = true en DB)                       │
│  - Retorna { ok: true, message: "Email verified" }              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UsersService                                  │
│  - Llama a UserRepository.findOneBy({ email })                  │
│  - Actualiza user.emailVerified = true                          │
│  - Guarda con repository.save(user)                             │
│  - Invalida caché de Redis para ese usuario                     │
└─────────────────────────────────────────────────────────────────┘
```

### 🔑 Comunicación entre Capas

| **Capa**         | **Responsabilidad**                                                     | **Tecnología**       |
|------------------|-------------------------------------------------------------------------|----------------------|
| **Controller**   | Extraer query params, validar con Zod, delegar a Service               | Express.js           |
| **Service**      | Validar JWT, actualizar estado de usuario                              | JWT, UsersService    |
| **Repository**   | Persistencia en MySQL, invalidación de caché Redis                     | TypeORM, Redis       |
| **Queue**        | Envío asíncrono de email de verificación                               | BullMQ, Nodemailer   |
| **Middleware**   | Validación de esquema Zod (validateZod)                                | Zod                  |

### ✅ Beneficios de la Arquitectura

- **Stateless:** No guarda tokens en DB, usa JWT auto-verificable.
- **Seguridad:** Token expira en 24 horas, previene reenvíos indefinidos.
- **Escalabilidad:** Email enviado por worker asíncrono, no afecta tiempo de respuesta.

---

## 3. Creación y Verificación de Órdenes con Pagos Confiables

### 🎯 Objetivo
Crear órdenes de compra con verificación de pago por email (2FA para pagos), o auto-aprobar en dispositivos confiables.

### 📍 Endpoints Involucrados

#### `POST /api/orders`
**Responsabilidad:** Validar stock/balance, crear orden (status `pending` o `completed`), enviar email si requiere verificación.

#### `GET /api/auth/verify-order?token=xxx&remember=true`
**Responsabilidad:** Validar token JWT, descontar balance/stock, actualizar orden a `completed`.

### 🏗️ Arquitectura del Flujo

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ 1. POST /api/orders
       │    { items: [{ productId, quantity }] }
       │    Cookies: accessToken + trustedPayment (opcional)
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   OrdersController                               │
│  - Middleware requireAuth(['user', 'admin']) valida tokens JWT  │
│  - Middleware checkTrustedPayment lee cookie `trustedPayment`   │
│    (valida JWT sin lanzar error si no existe)                   │
│  - Extrae userId de req.user                                    │
│  - Lee hasTrustedPayment de req.hasTrustedPayment               │
│  - Delega a OrdersService.createOrder()                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OrdersService                                 │
│  ┌─ SI hasTrustedPayment === true:                              │
│  │  ├─ Valida stock y balance                                   │
│  │  ├─ Descuenta stock de productos                             │
│  │  ├─ Descuenta balance de usuario                             │
│  │  ├─ Crea orden con status = 'completed'                      │
│  │  ├─ Llama a checkAndCleanupOutOfStockProducts() (async)     │
│  │  └─ Retorna { order, requiresVerification: false }           │
│  │                                                               │
│  └─ SI hasTrustedPayment === false:                             │
│     ├─ Valida que usuario no tenga más de 5 órdenes pending     │
│     ├─ Valida stock y balance (sin descontar todavía)           │
│     ├─ Crea orden con status = 'pending'                        │
│     ├─ Genera JWT token { orderId, userId, purpose: 'payment' } │
│     │   (expira en 5 minutos)                                   │
│     ├─ Construye dos links de verificación:                     │
│     │   - remember=false (verificación única)                   │
│     │   - remember=true (marca dispositivo como confiable)      │
│     ├─ Encola email con EmailTemplates.orderVerification()      │
│     ├─ Encola job en order-expiration queue (delay 5 min)       │
│     └─ Retorna { order, requiresVerification: true }            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ├─► (Caso trusted payment)
                           │   Orden completada inmediatamente
                           │
                           └─► (Caso NO trusted payment)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Email Queue (BullMQ)                           │
│  - Job: { to, subject, html }                                   │
│  - Worker envía email con dos botones:                          │
│    1. "Verify Payment" (remember=false)                         │
│    2. "Verify & Trust Device" (remember=true)                   │
│  - Template: order-verification.html                            │
└─────────────────────────────────────────────────────────────────┘
       │
       │ Usuario recibe email y hace click en link
       │
       ▼
┌──────────────┐
│   Cliente    │ 2. GET /api/auth/verify-order?token=xxx&remember=true
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AuthController                               │
│  - Extrae token y remember de query params                      │
│  - Delega a AuthService.verifyOrder()                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AuthService                                 │
│  - Decodifica JWT token                                         │
│  - Valida que purpose === 'payment-verification'                │
│  - Llama a OrdersService.completeOrderPayment()                 │
│  - Si remember === 'true':                                      │
│    └─ Genera cookie `trustedPayment` (30 días)                  │
│  - Retorna { ok, message, order, trustedDevice }                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OrdersService                                 │
│  - Verifica que orden.status === 'pending'                      │
│    (si no, retorna mensaje "already verified")                  │
│  - Valida balance actual del usuario                            │
│  - Descuenta stock de productos                                 │
│  - Descuenta balance de usuario                                 │
│  - Actualiza orden.status = 'completed'                         │
│  - Cancela job de order-expiration queue                        │
│  - Llama a checkAndCleanupOutOfStockProducts() (async)         │
│  - Encola email de confirmación con PDF adjunto                 │
│  - Retorna orden actualizada                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            Cart Cleanup Queue (BullMQ) - OPCIONAL                │
│  - SI algún producto quedó con stock === 0:                     │
│    ├─ Job: { jobId, products: [], orderId }                     │
│    ├─ Worker escanea todos los carritos en Redis                │
│    ├─ Identifica usuarios afectados (tienen ese producto)       │
│    ├─ Agrupa productos por usuario en Map<userId, products[]>   │
│    ├─ Elimina productos agotados de cada carrito                │
│    └─ Envía UN email por usuario con lista de productos         │
│       agotados (template: product-out-of-stock.html)            │
└─────────────────────────────────────────────────────────────────┘
```

### 🔑 Comunicación entre Capas

| **Capa**              | **Responsabilidad**                                              | **Tecnología**       |
|-----------------------|------------------------------------------------------------------|----------------------|
| **Controller**        | Manejo de HTTP, cookies, middlewares de auth                     | Express.js           |
| **Service (Orders)**  | Lógica de negocio (validación, creación orden, stock, balance)  | TypeORM              |
| **Service (Auth)**    | Verificación JWT, generación cookies de confianza                | JWT                  |
| **Repository**        | Persistencia (Order, OrderItem, Product, User)                   | TypeORM, MySQL       |
| **Queue (Email)**     | Envío asíncrono de emails de verificación y confirmación         | BullMQ, Nodemailer   |
| **Queue (Expiration)**| Job delayed para auto-cancelar órdenes no verificadas (5 min)    | BullMQ               |
| **Queue (Cleanup)**   | Limpieza de carritos cuando productos se agotan                  | BullMQ, Redis        |
| **Middleware**        | requireAuth, checkTrustedPayment, validateZod                    | JWT, Zod             |

### ✅ Beneficios de la Arquitectura

- **Seguridad:** Pagos requieren verificación por email (2FA) a menos que dispositivo sea confiable.
- **UX Mejorado:** Dispositivos confiables permiten pagos instantáneos sin email.
- **Optimización de Stock:** Balance/stock no se descuentan hasta verificar pago (previene bloqueo).
- **Auto-cancelación:** Órdenes no verificadas se cancelan automáticamente después de 5 minutos.
- **Notificaciones:** Usuarios con productos agotados reciben email automático.

---

## 4. Sistema de Carrito con Checkout

### 🎯 Objetivo
Permitir a usuarios agregar productos a un carrito temporal (Redis) y convertirlo en una orden de compra.

### 📍 Endpoints Involucrados

#### `POST /api/cart/items`
**Responsabilidad:** Agregar producto al carrito (valida stock).

#### `GET /api/cart/summary`
**Responsabilidad:** Obtener carrito con detalles de productos y total.

#### `POST /api/cart/checkout`
**Responsabilidad:** Convertir carrito en orden, limpiar carrito si éxito.

### 🏗️ Arquitectura del Flujo

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ 1. POST /api/cart/items
       │    { productId, quantity }
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CartController                                 │
│  - Middleware requireAuth(['user', 'admin'])                    │
│  - Extrae userId de req.user                                    │
│  - Valida body con Zod                                          │
│  - Delega a CartService.addItem()                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CartService                                  │
│  - Llama a ProductsService.getProductById() (valida existencia) │
│  - Valida que quantity <= product.stock                         │
│  - Llama a CartRepository.getCart(userId) (lee Redis)           │
│  - Si producto ya existe en carrito:                            │
│    └─ Suma cantidad existente + nueva cantidad                  │
│  - Si producto no existe:                                       │
│    └─ Agrega nuevo item al array                                │
│  - Actualiza timestamp updatedAt                                │
│  - Llama a CartRepository.saveCart() (guarda en Redis con TTL 7d)│
│  - Retorna carrito actualizado                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CartRepository                                 │
│  - Clave Redis: `cart:{userId}`                                 │
│  - Almacena JSON: { userId, items: [], updatedAt }              │
│  - TTL: 7 días (configurable)                                   │
│  - Cada operación reinicia TTL                                  │
└─────────────────────────────────────────────────────────────────┘
       │
       │ 2. GET /api/cart/summary (Ver detalles con precios)
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CartService                                  │
│  - Lee carrito de Redis                                         │
│  - Obtiene detalles de productos desde DB (ProductsService)     │
│  - Calcula subtotales por item                                  │
│  - Calcula total general                                        │
│  - Retorna { userId, items[], total, itemCount, updatedAt }     │
└─────────────────────────────────────────────────────────────────┘
       │
       │ 3. POST /api/cart/checkout (Convertir carrito en orden)
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CartController                                 │
│  - Middleware requireAuth(['user', 'admin'])                    │
│  - Middleware checkTrustedPayment (opcional)                    │
│  - Delega a CartService.checkout()                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CartService                                  │
│  - Lee carrito de Redis                                         │
│  - Valida que carrito no esté vacío                             │
│  - Transforma items del carrito al formato de OrdersService     │
│  - Llama a OrdersService.createOrder(userId, items, hasTrusted) │
│  - SI la orden se crea exitosamente:                            │
│    └─ Llama a CartRepository.clearCart() (elimina de Redis)     │
│  - Retorna orden creada                                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
                 [Flujo de Órdenes - Ver sección 3]
```

### 🔑 Comunicación entre Capas

| **Capa**         | **Responsabilidad**                                                     | **Tecnología**       |
|------------------|-------------------------------------------------------------------------|----------------------|
| **Controller**   | Manejo de HTTP, auth, delegación                                        | Express.js           |
| **Service**      | Validación de stock, cálculo de totales, conversión a orden            | TypeScript           |
| **Repository**   | Persistencia en Redis (carrito temporal)                                | Redis                |
| **Products**     | Validación de productos y stock disponible                              | TypeORM, MySQL       |
| **Orders**       | Creación de orden (reutiliza flujo de sección 3)                        | TypeORM, BullMQ      |

### ✅ Beneficios de la Arquitectura

- **Performance:** Carrito en Redis (no MySQL), acceso ultra-rápido.
- **Escalabilidad:** TTL automático (7 días) libera memoria sin cron jobs.
- **Separación de Responsabilidades:** CartService no conoce lógica de órdenes, solo delega.
- **Atomicidad:** Si la orden falla, el carrito se mantiene intacto.

---

## 5. Limpieza Automática de Carritos (Cart Cleanup)

### 🎯 Objetivo
Cuando un producto se agota, eliminar automáticamente ese producto de todos los carritos de usuarios y notificar por email.

### 📍 Flujo Desencadenado por:
- `OrdersService.completeOrderPayment()` (después de verificar pago)
- `OrdersService.createOrder()` (cuando dispositivo tiene pago confiable)

### 🏗️ Arquitectura del Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│                    OrdersService                                 │
│  - Después de descontar stock de productos                      │
│  - Llama a checkAndCleanupOutOfStockProducts(products, orderId) │
│    ├─ Filtra productos con stock === 0                          │
│    ├─ Mapea a formato { productId, productName }                │
│    └─ Si hay productos agotados:                                │
│       └─ Encola job en cart-cleanup queue                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            Cart Cleanup Queue (BullMQ)                           │
│  - Job Data: { jobId: UUID, products: [], orderId }             │
│  - Priority: 1 (alta prioridad)                                 │
│  - Attempts: 3, backoff exponencial                             │
│  - Worker concurrency: 5                                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               Cart Cleanup Worker                                │
│  1. Verifica cada producto en DB (stock === 0)                  │
│  2. Escanea Redis para encontrar todas las claves `cart:*`      │
│  3. Para cada carrito:                                          │
│     ├─ Deserializa JSON                                         │
│     ├─ Para cada producto agotado:                              │
│     │  ├─ Busca si está en carrito                              │
│     │  └─ Si existe, acumula en Map<userId, removedProducts[]>  │
│     ├─ Filtra items del carrito (remueve agotados)              │
│     └─ Guarda carrito actualizado en Redis o elimina si vacío   │
│  4. Para cada usuario afectado:                                 │
│     ├─ Obtiene info de usuario desde UsersService               │
│     └─ Encola email con lista de productos agotados             │
│  5. Retorna resultado con jobId, affectedUsers, productsProcessed│
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Email Queue (BullMQ)                           │
│  - Un email por usuario afectado                                │
│  - Template: product-out-of-stock.html                          │
│  - Contiene tabla HTML con todos los productos agotados         │
│  - Tema oscuro Amazon con tabla responsiva                      │
└─────────────────────────────────────────────────────────────────┘
```

### 🔑 Optimización: Batch Processing + Email Grouping

**Nivel 1 - Batch Processing:**
- **Antes:** N productos agotados → N jobs en cola (alto overhead)
- **Ahora:** N productos agotados → 1 job en cola con array de productos
- **Reducción:** 66-98% menos jobs (Ej: 50 productos → 1 job)

**Nivel 2 - Email Grouping:**
- **Antes:** Usuario con 3 productos agotados → 3 emails separados
- **Ahora:** Usuario con 3 productos agotados → 1 email con tabla de 3 productos
- **Reducción:** 50-66% menos emails

**Performance:**
- **Redis Scans:** 80% menos operaciones (1 scan vs N scans)
- **DB Queries:** Consolidados en batch queries
- **Worker Efficiency:** Procesa múltiples productos en una sola iteración

### 🔑 Comunicación entre Capas

| **Capa**         | **Responsabilidad**                                                     | **Tecnología**       |
|------------------|-------------------------------------------------------------------------|----------------------|
| **Service**      | Detección de productos agotados, encolar cleanup                        | TypeScript           |
| **Queue**        | Job management, retry logic, concurrency control                        | BullMQ, Redis        |
| **Worker**       | Escaneo de carritos, actualización masiva, agrupación de notificaciones | Redis SCAN, Map      |
| **Repository**   | Operaciones CRUD en carritos (Redis)                                    | Redis                |
| **Email**        | Envío de notificaciones agrupadas con templates HTML                    | Nodemailer           |

### ✅ Beneficios de la Arquitectura

- **Asíncrono:** No afecta tiempo de respuesta de la orden.
- **Escalable:** BullMQ maneja concurrencia y reintentos.
- **Batch Processing:** 66-98% menos jobs en cola (múltiples productos → 1 job).
- **Email Grouping:** 50-66% menos emails (múltiples productos → 1 email por usuario).
- **Consistencia:** Garantiza que carritos no tengan productos inexistentes.
- **UX Mejorado:** Usuarios informados inmediatamente cuando sus productos se agotan.

---

## 6. Expiración Automática de Órdenes

### 🎯 Objetivo
Cancelar automáticamente órdenes en estado `pending` que no fueron verificadas en 5 minutos.

### 📍 Flujo Desencadenado por:
- `OrdersService.createOrder()` (cuando NO tiene pago confiable)

### 🏗️ Arquitectura del Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│                    OrdersService                                 │
│  - Después de crear orden con status = 'pending'                │
│  - Llama a scheduleOrderExpiration(orderId, userId, createdAt)  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            Order Expiration Queue (BullMQ)                       │
│  - Job Data: { orderId, userId, createdAt }                     │
│  - JobId: `order-expiration-${orderId}` (único, reemplazable)   │
│  - Delay: 5 minutos (300,000 ms)                                │
│  - Attempts: 3, backoff exponencial                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │ ⏱️ Espera 5 minutos
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            Order Expiration Worker                               │
│  - Ejecuta después de 5 minutos                                 │
│  1. Obtiene orden desde OrdersService.getOrderById()            │
│  2. Verifica que orden.status === 'pending'                     │
│     ├─ Si NO es pending: retorna { skipped, reason }            │
│     └─ Si es pending: continúa                                  │
│  3. Calcula tiempo transcurrido desde creación                  │
│  4. Verifica que hayan pasado >= 5 minutos                      │
│  5. Llama a OrdersService.cancelOrder(orderId)                  │
│     ├─ Actualiza orden.status = 'cancelled'                     │
│     ├─ NO restaura stock (nunca fue descontado)                 │
│     └─ NO restaura balance (nunca fue descontado)               │
│  6. Retorna resultado { cancelled: true, orderId }              │
└─────────────────────────────────────────────────────────────────┘
```

### 🔑 Casos de Uso

#### **Caso 1: Usuario verifica pago a tiempo (< 5 min)**
```
1. createOrder() → orden pending + job delayed
2. Usuario hace click en link de verificación
3. completeOrderPayment() → descuenta balance/stock + cancela job
4. Job NO se ejecuta (fue cancelado con cancelOrderExpirationJob)
```

#### **Caso 2: Usuario NO verifica pago (> 5 min)**
```
1. createOrder() → orden pending + job delayed
2. Pasan 5 minutos sin verificación
3. Worker ejecuta job → verifica que siga pending
4. cancelOrder() → marca orden como 'cancelled'
5. Usuario recibe 404 si intenta verificar después
```

#### **Caso 3: Usuario verifica DESPUÉS de expirar**
```
1. createOrder() → orden pending + job delayed
2. Pasan 5 minutos
3. Worker ejecuta → marca orden como 'cancelled'
4. Usuario intenta verificar → AuthService detecta orden.status === 'cancelled'
5. Retorna error 400: "Order has been cancelled (timeout)"
```

### 🔑 Comunicación entre Capas

| **Capa**         | **Responsabilidad**                                                     | **Tecnología**       |
|------------------|-------------------------------------------------------------------------|----------------------|
| **Service**      | Scheduling de job de expiración al crear orden                          | BullMQ               |
| **Queue**        | Job delayed con ID único (para cancelación posterior)                   | BullMQ, Redis        |
| **Worker**       | Validación de estado y cancelación automática                           | TypeScript           |
| **Repository**   | Actualización de orden.status = 'cancelled'                             | TypeORM, MySQL       |

### ✅ Beneficios de la Arquitectura

- **Auto-Limpieza:** Órdenes no verificadas no ocupan espacio indefinidamente.
- **Cancelación Selectiva:** Job se cancela si usuario verifica a tiempo.
- **Optimización de Stock:** Stock nunca fue descontado, no hay que restaurarlo.
- **Escalable:** BullMQ maneja miles de jobs delayed sin problema.

---

## 7. Gestión de Balance con Notificaciones

### 🎯 Objetivo
Permitir a usuarios agregar balance a su cuenta y recibir sugerencias de productos que pueden comprar.

### 📍 Endpoints Involucrados

#### `POST /api/users/balance`
**Responsabilidad:** Incrementar balance, enviar email de confirmación con sugerencias de productos.

### 🏗️ Arquitectura del Flujo

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ POST /api/users/balance
       │ { amount: 100.50 }
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   UsersController                                │
│  - Middleware requireAuth(['user', 'admin'])                    │
│  - Valida body con Zod (amount > 0, max 999M, 2 decimales)     │
│  - Extrae userId de req.user                                    │
│  - Delega a UsersService.addBalance()                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UsersService                                  │
│  1. Obtiene usuario desde DB (UserRepository)                   │
│  2. Actualiza user.balance += amount                            │
│  3. Guarda en DB con repository.save()                          │
│  4. Invalida caché de Redis para ese usuario                    │
│  5. Llama a ProductsService.findProductsWithinBudget()          │
│     ├─ Busca hasta 3 productos aleatorios                       │
│     ├─ Filtro: product.price <= user.balance (nuevo)            │
│     └─ Retorna array de productos sugeridos                     │
│  6. Si hay productos sugeridos:                                 │
│     └─ Genera sección HTML con EmailTemplates.productSuggestions()│
│  7. Genera email completo con EmailTemplates.balanceAdded()     │
│  8. Encola email con queueEmail()                               │
│  9. Retorna { message, newBalance }                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Email Queue (BullMQ)                           │
│  - Job: { to, subject, html }                                   │
│  - Template: balance-added.html (tema oscuro Amazon)            │
│  - Incluye:                                                     │
│    ├─ Monto agregado con efecto glow                            │
│    ├─ Nuevo balance total                                       │
│    └─ Sección "Te puede interesar" (opcional)                   │
│       └─ Cards de productos con precio, stock y link            │
│  - Worker envía email con Nodemailer                            │
└─────────────────────────────────────────────────────────────────┘
```

### 🔑 Lógica de Sugerencias de Productos

```typescript
// ProductsService.findProductsWithinBudget()
async findProductsWithinBudget(maxPrice: number, limit: number = 3) {
  return await this.productRepository
    .createQueryBuilder('product')
    .where('product.price <= :maxPrice', { maxPrice })
    .andWhere('product.stock > 0') // Solo productos disponibles
    .orderBy('RAND()') // Aleatorio
    .limit(limit)
    .getMany();
}
```

**Casos de Uso:**
- Usuario agrega $100 → Sugerencias: productos <= $100
- Usuario agrega $10 → Sugerencias: productos <= $10 (o vacío si no hay)
- Usuario agrega $1000 → Sugerencias: hasta 3 productos aleatorios <= $1000

### 🔑 Comunicación entre Capas

| **Capa**         | **Responsabilidad**                                                     | **Tecnología**       |
|------------------|-------------------------------------------------------------------------|----------------------|
| **Controller**   | Validación de input, delegación                                         | Express.js, Zod      |
| **Service**      | Actualización de balance, búsqueda de sugerencias, generación de email | TypeORM, QueryBuilder|
| **Repository**   | Persistencia de user.balance, query de productos aleatorios            | TypeORM, MySQL       |
| **Cache**        | Invalidación de caché de usuario en Redis                               | Redis                |
| **Queue**        | Envío asíncrono de email con sugerencias                                | BullMQ, Nodemailer   |
| **Templates**    | Generación de HTML responsivo con tema oscuro                           | EmailTemplates       |

### ✅ Beneficios de la Arquitectura

- **Engagement:** Sugerencias personalizadas basadas en presupuesto del usuario.
- **Performance:** Query optimizada con RAND() y LIMIT (solo 3 productos).
- **Asíncrono:** Email se envía en worker, no bloquea respuesta HTTP.
- **Cache Invalidation:** Garantiza que balance actualizado se refleje inmediatamente.
- **UX:** Email con tema oscuro profesional (Amazon style).

---

## 🎨 Tecnologías y Patrones Utilizados

### Arquitectura General
- **DDD (Domain-Driven Design):** Separación en dominios (auth, users, products, orders, cart).
- **Layered Architecture:** Controller → Service → Repository.
- **Dependency Injection:** Servicios inyectados en constructores.

### Comunicación Asíncrona
- **BullMQ:** Colas de jobs (email, cart-cleanup, order-expiration).
- **Redis:** Storage de carritos, conexión para BullMQ.
- **Workers:** Procesamiento asíncrono con concurrencia y reintentos.

### Seguridad
- **JWT:** Tokens stateless para autenticación y verificaciones.
- **bcrypt:** Hash de contraseñas (10 rounds).
- **HTTP-only Cookies:** Almacenamiento seguro de tokens.
- **2FA:** Código de 6 dígitos para login.
- **Payment Verification:** 2FA para pagos (email con link).

### Validación y Manejo de Errores
- **Zod:** Validación de schemas en middlewares.
- **Custom Errors:** ApiError, ValidationError, AuthenticationError, NotFoundError.
- **Error Handling Middleware:** Centralizado en app.ts.

### Base de Datos
- **TypeORM:** ORM con QueryBuilder para optimización.
- **MySQL:** Base de datos relacional.
- **Redis:** Cache + storage temporal (carritos, sessions).

### Email System
- **Nodemailer:** Envío de emails SMTP.
- **HTML Templates:** Plantillas con tema oscuro Amazon.
- **Queue Processing:** Envío asíncrono con reintentos.

---

## 📊 Diagrama de Arquitectura Completo

```
┌──────────────────────────────────────────────────────────────────┐
│                          CLIENTE                                  │
│                    (Browser / Mobile App)                         │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTP Requests (JSON)
                         │ Cookies: accessToken, refreshToken,
                         │          trustedDevice, trustedPayment
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                     EXPRESS.JS SERVER                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   MIDDLEWARES                               │  │
│  │  - logger (Morgan + Winston)                               │  │
│  │  - requireAuth (JWT validation)                            │  │
│  │  - checkTrustedPayment (optional JWT validation)           │  │
│  │  - validateZod (schema validation)                         │  │
│  │  - errorHandler (centralized error handling)               │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    CONTROLLERS                              │  │
│  │  - AuthController                                          │  │
│  │  - UsersController                                         │  │
│  │  - ProductsController                                      │  │
│  │  - OrdersController                                        │  │
│  │  - CartController                                          │  │
│  └────────────────┬───────────────────────────────────────────┘  │
│                   │ Delegates to                                 │
│                   ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     SERVICES                                │  │
│  │  - AuthService (JWT, 2FA, verification)                    │  │
│  │  - UsersService (CRUD, balance, cache)                     │  │
│  │  - ProductsService (CRUD, search, stock)                   │  │
│  │  - OrdersService (orders, payment, cleanup)                │  │
│  │  - CartService (CRUD, checkout, Redis)                     │  │
│  └────────────────┬───────────────────────────────────────────┘  │
│                   │ Uses                                         │
│                   ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   REPOSITORIES                              │  │
│  │  - UserRepository (TypeORM Entity Repository)              │  │
│  │  - ProductRepository (TypeORM Entity Repository)           │  │
│  │  - OrderRepository (TypeORM Entity Repository)             │  │
│  │  - CartRepository (Redis Client)                           │  │
│  └────────────────┬───────────────────────────────────────────┘  │
└───────────────────┼──────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  MySQL Database  │    │   Redis Server   │
│  - users         │    │  - carts         │
│  - products      │    │  - BullMQ queues │
│  - orders        │    │  - sessions      │
│  - order_items   │    └──────┬───────────┘
└──────────────────┘           │
                               ▼
                    ┌──────────────────────────┐
                    │  BullMQ QUEUES (Redis)   │
                    ├──────────────────────────┤
                    │  - email                 │
                    │  - cart-cleanup          │
                    │  - order-expiration      │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │  BullMQ WORKERS          │
                    ├──────────────────────────┤
                    │  - Email Worker          │
                    │    (Nodemailer SMTP)     │
                    │  - Cleanup Worker        │
                    │    (Redis SCAN, batch)   │
                    │  - Expiration Worker     │
                    │    (Order cancellation)  │
                    └──────────────────────────┘
```

---

## 🚀 Conclusión

Esta arquitectura implementa:

✅ **Separación de Responsabilidades:** DDD con capas bien definidas (Controller → Service → Repository).  
✅ **Comunicación Asíncrona:** BullMQ workers para operaciones pesadas (emails, cleanup, expiración).  
✅ **Seguridad Multinivel:** JWT, 2FA, cookies HTTP-only, verificación de pagos.  
✅ **Optimización de Performance:** Redis para carritos, batch processing, email grouping.  
✅ **Escalabilidad:** Workers con concurrencia, reintentos automáticos, TTL en Redis.  
✅ **UX Mejorado:** Dispositivos de confianza, pagos instantáneos, notificaciones automáticas.  

La arquitectura sigue principios **SOLID**, usa **Design Patterns** (Repository, Dependency Injection, Queue Pattern) y está preparada para escalar horizontalmente agregando más workers y servidores Redis.
