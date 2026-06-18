FROM python:3.12-slim

# Evita prompts y archivos .pyc; logs sin buffer
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dependencias del sistema necesarias para compilar algunos paquetes (bcrypt, etc.)
# tzdata: necesario para que la variable TZ (zona horaria) funcione correctamente.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl tzdata \
    && rm -rf /var/lib/apt/lists/*

# Instala dependencias Python primero (mejor cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia el código
COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fs http://localhost:8000/health || exit 1

# --host 0.0.0.0 para que sea accesible desde otros contenedores
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
