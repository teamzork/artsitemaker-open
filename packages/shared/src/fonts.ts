import path from "path";

export function getFontFormat(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".woff2") return "woff2";
  if (ext === ".woff") return "woff";
  if (ext === ".otf") return "opentype";
  if (ext === ".ttc") return "truetype";
  if (ext === ".eot") return "embedded-opentype";
  return "truetype";
}

export interface ContentFolderFont {
  displayName: string;
  file: string;
}

export interface DimkaFontVariant {
  style: string;
  weight: number;
  woff2: string;
  woff: string;
}

export interface DimkaFontFamily {
  name: string;
  description: string;
  variants: DimkaFontVariant[];
}

export const DIMKA_FONTS: DimkaFontFamily[] = [
  {
    name: "Abatilo",
    description: "Display typeface",
    variants: [
      {
        style: "Regular",
        weight: 400,
        woff2: "https://f.dimka.com/dimka-fonts/fonts/Abatilo/Abatilo.woff2",
        woff: "https://f.dimka.com/dimka-fonts/fonts/Abatilo/Abatilo.woff",
      },
    ],
  },
  {
    name: "Aziu",
    description: "Display typeface in Black and Thin weights",
    variants: [
      {
        style: "Black",
        weight: 900,
        woff2: "https://f.dimka.com/dimka-fonts/fonts/Aziu/Aziu-Black.woff2",
        woff: "https://f.dimka.com/dimka-fonts/fonts/Aziu/Aziu-Black.woff",
      },
      {
        style: "Thin",
        weight: 100,
        woff2: "https://f.dimka.com/dimka-fonts/fonts/Aziu/Aziu-Thin.woff2",
        woff: "https://f.dimka.com/dimka-fonts/fonts/Aziu/Aziu-Thin.woff",
      },
    ],
  },
  {
    name: "DimkaSans",
    description: "Sans-serif typeface",
    variants: [
      {
        style: "Regular",
        weight: 400,
        woff2: "https://f.dimka.com/dimka-fonts/fonts/DimkaSans/DimkaSans-Regular.woff2",
        woff: "https://f.dimka.com/dimka-fonts/fonts/DimkaSans/DimkaSans-Regular.woff",
      },
    ],
  },
  {
    name: "Mescalito",
    description: "Display typeface",
    variants: [
      {
        style: "Regular",
        weight: 400,
        woff2: "https://f.dimka.com/dimka-fonts/fonts/Mescalito/Mescalito.woff2",
        woff: "https://f.dimka.com/dimka-fonts/fonts/Mescalito/Mescalito.woff",
      },
    ],
  },
  {
    name: "Remark",
    description: "Display typeface in Bold weight",
    variants: [
      {
        style: "Bold",
        weight: 700,
        woff2: "https://f.dimka.com/dimka-fonts/fonts/Remark/Remark%20Bold.woff2",
        woff: "https://f.dimka.com/dimka-fonts/fonts/Remark/Remark%20Bold.woff",
      },
    ],
  },
  {
    name: "Xarrovv",
    description: "Display typeface in Bold and Regular weights",
    variants: [
      {
        style: "Bold",
        weight: 700,
        woff2: "https://f.dimka.com/dimka-fonts/fonts/Xarrovv/Xarrovv-Bold.woff2",
        woff: "https://f.dimka.com/dimka-fonts/fonts/Xarrovv/Xarrovv-Bold.woff",
      },
      {
        style: "Regular",
        weight: 400,
        woff2: "https://f.dimka.com/dimka-fonts/fonts/Xarrovv/Xarrovv-Regular.woff2",
        woff: "https://f.dimka.com/dimka-fonts/fonts/Xarrovv/Xarrovv-Regular.woff",
      },
    ],
  },
];

export function findDimkaFont(familyName: string): DimkaFontFamily | undefined {
  const normalized = familyName.trim().toLowerCase();
  return DIMKA_FONTS.find((f) => f.name.toLowerCase() === normalized);
}
