import { PlayerErrorCode, PlayerException } from './errors';

/**
 * Normalize and validate a track URL before sending to native.
 * Bundled assets must be resolved via resolveAssetSource before calling this.
 */
export function normalizeTrackUrl(url: unknown): string {
  if (typeof url !== 'string') {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'Track url must be a non-empty string (resolve bundled assets with resolveAssetSource first)'
    );
  }

  const trimmed = url.trim();
  if (!trimmed) {
    throw new PlayerException(PlayerErrorCode.InvalidArgument, 'Track url must not be empty');
  }

  // Relative paths are rejected — hosts must pass absolute file/https/content URIs.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    throw new PlayerException(
      PlayerErrorCode.UnsupportedUrl,
      `Unsupported or relative url: ${trimmed}`
    );
  }

  const scheme = trimmed.slice(0, trimmed.indexOf(':')).toLowerCase();

  switch (scheme) {
    case 'https':
    case 'http':
    case 'file':
    case 'content':
      return trimmed;
    default:
      throw new PlayerException(
        PlayerErrorCode.UnsupportedUrl,
        `Unsupported url scheme "${scheme}". Allowed: https, http, file, content (Android)`
      );
  }
}
