/**
 * How an energy figure is written on screen.
 *
 * The API keeps one decimal, which is the right precision to compute with and
 * the wrong one to read: "413,3 kcal" claims an accuracy a food table matched
 * by name does not have, and the ",3" is three characters of noise on a 360px
 * line that already wraps. Grams keep their decimal — 0,4 g of salt is a real
 * difference from 0 — but energy is whole, and it is whole here rather than at
 * each of the places that print it.
 */
export function kcal(value: number) {
  return Math.round(value);
}
