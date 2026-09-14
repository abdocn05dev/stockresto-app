import { supabase } from './supabase.js'
import { t } from './i18n.js'

const form = document.getElementById('form-ingredient')
const bouton = document.getElementById('btn-ajouter')
const resultatDiv = document.getElementById('resultat')

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const ingredient = {
    nom: document.getElementById('nom').value.trim(),
    unite: document.getElementById('unite').value,
    prix_achat: Number(document.getElementById('prix_achat').value),
    stock_actuel: Number(document.getElementById('stock_actuel').value),
    seuil_minimum: Number(document.getElementById('seuil_minimum').value),
  }

  bouton.disabled = true
  bouton.textContent = t('bouton_ajout_en_cours')
  resultatDiv.innerHTML = ''

  const { error } = await supabase.from('ingredients').insert(ingredient)

  if (error) {
    resultatDiv.innerHTML = `<p class="erreur">${t('erreur_prefixe')} ${error.message}</p>`
  } else {
    resultatDiv.innerHTML = `<p class="succes">${t('ingredient_ajoute', { nom: ingredient.nom })}</p>`
    form.reset()
  }

  bouton.disabled = false
  bouton.textContent = t('bouton_ajouter_ingredient')
})
