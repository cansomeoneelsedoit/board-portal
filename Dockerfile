# Board Portal, self-contained: the API serving its own built SPA.
# Used by the local docker-compose stack so the portal survives terminal
# sessions and reboots. Railway builds its two services separately and does
# not use this file.
FROM node:20-alpine

# Prisma's engines need openssl on alpine.
RUN apk add --no-cache openssl

WORKDIR /app

COPY backend/package*.json backend/
RUN cd backend && npm ci --omit=dev

COPY backend backend
RUN cd backend && npx prisma generate

# The pre-built SPA. `npm run build` in frontend/ before building this image.
COPY frontend/dist frontend/dist

ENV SERVE_SPA=1 \
    PORT=3013 \
    UPLOAD_DIR=/app/backend/uploads

EXPOSE 3013

# Apply the schema on boot, then serve.
CMD ["sh", "-c", "cd backend && npx prisma db push --skip-generate --accept-data-loss && node src/server.js"]
