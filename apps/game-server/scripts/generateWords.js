const fs = require('fs');

const rawData = fs.readFileSync('Skribblitz-words-expanded.csv', 'utf-8');
const validWords = new Set();

rawData.split('\n').forEach((line) => {
  const word = line.split(',')[0].trim();
  // Filter: Not empty, not header, max 20 chars, max 2 words
  if (word && word.toLowerCase() !== 'word' && word.length <= 20 && word.split(/\s+/).length <= 2) {
    // Wrap in single quotes and escape existing quotes for JS syntax
    validWords.add(`'${word.replace(/'/g, "\\'")}'`);
  }
});

// Format as a ready-to-paste TypeScript array
const finalOutput = `const DEFAULT_WORDS = [\n  ${Array.from(validWords).join(', ')}\n];`;

// Write directly to a safe, new text file
fs.writeFileSync('generated_words.txt', finalOutput, 'utf-8');

console.log('✅ Success! Open generated_words.txt to copy your words.');
