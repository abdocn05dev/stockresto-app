// Arrondit à 2 décimales max pour l'affichage, sans zéros inutiles (25 -> "25", 14.870000000000003 -> "14.87")
export function formatNombre(nombre) {
  return Number(nombre.toFixed(2))
}
