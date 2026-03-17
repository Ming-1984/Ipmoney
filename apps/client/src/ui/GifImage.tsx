import React, { useEffect, useMemo, useState } from 'react';
import { Image } from '@tarojs/components';

type GifImageProps = React.ComponentProps<typeof Image> & {
  fallbackSrc?: string;
  deferOnWeapp?: boolean;
  deferMs?: number;
};

const GifImage = React.memo((props: GifImageProps) => {
  const { src, fallbackSrc, deferOnWeapp = false, deferMs = 80, ...rest } = props;
  const normalizedSrc = typeof src === 'string' ? src : '';
  const normalizedFallback = typeof fallbackSrc === 'string' ? fallbackSrc : normalizedSrc;
  const shouldDefer = useMemo(() => {
    if (process.env.TARO_ENV !== 'weapp') return false;
    if (!deferOnWeapp) return false;
    if (!normalizedSrc || !normalizedFallback) return false;
    return normalizedSrc.toLowerCase().endsWith('.gif');
  }, [deferOnWeapp, normalizedFallback, normalizedSrc]);

  const [currentSrc, setCurrentSrc] = useState<string>(shouldDefer ? normalizedFallback : normalizedSrc);

  useEffect(() => {
    if (!shouldDefer) {
      setCurrentSrc(normalizedSrc);
      return;
    }
    setCurrentSrc(normalizedFallback);
    const timer = setTimeout(() => setCurrentSrc(normalizedSrc), Math.max(0, deferMs));
    return () => clearTimeout(timer);
  }, [deferMs, normalizedFallback, normalizedSrc, shouldDefer]);

  return <Image {...rest} src={currentSrc} />;
});

GifImage.displayName = 'GifImage';

export default GifImage;
