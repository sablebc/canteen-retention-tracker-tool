# Build the React bundle, then serve the static output with nginx.
FROM node:22-alpine AS build

WORKDIR /app

# npm ci needs both files and nothing else, so this layer is cached until the
# dependencies themselves change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Only the API *port* is baked in. The hostname is read from window.location at
# runtime (see src/api/client.js), so moving the server to a different IP does
# not require rebuilding this image.
ARG VITE_API_PORT=8001
ENV VITE_API_PORT=$VITE_API_PORT

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
