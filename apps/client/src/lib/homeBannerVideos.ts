import bannerLocal1Mp4 from '../assets/home/banner-local-1.mp4';
import bannerLocal2Mp4 from '../assets/home/banner-local-2.mp4';
import bannerCover1 from '../assets/home/hero-benefit.png';
import bannerCover2 from '../assets/home/promo-free-publish.jpg';

export type HomeBannerVideo = {
  id: string;
  title: string;
  asset: string;
  fileName: string;
  cover: string;
};

export const homeBannerVideos: HomeBannerVideo[] = [
  {
    id: 'banner-local-1',
    title: 'Local Banner 1',
    asset: bannerLocal1Mp4,
    fileName: 'banner-local-1.mp4',
    cover: bannerCover1,
  },
  {
    id: 'banner-local-2',
    title: 'Local Banner 2',
    asset: bannerLocal2Mp4,
    fileName: 'banner-local-2.mp4',
    cover: bannerCover2,
  },
];
