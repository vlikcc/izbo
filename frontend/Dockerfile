# Build stage
FROM node:26-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (devDependencies required for tsc/vite build)
ENV NODE_ENV=development
RUN npm ci

# Copy source code (node_modules excluded via .dockerignore)
COPY . .

# Optional build-time fallback. Deployments set APP_API_URL at runtime instead, so the same image serves
# any domain (see /config.js in nginx.conf.template).
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Placed under templates/ so the image's entrypoint substitutes the CSP origins before nginx starts.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Defaults keep a plain `docker run` working; deployments override them with their real origins.
ENV CSP_CONNECT_SRC="https: wss:" \
    CSP_FRAME_SRC="https:" \
    CSP_MEDIA_SRC="https:" \
    APP_API_URL=""

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
