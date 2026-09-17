import { supabase } from './supabase.js'
import { formatNombre } from './format.js'
import { t } from './i18n.js'
import { appliquerEtiquettesTableau } from './tableau-responsive.js'
import './nav.js'

const form = document.getElementById('form-plat')
const selectCategorie = document.getElementById('categorie')
const labelNouvelleCategorie = document.getElementById('label-nouvelle-categorie')
const inputNouvelleCategorie = document.getElementById('nouvelle-categorie')
const bouton = document.getElementById('btn-ajouter')
const resultatDiv = document.getElementById('resultat')

const VALEUR_AUTRE = '__autre__'

let dernieresCategories = []
let dernierPlats = []
let platEnEdition = null
let platASupprimer = null

const modaleEdition = document.getElementById('modale-edition-plat')
const formEdition = document.getElementById('form-modale-edition-plat')
const editionNom = document.getElementById('edition-plat-nom')
const editionCategorie = document.getElementById('edition-plat-categorie')
const labelEditionNouvelleCategorie = document.getElementById('label-edition-plat-nouvelle-categorie')
const inputEditionNouvelleCategorie = document.getElementById('edition-plat-nouvelle-categorie')
const editionPrix = document.getElementById('edition-plat-prix')
const editionResultat = document.getElementById('modale-edition-plat-resultat')
const boutonEditionAnnuler = document.getElementById('btn-edition-plat-annuler')
const boutonEditionEnregistrer = document.getElementById('btn-edition-plat-enregistrer')

const modaleSuppression = document.getElementById('modale-suppression-plat')
const suppressionContenu = document.getElementById('modale-suppression-plat-contenu')
const suppressionActions = document.getElementById('modale-suppression-plat-actions')

function afficherCategories(categories) {
  const optionsExistantes = categories.map((c) => `<option value="${c}">${c}</option>`).join('')
  selectCategorie.innerHTML = `${optionsExistantes}<option value="${VALEUR_AUTRE}">${t('option_nouvelle_categorie')}</option>`
}

function afficherPlats(plats) {
  const corps = document.getElementById('plats-body')
  corps.innerHTML = ''

  for (const plat of plats) {
    const ligne = document.createElement('tr')
    ligne.innerHTML = `
      <td>${plat.nom}</td>
      <td>${plat.categorie ?? ''}</td>
      <td>${formatNombre(plat.prix_vente)}</td>
      <td>
        <button type="button" class="bouton-icone bouton-modifier" data-id="${plat.id}" aria-label="${t('bouton_modifier')}">✎</button>
        <button type="button" class="bouton-icone bouton-supprimer" data-id="${plat.id}" aria-label="${t('bouton_supprimer')}">🗑</button>
      </td>
    `
    corps.appendChild(ligne)
  }

  appliquerEtiquettesTableau('plats-body')
}

// Un seul appel réseau alimente à la fois le select de catégories et le tableau des plats.
async function chargerPlats() {
  const { data: plats, error } = await supabase
    .from('plats')
    .select('id, nom, categorie, prix_vente')
    .order('nom', { ascending: true })

  if (error) {
    selectCategorie.innerHTML = `<option value="">${t('erreur_chargement')}</option>`
    document.getElementById('plats-body').innerHTML = `<tr><td colspan="4" class="erreur">${t('erreur_chargement')}</td></tr>`
    return
  }

  dernierPlats = plats
  dernieresCategories = [...new Set(plats.map((p) => p.categorie).filter(Boolean))].sort()
  afficherCategories(dernieresCategories)
  afficherPlats(dernierPlats)
}

// Un changement de langue ne nécessite pas un nouvel appel réseau : on réaffiche juste les mêmes données.
window.addEventListener('langue-changee', () => {
  afficherCategories(dernieresCategories)
  afficherPlats(dernierPlats)
})

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
    await chargerPlats()
  }

  bouton.disabled = false
  bouton.textContent = t('bouton_ajouter_plat')
})

// --- Modifier un plat existant ---

function afficherCategoriesEdition() {
  const optionsExistantes = dernieresCategories.map((c) => `<option value="${c}">${c}</option>`).join('')
  editionCategorie.innerHTML = `${optionsExistantes}<option value="${VALEUR_AUTRE}">${t('option_nouvelle_categorie')}</option>`
}

function ouvrirModaleEdition(plat) {
  platEnEdition = plat
  editionNom.value = plat.nom
  afficherCategoriesEdition()

  const categorieConnue = dernieresCategories.includes(plat.categorie)
  editionCategorie.value = categorieConnue ? plat.categorie : VALEUR_AUTRE
  labelEditionNouvelleCategorie.hidden = categorieConnue
  inputEditionNouvelleCategorie.hidden = categorieConnue
  inputEditionNouvelleCategorie.required = !categorieConnue
  inputEditionNouvelleCategorie.value = categorieConnue ? '' : plat.categorie ?? ''

  editionPrix.value = formatNombre(plat.prix_vente)
  editionResultat.innerHTML = ''
  modaleEdition.hidden = false
}

function fermerModaleEdition() {
  modaleEdition.hidden = true
  platEnEdition = null
}

editionCategorie.addEventListener('change', () => {
  const estNouvelle = editionCategorie.value === VALEUR_AUTRE
  labelEditionNouvelleCategorie.hidden = !estNouvelle
  inputEditionNouvelleCategorie.hidden = !estNouvelle
  inputEditionNouvelleCategorie.required = estNouvelle
})

boutonEditionAnnuler.addEventListener('click', fermerModaleEdition)

modaleEdition.addEventListener('click', (event) => {
  if (event.target === modaleEdition) fermerModaleEdition()
})

formEdition.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!platEnEdition) return

  const nom = editionNom.value.trim()
  const categorie =
    editionCategorie.value === VALEUR_AUTRE ? inputEditionNouvelleCategorie.value.trim() : editionCategorie.value
  const prixVente = Number(editionPrix.value)

  boutonEditionEnregistrer.disabled = true
  boutonEditionEnregistrer.textContent = t('bouton_enregistrement_en_cours')
  editionResultat.innerHTML = ''

  const { error } = await supabase
    .from('plats')
    .update({ nom, categorie, prix_vente: prixVente })
    .eq('id', platEnEdition.id)

  if (error) {
    editionResultat.innerHTML = `<p class="erreur">${t('erreur_prefixe')} ${error.message}</p>`
    boutonEditionEnregistrer.disabled = false
    boutonEditionEnregistrer.textContent = t('bouton_enregistrer')
    return
  }

  fermerModaleEdition()
  await chargerPlats()

  boutonEditionEnregistrer.disabled = false
  boutonEditionEnregistrer.textContent = t('bouton_enregistrer')
})

// --- Supprimer un plat ---

// Renvoie le nombre de lignes de recette qui utilisent ce plat (0 si aucune).
async function compterRecettesUtilisantPlat(platId) {
  const { data: lignes, error } = await supabase.from('recettes').select('id').eq('plat_id', platId)
  return error || !lignes ? 0 : lignes.length
}

function fermerModaleSuppression() {
  modaleSuppression.hidden = true
  platASupprimer = null
  suppressionActions.innerHTML = ''
}

async function ouvrirModaleSuppression(plat) {
  platASupprimer = plat
  suppressionContenu.innerHTML = `<p>${t('verification_en_cours')}</p>`
  suppressionActions.innerHTML = ''
  modaleSuppression.hidden = false

  const nombreRecettes = await compterRecettesUtilisantPlat(plat.id)

  // Le plat a pu changer (ou la modale être fermée) pendant l'attente de la vérification.
  if (platASupprimer !== plat) return

  if (nombreRecettes > 0) {
    suppressionContenu.innerHTML = `<p class="erreur">${t('erreur_plat_utilise', { plat: plat.nom })}</p>`
    suppressionActions.innerHTML = `<button type="button" id="btn-suppression-plat-fermer" data-i18n="bouton_fermer">${t('bouton_fermer')}</button>`
    return
  }

  suppressionContenu.innerHTML = `<p>${t('confirmation_suppression_plat', { plat: plat.nom })}</p>`
  suppressionActions.innerHTML = `
    <button type="button" id="btn-suppression-plat-annuler" class="bouton-secondaire" data-i18n="bouton_annuler">${t('bouton_annuler')}</button>
    <button type="button" id="btn-suppression-plat-confirmer" class="bouton-danger" data-i18n="bouton_supprimer">${t('bouton_supprimer')}</button>
  `
}

modaleSuppression.addEventListener('click', (event) => {
  if (event.target === modaleSuppression) fermerModaleSuppression()
})

suppressionActions.addEventListener('click', async (event) => {
  if (event.target.id === 'btn-suppression-plat-fermer' || event.target.id === 'btn-suppression-plat-annuler') {
    fermerModaleSuppression()
    return
  }

  if (event.target.id !== 'btn-suppression-plat-confirmer' || !platASupprimer) return

  const plat = platASupprimer
  suppressionActions.innerHTML = ''
  suppressionContenu.innerHTML = `<p>${t('suppression_en_cours')}</p>`

  const { error } = await supabase.from('plats').delete().eq('id', plat.id)

  if (error) {
    suppressionContenu.innerHTML = `<p class="erreur">${t('erreur_prefixe')} ${error.message}</p>`
    suppressionActions.innerHTML = `<button type="button" id="btn-suppression-plat-fermer" data-i18n="bouton_fermer">${t('bouton_fermer')}</button>`
    return
  }

  dernierPlats = dernierPlats.filter((p) => p.id !== plat.id)
  afficherPlats(dernierPlats)
  fermerModaleSuppression()
})

document.getElementById('plats-body').addEventListener('click', (event) => {
  const boutonClique = event.target.closest('.bouton-modifier, .bouton-supprimer')
  if (!boutonClique) return

  const plat = dernierPlats.find((p) => p.id === Number(boutonClique.dataset.id))
  if (!plat) return

  if (boutonClique.classList.contains('bouton-modifier')) ouvrirModaleEdition(plat)
  else ouvrirModaleSuppression(plat)
})

chargerPlats()
