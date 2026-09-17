import { supabase } from './supabase.js'
import { formatNombre } from './format.js'
import { t, libelleUnite } from './i18n.js'
import { convertirVersUniteStock } from './vendre.js'
import { getStatut } from './statut-stock.js'
import { appliquerEtiquettesTableau } from './tableau-responsive.js'
import './nav.js'

const JOURS_FENETRE_VENTES = 30
const LIMITE_PLATS_VENDUS = 10

let dernieresVentes = []
let derniersCouts = []
let dernieresAlertes = []

// --- 1. Plats les plus vendus (30 derniers jours) ---
// Compté à partir de la table ventes (une ligne par vente réussie), pas de mouvements_stock :
// une vente y génère une ligne par ingrédient de la recette, pas une ligne par plat vendu.

function afficherVentes(lignes) {
  const corps = document.getElementById('ventes-body')
  corps.innerHTML = lignes.length
    ? lignes.map((ligne) => `<tr><td>${ligne.nom}</td><td>${ligne.nombre}</td></tr>`).join('')
    : `<tr><td colspan="2">${t('aucune_donnee')}</td></tr>`
  appliquerEtiquettesTableau('ventes-body')
}

async function chargerVentesParPlat() {
  const corps = document.getElementById('ventes-body')
  const depuis = new Date()
  depuis.setDate(depuis.getDate() - JOURS_FENETRE_VENTES)

  // La liste des plats ne dépend pas des ventes : on la charge en parallèle (tous les plats,
  // pas seulement ceux vendus) plutôt que d'attendre le résultat des ventes pour la filtrer.
  const [
    { data: ventes, error },
    { data: plats, error: erreurPlats },
  ] = await Promise.all([
    supabase.from('ventes').select('plat_id').gte('created_at', depuis.toISOString()),
    supabase.from('plats').select('id, nom'),
  ])

  if (error || erreurPlats) {
    corps.innerHTML = `<tr><td colspan="2" class="erreur">${t('erreur_chargement')}</td></tr>`
    return
  }

  const compteParPlat = new Map()
  for (const vente of ventes) {
    compteParPlat.set(vente.plat_id, (compteParPlat.get(vente.plat_id) ?? 0) + 1)
  }

  if (compteParPlat.size === 0) {
    dernieresVentes = []
    afficherVentes(dernieresVentes)
    return
  }

  const nomParId = new Map(plats.map((plat) => [plat.id, plat.nom]))

  dernieresVentes = [...compteParPlat.entries()]
    .map(([platId, nombre]) => ({ nom: nomParId.get(platId) ?? `#${platId}`, nombre }))
    .sort((a, b) => b.nombre - a.nombre)
    .slice(0, LIMITE_PLATS_VENDUS)

  afficherVentes(dernieresVentes)
}

// --- 2. Coût des plats (recette × prix d'achat des ingrédients) ---

function afficherCouts(lignes) {
  const corps = document.getElementById('cout-body')
  corps.innerHTML = lignes.length
    ? lignes
        .map(
          (ligne) => `
      <tr>
        <td>${ligne.nom}</td>
        <td>${formatNombre(ligne.cout)}</td>
        <td>${ligne.prixVente != null ? formatNombre(ligne.prixVente) : ''}</td>
        <td>${ligne.marge != null ? formatNombre(ligne.marge) : ''}</td>
      </tr>
    `
        )
        .join('')
    : `<tr><td colspan="4">${t('aucune_donnee')}</td></tr>`
  appliquerEtiquettesTableau('cout-body')
}

async function chargerCoutPlats() {
  const corps = document.getElementById('cout-body')

  // Les 3 tables sont indépendantes les unes des autres : un seul aller-retour groupé
  // au lieu de 3 requêtes l'une après l'autre (même optimisation que vendre.js).
  const [
    { data: plats, error: erreurPlats },
    { data: recettes, error: erreurRecettes },
    { data: ingredients, error: erreurIngredients },
  ] = await Promise.all([
    supabase.from('plats').select('id, nom, prix_vente'),
    supabase.from('recettes').select('plat_id, ingredient_id, quantite, unite'),
    supabase.from('ingredients').select('id, unite, prix_achat'),
  ])

  if (erreurPlats || erreurRecettes || erreurIngredients) {
    corps.innerHTML = `<tr><td colspan="4" class="erreur">${t('erreur_chargement')}</td></tr>`
    return
  }

  const platParId = new Map(plats.map((plat) => [plat.id, plat]))
  const ingredientParId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]))

  const recettesParPlat = new Map()
  for (const ligne of recettes) {
    if (!recettesParPlat.has(ligne.plat_id)) recettesParPlat.set(ligne.plat_id, [])
    recettesParPlat.get(ligne.plat_id).push(ligne)
  }

  derniersCouts = [...recettesParPlat.entries()]
    .map(([platId, lignesRecette]) => {
      const plat = platParId.get(platId)
      if (!plat) return null

      let cout = 0
      for (const ligne of lignesRecette) {
        const ingredient = ingredientParId.get(ligne.ingredient_id)
        if (!ingredient) continue
        const quantiteConvertie = convertirVersUniteStock(ligne.quantite, ligne.unite, ingredient.unite)
        cout += quantiteConvertie * ingredient.prix_achat
      }

      const prixVente = plat.prix_vente ?? null
      return {
        nom: plat.nom,
        cout,
        prixVente,
        marge: prixVente != null ? prixVente - cout : null,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.nom.localeCompare(b.nom))

  afficherCouts(derniersCouts)
}

// --- 3. Ingrédients en alerte (même seuil que la page Stock) ---

function afficherAlertes(ingredients) {
  const corps = document.getElementById('alertes-body')
  corps.innerHTML = ingredients.length
    ? ingredients
        .map((ingredient) => {
          const statut = getStatut(ingredient.stock_actuel, ingredient.seuil_minimum)
          return `
        <tr>
          <td>${ingredient.nom}</td>
          <td>${formatNombre(ingredient.stock_actuel)} ${libelleUnite(ingredient.unite)}</td>
          <td>${formatNombre(ingredient.seuil_minimum)} ${libelleUnite(ingredient.unite)}</td>
          <td><span class="badge ${statut.classe}">${statut.label}</span></td>
        </tr>
      `
        })
        .join('')
    : `<tr><td colspan="4">${t('aucune_alerte')}</td></tr>`
  appliquerEtiquettesTableau('alertes-body')
}

async function chargerAlertesStock() {
  const corps = document.getElementById('alertes-body')

  const { data: ingredients, error } = await supabase
    .from('ingredients')
    .select('id, nom, unite, stock_actuel, seuil_minimum')
    .order('nom', { ascending: true })

  if (error) {
    corps.innerHTML = `<tr><td colspan="4" class="erreur">${t('erreur_chargement')}</td></tr>`
    return
  }

  dernieresAlertes = ingredients.filter((ingredient) => ingredient.stock_actuel < ingredient.seuil_minimum)
  afficherAlertes(dernieresAlertes)
}

// Un changement de langue ne nécessite pas un nouvel appel réseau : on réaffiche juste les mêmes données.
window.addEventListener('langue-changee', () => {
  afficherVentes(dernieresVentes)
  afficherCouts(derniersCouts)
  afficherAlertes(dernieresAlertes)
})

chargerVentesParPlat()
chargerCoutPlats()
chargerAlertesStock()
