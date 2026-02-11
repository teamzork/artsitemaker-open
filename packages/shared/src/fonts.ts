import path from "path";

/**
 * Determines the font format based on file extension
 */
export function getFontFormat(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".woff2") return "woff2";
  if (ext === ".woff") return "woff";
  if (ext === ".otf") return "opentype";
  if (ext === ".ttc") return "truetype";
  if (ext === ".eot") return "embedded-opentype";
  return "truetype";
}

/**
 * Content Folder font metadata
 */
export interface ContentFolderFont {
  displayName: string;
  file: string;
}
