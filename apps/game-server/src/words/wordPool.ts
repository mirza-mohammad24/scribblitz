/**
 * This module manages the pool of words used in the game and provides functionality to pick random
 * words for each round.
 */

import { GAME_CONSTANTS } from '@scribblitz/shared';

//Will be extended later on
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
 * @returns Statistically random selection of words from the pool. Note that if count > pool.length, it will return all words in random order without duplicates.
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
 * Filters out words that have been recently used
 * @param pool
 * @param usedWords
 * @returns Filtered pool with recently used words removed. Comparison is done in a case-insensitive manner and ignores leading/trailing whitespace to prevent accidental repeats due to formatting differences.
 */
export const filterRecentlyUsedWords = (pool: string[], usedWords: string[]): string[] => {
  const normalizedUsed = usedWords.map(normalize);
  return pool.filter((word) => !normalizedUsed.includes(normalize(word)));
};

/**
 * Gets the available word pool by filtering out recently used words from the full pool. If the resulting pool is too small to provide enough choices, it falls back to the full pool to ensure the game can continue without interruption.
 * @param fullPool
 * @param usedWords
 * @returns An array of words that can be used for the current round, with recently used words filtered out when possible to enhance game variety.
 */
export const getAvailableWordPool = (fullPool: string[], usedWords: string[]): string[] => {
  const filteredPool = filterRecentlyUsedWords(fullPool, usedWords);

  //Failsafe: If filtering results in an empty pool (which can happen if the pool is small and many rounds have been played), return the full pool to avoid game-breaking scenarios
  if (filteredPool.length < GAME_CONSTANTS.WORD_CHOICES_COUNT) {
    return fullPool;
  }
  return filteredPool;
};
