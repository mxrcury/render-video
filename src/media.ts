import {staticFile} from 'remotion';

const PUBLIC_PREFIX_REGEX = /^(\.\/)?public\//i;

export const normalizePublicAssetPath = (assetPath: string) => {
  if (/^(https?:)?\/\//i.test(assetPath) || assetPath.startsWith('/')) {
    return assetPath;
  }

  return assetPath.replace(PUBLIC_PREFIX_REGEX, '');
};

export const toMediaSource = (assetPath: string) => {
  const normalizedPath = normalizePublicAssetPath(assetPath);

  if (/^(https?:)?\/\//i.test(normalizedPath) || normalizedPath.startsWith('/')) {
    return normalizedPath;
  }

  return staticFile(normalizedPath);
};
