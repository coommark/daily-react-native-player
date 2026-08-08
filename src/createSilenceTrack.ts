import type { Track } from './Track';
import { PlayerErrorCode, PlayerException } from './errors';

/** Maximum silence duration (5 minutes) — avoids multi-hour zero-filled WAVs on iOS. */
export const MAX_SILENCE_DURATION_MS = 300_000;

export type CreateSilenceTrackOptions = {
  /** Exact gap length in milliseconds (positive integer, max {@link MAX_SILENCE_DURATION_MS}). */
  durationMs: number;
  /** Optional stable identity; assigned on add if omitted. */
  id?: string;
};

const SILENCE_URL_RE = /^silence:(\d+)$/;

/**
 * True when the track is a first-class silence queue item (`type === 'silence'`).
 * Prefer this over URL string matching for host rate / skip policy (T8).
 */
export function isSilenceTrack(track: Track | null | undefined): boolean {
  return track?.type === 'silence';
}

function assertDurationMs(durationMs: unknown): number {
  if (
    typeof durationMs !== 'number' ||
    !Number.isFinite(durationMs) ||
    !Number.isInteger(durationMs) ||
    durationMs <= 0 ||
    durationMs > MAX_SILENCE_DURATION_MS
  ) {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      `durationMs must be an integer in (0, ${MAX_SILENCE_DURATION_MS}]`
    );
  }
  return durationMs;
}

/**
 * Build a canonical silence track for the speech queue.
 * Native materializes Android SilenceMediaSource / iOS cached PCM WAV on activate.
 */
export function createSilenceTrack(options: CreateSilenceTrackOptions): Track {
  if (!options || typeof options !== 'object') {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'createSilenceTrack requires { durationMs }'
    );
  }
  const durationMs = assertDurationMs(options.durationMs);
  if (options.id !== undefined && (typeof options.id !== 'string' || options.id.length === 0)) {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'id must be a non-empty string when provided'
    );
  }
  const track: Track = {
    type: 'silence',
    url: `silence:${durationMs}`,
    duration: durationMs / 1000,
  };
  if (typeof options.id === 'string') {
    track.id = options.id;
  }
  return track;
}

/**
 * Canonicalize a silence track for the native bridge.
 * Accepts helper output or already-canonical manual tracks only.
 */
export function canonicalizeSilence(track: Track): {
  durationMs: number;
  url: string;
  duration: number;
  id?: string;
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
} {
  const url = typeof track.url === 'string' ? track.url.trim() : '';
  const urlMatch = SILENCE_URL_RE.exec(url);
  const urlMs = urlMatch ? Number(urlMatch[1]) : null;

  const hasSilenceType = track.type === 'silence';
  const hasSilenceUrl = urlMs != null;

  if (!hasSilenceType && !hasSilenceUrl) {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'Silence track requires type: "silence" and url silence:<ms>'
    );
  }

  if (hasSilenceType !== hasSilenceUrl) {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'Silence track type and url must both be silence (type: "silence", url: "silence:<ms>")'
    );
  }

  if (url.toLowerCase().startsWith('http') || url.toLowerCase().startsWith('file:')) {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'type: "silence" cannot use a progressive media url'
    );
  }

  let durationMs = urlMs!;

  if (track.duration !== undefined) {
    if (
      typeof track.duration !== 'number' ||
      !Number.isFinite(track.duration) ||
      track.duration <= 0
    ) {
      throw new PlayerException(
        PlayerErrorCode.InvalidArgument,
        'Silence track duration must be a positive finite number (seconds)'
      );
    }
    const fromDuration = Math.round(track.duration * 1000);
    if (fromDuration !== durationMs) {
      throw new PlayerException(
        PlayerErrorCode.InvalidArgument,
        `Silence duration ${track.duration}s does not match url silence:${durationMs}`
      );
    }
  }

  durationMs = assertDurationMs(durationMs);

  if (track.id !== undefined && (typeof track.id !== 'string' || track.id.length === 0)) {
    throw new PlayerException(
      PlayerErrorCode.InvalidArgument,
      'id must be a non-empty string when provided'
    );
  }

  const result: {
    durationMs: number;
    url: string;
    duration: number;
    id?: string;
    title?: string;
    artist?: string;
    album?: string;
    artwork?: string;
  } = {
    durationMs,
    url: `silence:${durationMs}`,
    duration: durationMs / 1000,
  };
  if (typeof track.id === 'string') result.id = track.id;
  if (typeof track.title === 'string' && track.title.length > 0) result.title = track.title;
  if (typeof track.artist === 'string' && track.artist.length > 0) result.artist = track.artist;
  if (typeof track.album === 'string' && track.album.length > 0) result.album = track.album;
  if (typeof track.artwork === 'string' && track.artwork.length > 0) result.artwork = track.artwork;
  return result;
}
