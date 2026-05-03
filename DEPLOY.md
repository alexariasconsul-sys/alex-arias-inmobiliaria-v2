# 📦 Guía Rápida de Deploy en Hostinger VPS

## ⚡ TL;DR (Resumen rápido)

1. **Recibe credenciales** del VPS (IP, usuario, contraseña)
2. **SSH al VPS** y copia estos comandos:

```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs npm pm2 nginx git certbot python3-certbot-nginx
cd /var/www && git clone TU_REPO && cd tarjetas-de-inmuebles && npm install
pm2 start server.js --name "alex-arias" && pm2 startup && pm2 save
```

3. **Configura Nginx** (copia el config del README.md)
4. **HTTPS con Let's Encrypt**:

```bash
sudo certbot --nginx -d tudominio.com
```

5. **Accede a Admin** → `/admin` → Configura Google Client ID
6. ✅ **Listo!**

---

## 📋 Checklist antes de Deploy

- [ ] `package.json` existe con dependencias (✅ YA HECHO)
- [ ] `server.js` usa `process.env.PORT` (✅ YA HECHO)
- [ ] `.gitignore` correcto (✅ YA HECHO)
- [ ] Carpeta `public/uploads/` existe (✅ YA HECHO)
- [ ] Código está en GitHub (TÚ debes hacer `git push`)
- [ ] Dominio registrado y apuntando al VPS
- [ ] Credenciales SSH del VPS listos

---

## 🔧 Paso a Paso Detallado

Ver **README.md** para instrucciones completas.

---

## 📞 Después del Deploy

1. Accede a `https://tudominio.com/admin`
2. Crea contraseña para admin
3. Configura tu perfil
4. Agrega Google Client ID para reseñas
5. ¡Sube tu primer inmueble!

