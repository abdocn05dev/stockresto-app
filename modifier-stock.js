import { supabase } from './supabase.js'
import { formatNombre } from './format.js'
import { t, libelleUnite } from './i18n.js'

const form = document.getElementById('form-modifier-stock')
const selectIngredient = document.getElementById('ingredient')
const selectMotif = document.getElementById('motif')
const inputQuantite = document.getElementById('quantite')
const bouton = document.getElementById('btn-valider')
const resultatDiv = document.getElementById('resultat')

let ingredients = []

// Sens du mouvement selon le motif choisi : + pour un ajout au stock, - pour un retrait.
const SIGNES_MOTIF = {
  reapprovisionnement: 1,
  correction_ajout: 1,
  correction_retrait: -1,
  perte: -1,
}

async function chargerIngredients() {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, nom, unite, stock_actuel')
    .order('nom', { ascending: true })

  if (error) {
    selectIngredient.innerHTML = `<option value="">${t('erreur_chargement')}</option>`
    return
  }

  ingredients = data
  selectIngredient.innerHTML = data.map((ingredient) => `<option value="${ingredient.id}">${ingredient.nom}</option>`).join('')
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const ingredient = ingredients.find((i) => i.id === Number(selectIngredient.value))
  if (!ingredient) return

  const motif = selectMotif.value
  const quantiteSaisie = Number(inputQuantite.value)
  const quantiteSignee = quantiteSaisie * SIGNES_MOTIF[motif]
  const avant = ingredient.stock_actuel
  const apres = avant + quantiteSignee

  resultatDiv.innerHTML = ''

  if (apres < 0) {
    resultatDiv.innerHTML = `<p class="erreur">${t('erreur_stock_negatif', {
      ingredient: ingredient.nom,
      stock: formatNombre(avant),
      unite: libelleUnite(ingredient.unite),
    })}</p>`
    return
  }

  bouton.disabled = true
  bouton.textContent = t('bouton_validation_en_cours')

  const { error: erreurStock } = await supabase.from('ingredients').update({ stock_actuel: apres }).eq('id', ingredient.id)

  if (erreurStock) {
    resultatDiv.innerHTML = `<p class="erreur">${t('erreur_prefixe')} ${erreurStock.message}</p>`
    bouton.disabled = false
    bouton.textContent = t('bouton_valider')
    return
  }

  const { error: erreurMouvement } = await supabase
    .from('mouvements_stock')
    .insert({ ingredient_id: ingredient.id, quantite: quantiteSignee, motif })

  if (erreurMouvement) {
    resultatDiv.innerHTML = `<p class="erreur">${t('erreur_prefixe')} ${erreurMouvement.message}</p>`
    bouton.disabled = false
    bouton.textContent = t('bouton_valider')
    return
  }

  ingredient.stock_actuel = apres
  resultatDiv.innerHTML = `<p class="succes">${t('stock_modifie', {
    ingredient: ingredient.nom,
    avant: formatNombre(avant),
    apres: formatNombre(apres),
    unite: libelleUnite(ingredient.unite),
  })}</p>`
  form.reset()

  bouton.disabled = false
  bouton.textContent = t('bouton_valider')
})

chargerIngredients()
