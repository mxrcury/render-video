export type RenderPayload = {
  background: string;
  voice: string;
  music: string;
  lines: string[];
  lineStartTimesMs?: number[];
  lineDurationsMs?: number[];
  lineStartTimesUnit?: 'ms' | 's';
  voiceTranscript?: string;
};
