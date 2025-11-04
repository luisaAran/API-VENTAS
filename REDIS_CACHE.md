# Redis Cache Configuration

## 🔴 ¿Qué es Redis?

**Redis** (Remote Dictionary Server) es una base de datos en memoria ultra-rápida utilizada como:
- **Cache** - Almacenar datos temporales para acceso rápido
- **Session Store** - Guardar sesiones de usuario
- **Queue** - Procesar tareas en background
- **Pub/Sub** - Mensajería en tiempo real

## ⚡ Ventajas de usar Redis

1. **Velocidad** - Datos en RAM (100x más rápido que disco)
2. **Escalabilidad** - Reduce carga en MySQL
3. **TTL (Time To Live)** - Expira datos automáticamente
4. **Atomicidad** - Operaciones atómicas garantizadas
5. **Persistencia opcional** - Puede guardar a disco

## 📦 Instalación

### Con Docker (Recomendado)
```bash
docker-compose up redis
```

### Sin Docker (Local)
**Windows:**
```powershell
# Usar WSL2 o descargar desde: https://github.com/microsoftarchive/redis/releases
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**macOS:**
```bash
brew install redis
brew services start redis
```

## 🔧 Configuración

### Variables de Entorno (.env)
```env
REDIS_HOST=localhost      # 'redis' en Docker
REDIS_PORT=6379
REDIS_PASSWORD=           # Opcional (vacío por defecto)
REDIS_DB=0               # Base de datos (0-15)
```

### Docker Compose
```yaml
redis:
  image: redis:7-alpine
  container_name: ventas-redis
  ports:
    - "6379:6379"
  command: redis-server --appendonly yes
  volumes:
    - redis_data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
```

## 🚀 Uso Básico

### Conectar a Redis
```typescript
import redisClient from './shared/config/redis';

// Redis se conecta automáticamente al importar
```

### Operaciones Básicas

#### **SET - Guardar dato**
```typescript
await redisClient.set('key', 'value');
await redisClient.set('user:1', JSON.stringify({ name: 'Juan' }));
await redisClient.setex('session:abc', 3600, 'data'); // Expira en 1 hora
```

#### **GET - Obtener dato**
```typescript
const value = await redisClient.get('key');
const user = JSON.parse(await redisClient.get('user:1') || '{}');
```

#### **DEL - Eliminar dato**
```typescript
await redisClient.del('key');
await redisClient.del('user:1', 'user:2'); // Múltiples keys
```

#### **EXISTS - Verificar existencia**
```typescript
const exists = await redisClient.exists('key'); // 1 = existe, 0 = no existe
```

#### **TTL - Ver tiempo restante**
```typescript
const ttl = await redisClient.ttl('key'); // Segundos restantes (-1 = sin expiry)
```

#### **EXPIRE - Establecer expiración**
```typescript
await redisClient.expire('key', 3600); // Expira en 1 hora
```

## 📊 Estrategias de Cache

### 1. **Cache-Aside (Lazy Loading)**
```typescript
async function getProduct(id: number) {
  const cacheKey = `product:${id}`;
  
  // 1. Verificar cache
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // 2. Si no está en cache, consultar DB
  const product = await productRepo.findOne({ where: { id } });
  
  // 3. Guardar en cache (expira en 5 minutos)
  await redisClient.setex(cacheKey, 300, JSON.stringify(product));
  
  return product;
}
```

### 2. **Write-Through (Escribir en cache y DB)**
```typescript
async function updateProduct(id: number, data: any) {
  const cacheKey = `product:${id}`;
  
  // 1. Actualizar DB
  await productRepo.update(id, data);
  
  // 2. Actualizar cache
  const updated = await productRepo.findOne({ where: { id } });
  await redisClient.setex(cacheKey, 300, JSON.stringify(updated));
  
  return updated;
}
```

### 3. **Cache Invalidation (Invalidar cache)**
```typescript
async function deleteProduct(id: number) {
  const cacheKey = `product:${id}`;
  
  // 1. Eliminar de DB
  await productRepo.delete(id);
  
  // 2. Invalidar cache
  await redisClient.del(cacheKey);
  await redisClient.del('products:all'); // Invalidar lista completa
}
```

## 🎯 Casos de Uso en Ventas API

### 1. **Cache de Productos**
```typescript
// Lista de productos (expira cada 5 minutos)
GET /api/products → Cache: "products:all" (TTL: 300s)

// Producto individual (expira cada 10 minutos)
GET /api/products/:id → Cache: "product:{id}" (TTL: 600s)
```

### 2. **Cache de Usuarios**
```typescript
// Perfil de usuario (expira cada hora)
GET /api/users/me → Cache: "user:{userId}" (TTL: 3600s)
```

### 3. **Rate Limiting**
```typescript
// Limitar 100 requests por hora por IP
const key = `ratelimit:${ip}`;
const count = await redisClient.incr(key);
if (count === 1) {
  await redisClient.expire(key, 3600); // 1 hora
}
if (count > 100) {
  throw new Error('Rate limit exceeded');
}
```

### 4. **Session Storage (2FA codes)**
```typescript
// Guardar código 2FA (expira en 10 minutos)
const code = generateCode();
await redisClient.setex(`2fa:${email}`, 600, code);

// Verificar código
const storedCode = await redisClient.get(`2fa:${email}`);
if (code === storedCode) {
  await redisClient.del(`2fa:${email}`); // Eliminar después de usar
}
```

## 🔍 Comandos Útiles de Redis CLI

```bash
# Conectar a Redis
docker exec -it ventas-redis redis-cli

# Listar todas las keys
KEYS *

# Ver valor de una key
GET product:1

# Eliminar todas las keys (¡Cuidado!)
FLUSHDB

# Ver info del servidor
INFO

# Monitorear comandos en tiempo real
MONITOR

# Ver memoria usada
INFO memory
```

## 📝 Logs de Conexión

Al iniciar la aplicación, verás:
```bash
2025-10-29 15:30:00 [info]: 🔴 Redis client connected
2025-10-29 15:30:00 [info]: ✅ Redis client ready
```

En caso de error:
```bash
2025-10-29 15:30:00 [error]: ❌ Redis client error: connect ECONNREFUSED 127.0.0.1:6379
2025-10-29 15:30:01 [info]: 🔄 Redis client reconnecting...
```

## ⚠️ Consideraciones Importantes

1. **Memoria Limitada** - Redis usa RAM, no guardar datos masivos
2. **Volatilidad** - Los datos pueden perderse si Redis se reinicia (usar persistencia)
3. **Serialización** - Guardar objetos como JSON string
4. **TTL apropiado** - Balance entre freshness y performance
5. **Cache Invalidation** - Limpiar cache cuando datos cambian
6. **Monitoreo** - Vigilar uso de memoria

## 🔐 Seguridad

### Producción
```env
REDIS_PASSWORD=your_strong_password
```

```yaml
# docker-compose.yaml
redis:
  command: redis-server --requirepass your_strong_password --appendonly yes
```

### Red Interna
En Docker, Redis solo es accesible dentro de la red `ventas-network`, no desde internet.

## 📊 Monitoreo

### Ver estado de Redis
```bash
docker exec -it ventas-redis redis-cli INFO
```

### Ver memoria usada
```bash
docker exec -it ventas-redis redis-cli INFO memory
```

### Ver número de keys
```bash
docker exec -it ventas-redis redis-cli DBSIZE
```

## 🚀 Próximos Pasos

1. ✅ Implementar cache en endpoints de productos
2. ✅ Implementar cache en endpoints de usuarios
3. ✅ Implementar rate limiting
4. ✅ Migrar códigos 2FA de Map a Redis
5. ✅ Implementar caché de sesiones
