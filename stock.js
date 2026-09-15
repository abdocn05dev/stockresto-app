import { supabase } from './supabase.js'
import { formatNombre } from './format.js'
import { t, libelleUnite } from './i18n.js'
import { enregistrerMouvementStock } from './mouvement-stock.js'

// En dessous de la moitié du seuil minimum -> critique. Entre la moitié et le seuil -> bas.
// Ajuste ce ratio si tu veux une alerte "critique" plus ou moins sensible.
const RATIO_CRITIQUE = 0.5

let dernierIngredients = []
let ingredientCourant = null
// Le motif enregistré découle du bouton cliqué : "ajout" pour +, "retrait" pour -.
let motifCourant = null

const modale = document.getElementById('modale-mouvement')
const modaleTitre = document.getElementById('modale-titre')
const modaleNomIngredient = document.getElementById('modale-ingredient-nom')
const modaleInputQuantite = document.getElementById('modale-quantite')
const modaleResultat = document.getElementById('modale-resultat')
const formModale = document.getElementById('form-modale-mouvement')
const boutonConfirmer = document.getElementById('btn-modale-confirmer')
const boutonAnnuler = document.getElementById('btn-modale-annuler')

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
      <td>
        <button type="button" class="bouton-icone bouton-ajout" data-id="${ingredient.id}" aria-label="+">+</button>
        <button type="button" class="bouton-icone bouton-retrait" data-id="${ingredient.id}" aria-label="-">−</button>
      </td>
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
  const bouton = event.target.closest('.bouton-ajout, .bouton-retrait')
  if (!bouton) return

  const ingredient = dernierIngredients.find((i) => i.id === Number(bouton.dataset.id))
  if (!ingredient) return

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

// Un changement de langue ne nécessite pas un nouvel appel réseau : on réaffiche juste les mêmes données.
window.addEventListener('langue-changee', () => afficherIngredients(dernierIngredients))

chargerIngredients()
