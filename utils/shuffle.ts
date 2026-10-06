/**
 * Returns the items in a uniformly random order (Fisher-Yates).
 * `sort(() => Math.random() - 0.5)` isn't uniform: with 4 quiz options the item passed first
 * (the correct answer) stayed first ~36% of the time instead of 25%.
 */
export function shuffled<T>(items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
