#!/bin/bash
# Script de instalación automática en VPS Ubuntu

echo "🚀 Instalando Alex Arias Inmobiliario..."

# Actualizar sistema
echo "📦 Actualizando sistema..."
apt update && apt upgrade -y

# Instalar Node.js 18+
echo "📦 Instalando Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# Instalar herramientas
echo "📦 Instalando herramientas..."
npm install -g pm2
apt install -y nginx curl wget git

# Crear directorio
mkdir -p /var/www
cd /var/www

# Clonar o descargar repo
echo "📥 Descargando código..."
# Reemplaza con tu repo:
# git clone https://github.com/TU_USUARIO/tarjetas-de-inmuebles.git
# cd tarjetas-de-inmuebles

# O si subes por SFTP, asume que ya está en /var/www/tarjetas-de-inmuebles

cd tarjetas-de-inmuebles
npm install

# Iniciar con PM2
echo "▶️ Iniciando aplicación..."
pm2 start server.js --name "alex-arias"
pm2 startup
pm2 save

# Información
echo ""
echo "✅ Instalación completada!"
echo ""
echo "Próximos pasos:"
echo "1. Configura Nginx (ver README.md)"
echo "2. Obtén SSL con: sudo certbot --nginx -d tudominio.com"
echo "3. Accede a https://tudominio.com/admin"
echo ""
echo "Ver logs: pm2 logs alex-arias"
echo ""
