import {staticFile} from 'remotion';

const PUBLIC_PREFIX_REGEX = /^(\.\/|\/)?public\//i;
const LEADING_SLASHES_REGEX = /^\/+/;

export const normalizePublicAssetPath = (assetPath: string) => {
  if (/^(https?:)?\/\//i.test(assetPath)) {
    return assetPath;
  }

  const normalizedSeparators = assetPath.replaceAll('\\\\', '/').trim();
  const withoutPublicPrefix = normalizedSeparators.replace(PUBLIC_PREFIX_REGEX, '');

  return withoutPublicPrefix.replace(LEADING_SLASHES_REGEX, '');
};

export const toMediaSource = (assetPath: string) => {
  const normalizedPath = normalizePublicAssetPath(assetPath);

  if (/^(https?:)?\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  return staticFile(normalizedPath);
};
