# Varieté — Plataforma B2B de Pedidos

Plataforma de distribución B2B para propietarios de establecimientos comerciales. Incluye catálogo de productos, sistema de pedidos online con fechas de entrega, y programa de cashback configurable.

## Stack tecnológico

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + Framer Motion
- **Backend:** Node.js + Express + TypeScript
- **Base de datos:** PostgreSQL con Prisma ORM
- **Autenticación:** JWT en cookies httpOnly (sesión de 365 días para clientes, 8 horas para admin)
- **Imágenes:** Cloudinary (subida desde el panel admin)
- **Notificaciones WhatsApp:** Twilio
- **Notificaciones Email:** Resend
- **Deploy Frontend:** Netlify
- **Deploy Backend + BD:** Railway

---

## Instalación local

### Requisitos previos
- Node.js 18+
- PostgreSQL 14+ (local o Docker)

### 1. Clonar y configurar variables de entorno

```bash
git clone <tu-repositorio>
cd variete
```

Copiar el archivo de ejemplo y completar las variables:

```bash
cp .env.example backend/.env
```

Editar `backend/.env` con sus datos:

```env
ADMIN_EMAIL=admin@variete.com
ADMIN_PASSWORD=su_contraseña_segura
JWT_SECRET=una_clave_secreta_de_al_menos_32_caracteres
DATABASE_URL=postgresql://postgres:password@localhost:5432/variete
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=su_twilio_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
ADMIN_WHATSAPP_NUMBER=whatsapp:+5491100000000
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=Varieté <noreply@variete.com>
CLOUDINARY_CLOUD_NAME=su_cloud_name
CLOUDINARY_API_KEY=su_api_key
CLOUDINARY_API_SECRET=su_api_secret
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
```

Crear también `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001/api
```

### 2. Instalar dependencias e inicializar la base de datos

```bash
# Backend
cd backend
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

```bash
# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

La aplicación estará disponible en:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Credenciales de acceso local

- **Admin:** `admin@variete.com` / contraseña definida en `.env`
- **Clientes:** Registrarse desde `/registro`

---

## Deploy en producción

### Backend + Base de datos → Railway

1. Crear cuenta en [railway.app](https://railway.app)
2. Nuevo proyecto → **New Project**
3. Agregar servicio **PostgreSQL** desde el marketplace → Railway provee `DATABASE_URL` automáticamente
4. Agregar servicio **GitHub Repo** → seleccionar la carpeta `/backend`
5. En **Settings → Build**:
   - Build command: `npm install && npm run build && npx prisma generate`
   - Start command: `npm run start`
6. En **Variables**, agregar todas las variables de `.env.example` con valores de producción:
   - Railway inyecta `DATABASE_URL` automáticamente desde el servicio PostgreSQL
   - `NODE_ENV=production`
   - El resto de variables externas (Twilio, Resend, Cloudinary, etc.)
7. En **Deploy**, agregar un comando post-deploy personalizado o ejecutar manualmente:
   ```bash
   npx prisma migrate deploy && npx prisma db seed
   ```
8. Railway genera una URL pública para el backend (ej: `https://variete-api.up.railway.app`)

**Costo estimado:** ~$5 USD/mes (incluye PostgreSQL y el servidor Node.js)

---

### Frontend → Netlify

1. Crear cuenta en [netlify.com](https://netlify.com)
2. **New site from Git** → conectar repositorio de GitHub
3. Configurar:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. En **Site settings → Environment variables**, agregar:
   ```
   VITE_API_URL=https://variete-api.up.railway.app/api
   ```
   (usar la URL pública generada por Railway)
5. El archivo `public/_redirects` ya está incluido para manejar el enrutamiento de React Router
6. Deploy automático en cada push a la rama `main`

**Costo:** Gratuito (plan hobby de Netlify)

---

## Configuración de servicios externos

### Cloudinary

1. Crear cuenta gratuita en [cloudinary.com](https://cloudinary.com)
2. En el Dashboard, obtener:
   - **Cloud Name**
   - **API Key**
   - **API Secret**
3. Las imágenes se organizan automáticamente en carpetas:
   - `variete/productos` — imágenes de productos
   - `variete/categorias` — imágenes de categorías

**Costo:** Gratuito hasta 25 GB de almacenamiento

---

### Twilio WhatsApp

1. Crear cuenta en [twilio.com](https://twilio.com)
2. En **Messaging → Try it out → Send a WhatsApp message**, conectar el sandbox:
   - El número del sandbox es: `whatsapp:+14155238886`
   - Enviar el código de activación desde el número del admin
3. Para producción (número de WhatsApp propio):
   - Solicitar aprobación de **WhatsApp Business API** desde el panel de Twilio
   - Puede tomar 2-4 semanas
4. Variables necesarias:
   - `TWILIO_ACCOUNT_SID` — en el Dashboard de Twilio
   - `TWILIO_AUTH_TOKEN` — en el Dashboard de Twilio
   - `TWILIO_WHATSAPP_FROM` — el número del sandbox o aprobado
   - `ADMIN_WHATSAPP_NUMBER` — número del admin en formato `whatsapp:+5491100000000`

**Costo:** ~$0.005 USD por mensaje de WhatsApp

---

### Resend (emails transaccionales)

1. Crear cuenta en [resend.com](https://resend.com)
2. En **Domains**, agregar y verificar el dominio del que se enviarán los emails
3. Crear una **API Key** desde el panel
4. Variables necesarias:
   - `RESEND_API_KEY` — la clave generada
   - `EMAIL_FROM` — dirección verificada, ej: `Varieté <noreply@variete.com>`

**Costo:** Gratuito hasta 3.000 emails/mes

---

## Configuración de cookies en producción

Para que las cookies httpOnly funcionen correctamente en producción (Netlify ↔ Railway):

1. El backend debe tener `NODE_ENV=production` — activa `secure: true` en las cookies
2. Las cookies se configuran con `sameSite: 'none'` en producción para permitir cross-origin
3. El frontend usa `withCredentials: true` en todos los requests (ya configurado en `axios`)
4. El CORS del backend acepta únicamente el dominio de Netlify:
   ```env
   FRONTEND_URL=https://su-sitio.netlify.app
   ```

---

## Estructura del proyecto

```
variete/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Esquema de la base de datos
│   │   └── seed.ts            # Datos iniciales
│   └── src/
│       ├── index.ts           # Entry point
│       ├── middlewares/
│       │   └── auth.ts        # JWT middleware
│       ├── routes/
│       │   ├── auth.ts        # Login/registro
│       │   ├── products.ts    # CRUD productos
│       │   ├── categories.ts  # CRUD categorías
│       │   ├── cities.ts      # Ciudades y fechas de visita
│       │   ├── orders.ts      # Pedidos
│       │   ├── cashback.ts    # Reglas y transacciones de cashback
│       │   ├── clients.ts     # Perfil de clientes
│       │   ├── config.ts      # Configuración global
│       │   └── upload.ts      # Subida a Cloudinary
│       └── utils/
│           ├── cashback.ts    # Cálculo de cashback
│           ├── cloudinary.ts  # SDK de Cloudinary
│           └── notifications.ts # WhatsApp + Email
└── frontend/
    └── src/
        ├── components/        # Componentes reutilizables
        ├── pages/             # Páginas del cliente
        │   └── admin/         # Páginas del panel admin
        ├── store/             # Estado global (Zustand)
        ├── utils/             # API client y formateo
        └── types/             # Tipos TypeScript
```

---

## Flujo de un pedido

1. El cliente navega el catálogo y agrega productos al carrito
2. En el checkout, selecciona fecha de entrega (entre las programadas para su ciudad) y rango horario
3. Opcionalmente aplica su saldo de beneficios disponible como descuento
4. Al confirmar:
   - El stock se descuenta automáticamente
   - El cashback se calcula y acredita al saldo del cliente
   - El admin recibe una notificación por WhatsApp
   - El cliente recibe un email de confirmación con el detalle completo
5. El admin actualiza el estado del pedido desde `/admin/pedidos`
   - Al pasar a "En preparación": email automático al cliente
   - Al pasar a "Entregado": email de cierre al cliente

---

## Resumen de costos mensuales estimados

| Servicio | Plan | Costo |
|---------|------|-------|
| Netlify | Hobby | Gratuito |
| Railway (Node.js + PostgreSQL) | Starter | ~$5 USD |
| Cloudinary | Free | Gratuito |
| Resend | Free (3.000 emails/mes) | Gratuito |
| Twilio WhatsApp | Por uso | ~$0.005/mensaje |

**Total estimado: ~$5-6 USD/mes**
