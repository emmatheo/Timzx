/** Joins class names, dropping falsy entries. Small enough not to warrant a dependency. */
export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}
