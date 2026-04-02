import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {toMediaSource} from './media';
import type {RenderPayload} from './types';

const isVideoFile = (fileName: string) => /\.(mp4|mov|webm|m4v)$/i.test(fileName);

const CaptionLine: React.FC<{
  text: string;
  startFrame: number;
  durationInFrames: number;
}> = ({text, startFrame, durationInFrames}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;
  const fadeFrames = 8;

  const fadeOutStart = Math.max(fadeFrames, durationInFrames - fadeFrames);
  const opacity = interpolate(
    localFrame,
    [0, fadeFrames, fadeOutStart, durationInFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );

  const translateY = interpolate(localFrame, [0, fadeFrames], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <Sequence from={startFrame} durationInFrames={durationInFrames}>
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0 96px',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: 72,
            lineHeight: 1.15,
            fontFamily: 'System',
            fontWeight: 700,
            letterSpacing: -1.5,
            textAlign: 'center',
            textShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
            opacity,
            transform: `translateY(${translateY}px)`,
            maxWidth: 860,
          }}
        >
          {text}
        </div>
      </AbsoluteFill>
    </Sequence>
  );
};

const toFrame = (ms: number, fps: number) => Math.max(0, Math.floor((ms / 1000) * fps));

const normalizeLineStartTimesMs = ({
  lineStartTimesMs,
  lineStartTimesUnit,
  durationInFrames,
  fps,
}: {
  lineStartTimesMs: number[];
  lineStartTimesUnit?: 'ms' | 's';
  durationInFrames: number;
  fps: number;
}) => {
  if (lineStartTimesUnit === 's') {
    return lineStartTimesMs.map((value) => value * 1000);
  }

  if (lineStartTimesUnit === 'ms') {
    return lineStartTimesMs;
  }

  const maxValue = Math.max(...lineStartTimesMs);
  const durationInSeconds = durationInFrames / fps;

  if (maxValue <= durationInSeconds + 2) {
    return lineStartTimesMs.map((value) => value * 1000);
  }

  return lineStartTimesMs;
};

const buildCaptionTimeline = ({
  lines,
  durationInFrames,
  fps,
  lineStartTimesMs,
  lineDurationsMs,
  lineStartTimesUnit,
}: {
  lines: string[];
  durationInFrames: number;
  fps: number;
  lineStartTimesMs?: number[];
  lineDurationsMs?: number[];
  lineStartTimesUnit?: 'ms' | 's';
}) => {
  const safeLines = lines.length > 0 ? lines : [''];

  if (!lineStartTimesMs || lineStartTimesMs.length !== safeLines.length) {
    throw new Error('Subtitle timing is required. Provide lineStartTimesMs or transcript-derived timing.');
  }

  const normalizedStartTimesMs = normalizeLineStartTimesMs({
    lineStartTimesMs,
    lineStartTimesUnit,
    durationInFrames,
    fps,
  });

  return safeLines.map((text, index) => {
    const startFrame = toFrame(normalizedStartTimesMs[index], fps);
    const durationByProvidedMs =
      lineDurationsMs && lineDurationsMs.length === safeLines.length
        ? toFrame(lineDurationsMs[index], fps)
        : null;
    const nextStartFrame =
      index < safeLines.length - 1 ? toFrame(normalizedStartTimesMs[index + 1], fps) : durationInFrames;

    const cueDurationInFrames =
      durationByProvidedMs !== null
        ? Math.max(1, Math.min(durationByProvidedMs, nextStartFrame - startFrame))
        : Math.max(1, nextStartFrame - startFrame);

    return {
      text,
      startFrame,
      durationInFrames: cueDurationInFrames,
    };
  });
};

export const VerticalMotivationVideo: React.FC<RenderPayload> = ({
  background,
  voice,
  music,
  lines,
  lineStartTimesMs,
  lineDurationsMs,
  lineStartTimesUnit,
}) => {
  const {durationInFrames, fps} = useVideoConfig();
  const backgroundSource = toMediaSource(background);
  const captionTimeline = buildCaptionTimeline({
    lines,
    durationInFrames,
    fps,
    lineStartTimesMs,
    lineDurationsMs,
    lineStartTimesUnit,
  });

  return (
    <AbsoluteFill style={{backgroundColor: '#050505'}}>
      {isVideoFile(background) ? (
        <OffthreadVideo
          src={backgroundSource}
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.72,
          }}
        />
      ) : (
        <Img
          src={backgroundSource}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.62,
          }}
        />
      )}

      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0, 0, 0, 0.18) 0%, rgba(0, 0, 0, 0.34) 100%)',
        }}
      />

      {captionTimeline.map((cue, index) => (
        <CaptionLine
          key={`${index}-${cue.text}`}
          text={cue.text}
          startFrame={cue.startFrame}
          durationInFrames={cue.durationInFrames}
        />
      ))}

      <Audio src={toMediaSource(voice)} />
      <Audio src={toMediaSource(music)} volume={0.12} />
    </AbsoluteFill>
  );
};
