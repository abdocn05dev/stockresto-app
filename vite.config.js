import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        stock: resolve(import.meta.dirname, 'index.html'),
        vendre: resolve(import.meta.dirname, 'vendre.html'),
        nouvelIngredient: resolve(import.meta.dirname, 'nouvel-ingredient.html'),
        nouveauPlat: resolve(import.meta.dirname, 'nouveau-plat.html'),
        nouvelleRecette: resolve(import.meta.dirname, 'nouvelle-recette.html'),
      },
    },
  },
})
