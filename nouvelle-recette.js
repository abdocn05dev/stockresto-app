import { supabase } from './supabase.js'
import { formatNombre } from './format.js'
import { t, libelleUnite } from './i18n.js'

const form = document.getElementById('form-recette')
const selectPlat = document.getElementById('plat')
const selectIngredient = document.getElementById('ingredient')
const selectUnite = document.getElementById('unite')
const bouton = document.getElementById('btn-ajouter')
const resultatDiv = document.getElementById('resultat')

let plats = []
let ingredients = []
let toutesLesRecettes = []

// Unités que vendre.js sait convertir vers le stock d'un ingrédient (voir convertirVersUniteStock).
const UNITES_COMPATIBLES = {
  kg: ['kg', 'g'],
  g: ['g'],
  L: ['L', 'ml'],
  ml: ['ml'],
  unite: ['unite'],
}

function unitesCompatiblesPourIngredient(ingredientId) {
  const ingredient = ingredients.find((i) => i.id === ingredientId)
  return ingredient ? UNITES_COMPATIBLES[ingredient.unite] || [ingredient.unite] : []
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

  plats = data
  selectPlat.innerHTML = plats
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
  const unitesPossibles = unitesCompatiblesPourIngredient(Number(selectIngredient.value))
  selectUnite.innerHTML = unitesPossibles.map((u) => `<option value="${u}">${libelleUnite(u)}</option>`).join('')
}

async function chargerRecettes() {
  const { data, error } = await supabase.from('recettes').select('id, plat_id, ingredient_id, quantite, unite')

  if (error) {
    document.getElementById('recettes-body').innerHTML = `<tr><td colspan="3" class="erreur">${t('erreur_chargement')}</td></tr>`
    return
  }

  toutesLesRecettes = data
}

function afficherRecettes() {
  const corps = document.getElementById('recettes-body')
  corps.innerHTML = ''

  const groupes = new Map()
  for (const ligne of toutesLesRecettes) {
    if (!groupes.has(ligne.plat_id)) groupes.set(ligne.plat_id, [])
    groupes.get(ligne.plat_id).push(ligne)
  }

  const recettesParPlat = [...groupes.entries()]
    .map(([platId, lignes]) => ({
      platId,
      nomPlat: (plats.find((p) => p.id === platId) || {}).nom || `#${platId}`,
      lignes,
    }))
    .sort((a, b) => a.nomPlat.localeCompare(b.nomPlat))

  for (const { platId, nomPlat, lignes } of recettesParPlat) {
    const texteIngredients = lignes
      .map((ligne) => {
        const ingredient = ingredients.find((i) => i.id === ligne.ingredient_id)
        const nomIngredient = ingredient ? ingredient.nom : `#${ligne.ingredient_id}`
        return `${nomIngredient} ${formatNombre(ligne.quantite)} ${libelleUnite(ligne.unite)}`
      })
      .join(', ')

    const rangee = document.createElement('tr')
    rangee.innerHTML = `
      <td>${nomPlat}</td>
      <td>${texteIngredients}</td>
      <td>
        <button type="button" class="bouton-icone bouton-modifier" data-plat-id="${platId}" aria-label="${t('bouton_modifier')}">✎</button>
        <button type="button" class="bouton-icone bouton-supprimer" data-plat-id="${platId}" aria-label="${t('bouton_supprimer')}">🗑</button>
      </td>
    `
    corps.appendChild(rangee)
  }
}

// Un changement de langue ne nécessite pas un nouvel appel réseau : on réaffiche juste les mêmes données.
window.addEventListener('langue-changee', () => {
  afficherIngredients()
  afficherRecettes()
})

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
    await chargerRecettes()
    afficherRecettes()
  }

  bouton.disabled = false
  bouton.textContent = t('bouton_ajouter_recette')
})

// --- Modifier une recette (la liste des lignes ingrédient/quantité d'un plat) ---

const modaleEdition = document.getElementById('modale-edition-recette')
const editionPlatNom = document.getElementById('edition-recette-plat-nom')
const conteneurLignes = document.getElementById('edition-recette-lignes')
const formEdition = document.getElementById('form-modale-edition-recette')
const boutonAjouterLigne = document.getElementById('btn-edition-recette-ajouter-ligne')
const editionResultat = document.getElementById('modale-edition-recette-resultat')
const boutonEditionAnnuler = document.getElementById('btn-edition-recette-annuler')
const boutonEditionEnregistrer = document.getElementById('btn-edition-recette-enregistrer')

let platEnEditionId = null
let idsLignesOriginales = []
let lignesEdition = []
let compteurNouvelleLigne = 0

function afficherLignesEdition() {
  conteneurLignes.innerHTML = lignesEdition
    .map((ligne) => {
      const unitesPossibles = unitesCompatiblesPourIngredient(ligne.ingredientId)
      return `
        <div class="ligne-recette" data-cle="${ligne.cle}">
          <select class="edition-ligne-ingredient" data-cle="${ligne.cle}">
            ${ingredients
              .map((i) => `<option value="${i.id}" ${i.id === ligne.ingredientId ? 'selected' : ''}>${i.nom}</option>`)
              .join('')}
          </select>
          <input type="number" class="edition-ligne-quantite" data-cle="${ligne.cle}" step="0.01" min="0.01" value="${ligne.quantite}">
          <select class="edition-ligne-unite" data-cle="${ligne.cle}">
            ${unitesPossibles.map((u) => `<option value="${u}" ${u === ligne.unite ? 'selected' : ''}>${libelleUnite(u)}</option>`).join('')}
          </select>
          <button type="button" class="bouton-icone bouton-supprimer bouton-supprimer-ligne" data-cle="${ligne.cle}" aria-label="${t('bouton_supprimer')}">✕</button>
        </div>
      `
    })
    .join('')
}

function ouvrirModaleEdition(platId, lignesRecette) {
  platEnEditionId = platId
  const plat = plats.find((p) => p.id === platId)
  editionPlatNom.textContent = plat ? plat.nom : `#${platId}`

  idsLignesOriginales = lignesRecette.map((ligne) => ligne.id)
  lignesEdition = lignesRecette.map((ligne) => ({
    cle: `existante-${ligne.id}`,
    id: ligne.id,
    ingredientId: ligne.ingredient_id,
    quantite: ligne.quantite,
    unite: ligne.unite,
  }))

  afficherLignesEdition()
  editionResultat.innerHTML = ''
  modaleEdition.hidden = false
}

function fermerModaleEdition() {
  modaleEdition.hidden = true
  platEnEditionId = null
  lignesEdition = []
}

function ajouterLigneVide() {
  const premierIngredient = ingredients[0]
  if (!premierIngredient) return

  compteurNouvelleLigne += 1
  const unitesPossibles = unitesCompatiblesPourIngredient(premierIngredient.id)
  lignesEdition.push({
    cle: `nouvelle-${compteurNouvelleLigne}`,
    id: null,
    ingredientId: premierIngredient.id,
    quantite: '',
    unite: unitesPossibles[0] || premierIngredient.unite,
  })
  afficherLignesEdition()
}

boutonAjouterLigne.addEventListener('click', ajouterLigneVide)
boutonEditionAnnuler.addEventListener('click', fermerModaleEdition)

modaleEdition.addEventListener('click', (event) => {
  if (event.target === modaleEdition) fermerModaleEdition()
})

conteneurLignes.addEventListener('change', (event) => {
  const cle = event.target.dataset.cle
  const ligne = lignesEdition.find((l) => l.cle === cle)
  if (!ligne) return

  if (event.target.classList.contains('edition-ligne-ingredient')) {
    ligne.ingredientId = Number(event.target.value)
    const unitesPossibles = unitesCompatiblesPourIngredient(ligne.ingredientId)
    ligne.unite = unitesPossibles[0] || ligne.unite
    afficherLignesEdition()
  } else if (event.target.classList.contains('edition-ligne-unite')) {
    ligne.unite = event.target.value
  } else if (event.target.classList.contains('edition-ligne-quantite')) {
    ligne.quantite = event.target.value
  }
})

conteneurLignes.addEventListener('click', (event) => {
  const boutonSupprimerLigne = event.target.closest('.bouton-supprimer-ligne')
  if (!boutonSupprimerLigne) return

  lignesEdition = lignesEdition.filter((l) => l.cle !== boutonSupprimerLigne.dataset.cle)
  afficherLignesEdition()
})

formEdition.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (platEnEditionId === null) return

  const lignesInvalides = lignesEdition.some((l) => !l.ingredientId || !l.quantite || Number(l.quantite) <= 0)
  if (lignesInvalides) {
    editionResultat.innerHTML = `<p class="erreur">${t('erreur_ligne_recette_invalide')}</p>`
    return
  }

  boutonEditionEnregistrer.disabled = true
  boutonEditionEnregistrer.textContent = t('bouton_enregistrement_en_cours')
  editionResultat.innerHTML = ''

  const idsConserves = lignesEdition.filter((l) => l.id !== null).map((l) => l.id)
  const idsASupprimer = idsLignesOriginales.filter((id) => !idsConserves.includes(id))

  let erreur = null

  for (const id of idsASupprimer) {
    const { error } = await supabase.from('recettes').delete().eq('id', id)
    if (error) {
      erreur = error
      break
    }
  }

  if (!erreur) {
    for (const ligne of lignesEdition.filter((l) => l.id !== null)) {
      const { error } = await supabase
        .from('recettes')
        .update({ ingredient_id: ligne.ingredientId, quantite: Number(ligne.quantite), unite: ligne.unite })
        .eq('id', ligne.id)
      if (error) {
        erreur = error
        break
      }
    }
  }

  if (!erreur) {
    const nouvellesLignes = lignesEdition
      .filter((l) => l.id === null)
      .map((l) => ({ plat_id: platEnEditionId, ingredient_id: l.ingredientId, quantite: Number(l.quantite), unite: l.unite }))

    if (nouvellesLignes.length > 0) {
      const { error } = await supabase.from('recettes').insert(nouvellesLignes)
      if (error) erreur = error
    }
  }

  if (erreur) {
    editionResultat.innerHTML = `<p class="erreur">${t('erreur_prefixe')} ${erreur.message}</p>`
    boutonEditionEnregistrer.disabled = false
    boutonEditionEnregistrer.textContent = t('bouton_enregistrer')
    return
  }

  fermerModaleEdition()
  await chargerRecettes()
  afficherRecettes()

  boutonEditionEnregistrer.disabled = false
  boutonEditionEnregistrer.textContent = t('bouton_enregistrer')
})

// --- Supprimer une recette (toutes les lignes d'un plat) ---

const modaleSuppression = document.getElementById('modale-suppression-recette')
const suppressionContenu = document.getElementById('modale-suppression-recette-contenu')
const suppressionActions = document.getElementById('modale-suppression-recette-actions')

let platASupprimerId = null

function fermerModaleSuppression() {
  modaleSuppression.hidden = true
  platASupprimerId = null
  suppressionActions.innerHTML = ''
}

function ouvrirModaleSuppression(platId) {
  platASupprimerId = platId
  const plat = plats.find((p) => p.id === platId)
  const nomPlat = plat ? plat.nom : `#${platId}`

  suppressionContenu.innerHTML = `<p>${t('confirmation_suppression_recette', { plat: nomPlat })}</p>`
  suppressionActions.innerHTML = `
    <button type="button" id="btn-suppression-recette-annuler" class="bouton-secondaire" data-i18n="bouton_annuler">${t('bouton_annuler')}</button>
    <button type="button" id="btn-suppression-recette-confirmer" class="bouton-danger" data-i18n="bouton_supprimer">${t('bouton_supprimer')}</button>
  `
  modaleSuppression.hidden = false
}

modaleSuppression.addEventListener('click', (event) => {
  if (event.target === modaleSuppression) fermerModaleSuppression()
})

suppressionActions.addEventListener('click', async (event) => {
  if (event.target.id === 'btn-suppression-recette-annuler' || event.target.id === 'btn-suppression-recette-fermer') {
    fermerModaleSuppression()
    return
  }

  if (event.target.id !== 'btn-suppression-recette-confirmer' || platASupprimerId === null) return

  const platId = platASupprimerId
  suppressionActions.innerHTML = ''
  suppressionContenu.innerHTML = `<p>${t('suppression_en_cours')}</p>`

  const { error } = await supabase.from('recettes').delete().eq('plat_id', platId)

  if (error) {
    suppressionContenu.innerHTML = `<p class="erreur">${t('erreur_prefixe')} ${error.message}</p>`
    suppressionActions.innerHTML = `<button type="button" id="btn-suppression-recette-fermer" data-i18n="bouton_fermer">${t('bouton_fermer')}</button>`
    return
  }

  toutesLesRecettes = toutesLesRecettes.filter((l) => l.plat_id !== platId)
  afficherRecettes()
  fermerModaleSuppression()
})

document.getElementById('recettes-body').addEventListener('click', (event) => {
  const boutonClique = event.target.closest('.bouton-modifier, .bouton-supprimer')
  if (!boutonClique) return

  const platId = Number(boutonClique.dataset.platId)
  if (boutonClique.classList.contains('bouton-modifier')) {
    const lignesRecette = toutesLesRecettes.filter((l) => l.plat_id === platId)
    ouvrirModaleEdition(platId, lignesRecette)
  } else {
    ouvrirModaleSuppression(platId)
  }
})

await Promise.all([chargerPlats(), chargerIngredients(), chargerRecettes()])
afficherRecettes()
