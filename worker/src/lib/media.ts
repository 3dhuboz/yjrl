import type { Env } from '../types';

export const MEDIA_PROCESSING_VERSION = 'webp-v1';
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function reviewedMediaUrl(requestUrl: string, key: string) {
  return `${new URL(requestUrl).origin}/api/media?key=${encodeURIComponent(key)}`;
}

export function playerIdsFrom(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 60 || value.some(id => typeof id !== 'string' || !id.trim() || id.length > 100)) return null;
  return [...new Set(value.map(id => id.trim()))];
}

export async function mediaPlayerIds(env: Env, key: string): Promise<string[]> {
  const row = await env.DB.prepare('SELECT player_ids FROM upload_records WHERE key = ?').bind(key).first<{ player_ids: string }>();
  const ids = row && playerIdsFrom(JSON.parse(row.player_ids));
  if (!ids) throw new Error('Invalid image player list');
  return ids;
}

export async function allPlayersConsent(env: Env, ids: string[]) {
  if (!ids.length) return false;
  const count = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM players p JOIN player_consents pc ON pc.player_id = p.id
     WHERE p.is_active = 1 AND pc.media_consent = 1 AND p.id IN (${ids.map(() => '?').join(',')})`
  ).bind(...ids).first<{ n: number }>();
  return count?.n === ids.length;
}

export async function isPublicMedia(env: Env, record: Record<string, unknown>) {
  if (record.status !== 'approved' || record.processing_version !== MEDIA_PROCESSING_VERSION
      || !record.reviewed_by_user_id || !record.sha256 || record.reviewed_sha256 !== record.sha256) return false;
  const ids = await mediaPlayerIds(env, String(record.key));
  if (record.contains_children === 1) return allPlayersConsent(env, ids);
  return record.contains_children === 0 && !record.player_id && ids.length === 0;
}

// Accept only a stored reviewed reference. Never reflect arbitrary external URLs.
export async function approvedMediaUrl(env: Env, requestUrl: string, value: unknown) {
  if (!value || typeof value !== 'string') return '';
  const record = await env.DB.prepare('SELECT * FROM upload_records WHERE key = ? OR url = ?').bind(value, value).first();
  return record && await isPublicMedia(env, record) ? reviewedMediaUrl(requestUrl, String(record.key)) : '';
}

// The provider decodes the image and applies orientation before encoding WebP.
// WebP output discards metadata: https://developers.cloudflare.com/images/optimization/features/#metadata
export async function processImage(env: Env, file: File) {
  if (!env.IMAGES) throw new Error('Image processing unavailable');
  const info = await env.IMAGES.info(file.stream());
  if (!IMAGE_TYPES.includes(info.format) || info.format !== file.type || !('width' in info)
      || !Number.isInteger(info.width) || !Number.isInteger(info.height)
      || info.width < 1 || info.height < 1 || info.width * info.height > 40_000_000) throw new Error('Unsupported image');
  const result = await env.IMAGES.input(file.stream())
    .transform({ width: 1600, height: 1600, fit: 'scale-down' })
    .output({ format: 'image/webp', quality: 85, anim: false });
  const response = result.response();
  if (!response.ok || response.headers.get('Content-Type') !== 'image/webp') throw new Error('Invalid processed image');
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength || buffer.byteLength > MAX_IMAGE_SIZE || !isMetadataFreeWebp(new Uint8Array(buffer))) throw new Error('Invalid processed image');
  return buffer;
}

// Reject metadata/animation chunks or malformed provider output before storage.
export function isMetadataFreeWebp(bytes: Uint8Array) {
  const tag = (i: number) => String.fromCharCode(...bytes.subarray(i, i + 4));
  if (bytes.length < 20 || tag(0) !== 'RIFF' || tag(8) !== 'WEBP') return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length) return false;
  let offset = 12, images = 0;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) return false;
    const kind = tag(offset), size = view.getUint32(offset + 4, true);
    if (!['VP8 ', 'VP8L', 'VP8X', 'ALPH'].includes(kind) || size === 0) return false;
    if (kind === 'VP8 ' || kind === 'VP8L') images++;
    offset += 8 + size + (size % 2);
    if (offset > bytes.length) return false;
  }
  return images === 1 && offset === bytes.length;
}
