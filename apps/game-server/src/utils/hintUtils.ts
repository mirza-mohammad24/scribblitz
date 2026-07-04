/**
 * Utility functions for generating and managing word hints during the drawing phase.
 * This module includes functions to generate the current hint based on revealed indexes
 * and to select a random hidden index for hint updates.
 */

/**
 * Generates a hint for the given word based on the revealed indexes.
 * @param word The word for which to generate the hint
 * @param revealedIndexes A set of indexes that have been revealed
 * @returns the hint string with unrevealed characters replaced by underscores
 */
export const generateHint = (word: string, revealedIndexes: Set<number>): string => {
  return word
    .split('')
    .map((char, index) => {
      if (char === ' ') return ' '; //preserve spaces
      return revealedIndexes.has(index) ? char : '_';
    })
    .join('');
};

/**
 * Gets a random index of a hidden character in the word.
 * @param word The word for which to find a hidden index
 * @param revealedIndexes A set of indexes that have been revealed
 * @param maxRevealPercent The maximum percentage of characters that can be revealed
 * @returns a random index of a hidden character, or null if all characters are
 * revealed or max reveal limit is reached
 */
export const getRandomHiddenIndex = (
  word: string,
  revealedIndexes: Set<number>,
  maxRevealPercent: number = 0.3,
): number | null => {
  const maxReveals = Math.floor(word.replace(/ /g, '').length * maxRevealPercent);

  if (revealedIndexes.size >= maxReveals) return null;

  const hiddenIndexes: number[] = [];

  for (let i = 0; i < word.length; i++) {
    if (word[i] !== ' ' && !revealedIndexes.has(i)) {
      hiddenIndexes.push(i);
    }
  }

  if (hiddenIndexes.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * hiddenIndexes.length);
  return hiddenIndexes[randomIndex] ?? null;
};
