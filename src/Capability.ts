/** Lock-screen / notification remote capabilities (Bible matrix). */
export const Capability = {
  Play: 'play',
  Pause: 'pause',
  Stop: 'stop',
  SkipToNext: 'skipToNext',
  SkipToPrevious: 'skipToPrevious',
} as const;

export type CapabilityValue = (typeof Capability)[keyof typeof Capability];

export const DEFAULT_CAPABILITIES: CapabilityValue[] = [
  Capability.Play,
  Capability.Pause,
  Capability.Stop,
  Capability.SkipToNext,
  Capability.SkipToPrevious,
];
