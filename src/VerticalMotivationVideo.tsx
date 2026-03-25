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

  const opacity = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const translateY = interpolate(localFrame, [0, 12], [24, 0], {
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

const toFrame = (ms: number, fps: number) => Math.max(0, Math.round((ms / 1000) * fps));

const buildCaptionTimeline = ({
  lines,
  durationInFrames,
  fps,
  lineStartTimesMs,
}: {
  lines: string[];
  durationInFrames: number;
  fps: number;
  lineStartTimesMs?: number[];
}) => {
  const safeLines = lines.length > 0 ? lines : [''];

  if (!lineStartTimesMs || lineStartTimesMs.length !== safeLines.length) {
    const framesPerLine = Math.max(1, Math.floor(durationInFrames / safeLines.length));
    return safeLines.map((text, index) => ({
      text,
      startFrame: index * framesPerLine,
      durationInFrames:
        index === safeLines.length - 1
          ? durationInFrames - index * framesPerLine
          : framesPerLine,
    }));
  }

  return safeLines.map((text, index) => {
    const startFrame = toFrame(lineStartTimesMs[index], fps);
    const nextStartFrame =
      index < safeLines.length - 1 ? toFrame(lineStartTimesMs[index + 1], fps) : durationInFrames;

    return {
      text,
      startFrame,
      durationInFrames: Math.max(1, nextStartFrame - startFrame),
    };
  });
};

export const VerticalMotivationVideo: React.FC<RenderPayload> = ({
  background,
  voice,
  music,
  lines,
  lineStartTimesMs,
}) => {
  const {durationInFrames, fps} = useVideoConfig();
  const backgroundSource = toMediaSource(background);
  const captionTimeline = buildCaptionTimeline({
    lines,
    durationInFrames,
    fps,
    lineStartTimesMs,
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
            opacity: 0.5,
          }}
        />
      ) : (
        <Img
          src={backgroundSource}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.42,
          }}
        />
      )}

      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0, 0, 0, 0.38) 0%, rgba(0, 0, 0, 0.56) 100%)',
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
