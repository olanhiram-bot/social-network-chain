import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const uploadDir = join(process.cwd(), 'apps/api/uploads');
mkdirSync(uploadDir, { recursive: true });

export function publicMediaUrl(filename: string) {
  return `/media/${filename}`;
}

export function localMediaPath(filename: string) {
  return join(uploadDir, filename);
}

export async function storeMedia(filename: string, buffer: Buffer, contentType: string) {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;

  if (!supabaseUrl || !serviceRoleKey || !bucket) {
    await writeFile(localMediaPath(filename), buffer);
    return publicMediaUrl(filename);
  }

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${filename}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': contentType,
      'x-upsert': 'true',
    },
    body: new Blob([new Uint8Array(buffer)], { type: contentType }),
  });

  if (!response.ok) {
    throw new Error(`Supabase storage upload failed: ${response.status}`);
  }

  return publicMediaUrl(filename);
}

export function remoteMediaUrl(filename: string) {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!supabaseUrl || !bucket) {
    return null;
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${filename}`;
}
