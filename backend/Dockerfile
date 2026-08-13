# syntax=docker/dockerfile:1

FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

COPY . .
RUN npm run build

ARG CORS_ORIGIN=http://localhost:3000
ENV CORS_ORIGIN=${CORS_ORIGIN}

EXPOSE 3001

CMD ["node", "dist/src/index.js"]
