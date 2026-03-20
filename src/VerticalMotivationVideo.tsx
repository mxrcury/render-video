import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  staticFile,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {RenderPayload} from './types';

const isVideoFile = (fileName: string) => /\.(mp4|mov|webm|m4v)$/i.test(fileName);

const resolveMediaSource = (filePath: string) => {
  if (/^(https?:)?\/\//i.test(filePath) || filePath.startsWith('/')) {
    return filePath;
  }

  return staticFile(filePath);
};

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

export const VerticalMotivationVideo: React.FC<RenderPayload> = ({
  background,
  voice,
  music,
  lines,
}) => {
  const {durationInFrames} = useVideoConfig();
  const safeLines = lines.length > 0 ? lines : [''];
  const framesPerLine = Math.max(1, Math.floor(durationInFrames / safeLines.length));
  const backgroundSource = resolveMediaSource(background);

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
            opacity: 0.34,
          }}
        />
      ) : (
        <Img
          src={backgroundSource}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.22,
          }}
        />
      )}

      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0, 0, 0, 0.68) 0%, rgba(0, 0, 0, 0.76) 100%)',
        }}
      />

      {safeLines.map((line, index) => (
        <CaptionLine
          key={`${index}-${line}`}
          text={line}
          startFrame={index * framesPerLine}
          durationInFrames={
            index === safeLines.length - 1
              ? durationInFrames - index * framesPerLine
              : framesPerLine
          }
        />
      ))}

      <Audio src={resolveMediaSource(voice)} />
      <Audio src={resolveMediaSource(music)} volume={0.12} />
    </AbsoluteFill>
  );
};
