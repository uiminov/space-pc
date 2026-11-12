# USTA PC — образ для Railway (Node 24: нужен встроенный node:sqlite)
FROM node:24-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
# База и загруженные фото — на постоянном диске Railway (volume, смонтированный в /data)
ENV DATA_DIR=/data
EXPOSE 3000
CMD ["sh", "-c", "npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
