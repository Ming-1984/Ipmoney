import React from 'react';

export function VideoPlayer(props: any) {
  const { autoplay, objectFit, style, ...videoProps } = props;
  return <video {...videoProps} autoPlay={autoplay} playsInline style={{ ...style, objectFit }} />;
}
