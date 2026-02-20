/**
 * Shared Content Types
 * 
 * TypeScript interfaces for content data structures used throughout the site package.
 * These mirror the types in @artsitemaker/admin yaml-manager.ts for consistency.
 */

// ============================================================================
// Artwork Types
// ============================================================================

/** Additional image attached to an artwork */
export interface AdditionalImage {
  file: string;
  type?: string;
  title?: string;
  caption?: string;
}

/** Image processing metadata */
export interface ProcessingData {
  originalFile: string;
  originalDimensions: [number, number];
  processedAt: string;
  warnings: string[];
  aspectRatio: number;
  padded: boolean;
}

/** Artwork data structure */
export interface ArtworkData {
  slug: string;
  title: string;
  year?: number;
  medium?: string;
  dimensions?: string;
  description?: string;
  collection?: string;
  tags: string[];
  sortOrder: number;
  sold: boolean;
  price: number | null;
  currency: string;
  inquireOnly: boolean;
  primary: string;
  additional: AdditionalImage[];
  processing?: ProcessingData;
  createdAt: string;
  updatedAt: string;
  published: boolean;
}

// ============================================================================
// Settings Types
// ============================================================================

/** Site configuration */
export interface SiteConfig {
  title: string;
  tagline?: string;
  url?: string;
  imageBaseUrl?: string;
  language?: string;
}

/** SEO configuration */
export interface SeoConfig {
  description?: string;
  keywords?: string[];
  ogImage?: string;
}

/** Home page configuration */
export interface HomeConfig {
  galleryClick?: 'slideshow' | 'detail';
}

/** Navigation item */
export interface NavItem {
  label: string;
  href: string;
  external?: boolean;
}

/** Navigation configuration */
export interface NavConfig {
  items?: NavItem[];
  showLogo?: boolean;
}

/** Pages configuration */
export interface PagesConfig {
  enabled?: Record<string, boolean>;
  homePage?: string;
}

/** Main settings data structure */
export interface SettingsData {
  site: SiteConfig;
  seo?: SeoConfig;
  theme?: string;
  home?: HomeConfig;
  footer?: FooterData;
  nav?: NavConfig;
  pages?: PagesConfig;
  contact?: {
    email?: string;
  };
}

// ============================================================================
// Page Types
// ============================================================================

/** Static page data (about, contact, etc.) */
export interface PageData {
  slug: string;
  title: string;
  content?: string;
  published?: boolean;
  featuredArtwork?: string;  // Slug of artwork to display as featured image
  featuredImage?: string;    // Storage-relative path (e.g., "originals/selfie.jpg")
}

/** Footer configuration */
export interface FooterData {
  showLogo?: boolean;
  story?: string;
  artistName?: string;
  contactEmail?: string;
  websiteUrl?: string;
  websiteLabel?: string;
  portfolioUrl?: string;
  portfolioLabel?: string;
  copyrightStart?: number;
  copyrightName?: string;
  showCredits?: boolean;
  allRightsReserved?: boolean;
  /** When true, show "Powered by ArtSiteMaker" link in the copyright bar */
  poweredByArtSiteMaker?: boolean;
}
