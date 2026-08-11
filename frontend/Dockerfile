# Build the React bundle, then serve the static output with nginx.
FROM node:22-alpine AS build

WORKDIR /app

# npm ci needs both files and nothing else, so this layer is cached until the
# dependencies themselves change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# A relative base, because nginx in this image proxies /api to the backend:
# the browser therefore calls the same origin it loaded the page from, whatever
# address that is. Nothing host-specific is baked in, so this image is valid
# for any hostname and needs no rebuild when the server moves.
#
# VITE_API_PORT is the fallback for builds served without that proxy, where the
# API is a separate origin on the same host.
ARG VITE_API_BASE_URL=/api
ARG VITE_API_PORT=8001
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_API_PORT=$VITE_API_PORT

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
