import type { components } from '@ipmoney/api-types';

import { apiPost } from './api';

type FileTemporaryAccessRequest = components['schemas']['FileTemporaryAccessRequest'];
type FileTemporaryAccessResponse = components['schemas']['FileTemporaryAccessResponse'];

export async function createFileTemporaryAccess(
  fileId: string,
  payload?: FileTemporaryAccessRequest,
): Promise<FileTemporaryAccessResponse> {
  return await apiPost<FileTemporaryAccessResponse>(`/files/${fileId}/temporary-access`, payload ?? {});
}
