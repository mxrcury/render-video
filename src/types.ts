export type RenderPayload = {
  background: string;
  voice: string;
  music: string;
  lines: string[];
  lineStartTimesMs?: number[];
  lineStartTimesUnit?: 'ms' | 's';
};
