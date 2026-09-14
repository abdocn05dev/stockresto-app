import { supabase } from './supabase.js'
import { t, libelleUnite } from './i18n.js'

const form = document.getElementById('form-recette')
const selectPlat = document.getElementById('plat')
const selectIngredient = document.getElementById('ingredient')
const selectUnite = document.getElementById('unite')
const bouton = document.getElementById('btn-ajouter')
const resultatDiv = document.getElementById('resultat')

let ingredients = []

// Unités que vendre.js sait convertir vers le stock d'un ingrédient (voir convertirVersUniteStock).
const UNITES_COMPATIBLES = {
  kg: ['kg', 'g'],
  g: ['g'],
  L: ['L', 'ml'],
  ml: ['ml'],
  unite: ['unite'],
}

async function chargerPlats() {
  const { data, error } = await supabase
    .from('plats')
    .select('id, nom, categorie')
    .order('nom', { ascending: true })

  if (error) {
    selectPlat.innerHTML = `<option value="">${t('erreur_chargement')}</option>`
    return
  }

  selectPlat.innerHTML = data
    .map((plat) => `<option value="${plat.id}">${plat.nom}${plat.categorie ? ` (${plat.categorie})` : ''}</option>`)
    .join('')
}

function afficherIngredients() {
  const selectionPrecedente = selectIngredient.value
  selectIngredient.innerHTML = ingredients
    .map((ingredient) => `<option value="${ingredient.id}">${ingredient.nom} (${libelleUnite(ingredient.unite)})</option>`)
    .join('')
  if (selectionPrecedente) selectIngredient.value = selectionPrecedente
  mettreAJourUnites()
}

async function chargerIngredients() {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, nom, unite')
    .order('nom', { ascending: true })

  if (error) {
    selectIngredient.innerHTML = `<option value="">${t('erreur_chargement')}</option>`
    return
  }

  ingredients = data
  afficherIngredients()
}

function mettreAJourUnites() {
  const ingredient = ingredients.find((i) => i.id === Number(selectIngredient.value))
  const unitesPossibles = ingredient ? UNITES_COMPATIBLES[ingredient.unite] || [ingredient.unite] : []
  selectUnite.innerHTML = unitesPossibles.map((u) => `<option value="${u}">${libelleUnite(u)}</option>`).join('')
}

// Un changement de langue ne nécessite pas un nouvel appel réseau : on réaffiche juste les mêmes données.
window.addEventListener('langue-changee', afficherIngredients)

selectIngredient.addEventListener('change', mettreAJourUnites)

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const recette = {
    plat_id: Number(selectPlat.value),
    ingredient_id: Number(selectIngredient.value),
    quantite: Number(document.getElementById('quantite').value),
    unite: selectUnite.value,
  }

  bouton.disabled = true
  bouton.textContent = t('bouton_ajout_en_cours')
  resultatDiv.innerHTML = ''

  const { error } = await supabase.from('recettes').insert(recette)

  if (error) {
    resultatDiv.innerHTML = `<p class="erreur">${t('erreur_prefixe')} ${error.message}</p>`
  } else {
    resultatDiv.innerHTML = `<p class="succes">${t('recette_ajoutee')}</p>`
    document.getElementById('quantite').value = ''
  }

  bouton.disabled = false
  bouton.textContent = t('bouton_ajouter_recette')
})

await Promise.all([chargerPlats(), chargerIngredients()])
