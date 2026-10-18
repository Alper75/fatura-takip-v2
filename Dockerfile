# Aşama 1: Frontend Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Aşama 2: Production Server
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Kök bağımlılıkları yükle
COPY package*.json ./
RUN npm install --omit=dev

# API bağımlılıklarını yükle
COPY api/package*.json ./api/
RUN cd api && npm install --omit=dev

# Derlenmiş frontend dosyalarını ve backend kodlarını kopyala
COPY --from=builder /app/dist ./dist
COPY api ./api

EXPOSE 8080

CMD ["node", "api/index.js"]
