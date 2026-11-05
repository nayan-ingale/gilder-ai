// Counts in words, such as "1 step" and "8 steps", worded the same way on every page.

/** `count` followed by the word, singular for exactly one. `many` defaults to `one` + "s". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
