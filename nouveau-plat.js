import { supabase } from './supabase.js'
import { t } from './i18n.js'

const form = document.getElementById('form-plat')
const selectCategorie = document.getElementById('categorie')
const labelNouvelleCategorie = document.getElementById('label-nouvelle-categorie')
const inputNouvelleCategorie = document.getElementById('nouvelle-categorie')
const bouton = document.getElementById('btn-ajouter')
const resultatDiv = document.getElementById('resultat')

const VALEUR_AUTRE = '__autre__'

let dernieresCategories = []

function afficherCategories(categories) {
  const optionsExistantes = categories.map((c) => `<option value="${c}">${c}</option>`).join('')
  selectCategorie.innerHTML = `${optionsExistantes}<option value="${VALEUR_AUTRE}">${t('option_nouvelle_categorie')}</option>`
}

async function chargerCategories() {
  const { data: plats, error } = await supabase.from('plats').select('categorie')

  if (error) {
    selectCategorie.innerHTML = `<option value="">${t('erreur_chargement')}</option>`
    return
  }

  dernieresCategories = [...new Set(plats.map((p) => p.categorie).filter(Boolean))].sort()
  afficherCategories(dernieresCategories)
}

// Un changement de langue ne nécessite pas un nouvel appel réseau : on réaffiche juste les mêmes catégories.
window.addEventListener('langue-changee', () => afficherCategories(dernieresCategories))

selectCategorie.addEventListener('change', () => {
  const estNouvelle = selectCategorie.value === VALEUR_AUTRE
  labelNouvelleCategorie.hidden = !estNouvelle
  inputNouvelleCategorie.hidden = !estNouvelle
  inputNouvelleCategorie.required = estNouvelle
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const categorie =
    selectCategorie.value === VALEUR_AUTRE ? inputNouvelleCategorie.value.trim() : selectCategorie.value

  const plat = {
    nom: document.getElementById('nom').value.trim(),
    categorie,
    prix_vente: Number(document.getElementById('prix_vente').value),
  }

  bouton.disabled = true
  bouton.textContent = t('bouton_ajout_en_cours')
  resultatDiv.innerHTML = ''

  const { error } = await supabase.from('plats').insert(plat)

  if (error) {
    resultatDiv.innerHTML = `<p class="erreur">${t('erreur_prefixe')} ${error.message}</p>`
  } else {
    resultatDiv.innerHTML = `<p class="succes">${t('plat_ajoute', { nom: plat.nom })}</p>`
    form.reset()
    labelNouvelleCategorie.hidden = true
    inputNouvelleCategorie.hidden = true
    inputNouvelleCategorie.required = false
    await chargerCategories()
  }

  bouton.disabled = false
  bouton.textContent = t('bouton_ajouter_plat')
})

chargerCategories()
