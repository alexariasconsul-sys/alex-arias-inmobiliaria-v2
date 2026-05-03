# Alex Arias · Consultor Inmobiliario

Portal inmobiliario Vanilla JS + Express.js + NeDB + Socket.io + Leaflet.js

## 🚀 Deploy en VPS (Hostinger KVM con Ubuntu)

### 1️⃣ Conectarse al VPS

```bash
ssh root@TU_IP_DEL_VPS
# O con contraseña: ssh -p 22 root@TU_IP_DEL_VPS
```

### 2️⃣ Actualizar el sistema

```bash
apt update && apt upgrade -y
```

### 3️⃣ Instalar Node.js 18+

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs
node --version  # Verificar v18+
npm --version
```

### 4️⃣ Instalar herramientas necesarias

```bash
npm install -g pm2
apt install -y nginx curl wget git
```

### 5️⃣ Clonar el repositorio

```bash
cd /var/www
git clone https://github.com/TU_USUARIO/tarjetas-de-inmuebles.git
cd tarjetas-de-inmuebles
npm install
```

**O si subes por SFTP:**
```bash
# Sube toda la carpeta menos node_modules/
# Luego en el VPS:
npm install
```

### 6️⃣ Iniciar la aplicación con PM2

```bash
pm2 start server.js --name "alex-arias"
pm2 startup
pm2 save
pm2 logs alex-arias  # Ver logs
```

Verifica que está corriendo:
```bash
pm2 list
curl http://localhost:3000  # Debe responder HTML
```

### 7️⃣ Configurar Nginx (Reverse Proxy)

Crea `/etc/nginx/sites-available/alex-arias`:

```bash
sudo nano /etc/nginx/sites-available/alex-arias
```

Pega esto (reemplaza `tudominio.com` con tu dominio):

```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;
    
    client_max_body_size 100M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activa el sitio:

```bash
sudo ln -s /etc/nginx/sites-available/alex-arias /etc/nginx/sites-enabled/
sudo nginx -t  # Verificar sintaxis
sudo systemctl restart nginx
```

### 8️⃣ Configurar HTTPS/SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com -d www.tudominio.com
# Elige opción 2 (redirect HTTP a HTTPS)
```

Verifica auto-renovación:
```bash
sudo systemctl timer list | grep certbot
```

### 9️⃣ Configurar el Admin Panel

1. Accede a `https://tudominio.com/admin`
2. Establece una contraseña fuerte
3. Completa tu perfil (nombre, teléfono WhatsApp, foto)
4. Configura integraciones:
   - **Facebook Pixel** (opcional): Agrega tu Pixel ID
   - **Google Client ID**: Necesario para reseñas
   - **Anthropic API Key** (opcional): Para chat IA

### 🔑 Google Client ID (para Reseñas)

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto
3. Habilita **Google Identity Services**
4. Crea credenciales OAuth 2.0 → Web application
5. Orígenes autorizados:
   - `https://tudominio.com`
   - `https://www.tudominio.com`
6. Copia el **Client ID**
7. Pega en Admin → Integraciones → API Keys → Google Client ID

### 🛡️ Backup de datos

Las bases de datos se guardan en `/var/www/tarjetas-de-inmuebles/`:
- `properties.db` — Inmuebles
- `leads.db` — Consultas CRM
- `reviews.db` — Reseñas
- `profiles.db` — Perfil del consultor
- `integrations.json` — Configuraciones
- `api_keys.json` — API keys generadas
- `public/uploads/` — Imágenes

**Backup automático diario:**

```bash
crontab -e
```

Agrega:
```
0 2 * * * tar -czf /home/backup_$(date +\%Y\%m\%d).tar.gz /var/www/tarjetas-de-inmuebles/ && find /home -name "backup_*.tar.gz" -mtime +30 -delete
```

---

## 📝 Estructura del Proyecto

```
tarjetas-de-inmuebles/
├── server.js                 # Backend Express
├── package.json
├── .gitignore
├── public/
│   ├── index.html           # Página principal
│   ├── admin.html           # Panel admin
│   ├── blog.html            # Blog
│   ├── post.html            # Post individual
│   ├── app.js               # Frontend logic
│   ├── admin.js             # Admin logic
│   ├── blog.js              # Blog logic
│   ├── post.js              # Post logic
│   ├── styles.css           # Estilos principales
│   ├── blog.css             # Estilos blog
│   ├── admin.css            # Estilos admin
│   ├── uploads/             # Imágenes subidas (se genera en servidor)
│   └── assets/              # Logo, favicon, etc
├── properties.db            # Se genera automáticamente
├── leads.db                 # Se genera automáticamente
├── reviews.db               # Se genera automáticamente
├── profiles.db              # Se genera automáticamente
├── integrations.json        # Se genera automáticamente
└── api_keys.json            # Se genera automáticamente
```

---

## 🔧 Comandos útiles en el VPS

```bash
# Ver logs en tiempo real
pm2 logs alex-arias

# Reiniciar la app
pm2 restart alex-arias

# Detener la app
pm2 stop alex-arias

# Iniciar la app
pm2 start alex-arias

# Ver estado
pm2 status

# Actualizar código desde git
cd /var/www/tarjetas-de-inmuebles
git pull origin main
npm install  # si hay dependencias nuevas
pm2 restart alex-arias

# Ver espacio en disco
df -h

# Ver uso de memoria
free -h
```

---

## 🐛 Troubleshooting

### "Cannot POST /api/..." → 401

Admin no autenticado. Asegúrate de:
- Contraseña guardada en localStorage (`adminPwd`)
- Verificar en inspector: `localStorage.getItem('adminPwd')`

### Las imágenes no se suben

Verifica permisos:
```bash
sudo chown -R www-data:www-data /var/www/tarjetas-de-inmuebles/public/uploads
sudo chmod -R 755 /var/www/tarjetas-de-inmuebles/public/uploads
```

### Nginx error: "upstream prematurely closed connection"

Reinicia Node:
```bash
pm2 restart alex-arias
sudo systemctl restart nginx
```

### "SSL certificate error"

Verifica Let's Encrypt:
```bash
sudo certbot renew --dry-run
sudo systemctl restart certbot.timer
```

---

## 📞 Contacto & Soporte

- **WhatsApp**: Configurable en Admin → Perfil
- **Email**: Configurable en Admin → Perfil
- **GitHub**: [Tu repositorio]

---

**Última actualización**: Abril 2026  
**Version**: 1.0.0
