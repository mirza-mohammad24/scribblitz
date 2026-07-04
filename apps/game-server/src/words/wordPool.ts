/**
 * This module manages the pool of words used in the game and provides functionality to pick random
 * words for each round. It also includes logic to filter out recently used words to enhance game variety
 * and prevent repeats. The word pool can be easily extended in the future to support different categories
 * and difficulty levels.
 */

import { GAME_CONSTANTS } from '@scribblitz/shared';

//Will be extended later
const DEFAULT_WORDS = [
  'apple',
  'banana',
  'watermelon',
  'computer',
  'guitar',
  'mountain',
  'ocean',
  'pizza',
  'spaceship',
  'television',
  'umbrella',
  'vampire',
  'wizard',
  'zombie',
  'helicopter',
  'elephant',
];

export const getWordPool = (): string[] => {
  return DEFAULT_WORDS;
};

/**
 * Fisher-Yates shuffle to pick random words from the pool
 * @param pool array of words to pick from
 * @param count count of words to pick
 * @returns Statistically random selection of words from the pool. Note that if count > pool.length,
 * it will return all words in random order without duplicates.
 */
export const pickRandomWords = (pool: string[], count: number): string[] => {
  const shuffled = [...pool]; //shallow copy

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[j]] = [shuffled[j] as string, shuffled[i] as string];
  }
  return shuffled.slice(0, count);
};

//Normalize string for safe comparison by trimming whitespace and converting to lowercase
const normalize = (word: string): string => word.toLowerCase().trim();

/**
 * Filters out words that have been recently used (uses Set for o(1) lookup)
 * @param pool The pool of words to filter
 * @param usedWords An array of words that have been used recently
 * @returns Filtered pool with recently used words removed. Comparison is done in a case-insensitive manner and
 * ignores leading/trailing whitespace to prevent accidental repeats due to formatting differences.
 */
export const filterRecentlyUsedWords = (pool: string[], usedWords: string[]): string[] => {
  const normalizedUsed = new Set(usedWords.map(normalize));
  return pool.filter((word) => !normalizedUsed.has(normalize(word)));
};

/**
 * Gets the available word pool by filtering out recently used words from the full pool. If the resulting pool is
 * too small to provide enough choices, it falls back to the full pool to ensure the game can continue without
 * interruption.
 * @param fullPool The complete pool of words
 * @param usedWords An array of words that have been used recently
 * @returns An array of words that can be used for the current round, with recently used words filtered out
 * when possible to enhance game variety.
 */
export const getAvailableWordPool = (fullPool: string[], usedWords: string[]): string[] => {
  const filteredPool = filterRecentlyUsedWords(fullPool, usedWords);

  //Failsafe: If filtering results in an empty pool (which can happen if the pool is small and many rounds
  // have been played), return the full pool to avoid game-breaking scenarios
  if (filteredPool.length < GAME_CONSTANTS.WORD_CHOICES_COUNT) {
    return fullPool;
  }
  return filteredPool;
};

/**
 * A single word pool that handles both custom and default words, prioritizing custom words when available.
 * It first checks for default scenario where there are no custom words so it just returns the default pool
 * filtered for recently used words.
 * In case custom words are available, it first attempts to use custom words, filtering out recently used ones.
 * If there are not enough custom words available, it fills the remaining slots with default words,
 * also ensuring that recently used default words and overlapping custom and default words are excluded.
 * It also works in strict mode where only custom words are used, allowing repeats if the custom pool is exhausted.
 * @param customWords The array of custom words
 * @param usedWords An array of words that have been used recently
 * @param customWordsOnly A flag indicating whether to use only custom words
 * @returns A set of words for the current round depending on the scenario
 */
export const getWordPoolWithCustomPriority = (
  customWords: string[] | undefined,
  usedWords: string[],
  customWordsOnly: boolean,
): string[] => {
  const defaultPool = getWordPool();

  //1. No custom words at all -> use default pool
  if (!customWords || customWords.length === 0) {
    return getAvailableWordPool(defaultPool, usedWords);
  }

  //Filter out recently used words from the custom pool
  const availableCustom = filterRecentlyUsedWords(customWords, usedWords);

  //2. STRICT MODE: Only custom words. If exhausted, we will allow repeats to respect the user input of strict mode.
  if (customWordsOnly) {
    return availableCustom.length >= GAME_CONSTANTS.WORD_CHOICES_COUNT
      ? availableCustom
      : customWords; // Allow repeats if the pool is exhausted
  }

  //3. HYBRID MODE (Strict Priority Fill)
  //First we grab as many unused custom words as we can (up to the required 3)
  const amountToTake = Math.min(availableCustom.length, GAME_CONSTANTS.WORD_CHOICES_COUNT);
  const customToUse = pickRandomWords(availableCustom, amountToTake);

  //If we grabbed fewer than 3 words (because the custom pool is small or exhausted), we calculate the deficit
  //and fill the rest with default words ensuring that we don't repeat recently used words from the default pool either.
  if (customToUse.length < GAME_CONSTANTS.WORD_CHOICES_COUNT) {
    const deficit = GAME_CONSTANTS.WORD_CHOICES_COUNT - customToUse.length;

    //Combine used words and already selected custom words to avoid repeats
    //This prevents the scenario where both custom and default pools have overlapping words and
    //we have selected the overlapping word from the custom pool, for this round and hence we
    //don't have it in usedWords yet, but we don't want to select it again from the default pool.
    const exclusionList = [...usedWords, ...customToUse];

    const availableDefaults = filterRecentlyUsedWords(defaultPool, exclusionList);
    const defaultsToUse = pickRandomWords(availableDefaults, deficit);

    //Return the 3 words needed
    return [...customToUse, ...defaultsToUse];
  }

  // If we had enough custom words to fill all 3 choices, just return them!
  return customToUse;
};
