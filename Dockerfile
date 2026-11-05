# Servidor de Carrom (Socket.IO) para Cloud Run. Contexto de build: la raíz del repositorio.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

# Dependencias (capa cacheable). Se copian los package.json de todos los workspaces
# para que el lockfile siga siendo válido, pero solo se instalan los del servidor.
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/client/package.json packages/client/
COPY packages/server/package.json packages/server/
RUN npm ci --omit=dev -w @carrom/server -w @carrom/core

COPY tsconfig.base.json ./
COPY packages/core/src packages/core/src
COPY packages/server/src packages/server/src

# Cloud Run define PORT (8080 por defecto).
EXPOSE 8080
CMD ["node", "--import", "tsx", "packages/server/src/index.ts"]
