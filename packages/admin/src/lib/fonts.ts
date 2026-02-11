import path from "path";
import fs from "fs/promises";
import { getContentAssetsBaseUrl } from "./paths";
import { getFontFormat } from "@artsitemaker/shared";

export interface FontFile {
  name: string;
  displayName: string;
}

export interface FontOption {
  label: string;
  value: string;
  preview: string;
  previewFamily: string;
}

export interface FontSection {
  label: string;
  options: FontOption[];
}

export interface FontData {
  sections: FontSection[];
  css: string;
}

const FONT_FILE_EXTENSIONS = new Set([
  ".woff2",
  ".woff",
  ".ttf",
  ".otf",
  ".ttc",
  ".eot",
]);

const FONT_PREVIEW_SAMPLE = "Aa Bb 0123";

/**
 * Scans the content fonts directory and returns available font files
 */
async function getContentFonts(contentPath: string): Promise<FontFile[]> {
  const contentFontsDir = path.join(contentPath, "assets", "fonts");
  try {
    const entries = await fs.readdir(contentFontsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) =>
        FONT_FILE_EXTENSIONS.has(path.extname(name).toLowerCase())
      )
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        displayName: path.parse(name).name,
      }));
  } catch (e) {
    // Directory might not exist or be accessible, return empty array
    return [];
  }
}

/**
 * Generates font options for Combobox
 */
function generateFontOptions(fonts: FontFile[]): FontOption[] {
  return fonts.map((font) => ({
    label: font.displayName,
    value: font.displayName,
    preview: FONT_PREVIEW_SAMPLE,
    previewFamily: font.displayName,
  }));
}

/**
 * Generates CSS @font-face rules for the available fonts
 */
function generateFontFaceCss(fonts: FontFile[]): string {
  const contentAssetsBaseUrl = getContentAssetsBaseUrl();

  return fonts
    .map((font) => {
      const relativePath = path.posix.join("fonts", font.name);
      // Ensure we don't have double slashes if base url ends with /
      const baseUrl = contentAssetsBaseUrl.endsWith("/")
        ? contentAssetsBaseUrl.slice(0, -1)
        : contentAssetsBaseUrl;
      const fontUrl = `${baseUrl}/${encodeURI(relativePath)}`;
      const format = getFontFormat(font.name);

      return `
@font-face {
  font-family: "${font.displayName}";
  src: url("${fontUrl}") format("${format}");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
      `.trim();
    })
    .join("\n\n");
}

/**
 * Loads all font data needed for the settings page.
 * Returns sections for Combobox and CSS for @font-face injection.
 */
export async function loadFontData(contentPath: string): Promise<FontData> {
  const fonts = await getContentFonts(contentPath);
  const options = generateFontOptions(fonts);
  const css = generateFontFaceCss(fonts);

  const sections: FontSection[] = options.length
    ? [{ label: "Content Folder Fonts", options }]
    : [];

  return { sections, css };
}

