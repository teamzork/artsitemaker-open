
/**
 * Generates a deterministic pastel color from a string.
 * Used for giving collections distinct but subtle background tints.
 * 
 * @param str The input string (e.g. collection slug or name)
 * @param opacity The opacity of the color (default: 0.1 for very subtle tint)
 * @returns A CSS hsla() color string
 */
export function stringToColor(str: string, opacity: number = 0.1): string {
  if (!str) return 'transparent';
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use a constrained hue range or full range
  // We want it to be distinct.
  const h = hash % 360;
  
  // Keep saturation reasonable, maybe lower for pastel
  const s = 60 + (hash % 20); // 60-80%
  
  // Keep lightness high for pastel/tint feel (if we were doing solid pastel)
  // But since we are doing low opacity on dark/light theme, we want a distinctive hue.
  // The opacity controls the subtlety.
  
  const l = 50; // Middle lightness so it shows on both light/dark if opacity is handled

  return `hsla(${h}, ${s}%, ${l}%, ${opacity})`;
}
