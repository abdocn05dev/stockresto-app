import { supabase } from './supabase.js'
import { formatNombre } from './format.js'
import { t, libelleUnite } from './i18n.js'
import { enregistrerMouvementStock } from './mouvement-stock.js'
import { getStatut } from './statut-stock.js'
import { appliquerEtiquettesTableau } from './tableau-responsive.js'
import './nav.js'

let dernierIngredients = []
let ingredientCourant = null
// Le motif enregistré découle du bouton cliqué : "ajout" pour +, "retrait" pour -.
let motifCourant = null
let ingredientEnEdition = null
let ingredientASupprimer = null

const modale = document.getElementById('modale-mouvement')
const modaleTitre = document.getElementById('modale-titre')
const modaleNomIngredient = document.getElementById('modale-ingredient-nom')
const modaleInputQuantite = document.getElementById('modale-quantite')
const modaleResultat = document.getElementById('modale-resultat')
const formModale = document.getElementById('form-modale-mouvement')
const boutonConfirmer = document.getElementById('btn-modale-confirmer')
const boutonAnnuler = document.getElementById('btn-modale-annuler')

const modaleEdition = document.getElementById('modale-edition')
const formEdition = document.getElementById('form-modale-edition')
const editionNom = document.getElementById('edition-nom')
const editionUnite = document.getElementById('edition-unite')
const editionSeuil = document.getElementById('edition-seuil')
const editionResultat = document.getElementById('modale-edition-resultat')
const boutonEditionAnnuler = document.getElementById('btn-edition-annuler')
const boutonEditionEnregistrer = document.getElementById('btn-edition-enregistrer')

const modaleSuppression = document.getElementById('modale-suppression')
const suppressionContenu = document.getElementById('modale-suppression-contenu')
const suppressionActions = document.getElementById('modale-suppression-actions')

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
      <td>
        <button type="button" class="bouton-icone bouton-ajout" data-id="${ingredient.id}" aria-label="+">+</button>
        <button type="button" class="bouton-icone bouton-retrait" data-id="${ingredient.id}" aria-label="-">−</button>
        <button type="button" class="bouton-icone bouton-modifier" data-id="${ingredient.id}" aria-label="${t('bouton_modifier')}">✎</button>
        <button type="button" class="bouton-icone bouton-supprimer" data-id="${ingredient.id}" aria-label="${t('bouton_supprimer')}">🗑</button>
      </td>
    `
    corps.appendChild(ligne)
  }

  appliquerEtiquettesTableau('stock-body')
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

function ouvrirModale(ingredient, motif) {
  ingredientCourant = ingredient
  motifCourant = motif
  modaleNomIngredient.textContent = ingredient.nom

  // On pose la clé i18n sur le titre : un changement de langue le retraduira tout seul.
  const cleTitre = motif === 'ajout' ? 'titre_ajouter_stock' : 'titre_retirer_stock'
  modaleTitre.dataset.i18n = cleTitre
  modaleTitre.textContent = t(cleTitre)

  modaleInputQuantite.value = ''
  modaleResultat.innerHTML = ''
  modale.hidden = false
}

function fermerModale() {
  modale.hidden = true
  ingredientCourant = null
  motifCourant = null
}

document.getElementById('stock-body').addEventListener('click', (event) => {
  const bouton = event.target.closest('.bouton-ajout, .bouton-retrait, .bouton-modifier, .bouton-supprimer')
  if (!bouton) return

  const ingredient = dernierIngredients.find((i) => i.id === Number(bouton.dataset.id))
  if (!ingredient) return

  if (bouton.classList.contains('bouton-modifier')) {
    ouvrirModaleEdition(ingredient)
    return
  }
  if (bouton.classList.contains('bouton-supprimer')) {
    ouvrirModaleSuppression(ingredient)
    return
  }
  ouvrirModale(ingredient, bouton.classList.contains('bouton-ajout') ? 'ajout' : 'retrait')
})

boutonAnnuler.addEventListener('click', fermerModale)

modale.addEventListener('click', (event) => {
  if (event.target === modale) fermerModale()
})

formModale.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!ingredientCourant) return

  const quantiteSaisie = Number(modaleInputQuantite.value)

  boutonConfirmer.disabled = true
  boutonConfirmer.textContent = t('bouton_confirmation_en_cours')
  modaleResultat.innerHTML = ''

  const resultat = await enregistrerMouvementStock(ingredientCourant, motifCourant, quantiteSaisie)

  if (!resultat.succes) {
    const message =
      resultat.erreurCode === 'stock_negatif'
        ? t('erreur_stock_negatif', {
            ingredient: ingredientCourant.nom,
            stock: formatNombre(resultat.avant),
            unite: libelleUnite(ingredientCourant.unite),
          })
        : `${t('erreur_prefixe')} ${resultat.erreurMessage}`
    modaleResultat.innerHTML = `<p class="erreur">${message}</p>`
    boutonConfirmer.disabled = false
    boutonConfirmer.textContent = t('bouton_confirmer')
    return
  }

  ingredientCourant.stock_actuel = resultat.apres
  afficherIngredients(dernierIngredients)
  fermerModale()

  boutonConfirmer.disabled = false
  boutonConfirmer.textContent = t('bouton_confirmer')
})

function ouvrirModaleEdition(ingredient) {
  ingredientEnEdition = ingredient
  editionNom.value = ingredient.nom
  editionUnite.value = ingredient.unite
  editionSeuil.value = formatNombre(ingredient.seuil_minimum)
  editionResultat.innerHTML = ''
  modaleEdition.hidden = false
}

function fermerModaleEdition() {
  modaleEdition.hidden = true
  ingredientEnEdition = null
}

boutonEditionAnnuler.addEventListener('click', fermerModaleEdition)

modaleEdition.addEventListener('click', (event) => {
  if (event.target === modaleEdition) fermerModaleEdition()
})

formEdition.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!ingredientEnEdition) return

  const nom = editionNom.value.trim()
  const unite = editionUnite.value
  const seuilMinimum = Number(editionSeuil.value)

  boutonEditionEnregistrer.disabled = true
  boutonEditionEnregistrer.textContent = t('bouton_enregistrement_en_cours')
  editionResultat.innerHTML = ''

  const { error } = await supabase
    .from('ingredients')
    .update({ nom, unite, seuil_minimum: seuilMinimum })
    .eq('id', ingredientEnEdition.id)

  if (error) {
    editionResultat.innerHTML = `<p class="erreur">${t('erreur_prefixe')} ${error.message}</p>`
    boutonEditionEnregistrer.disabled = false
    boutonEditionEnregistrer.textContent = t('bouton_enregistrer')
    return
  }

  ingredientEnEdition.nom = nom
  ingredientEnEdition.unite = unite
  ingredientEnEdition.seuil_minimum = seuilMinimum
  afficherIngredients(dernierIngredients)
  fermerModaleEdition()

  boutonEditionEnregistrer.disabled = false
  boutonEditionEnregistrer.textContent = t('bouton_enregistrer')
})

// Renvoie les noms des plats dont la recette utilise cet ingrédient (tableau vide si aucun).
async function trouverPlatsUtilisantIngredient(ingredientId) {
  const { data: lignes, error: erreurRecettes } = await supabase
    .from('recettes')
    .select('plat_id')
    .eq('ingredient_id', ingredientId)

  if (erreurRecettes || !lignes.length) return []

  const platIds = [...new Set(lignes.map((ligne) => ligne.plat_id))]
  const { data: plats, error: erreurPlats } = await supabase.from('plats').select('nom').in('id', platIds)

  return erreurPlats || !plats ? [] : plats.map((plat) => plat.nom)
}

function fermerModaleSuppression() {
  modaleSuppression.hidden = true
  ingredientASupprimer = null
  suppressionActions.innerHTML = ''
}

async function ouvrirModaleSuppression(ingredient) {
  ingredientASupprimer = ingredient
  suppressionContenu.innerHTML = `<p>${t('verification_en_cours')}</p>`
  suppressionActions.innerHTML = ''
  modaleSuppression.hidden = false

  const plats = await trouverPlatsUtilisantIngredient(ingredient.id)

  // L'ingrédient a pu changer (ou la modale être fermée) pendant l'attente de la vérification.
  if (ingredientASupprimer !== ingredient) return

  if (plats.length > 0) {
    suppressionContenu.innerHTML = `<p class="erreur">${t('erreur_ingredient_utilise', {
      ingredient: ingredient.nom,
      plats: plats.join(', '),
    })}</p>`
    suppressionActions.innerHTML = `<button type="button" id="btn-suppression-fermer" data-i18n="bouton_fermer">${t('bouton_fermer')}</button>`
    return
  }

  suppressionContenu.innerHTML = `<p>${t('confirmation_suppression', { ingredient: ingredient.nom })}</p>`
  suppressionActions.innerHTML = `
    <button type="button" id="btn-suppression-annuler" class="bouton-secondaire" data-i18n="bouton_annuler">${t('bouton_annuler')}</button>
    <button type="button" id="btn-suppression-confirmer" class="bouton-danger" data-i18n="bouton_supprimer">${t('bouton_supprimer')}</button>
  `
}

modaleSuppression.addEventListener('click', (event) => {
  if (event.target === modaleSuppression) fermerModaleSuppression()
})

suppressionActions.addEventListener('click', async (event) => {
  if (event.target.id === 'btn-suppression-fermer' || event.target.id === 'btn-suppression-annuler') {
    fermerModaleSuppression()
    return
  }

  if (event.target.id !== 'btn-suppression-confirmer' || !ingredientASupprimer) return

  const ingredient = ingredientASupprimer
  suppressionActions.innerHTML = ''
  suppressionContenu.innerHTML = `<p>${t('suppression_en_cours')}</p>`

  await supabase.from('mouvements_stock').delete().eq('ingredient_id', ingredient.id)
  const { error } = await supabase.from('ingredients').delete().eq('id', ingredient.id)

  if (error) {
    suppressionContenu.innerHTML = `<p class="erreur">${t('erreur_prefixe')} ${error.message}</p>`
    suppressionActions.innerHTML = `<button type="button" id="btn-suppression-fermer" data-i18n="bouton_fermer">${t('bouton_fermer')}</button>`
    return
  }

  dernierIngredients = dernierIngredients.filter((i) => i.id !== ingredient.id)
  afficherIngredients(dernierIngredients)
  fermerModaleSuppression()
})

// Un changement de langue ne nécessite pas un nouvel appel réseau : on réaffiche juste les mêmes données.
window.addEventListener('langue-changee', () => afficherIngredients(dernierIngredients))

chargerIngredients()
