import path from 'path';
import fs from 'fs/promises';
import { getUserDataPath } from './paths';
import type { ContentFolderFont } from '@artsitemaker/shared';

const FONT_FILE_EXTENSIONS = new Set([
  '.woff2',
  '.woff',
  '.ttf',
  '.otf',
  '.ttc',
  '.eot',
]);

/**
 * Scans the user-data fonts directory and returns available font files
 */
export async function getContentFolderFonts(): Promise<ContentFolderFont[]> {
  const userDataPath = getUserDataPath();
  const fontsDir = path.join(userDataPath, 'assets', 'fonts');
  
  try {
    const entries = await fs.readdir(fontsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) =>
        FONT_FILE_EXTENSIONS.has(path.extname(name).toLowerCase())
      )
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        displayName: path.parse(name).name,
        file: name,
      }));
  } catch (e) {
    // Directory might not exist or be accessible, return empty array
    return [];
  }
}
