# Build stage
FROM node:18-alpine AS builder

# Install OpenSSL required by Prisma Engine
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

# Install OpenSSL required by Prisma Engine
RUN apk add --no-cache openssl

WORKDIR /app

# Copy only production dependencies and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --production --legacy-peer-deps
RUN npx prisma generate

# Copy built files from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["npm", "start"]
