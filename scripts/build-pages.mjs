import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const file of ['index.html', 'styles.css', 'auth.js', 'app.js']) fs.copyFileSync(path.join(root, file), path.join(out, file));
fs.writeFileSync(path.join(out, '_headers'), ['/api/*', '  Cache-Control: no-store', '/generated/*', '  Cache-Control: private, no-store', '/*', '  X-Content-Type-Options: nosniff', '  Referrer-Policy: same-origin', '  Permissions-Policy: camera=(), geolocation=()', ''].join('\n'));
console.log(`Built Pages assets: ${out}`);

