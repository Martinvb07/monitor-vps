<div align="center">

<img src="frontend/public/icon.svg" alt="MARTIN.HQ Logo" width="120"/>

# MARTIN.HQ — Monitor

**Panel de monitoreo en tiempo real para VPS, sitios web y procesos, con terminal SSH integrada**

*Controlá tu infraestructura desde cualquier dispositivo, en cualquier momento*

---

[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Real--Time-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![PWA](https://img.shields.io/badge/PWA-Instalable-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

</div>

---

## ¿Qué es MARTIN.HQ?

**MARTIN.HQ** es un dashboard de monitoreo personal diseñado para tener visibilidad total sobre un servidor VPS y los sitios web que corre, directamente desde el browser — sin depender de herramientas externas ni servicios de terceros.

Todo corre en tu propio servidor. Tus datos no salen de tu infraestructura.

El sistema verifica automáticamente cada 30 segundos el estado de tus sitios y envía actualizaciones en tiempo real al dashboard vía WebSocket. Si algo cae, el panel lo muestra al instante — sin necesidad de recargar la página.

---

## ¿Qué podés hacer con MARTIN.HQ?

### 📡 Monitoreo de sitios web
Seguimiento continuo de cada sitio con chequeo automático cada 30 segundos. Cada sitio muestra en tiempo real:
- **Estado** — Online / Down con dot animado
- **Latencia HTTP** — En milisegundos, con indicadores de alerta (>800ms: warn, >2000ms: crítico)
- **Código HTTP** — Status code de la respuesta
- **SSL** — Días restantes hasta el vencimiento del certificado, con alertas automáticas a los 30 y 14 días
- **IP** — Dirección IP resuelta vía DNS

### 🔴 Sistema de alertas
Las alertas se generan automáticamente cuando un sitio cae, tiene latencia alta o el SSL está por vencer. Se auto-resuelven cuando el sitio vuelve a estar en buen estado. Incluye:
- Filtros por estado (activas / resueltas / todas) y severidad (crítica / warning)
- Historial completo de las últimas 200 alertas
- Botón de resolución manual con toast de confirmación

### 📈 Historial y uptime
Gráficas de latencia de las últimas 24 entradas por sitio y barra de uptime visual con los últimos 60 checks. Permite identificar patrones de caídas y picos de latencia a lo largo del tiempo.

### 💻 Terminal SSH en el browser
Terminal SSH completamente funcional integrada en el panel, impulsada por **xterm.js** — el mismo motor que usa VS Code. Conecta directamente a tu VPS con autenticación segura:
- Conexión vía WebSocket con token de sesión firmado (HMAC)
- Soporte completo de colores ANSI y caracteres especiales
- Clic derecho para pegar desde el clipboard
- Resize dinámico al redimensionar la ventana
- Sesiones protegidas por JWT — solo usuarios autenticados pueden abrir una terminal

### 🚀 Deploys y GitHub integration
Registro de deploys con ejecución de scripts automáticos directamente desde el panel:
- Selección de proyecto con scripts preconfigurados en el servidor
- Output en tiempo real del script de deploy en terminal estilo editor
- Integración con **GitHub API** — muestra los últimos commits de tus repositorios con el mensaje, SHA y autor
- Un click en "Usar en deploy" pre-rellena el formulario con la info del commit
- Registro histórico de los últimos 100 deploys

### ⚙️ Procesos PM2
Vista en tiempo real de todos los procesos gestionados por PM2:
- CPU, memoria RAM, cantidad de reinicios y estado de cada proceso
- Botón de restart por proceso con confirmación vía toast
- Alertas visuales cuando CPU > 80% o reinicios > 5

### 🌐 Visitantes y analytics
Análisis del tráfico de Nginx en tiempo real:
- Requests del día, IPs únicas, bots detectados y errores 4xx/5xx
- Distribución horaria del tráfico con gráfica de barras
- Feed en vivo de las últimas peticiones
- Países de origen y referrers más frecuentes

### 🛡️ Seguridad
Monitor de seguridad basado en análisis de logs de Nginx:
- IPs bloqueadas con motivo y cantidad de intentos
- Verificación de headers de seguridad por sitio (HTTPS, HSTS, HTTP/2, X-Powered-By)
- Endpoints con mayor cantidad de errores 401/403
- Detección de bots por user-agent

### 📋 Logs en vivo
Visor de logs con selector de fuente (Nginx access, Nginx error, PM2 por proceso):
- Selección de cantidad de líneas (50 / 100 / 200)
- Auto-refresh opcional
- Visualización en terminal monoespacio

### 🔌 Puertos
Estado de los puertos configurados del servidor (22, 80, 443, 3000, 3001…), con indicador de abierto/cerrado y latencia de conexión.

### 📝 Notas
Bloc de notas persistente con auto-guardado a los 800ms. Ideal para comandos frecuentes, IPs y recordatorios del servidor.

### ⚙️ Ajustes
- **2FA** — Autenticación en dos pasos con Google Authenticator o Authy (TOTP)
- **Cambio de contraseña** — Desde el panel, sin tocar archivos del servidor
- **Webhook CI/CD** — URL y ejemplo de GitHub Actions para registrar deploys automáticamente

---

## Tecnologías utilizadas

### ⚙️ Backend

| Tecnología | Para qué se usa |
|------------|-----------------|
| ![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white) | Motor del servidor |
| ![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white) | API REST |
| ![ws](https://img.shields.io/badge/ws-WebSocket-010101?logoColor=white) | WebSocket real-time (puerto 3003) |
| ![JWT](https://img.shields.io/badge/JWT-000000?logo=jsonwebtokens&logoColor=white) | Autenticación de sesiones |
| ![bcrypt](https://img.shields.io/badge/bcrypt-Hash-4A154B?logoColor=white) | Hash de contraseñas |
| ![speakeasy](https://img.shields.io/badge/Speakeasy-2FA-FF6B35?logoColor=white) | Autenticación en dos pasos |
| ![Helmet](https://img.shields.io/badge/Helmet.js-Security-333333?logoColor=white) | Headers HTTP de seguridad |

### 🖥️ Frontend

| Tecnología | Para qué se usa |
|------------|-----------------|
| ![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white) | Framework React con App Router |
| ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) | Tipado estático |
| ![xterm.js](https://img.shields.io/badge/xterm.js-Terminal-2B7489?logoColor=white) | Emulador de terminal en el browser |
| ![ssh2](https://img.shields.io/badge/ssh2-SSH-4D4D4D?logoColor=white) | Conexión SSH desde Node.js |
| ![Recharts](https://img.shields.io/badge/Recharts-Charts-22b5bf?logoColor=white) | Gráficas de latencia |
| ![tsx](https://img.shields.io/badge/tsx-TS_Runner-3178C6?logoColor=white) | Custom server con WebSocket |

---

## Estructura del proyecto

```
vps-monitor/
│
├── server.js                → API + WebSocket status (puerto 3003)
├── services/
│   └── monitor.js           → Monitoreo automático cada 30s
├── routes/                  → auth, status, alertas, deploys, visitantes,
│                              seguridad, pm2, logs, ports, sites, notes,
│                              system, webhook
├── middleware/auth.js        → Verificación JWT
├── data/                    → Persistencia JSON (history, alerts, deploys, notes)
│
└── frontend/
    ├── server.ts            → Custom server: Next.js + WebSocket SSH (puerto 3002)
    ├── app/dashboard/       → 12 páginas del panel
    ├── components/
    │   ├── StatusContext.tsx → WebSocket real-time
    │   ├── Toast.tsx        → Notificaciones
    │   ├── NavDropdown.tsx  → Menú con badges
    │   └── SslBanner.tsx    → Banner SSL
    └── lib/
        ├── api.ts           → Cliente HTTP completo
        ├── auth.ts          → JWT localStorage
        └── terminal-tokens.ts → Tokens HMAC
```

---

## Roadmap

### ✅ Completado
- [x] Monitoreo automático de sitios (HTTP, SSL, DNS, latencia)
- [x] Dashboard en tiempo real vía WebSocket
- [x] Sistema de alertas con auto-resolución
- [x] Historial y gráficas de latencia / uptime
- [x] Terminal SSH en el browser (xterm.js + WebSocket + ssh2)
- [x] Deploys con scripts y output en streaming
- [x] Integración GitHub API — commits recientes
- [x] PM2 management con restart
- [x] Analytics de visitantes (Nginx logs)
- [x] Monitor de seguridad
- [x] Logs en tiempo real
- [x] Puertos y notas
- [x] 2FA, cambio de contraseña, webhook CI/CD
- [x] PWA instalable (Android e iOS)
- [x] Dark mode / Light mode
- [x] Responsive completo (móvil, tablet, desktop)
- [x] Toast notifications y session timeout
- [x] apt upgrade desde el panel con streaming

### 🔜 Próximamente
- [ ] Deploy con Nginx + dominio propio + HTTPS
- [ ] Notificaciones push (PWA)
- [ ] Métricas de CPU/RAM del servidor en tiempo real
- [ ] Múltiples usuarios con roles

---

<div align="center">

Construido con obsesión por el control total de la infraestructura propia

**[Reportar un problema](https://github.com/Martinvb07/monitor-vps/issues)** · **[Solicitar una función](https://github.com/Martinvb07/monitor-vps/issues/new)**

</div>
