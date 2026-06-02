# SigmaIDS — Frontend React

Frontend para el sistema de detección de intrusos basado en firmas + ML (Random Forest).

## Stack

| Capa        | Tecnología                         |
|-------------|-------------------------------------|
| Framework   | React 18 + Vite                    |
| Estado      | Zustand                            |
| HTTP        | Axios                              |
| WebSocket   | API nativa del navegador           |
| Estilos     | CSS-in-JS (inline styles + tokens) |
| Gráficos    | Recharts (listo para integrar)     |

## Estructura

```
src/
├── pages/              # Una página por sección del menú
│   ├── LoginPage.jsx
│   ├── DashboardPage.jsx
│   ├── MonitoreoPage.jsx
│   ├── AlertasPage.jsx
│   ├── ReglasFirmasPage.jsx
│   ├── MLModeloPage.jsx
│   └── ConfigPage.jsx
│
├── components/
│   ├── layout/         # Shell, Sidebar, Topbar
│   │   ├── AppShell.jsx
│   │   ├── Sidebar.jsx
│   │   └── Topbar.jsx
│   └── ui/             # Componentes compartidos
│       ├── SharedUI.jsx   (MetricCard, MlBar, Toggle, SevBadge, Sparkline)
│       └── NavIcon.jsx    (todos los íconos SVG)
│
├── hooks/
│   ├── useAlerts.js    # Estado de alertas en vivo
│   ├── useClock.js     # Reloj tick-tock
│   └── useStyles.js    # Fábrica de estilos por tema
│
├── store/
│   └── authStore.js    # Zustand: usuario autenticado
│
├── services/
│   ├── api.js          # Axios + interceptors JWT → FastAPI
│   └── ws.js           # WebSocket con reconexión automática
│
├── context/
│   └── ThemeContext.jsx # Proveedor de tema claro/oscuro
│
└── utils/
    ├── theme.js         # Tokens de color (light/dark) + NAV_ITEMS
    └── mockData.js      # Datos de prueba y generadores
```

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env

# 3. Iniciar en desarrollo
npm run dev
```

La app queda en http://localhost:5173  
Credenciales demo: `admin` / `admin123`

## Conectar con FastAPI

Editar `src/services/api.js` para apuntar a tu backend real.
El `vite.config.js` ya tiene el proxy configurado: `/api/*` → `http://localhost:8000`.

Para habilitar el WebSocket real, instanciar `IDSWebSocket` en `useAlerts.js`
y reemplazar el `setInterval` de mock por los mensajes que lleguen del servidor.

## Build para producción

```bash
npm run build
# Salida en /dist, servir con nginx o cualquier CDN estático
```
