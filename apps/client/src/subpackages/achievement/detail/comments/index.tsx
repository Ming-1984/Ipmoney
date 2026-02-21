import React from 'react';

import './index.scss';

import { CommentsSection } from '../../../../ui/CommentsSection';

export default function AchievementComments(props: { contentId: string }) {
  return <CommentsSection contentType="ACHIEVEMENT" contentId={props.contentId} />;
}

