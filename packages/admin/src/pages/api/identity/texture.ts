import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { getUserAssetsPath } from '../../../lib/paths';
import {
  ALLOWED_TEXTURE_IMAGE_EXTENSIONS,
  ALLOWED_TEXTURE_IMAGE_MIME_TYPES,
  isAllowedImageExtension,
} from '../../../lib/image-constants';

const MAX_TEXTURE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXTURE_DIMENSION = 2400; // Max width/height

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * GET /api/identity/texture - List available texture files
 */
export const GET: APIRoute = async () => {
  try {
    const assetsPath = getUserAssetsPath();
    const texturesPath = path.join(assetsPath, 'textures');

    // Ensure textures directory exists
    await fs.mkdir(texturesPath, { recursive: true });

    // List files in textures directory
    const files = await fs.readdir(texturesPath);
    const textures: { filename: string; path: string; url: string }[] = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (isAllowedImageExtension(ext, ALLOWED_TEXTURE_IMAGE_EXTENSIONS)) {
        const relativePath = `textures/${file}`;
        textures.push({
          filename: file,
          path: relativePath,
          url: `/user-assets/${relativePath}`
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      textures: textures.sort((a, b) => a.filename.localeCompare(b.filename))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to list textures:', error);
    return new Response(JSON.stringify({
      error: 'Failed to list textures: ' + (error as Error).message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const temporary = formData.get('temporary') === 'true'; // Check if this is a temp upload

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate file type
    if (!ALLOWED_TEXTURE_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_TEXTURE_IMAGE_MIME_TYPES)[number])) {
      return new Response(JSON.stringify({ error: 'Invalid file type. Use PNG, JPG, or WebP.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate file size
    if (file.size > MAX_TEXTURE_SIZE) {
      return new Response(JSON.stringify({ error: 'File too large. Maximum size is 10MB.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get user assets path and ensure directory exists
    const assetsPath = getUserAssetsPath();
    const targetDir = temporary ? '.temp/textures' : 'textures';
    const texturesDir = path.join(assetsPath, targetDir);
    await fs.mkdir(texturesDir, { recursive: true });

    // Sanitize filename
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const timestamp = Date.now();
    const filename = `${baseName}-${timestamp}${ext}`;
    const relativePath = `${targetDir}/${filename}`;

    if (!isAllowedImageExtension(ext, ALLOWED_TEXTURE_IMAGE_EXTENSIONS)) {
      return new Response(JSON.stringify({ error: `Invalid file extension: ${ext}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const targetPath = () => path.join(texturesDir, filename);

    // Process and write file
    const buffer = Buffer.from(await file.arrayBuffer());
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Resize if dimensions exceed max
    let needsResize = false;
    if (metadata.width && metadata.width > MAX_TEXTURE_DIMENSION) {
      needsResize = true;
    }
    if (metadata.height && metadata.height > MAX_TEXTURE_DIMENSION) {
      needsResize = true;
    }

    if (needsResize) {
      image.resize(MAX_TEXTURE_DIMENSION, MAX_TEXTURE_DIMENSION, {
        withoutEnlargement: true,
        fit: 'inside'
      });
    }

    // Convert to appropriate format and optimize
    if (ext === '.png') {
      await image.png({ quality: 90, compressionLevel: 9 }).toFile(targetPath());
    } else if (ext === '.webp') {
      await image.webp({ quality: 85 }).toFile(targetPath());
    } else {
      // JPEG
      await image.jpeg({ quality: 85 }).toFile(targetPath());
    }

    return new Response(JSON.stringify({
      success: true,
      path: relativePath,
      filename: filename,
      url: `/user-assets/${relativePath}`,
      isTemporary: temporary
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Texture upload failed:', error);
    return new Response(JSON.stringify({
      error: 'Upload failed: ' + (error as Error).message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Move temp file to permanent location (commit)
export const PUT: APIRoute = async ({ request }) => {
  try {
    const { tempPath } = await request.json();

    if (!tempPath) {
      return new Response(JSON.stringify({ error: 'No temp path provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate path is within temp textures directory
    if (!tempPath.startsWith('.temp/textures/')) {
      return new Response(JSON.stringify({ error: 'Invalid temp path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const assetsPath = getUserAssetsPath();
    const tempFilePath = path.join(assetsPath, tempPath);

    // Check if temp file exists
    if (!await fileExists(tempFilePath)) {
      return new Response(JSON.stringify({ error: 'Temp file not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create permanent path
    const filename = path.basename(tempPath);
    const permanentPath = `textures/${filename}`;
    const permanentFilePath = path.join(assetsPath, permanentPath);

    // Ensure permanent directory exists
    await fs.mkdir(path.dirname(permanentFilePath), { recursive: true });

    // Move file from temp to permanent
    await fs.rename(tempFilePath, permanentFilePath);

    return new Response(JSON.stringify({
      success: true,
      path: permanentPath,
      url: `/user-assets/${permanentPath}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Texture commit failed:', error);
    return new Response(JSON.stringify({
      error: 'Commit failed: ' + (error as Error).message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const { path: texturePath } = await request.json();

    if (!texturePath) {
      return new Response(JSON.stringify({ error: 'No texture path provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate path is within textures or temp textures directory
    const isTemp = texturePath.startsWith('.temp/textures/');
    const isPermanent = texturePath.startsWith('textures/');

    if (!isTemp && !isPermanent) {
      return new Response(JSON.stringify({ error: 'Invalid texture path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get user assets path
    const assetsPath = getUserAssetsPath();
    const filePath = path.join(assetsPath, texturePath);

    // Check if file exists and delete it
    if (await fileExists(filePath)) {
      await fs.unlink(filePath);

      return new Response(JSON.stringify({
        success: true,
        message: 'Texture deleted successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Texture file not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Texture deletion failed:', error);
    return new Response(JSON.stringify({
      error: 'Deletion failed: ' + (error as Error).message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
