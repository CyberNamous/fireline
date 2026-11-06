import { rm, mkdir, cp, copyFile, readdir, readFile } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/geography', { recursive: true });
await copyFile('index.html', 'dist/index.html');
await cp('public', 'dist/public', { recursive: true });
await copyFile('geography/district.geojson', 'dist/geography/district.geojson');
// Fail the build on any broken local HTML/CSS asset reference.
const html = await readFile('index.html', 'utf8');
for (const match of html.matchAll(/(?:src|href)="(\/(?:public|geography)\/[^"#?]+)"/g)) {
  await readFile('dist' + match[1]);
}
console.log('Built dist/: browser files and geography only; server code and secrets are excluded.');
