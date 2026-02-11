import path from 'path';

export const ALLOWED_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.tiff',
  '.tif',
  '.heic',
  '.heif',
  '.webp',
] as const;

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/heic',
  'image/heif',
  'image/webp',
] as const;

export const ALLOWED_IDENTITY_IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
] as const;

export const ALLOWED_IDENTITY_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
] as const;

export const ALLOWED_TEXTURE_IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
] as const;

export const ALLOWED_TEXTURE_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
] as const;

export function isAllowedImageExtension(
  filename: string,
  allowedExtensions: readonly string[] = ALLOWED_IMAGE_EXTENSIONS,
): boolean {
  const ext = filename.startsWith('.')
    ? filename.toLowerCase()
    : path.extname(filename).toLowerCase();
  return allowedExtensions.includes(ext);
}
