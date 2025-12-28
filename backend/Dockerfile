# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev for building)
RUN npm install

# Copy all source including prisma schema
COPY . .

# Generate Prisma Client (after schema is copied)
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production Stage
FROM node:20-alpine
WORKDIR /app

# Copy built artifacts and dependencies from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Ensure uploads directory exists
RUN mkdir -p uploads

EXPOSE 4000

CMD ["npm", "run", "start:prod"]
