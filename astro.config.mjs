import { defineConfig } from 'astro/config';

const repository = process.env.GITHUB_REPOSITORY ?? 'bluefateludi/HeartIsle';
const [owner, name] = repository.split('/');

export default defineConfig({
  site: `https://${owner}.github.io`,
  base: name.toLowerCase() === `${owner.toLowerCase()}.github.io` ? '/' : `/${name}`,
  output: 'static',
  trailingSlash: 'always',
});
