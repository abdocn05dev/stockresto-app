import { supabase } from './supabase.js'
import { vendrePlat } from './vendre.js'
import { formatNombre } from './format.js'
import { t, libelleUnite } from './i18n.js'

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
  if (alerte.type === 'seuil_minimum') return t('alerte_seuil_minimum', { ingredient: alerte.ingredient })
  if (alerte.type === 'erreur_ingredient') return t('alerte_erreur_ingredient', { message: alerte.message })
  if (alerte.type === 'erreur_stock') return t('alerte_erreur_stock', { ingredient: alerte.ingredient, message: alerte.message })
  return ''
}

function afficherResultat(resultat) {
  if (!resultat.succes) {
    const message =
      resultat.erreurCode === 'erreur_supabase'
        ? `${t('erreur_prefixe')} ${resultat.erreurMessage}`
        : t('erreur_recette_introuvable')
    resultatDiv.innerHTML = `<p class="erreur">${message}</p>`
    return
  }

  const lignesHtml = resultat.lignes
    .map(
      (ligne) =>
        `<li>${ligne.nom} : ${formatNombre(ligne.avant)} → ${formatNombre(ligne.apres)} ${libelleUnite(ligne.unite)}</li>`
    )
    .join('')

  const alertesHtml = resultat.alertes.length
    ? `<div class="alerte">${resultat.alertes.map((a) => `<p>⚠️ ${formaterAlerte(a)}</p>`).join('')}</div>`
    : ''

  resultatDiv.innerHTML = `
    <p class="succes">${t('vente_enregistree')}</p>
    <ul>${lignesHtml}</ul>
    ${alertesHtml}
  `
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
