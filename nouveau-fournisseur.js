import { supabase } from './supabase.js'
import { t } from './i18n.js'
import { appliquerEtiquettesTableau } from './tableau-responsive.js'
import './nav.js'

const form = document.getElementById('form-fournisseur')
const bouton = document.getElementById('btn-ajouter')
const resultatDiv = document.getElementById('resultat')

let dernierFournisseurs = []
let fournisseurEnEdition = null
let fournisseurASupprimer = null

const modaleEdition = document.getElementById('modale-edition-fournisseur')
const formEdition = document.getElementById('form-modale-edition-fournisseur')
const editionNom = document.getElementById('edition-fournisseur-nom')
const editionContact = document.getElementById('edition-fournisseur-contact')
const editionProduits = document.getElementById('edition-fournisseur-produits')
const editionResultat = document.getElementById('modale-edition-fournisseur-resultat')
const boutonEditionAnnuler = document.getElementById('btn-edition-fournisseur-annuler')
const boutonEditionEnregistrer = document.getElementById('btn-edition-fournisseur-enregistrer')

const modaleSuppression = document.getElementById('modale-suppression-fournisseur')
const suppressionContenu = document.getElementById('modale-suppression-fournisseur-contenu')
const suppressionActions = document.getElementById('modale-suppression-fournisseur-actions')

function afficherFournisseurs(fournisseurs) {
  const corps = document.getElementById('fournisseurs-body')
  corps.innerHTML = ''

  for (const fournisseur of fournisseurs) {
    const ligne = document.createElement('tr')
    ligne.innerHTML = `
      <td>${fournisseur.nom}</td>
      <td>${fournisseur.contact ?? ''}</td>
      <td>${fournisseur.produits ?? ''}</td>
      <td>
        <button type="button" class="bouton-icone bouton-modifier" data-id="${fournisseur.id}" aria-label="${t('bouton_modifier')}">✎</button>
        <button type="button" class="bouton-icone bouton-supprimer" data-id="${fournisseur.id}" aria-label="${t('bouton_supprimer')}">🗑</button>
      </td>
    `
    corps.appendChild(ligne)
  }

  appliquerEtiquettesTableau('fournisseurs-body')
}

async function chargerFournisseurs() {
  const { data: fournisseurs, error } = await supabase
    .from('fournisseurs')
    .select('id, nom, contact, produits')
    .order('nom', { ascending: true })

  if (error) {
    document.getElementById('fournisseurs-body').innerHTML = `<tr><td colspan="4" class="erreur">${t('erreur_chargement')}</td></tr>`
    return
  }

  dernierFournisseurs = fournisseurs
  afficherFournisseurs(dernierFournisseurs)
}

// Un changement de langue ne nécessite pas un nouvel appel réseau : on réaffiche juste les mêmes données.
window.addEventListener('langue-changee', () => {
  afficherFournisseurs(dernierFournisseurs)
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const fournisseur = {
    nom: document.getElementById('nom').value.trim(),
    contact: document.getElementById('contact').value.trim() || null,
    produits: document.getElementById('produits').value.trim() || null,
  }

  bouton.disabled = true
  bouton.textContent = t('bouton_ajout_en_cours')
  resultatDiv.innerHTML = ''

  const { error } = await supabase.from('fournisseurs').insert(fournisseur)

  if (error) {
    resultatDiv.innerHTML = `<p class="erreur">${t('erreur_prefixe')} ${error.message}</p>`
  } else {
    resultatDiv.innerHTML = `<p class="succes">${t('fournisseur_ajoute', { nom: fournisseur.nom })}</p>`
    form.reset()
    await chargerFournisseurs()
  }

  bouton.disabled = false
  bouton.textContent = t('bouton_ajouter_fournisseur')
})

// --- Modifier un fournisseur existant ---

function ouvrirModaleEdition(fournisseur) {
  fournisseurEnEdition = fournisseur
  editionNom.value = fournisseur.nom
  editionContact.value = fournisseur.contact ?? ''
  editionProduits.value = fournisseur.produits ?? ''
  editionResultat.innerHTML = ''
  modaleEdition.hidden = false
}

function fermerModaleEdition() {
  modaleEdition.hidden = true
  fournisseurEnEdition = null
}

boutonEditionAnnuler.addEventListener('click', fermerModaleEdition)

modaleEdition.addEventListener('click', (event) => {
  if (event.target === modaleEdition) fermerModaleEdition()
})

formEdition.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!fournisseurEnEdition) return

  const nom = editionNom.value.trim()
  const contact = editionContact.value.trim() || null
  const produits = editionProduits.value.trim() || null

  boutonEditionEnregistrer.disabled = true
  boutonEditionEnregistrer.textContent = t('bouton_enregistrement_en_cours')
  editionResultat.innerHTML = ''

  const { error } = await supabase
    .from('fournisseurs')
    .update({ nom, contact, produits })
    .eq('id', fournisseurEnEdition.id)

  if (error) {
    editionResultat.innerHTML = `<p class="erreur">${t('erreur_prefixe')} ${error.message}</p>`
    boutonEditionEnregistrer.disabled = false
    boutonEditionEnregistrer.textContent = t('bouton_enregistrer')
    return
  }

  fermerModaleEdition()
  await chargerFournisseurs()

  boutonEditionEnregistrer.disabled = false
  boutonEditionEnregistrer.textContent = t('bouton_enregistrer')
})

// --- Supprimer un fournisseur ---
// Un fournisseur n'est référencé par aucune autre table : suppression directe, sans vérification de dépendance.

function fermerModaleSuppression() {
  modaleSuppression.hidden = true
  fournisseurASupprimer = null
  suppressionActions.innerHTML = ''
}

function ouvrirModaleSuppression(fournisseur) {
  fournisseurASupprimer = fournisseur
  suppressionContenu.innerHTML = `<p>${t('confirmation_suppression_fournisseur', { fournisseur: fournisseur.nom })}</p>`
  suppressionActions.innerHTML = `
    <button type="button" id="btn-suppression-fournisseur-annuler" class="bouton-secondaire" data-i18n="bouton_annuler">${t('bouton_annuler')}</button>
    <button type="button" id="btn-suppression-fournisseur-confirmer" class="bouton-danger" data-i18n="bouton_supprimer">${t('bouton_supprimer')}</button>
  `
  modaleSuppression.hidden = false
}

modaleSuppression.addEventListener('click', (event) => {
  if (event.target === modaleSuppression) fermerModaleSuppression()
})

suppressionActions.addEventListener('click', async (event) => {
  if (event.target.id === 'btn-suppression-fournisseur-annuler' || event.target.id === 'btn-suppression-fournisseur-fermer') {
    fermerModaleSuppression()
    return
  }

  if (event.target.id !== 'btn-suppression-fournisseur-confirmer' || !fournisseurASupprimer) return

  const fournisseur = fournisseurASupprimer
  suppressionActions.innerHTML = ''
  suppressionContenu.innerHTML = `<p>${t('suppression_en_cours')}</p>`

  const { error } = await supabase.from('fournisseurs').delete().eq('id', fournisseur.id)

  if (error) {
    suppressionContenu.innerHTML = `<p class="erreur">${t('erreur_prefixe')} ${error.message}</p>`
    suppressionActions.innerHTML = `<button type="button" id="btn-suppression-fournisseur-fermer" data-i18n="bouton_fermer">${t('bouton_fermer')}</button>`
    return
  }

  dernierFournisseurs = dernierFournisseurs.filter((f) => f.id !== fournisseur.id)
  afficherFournisseurs(dernierFournisseurs)
  fermerModaleSuppression()
})

document.getElementById('fournisseurs-body').addEventListener('click', (event) => {
  const boutonClique = event.target.closest('.bouton-modifier, .bouton-supprimer')
  if (!boutonClique) return

  const fournisseur = dernierFournisseurs.find((f) => f.id === Number(boutonClique.dataset.id))
  if (!fournisseur) return

  if (boutonClique.classList.contains('bouton-modifier')) ouvrirModaleEdition(fournisseur)
  else ouvrirModaleSuppression(fournisseur)
})

chargerFournisseurs()
