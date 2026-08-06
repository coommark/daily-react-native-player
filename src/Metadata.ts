/** Now-playing / track metadata fields. */
export type NowPlayingMetadata = {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
  /** Forced duration override in seconds (optional). */
  duration?: number;
};

export type TrackMetadataPayload = {
  url: string;
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
};

/**
 * Build native add() payload. Url-only tracks remain valid.
 * When autoUpdateMetadata is false, still send url; omit empty metadata fields.
 */
export function trackToNativePayload(
  url: string,
  meta: {
    title?: string;
    artist?: string;
    album?: string;
    artwork?: string;
  },
  autoUpdateMetadata: boolean
): TrackMetadataPayload {
  const payload: TrackMetadataPayload = { url };
  if (!autoUpdateMetadata) {
    return payload;
  }
  if (typeof meta.title === 'string' && meta.title.length > 0) {
    payload.title = meta.title;
  }
  if (typeof meta.artist === 'string' && meta.artist.length > 0) {
    payload.artist = meta.artist;
  }
  if (typeof meta.album === 'string' && meta.album.length > 0) {
    payload.album = meta.album;
  }
  if (typeof meta.artwork === 'string' && meta.artwork.length > 0) {
    payload.artwork = meta.artwork;
  }
  return payload;
}

/**
 * Merge forced now-playing override onto existing forced state.
 * Empty string clears a field; undefined leaves it unchanged.
 */
export function mergeForcedMetadata(
  base: NowPlayingMetadata,
  partial: NowPlayingMetadata
): NowPlayingMetadata {
  const next: NowPlayingMetadata = { ...base };
  for (const key of ['title', 'artist', 'album', 'artwork'] as const) {
    if (partial[key] !== undefined) {
      const value = partial[key];
      if (value === '') {
        delete next[key];
      } else {
        next[key] = value;
      }
    }
  }
  if (partial.duration !== undefined) {
    if (
      typeof partial.duration === 'number' &&
      Number.isFinite(partial.duration) &&
      partial.duration >= 0
    ) {
      next.duration = partial.duration;
    }
  }
  return next;
}

/** Resolve display metadata: forced wins over track fields when auto. */
export function resolveDisplayMetadata(
  track: NowPlayingMetadata | null,
  forced: NowPlayingMetadata | null,
  autoUpdateMetadata: boolean
): NowPlayingMetadata {
  if (forced && Object.keys(forced).length > 0) {
    const fromTrack = autoUpdateMetadata && track ? track : {};
    return { ...fromTrack, ...forced };
  }
  if (autoUpdateMetadata && track) {
    return { ...track };
  }
  return {};
}
