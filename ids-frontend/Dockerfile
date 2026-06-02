# ──────────────────────────────────────────────────────────────────────────────
# Etapa 1: build — compila la app React/Vite a estáticos
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Copiamos solo los manifiestos primero para aprovechar la caché de capas.
# Si package.json no cambia, Docker reutiliza la capa de npm install.
COPY package.json package-lock.json* ./

# npm ci es reproducible y usa el lockfile; si no hay lockfile, cae a npm install.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Ahora copiamos el resto del código fuente
COPY . .

# Variables de entorno de build (Vite las inyecta en tiempo de compilación).
# Se pueden sobreescribir con --build-arg al construir la imagen.
ARG VITE_API_URL=/api
ARG VITE_WS_URL=/ws/live
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# ──────────────────────────────────────────────────────────────────────────────
# Etapa 2: runtime — sirve los estáticos con Nginx (imagen final ligera)
# ──────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Configuración de Nginx (SPA fallback + proxy a /api y /ws)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos el build generado en la etapa anterior
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# healthcheck simple: que Nginx responda en el puerto 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
