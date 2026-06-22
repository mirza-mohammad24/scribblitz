/**
 * Computes the Levenshtein edit distance between two strings.
 * Uses a single-row DP optimization for O(min(m,n)) space complexity.
 */
export const levenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length; // we need to insert all characters of b
  if (b.length === 0) return a.length; // we need to delete all characters of a

  // Ensure a is shorter for space optimization
  if (a.length > b.length) [a, b] = [b, a];

  let prev = Array.from({ length: a.length + 1 }, (_, i) => i);

  for (let j = 1; j <= b.length; j++) {
    const curr = [j];
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1]! + 1, // insertion
        prev[i]! + 1, // deletion
        prev[i - 1]! + cost, // substitution
      );
    }
    prev = curr;
  }
  return prev[a.length]!;
};
