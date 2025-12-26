# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies (including dev for building)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and build
COPY . .
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
