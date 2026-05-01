import { defineConfig } from 'vite'

export default defineConfig({
    // Minimal Vite config for static site
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
            input: {
                main: 'index.html',
                contacto: 'contacto.html',
                ecommerce: 'ecommerce.html',
                redes: 'redes.html',
                web: 'web.html',
                login: 'login.html',
                portal: 'portal.html'
            }
        }
    }
})
