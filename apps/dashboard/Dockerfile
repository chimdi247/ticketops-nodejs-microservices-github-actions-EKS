FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine AS production
RUN rm -rf /etc/nginx/conf.d/*
# Templated so EVENTS_API_UPSTREAM / ADMIN_API_UPSTREAM can point at the
# right upstream per environment (docker-compose service names locally,
# k8s Service names in-cluster) without rebuilding the image. The base
# nginx image's docker-entrypoint.sh envsubst's every /etc/nginx/templates
# file into /etc/nginx/conf.d/ at container start.
COPY nginx/default.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html
# sensible defaults for docker-compose; override via environment: in compose
ENV EVENTS_API_UPSTREAM=http://events-api:3000
ENV ADMIN_API_UPSTREAM=http://admin-api:4000
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
