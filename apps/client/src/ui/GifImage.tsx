import React from 'react';
import { Image } from '@tarojs/components';

type GifImageProps = React.ComponentProps<typeof Image>;

const GifImage = React.memo((props: GifImageProps) => <Image {...props} />);

GifImage.displayName = 'GifImage';

export default GifImage;
