// A lightweight `@nutui/icons-react-taro` replacement used via bundler alias.
// NutUI (and our app) import icons via the package entry, but the upstream
// entry is marked as side-effectful which can pull in the entire icon set.
// Re-export only the icons we actually need via deep imports.

export { configure } from '@nutui/icons-react-taro/dist/es/icons/configure';

// App usage
export { default as ArrowLeft } from '@nutui/icons-react-taro/dist/es/icons/ArrowLeft';
export { default as ArrowRight } from '@nutui/icons-react-taro/dist/es/icons/ArrowRight';
export { default as Check } from '@nutui/icons-react-taro/dist/es/icons/Check';
export { default as Close } from '@nutui/icons-react-taro/dist/es/icons/Close';
export { default as Heart } from '@nutui/icons-react-taro/dist/es/icons/Heart';
export { default as HeartFill } from '@nutui/icons-react-taro/dist/es/icons/HeartFill';
export { default as Message } from '@nutui/icons-react-taro/dist/es/icons/Message';
export { default as Photograph } from '@nutui/icons-react-taro/dist/es/icons/Photograph';
export { default as Search } from '@nutui/icons-react-taro/dist/es/icons/Search';
export { default as Share2 } from '@nutui/icons-react-taro/dist/es/icons/Share2';

// NutUI internal usage (subset used by our chosen components)
export { default as Del } from '@nutui/icons-react-taro/dist/es/icons/Del';
export { default as Failure } from '@nutui/icons-react-taro/dist/es/icons/Failure';
export { default as Image } from '@nutui/icons-react-taro/dist/es/icons/Image';
export { default as ImageError } from '@nutui/icons-react-taro/dist/es/icons/ImageError';
export { default as JoySmile } from '@nutui/icons-react-taro/dist/es/icons/JoySmile';
export { default as Link } from '@nutui/icons-react-taro/dist/es/icons/Link';
export { default as Loading } from '@nutui/icons-react-taro/dist/es/icons/Loading';
export { default as Loading1 } from '@nutui/icons-react-taro/dist/es/icons/Loading1';
export { default as MaskClose } from '@nutui/icons-react-taro/dist/es/icons/MaskClose';
export { default as More } from '@nutui/icons-react-taro/dist/es/icons/More';
export { default as Success } from '@nutui/icons-react-taro/dist/es/icons/Success';
export { default as Tips } from '@nutui/icons-react-taro/dist/es/icons/Tips';
export { default as User } from '@nutui/icons-react-taro/dist/es/icons/User';
