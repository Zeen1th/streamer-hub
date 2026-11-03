/*
 * "Send one random line": a chat step can hold many messages (one per line, or a .txt file) and post one of them each
 * time it runs. Lines are dealt like cards: none repeats until every line has been used once.
 */

/** The usable lines of a list or text file: trimmed, blank lines dropped. */
export function linesFromText(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Deals lines without repeats until all are used, per step. Starts over when the list changes. */
export class LineDeck {
  private decks = new Map<string, { source: string; left: string[]; last?: string }>();
  private random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  next(key: string, lines: string[]): string | null {
    if (lines.length === 0) return null;
    const source = lines.join('\n');
    let deck = this.decks.get(key);
    if (!deck || deck.source !== source) {
      deck = { source, left: [] };
      this.decks.set(key, deck);
    }
    let choices = deck.left;
    if (choices.length === 0) {
      deck.left = [...lines];
      // A fresh round never starts with the line that ended the last one
      choices = deck.left.length > 1 && deck.last !== undefined ? deck.left.filter((l) => l !== deck!.last) : deck.left;
      if (choices.length === 0) choices = deck.left;
    }
    const line = choices[Math.min(choices.length - 1, Math.floor(this.random() * choices.length))];
    deck.left.splice(deck.left.indexOf(line), 1);
    deck.last = line;
    return line;
  }
}
