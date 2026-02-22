/**
 * tagUtils.ts
 *
 * Shared utility for tag name normalization.
 * Converts arbitrary strings to UpperCamelCase (PascalCase) for consistent tag storage.
 */

/**
 * Convert a string to UpperCamelCase (PascalCase).
 *
 * Examples:
 *   "cybersecurity"    -> "Cybersecurity"
 *   "bahasa"           -> "Bahasa"
 *   "machine learning" -> "MachineLearning"
 *   "NATIVE LANGUAGE"  -> "NativeLanguage"
 *   "data-science"     -> "DataScience"
 */
export function toUpperCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}
