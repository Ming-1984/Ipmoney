import assert from 'node:assert/strict';

// @ts-expect-error Node's strip-types runner requires the explicit extension.
import { buildSharePayload, DEFAULT_SHARE_PATH, DEFAULT_SHARE_TITLE } from './wechatSharePayload.ts';

const patentId = '123e4567-e89b-12d3-a456-426614174000';

assert.deepEqual(buildSharePayload(), {
  title: DEFAULT_SHARE_TITLE,
  path: DEFAULT_SHARE_PATH,
  imageUrl: undefined,
});

assert.equal(
  buildSharePayload({ title: '  标题\n带换行  ', visibility: 'private', path: '/subpackages/orders/index?orderId=secret' }).path,
  DEFAULT_SHARE_PATH,
);
assert.equal(buildSharePayload({ title: '一'.repeat(40) }).title.length, 30);

assert.equal(
  buildSharePayload({
    visibility: 'public',
    path: `/subpackages/patent/detail/index?patentId=${patentId}`,
    imageUrl: 'https://cdn.ipmoney.cn/covers/patent.png',
  }).path,
  `/subpackages/patent/detail/index?patentId=${patentId}`,
);
assert.equal(
  buildSharePayload({ visibility: 'public', path: `/subpackages/patent/detail/index?patentId=${patentId}&token=secret` }).path,
  DEFAULT_SHARE_PATH,
);
assert.equal(buildSharePayload({ visibility: 'public', path: '/subpackages/patent/detail/index?patentId=invalid' }).path, DEFAULT_SHARE_PATH);
assert.equal(buildSharePayload({ imageUrl: 'http://localhost:3000/cover.png' }).imageUrl, undefined);
assert.equal(buildSharePayload({ imageUrl: 'https://cdn.ipmoney.cn/cover.png' }).imageUrl, 'https://cdn.ipmoney.cn/cover.png');

console.log('[wechatShare.test] all assertions passed');
