/**
 * Re-comprime todas las imágenes WebP existentes en /uploads
 * a calidad 72 y máximo 1280px — corre una sola vez en el VPS.
 *
 * Uso: node recompress-images.js
 */

const fs   = require('fs');
const path = require('path');
const sharp = require('sharp');

const uploadsDir = path.join(__dirname, 'uploads');
const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.webp'));

console.log(`Encontradas ${files.length} imágenes WebP. Recomprimiendo...`);

let ok = 0, skip = 0, fail = 0;

(async () => {
  for (const file of files) {
    const fp = path.join(uploadsDir, file);
    const tmp = fp + '.tmp';
    try {
      const meta = await sharp(fp).metadata();
      // Si ya es pequeña (< 100KB) la dejamos como está
      const stat = fs.statSync(fp);
      if (stat.size < 100 * 1024) { skip++; continue; }

      await sharp(fp)
        .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 72, effort: 5 })
        .toFile(tmp);

      const newStat = fs.statSync(tmp);
      if (newStat.size < stat.size) {
        fs.renameSync(tmp, fp);
        const saved = ((stat.size - newStat.size) / 1024).toFixed(0);
        console.log(`✓ ${file}  ${(stat.size/1024).toFixed(0)}KB → ${(newStat.size/1024).toFixed(0)}KB  (-${saved}KB)`);
        ok++;
      } else {
        fs.unlinkSync(tmp); // ya era óptima
        skip++;
      }
    } catch (err) {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      console.error(`✗ ${file}: ${err.message}`);
      fail++;
    }
  }
  console.log(`\nListo: ${ok} recomprimidas, ${skip} omitidas, ${fail} errores.`);
})();
