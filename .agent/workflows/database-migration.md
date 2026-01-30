---
description: Safe database migration process for production - NEVER use migrate dev
---

# ⚠️ PRODUCCIÓN - Migración Segura de Base de Datos

## REGLA CRÍTICA
**NUNCA usar `npx prisma migrate dev` en producción. Este comando RESETEA la base de datos.**

## Proceso Seguro para Cambios de Esquema

### 1. Para añadir columnas o cambios simples
```bash
# USAR SIEMPRE db push - NO resetea datos
npx prisma db push
```

### 2. Para cambios que requieren migración SQL manual
Crear un archivo `.sql` con el cambio específico:
```sql
-- Ejemplo: Añadir columna
ALTER TABLE "NombreTabla" ADD COLUMN "nuevaColumna" TEXT;
```

Ejecutar el SQL directamente:
```bash
npx prisma db execute --file prisma/migrations/nombre_cambio.sql
```

### 3. Para regenerar el Prisma Client (sin tocar la DB)
```bash
npx prisma generate
```

### 4. Para despliegue a producción (aplicar migraciones existentes)
```bash
# SOLO aplica migraciones pendientes, NO resetea
npx prisma migrate deploy
```

## Comandos PROHIBIDOS en Producción
- ❌ `npx prisma migrate dev` - RESETEA TODO
- ❌ `npx prisma migrate reset` - BORRA TODO
- ❌ Confirmar "y" cuando Prisma pregunta sobre reset

## Antes de Cualquier Cambio
1. Verificar que estás en el ambiente correcto
2. Hacer backup o tener Point-in-Time Restore habilitado
3. Probar el cambio en ambiente de desarrollo primero

// turbo-all
