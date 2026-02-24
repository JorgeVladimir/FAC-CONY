<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1OP0OX73PLMnW3xjMfig0xQZ0UcpwsYu2

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env.local` from `.env.example` and configure SQL Server credentials:
   - `DB_SERVER=192.168.40.20`
   - `DB_NAME=ICGFRONT`
   - `DB_USER=...`
   - `DB_PASSWORD=...`
3. Run frontend + backend:
   `npm run dev:full`

### Checklist de ejecución local (Windows)

1. Instalar dependencias:
   `npm install`
2. Verificar que `.env` tenga CORS local (ya configurado por defecto):
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
3. Liberar puertos de desarrollo si hubo ejecuciones previas:
   `Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 3000,3001 } | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }`
4. Levantar app completa en local:
   `npm run dev:full`
5. Validar salud:
   - Frontend dev: `http://localhost:3001`
   - API: `http://localhost:3000/api/health`

> Nota: en desarrollo, la API se ejecuta en `3000` y Vite en `3001` para evitar conflicto de puertos.

### Authentication flow (current)

- Validate customer ID (Cédula/RUC/Pasaporte) against `CLIENTES.NIF20` in `ICGFRONT`.
- Validate generic password of 7 digits.
- Once password is valid, user must authorize personal data processing.

## Publicación en Internet (producción)

Esta app está preparada para publicar con dominio + HTTPS, sin exponer puertos de desarrollo.

### 1) Requisitos recomendados

- Un servidor Linux público (Ubuntu 22.04+ recomendado).
- Dominio o subdominio, por ejemplo: `facturas.tudominio.com`.
- Acceso del servidor hacia SQL Server privado (`192.168.40.20`) por VPN o red privada.

### 2) Qué puertos abrir

- **Abrir públicamente:** `80/TCP` y `443/TCP`.
- **NO abrir públicamente:** `3002` (backend interno).
- Protocolo correcto para web/API: **TCP**.

### 3) Subir el proyecto y variables

```bash
git clone <tu-repo>
cd FAC-CONY
npm install
cp .env.production.example .env
```

Editar `.env` con tus credenciales reales (`DB_USER`, `DB_PASSWORD`, `GEMINI_API_KEY`) y el dominio en `CORS_ORIGIN`.

### 4) Compilar frontend

```bash
npm run build
```

Esto genera `dist/` para servir estático.

### 5) Levantar backend con PM2

```bash
npm i -g pm2
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 save
pm2 startup
```

API quedará en `127.0.0.1:3002` (interno).

### 6) Configurar Nginx (frontend + proxy API)

Archivo base listo en:

- `deploy/nginx/facturas.conf`

Instalar y activar:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo mkdir -p /var/www/fac-cony
sudo cp -r dist /var/www/fac-cony/
sudo cp deploy/nginx/facturas.conf /etc/nginx/sites-available/facturas.conf
sudo ln -s /etc/nginx/sites-available/facturas.conf /etc/nginx/sites-enabled/facturas.conf
sudo nginx -t
sudo systemctl reload nginx
```

### 7) Certificado SSL (Let’s Encrypt)

```bash
sudo certbot --nginx -d facturas.tudominio.com
```

Luego recargar:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 8) Validación final

- Salud backend: `https://facturas.tudominio.com/api/health`
- Frontend: `https://facturas.tudominio.com`
- Verificar login real y consulta de facturas.

### 9) Actualización en producción sin cortes (zero-downtime)

Usa este flujo para actualizar sin tumbar el servicio:

```bash
cd /var/www/fac-cony
git pull
npm ci
npm run build
pm2 reload fac-cony-api --update-env
```

Notas importantes:

- `pm2 reload` (no `restart`) mantiene la API respondiendo mientras reemplaza procesos.
- El frontend en `dist/` lo sirve Nginx y se actualiza al terminar el build.
- Con `deploy/pm2/ecosystem.config.cjs` en modo `cluster` e `instances: 2`, la recarga es continua.

### Archivos de despliegue incluidos

- `.env.production.example`
- `deploy/nginx/facturas.conf`
- `deploy/pm2/ecosystem.config.cjs`

## Publicación con Hostinger: facturacionelectronica.grupolina.com

Estado esperado para que funcione tu app (no la página por defecto de Hostinger):

1. En zona DNS de `grupolina.com`, host `facturacionelectronica`:
   - `A` -> `181.199.76.152`
   - Eliminar `AAAA` del mismo host (si existe)
   - Eliminar cualquier `CNAME` conflictivo del mismo host
2. En tu router/NAT:
   - `80/TCP` -> servidor local `80/TCP`
   - `443/TCP` -> servidor local `443/TCP`
3. En tu servidor (donde corre FAC-CONY):
   - `pm2` ejecutando backend interno en `127.0.0.1:3002`
   - `nginx` con `server_name facturacionelectronica.grupolina.com`
   - Certificado SSL para ese subdominio
4. Validación:
   - `nslookup facturacionelectronica.grupolina.com 8.8.8.8` debe devolver tu IP pública (`181.199.76.152`)
   - Abrir `https://facturacionelectronica.grupolina.com`
   - Salud API: `https://facturacionelectronica.grupolina.com/api/health`

Si `nslookup` devuelve `191.101.230.174` y el navegador muestra "Default page", el DNS aún está apuntando al hosting compartido de Hostinger y no a tu servidor.

## Publicación rápida con IP pública (sin dominio)

Si no tienes dominio y ya redireccionaste tu IP pública al puerto `3000`, puedes publicar en HTTP así:

### 1) Preparar variables para IP pública

```bash
cp .env.public-ip.example .env
```

Editar `.env` con:

- `DB_USER`, `DB_PASSWORD`, `GEMINI_API_KEY`
- `CORS_ORIGIN=http://TU_IP_PUBLICA:3000`

### 2) Build + arranque en un solo puerto (3000)

```bash
npm install
npm run build
npm start
```

Con esto, `backend/server.js` sirve:

- Frontend estático desde `dist`
- API en `/api/*`

Todo en `http://TU_IP_PUBLICA:3000`.

### 3) Recomendación de proceso en segundo plano

```bash
npm i -g pm2
pm2 start npm --name fac-cony -- start
pm2 save
pm2 startup
```

### 4) Red y firewall

- En router/NAT: `3000/TCP` → servidor `3000/TCP`
- En firewall del servidor: permitir `3000/TCP`
- Protocolo: **TCP**

### 5) Validación

- App: `http://TU_IP_PUBLICA:3000`
- Salud API: `http://TU_IP_PUBLICA:3000/api/health`

> Nota: esto funciona para salir rápido, pero al no tener dominio no tendrás SSL público confiable (HTTPS) con Let's Encrypt.

