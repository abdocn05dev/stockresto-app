import { supabase } from './supabase.js'
import { formatNombre } from './format.js'
import { t, libelleUnite } from './i18n.js'

// En dessous de la moitié du seuil minimum -> critique. Entre la moitié et le seuil -> bas.
// Ajuste ce ratio si tu veux une alerte "critique" plus ou moins sensible.
const RATIO_CRITIQUE = 0.5

let dernierIngredients = []

function getStatut(stockActuel, seuilMinimum) {
  if (stockActuel < seuilMinimum * RATIO_CRITIQUE) {
    return { label: t('statut_critique'), classe: 'critique' }
  }
  if (stockActuel < seuilMinimum) {
    return { label: t('statut_bas'), classe: 'bas' }
  }
  return { label: t('statut_ok'), classe: 'ok' }
}

function afficherIngredients(ingredients) {
  const corps = document.getElementById('stock-body')
  corps.innerHTML = ''

  for (const ingredient of ingredients) {
    const statut = getStatut(ingredient.stock_actuel, ingredient.seuil_minimum)
    const ligne = document.createElement('tr')
    ligne.innerHTML = `
      <td>${ingredient.nom}</td>
      <td>${formatNombre(ingredient.stock_actuel)} ${libelleUnite(ingredient.unite)}</td>
      <td>${formatNombre(ingredient.seuil_minimum)} ${libelleUnite(ingredient.unite)}</td>
      <td><span class="badge ${statut.classe}">${statut.label}</span></td>
    `
    corps.appendChild(ligne)
  }
}

async function chargerIngredients() {
  const corps = document.getElementById('stock-body')
  const message = document.getElementById('message')

  const { data: ingredients, error } = await supabase
    .from('ingredients')
    .select('id, nom, unite, stock_actuel, seuil_minimum')
    .order('nom', { ascending: true })

  if (error) {
    message.textContent = `${t('erreur_chargement_stock')} ${error.message}`
    message.className = 'erreur'
    corps.innerHTML = ''
    return
  }

  message.textContent = ''
  dernierIngredients = ingredients
  afficherIngredients(dernierIngredients)
}

// Un changement de langue ne nécessite pas un nouvel appel réseau : on réaffiche juste les mêmes données.
window.addEventListener('langue-changee', () => afficherIngredients(dernierIngredients))

chargerIngredients()
