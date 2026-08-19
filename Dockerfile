FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --omit=dev --workspace @erf/api
COPY --from=build /app/apps/api/dist apps/api/dist
USER node
CMD ["node", "apps/api/dist/server.js"]
