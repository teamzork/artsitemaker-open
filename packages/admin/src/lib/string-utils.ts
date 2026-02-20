/**
 * Get initials from a name string.
 * If the name has multiple parts (first last), returns the first letter of the first and last parts.
 * If the name has only one part, returns the first two letters.
 * 
 * @example
 * getInitials("John Doe") // "JD"
 * getInitials("John") // "JO"
 * getInitials("John Middle Doe") // "JD"
 */
export function getInitials(name: string): string {
  if (!name) return "";
  
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  
  // If we have at least First and Last name parts
  if (parts.length >= 2) {
    // Return first char of first part and first char of last part
    const firstInitial = parts[0][0];
    const lastInitial = parts[parts.length - 1][0];
    return (firstInitial + lastInitial).toUpperCase();
  }
  
  // Fallback to first two chars of the single name
  return trimmed.slice(0, 2).toUpperCase();
}
