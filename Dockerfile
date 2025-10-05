# Etapa de build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Generar cliente de Prisma y build
RUN npm run build:prod

# Etapa de producción
FROM node:20-alpine

WORKDIR /app

# Copiar archivos necesarios desde builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# Crear directorio de logs
RUN mkdir -p /app/logs

# Exponer puerto
EXPOSE 3000

# Variables de entorno por defecto (se pueden sobreescribir)
ENV NODE_ENV=production
ENV PORT=3000

# Comando para iniciar la aplicación
CMD ["npm", "run", "start:prod"]

