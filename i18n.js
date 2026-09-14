import { TRADUCTIONS, LANGUE_PAR_DEFAUT } from './traductions.js'

const CLE_STOCKAGE = 'stockresto_langue'
const LANGUES_RTL = ['ar']

export function getLangue() {
  const stockee = localStorage.getItem(CLE_STOCKAGE)
  return TRADUCTIONS[stockee] ? stockee : LANGUE_PAR_DEFAUT
}

export function t(cle, remplacements) {
  const langue = getLangue()
  let texte = TRADUCTIONS[langue]?.[cle] ?? TRADUCTIONS[LANGUE_PAR_DEFAUT][cle] ?? cle

  if (remplacements) {
    for (const [nomVariable, valeur] of Object.entries(remplacements)) {
      texte = texte.replaceAll(`{${nomVariable}}`, valeur)
    }
  }

  return texte
}

// kg/g/L/ml sont des symboles universels qu'on n'a pas besoin de traduire ; seul "unite" est un vrai mot.
export function libelleUnite(code) {
  return code === 'unite' ? t('unite_piece') : code
}

function appliquerTextes() {
  const langue = getLangue()
  document.documentElement.lang = langue
  document.documentElement.dir = LANGUES_RTL.includes(langue) ? 'rtl' : 'ltr'

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.getAttribute('data-i18n'))
  })

  const selecteur = document.getElementById('langue-select')
  if (selecteur) selecteur.value = langue
}

export function setLangue(langue) {
  localStorage.setItem(CLE_STOCKAGE, langue)
  appliquerTextes()
  window.dispatchEvent(new CustomEvent('langue-changee'))
}

function initSelecteurLangue() {
  const selecteur = document.getElementById('langue-select')
  if (!selecteur) return
  selecteur.value = getLangue()
  selecteur.addEventListener('change', (evenement) => setLangue(evenement.target.value))
}

appliquerTextes()
initSelecteurLangue()
