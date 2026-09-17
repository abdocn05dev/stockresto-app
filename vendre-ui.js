import { supabase } from './supabase.js'
import { vendrePlat } from './vendre.js'
import { formatNombre } from './format.js'
import { t, libelleUnite } from './i18n.js'
import './nav.js'

const select = document.getElementById('plat-select')
const form = document.getElementById('form-vente')
const boutonVendre = document.getElementById('btn-vendre')
const resultatDiv = document.getElementById('resultat')

async function chargerPlats() {
  const { data: plats, error } = await supabase
    .from('plats')
    .select('id, nom, categorie')
    .order('nom', { ascending: true })

  if (error) {
    select.innerHTML = `<option value="">${t('erreur_chargement')}</option>`
    return
  }

  select.innerHTML = plats
    .map((plat) => `<option value="${plat.id}">${plat.nom}${plat.categorie ? ` (${plat.categorie})` : ''}</option>`)
    .join('')
}

function formaterAlerte(alerte) {
  if (alerte.type === 'seuil_minimum') return t('alerte_stock_bas', { ingredient: alerte.ingredient })
  if (alerte.type === 'erreur_ingredient') return t('alerte_erreur_ingredient', { message: alerte.message })
  return ''
}

function messageErreurVente(resultat) {
  if (resultat.erreurCode === 'stock_negatif') {
    return t('erreur_stock_negatif', {
      ingredient: resultat.ingredient,
      stock: formatNombre(resultat.stock),
      unite: libelleUnite(resultat.unite),
    })
  }
  if (resultat.erreurCode === 'erreur_supabase') {
    return `${t('erreur_prefixe')} ${resultat.erreurMessage}`
  }
  return t('erreur_recette_introuvable')
}

function afficherResultat(resultat) {
  if (!resultat.succes) {
    resultatDiv.innerHTML = `<p class="erreur">${messageErreurVente(resultat)}</p>`
    return
  }

  const alertesHtml = resultat.alertes.length
    ? `<div class="alerte">${resultat.alertes.map((a) => `<p>⚠️ ${formaterAlerte(a)}</p>`).join('')}</div>`
    : ''

  const lignesHtml = resultat.lignes
    .map(
      (ligne) =>
        `<li>${ligne.nom} : ${formatNombre(ligne.avant)} → ${formatNombre(ligne.apres)} ${libelleUnite(ligne.unite)}</li>`
    )
    .join('')

  resultatDiv.innerHTML = `
    <div class="succes-badge">
      <span class="succes-badge-icone" aria-hidden="true">✓</span>
      <span>${t('vente_enregistree')}</span>
    </div>
    ${alertesHtml}
    <button type="button" class="lien-detail" id="lien-detail">${t('lien_voir_detail')}</button>
    <ul id="detail-lignes" hidden>${lignesHtml}</ul>
  `

  const lienDetail = document.getElementById('lien-detail')
  const detailLignes = document.getElementById('detail-lignes')
  lienDetail.addEventListener('click', () => {
    const vaSAfficher = detailLignes.hidden
    detailLignes.hidden = !vaSAfficher
    lienDetail.textContent = t(vaSAfficher ? 'lien_masquer_detail' : 'lien_voir_detail')
  })
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const platId = Number(select.value)
  if (!platId) return

  boutonVendre.disabled = true
  boutonVendre.textContent = t('bouton_vente_en_cours')
  resultatDiv.innerHTML = ''

  const resultat = await vendrePlat(platId)
  afficherResultat(resultat)

  boutonVendre.disabled = false
  boutonVendre.textContent = t('bouton_vendre')
})

chargerPlats()
