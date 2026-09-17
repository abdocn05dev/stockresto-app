import { supabase } from './supabase.js'
import { formatNombre } from './format.js'
import { t, libelleUnite, getLangue } from './i18n.js'
import { appliquerEtiquettesTableau } from './tableau-responsive.js'
import './nav.js'

const TAILLE_PAGE = 100

// Locale utilisée pour l'affichage de la date, alignée sur la langue choisie dans l'app.
const LOCALES = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', ar: 'ar-MA' }

const MOTIF_VERS_CLE = {
  ajout: 'motif_ajout',
  retrait: 'motif_retrait',
  vente: 'motif_vente',
}

let ingredientsParId = new Map()
let mouvementsAffiches = []
let decalage = 0
let tousCharges = false

const corpsTableau = document.getElementById('historique-body')
const message = document.getElementById('message')
const boutonChargerPlus = document.getElementById('btn-charger-plus')

async function chargerIngredients() {
  const { data, error } = await supabase.from('ingredients').select('id, nom, unite')
  if (!error && data) {
    ingredientsParId = new Map(data.map((ingredient) => [ingredient.id, ingredient]))
  }
}

function libelleMotif(motif) {
  const cle = MOTIF_VERS_CLE[motif]
  return cle ? t(cle) : motif
}

function formaterDate(dateIso) {
  const locale = LOCALES[getLangue()] || LOCALES.fr
  return new Date(dateIso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
}

function afficherMouvements() {
  corpsTableau.innerHTML = ''

  for (const mouvement of mouvementsAffiches) {
    const ingredient = ingredientsParId.get(mouvement.ingredient_id)
    const nomIngredient = ingredient ? ingredient.nom : `#${mouvement.ingredient_id}`
    const uniteIngredient = ingredient ? libelleUnite(ingredient.unite) : ''
    const estPositif = mouvement.quantite > 0
    const signe = estPositif ? '+' : ''

    const ligne = document.createElement('tr')
    ligne.innerHTML = `
      <td>${formaterDate(mouvement.created_at)}</td>
      <td>${nomIngredient}</td>
      <td class="${estPositif ? 'quantite-positive' : 'quantite-negative'}">${signe}${formatNombre(mouvement.quantite)} ${uniteIngredient}</td>
      <td>${libelleMotif(mouvement.motif)}</td>
    `
    corpsTableau.appendChild(ligne)
  }

  appliquerEtiquettesTableau('historique-body')
}

function recupererPage() {
  return supabase
    .from('mouvements_stock')
    .select('id, ingredient_id, quantite, motif, created_at')
    .order('created_at', { ascending: false })
    .range(decalage, decalage + TAILLE_PAGE - 1)
}

function traiterPage({ data, error }) {
  if (error) {
    message.textContent = `${t('erreur_chargement')} : ${error.message}`
    message.className = 'erreur'
    boutonChargerPlus.disabled = false
    return
  }

  message.textContent = ''
  mouvementsAffiches = mouvementsAffiches.concat(data)
  decalage += data.length
  tousCharges = data.length < TAILLE_PAGE

  afficherMouvements()
  boutonChargerPlus.hidden = tousCharges
  boutonChargerPlus.disabled = false
}

async function chargerPage() {
  boutonChargerPlus.disabled = true
  traiterPage(await recupererPage())
}

boutonChargerPlus.addEventListener('click', chargerPage)

// Un changement de langue ne nécessite pas un nouvel appel réseau : on réaffiche juste les mêmes données.
window.addEventListener('langue-changee', afficherMouvements)

// Les ingrédients (pour les noms) et la première page de mouvements sont indépendants :
// chargés en parallèle plutôt que l'un après l'autre.
boutonChargerPlus.disabled = true
const [, resultatPremierePage] = await Promise.all([chargerIngredients(), recupererPage()])
traiterPage(resultatPremierePage)
