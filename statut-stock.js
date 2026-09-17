import { t } from './i18n.js'

// En dessous de la moitié du seuil minimum -> critique. Entre la moitié et le seuil -> bas.
// Ajuste ce ratio si tu veux une alerte "critique" plus ou moins sensible.
export const RATIO_CRITIQUE = 0.5

export function getStatut(stockActuel, seuilMinimum) {
  if (stockActuel < seuilMinimum * RATIO_CRITIQUE) {
    return { label: t('statut_critique'), classe: 'critique' }
  }
  if (stockActuel < seuilMinimum) {
    return { label: t('statut_bas'), classe: 'bas' }
  }
  return { label: t('statut_ok'), classe: 'ok' }
}
