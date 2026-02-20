import { DIMKA_FONTS } from "@artsitemaker/shared";

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

const FONT_PREVIEW_SAMPLE = "Aa Bb 0123";

function generateFontOptions(): FontOption[] {
  return DIMKA_FONTS.map((font) => ({
    label: font.name,
    value: font.name,
    preview: FONT_PREVIEW_SAMPLE,
    previewFamily: font.name,
  }));
}

function generateFontFaceCss(): string {
  const rules: string[] = [];

  for (const font of DIMKA_FONTS) {
    for (const variant of font.variants) {
      rules.push(
        `@font-face {
  font-family: "${font.name}";
  src: url("${variant.woff2}") format("woff2"),
       url("${variant.woff}") format("woff");
  font-weight: ${variant.weight};
  font-style: normal;
  font-display: swap;
}`.trim()
      );
    }
  }

  return rules.join("\n\n");
}

export async function loadFontData(): Promise<FontData> {
  const options = generateFontOptions();
  const css = generateFontFaceCss();

  const sections: FontSection[] = [
    {
      label: "Dimka Fonts",
      options,
    },
  ];

  return { sections, css };
}
