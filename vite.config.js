import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  build:{
    target:'es2022',
    rollupOptions:{input:{reality:resolve(process.cwd(),'reality-compiler.html')}}
  }
});