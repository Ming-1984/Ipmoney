# 专利批量入库与收尾验收（2026-04-16）

## 1. 验收范围

- 批量解析并入库 `docs/patent/*.xlsx` 专利数据
- 上架到平台侧（平台身份）
- 咨询链路校验：前台发起咨询 -> 平台会话收件箱可见
- 回归本次修复：平台会话列表 `q` 过滤（UUID 场景）不再 500
- 关键端构建与线上服务可用性检查

## 2. 环境与时间

- 验收日期：2026-04-16（UTC+8）
- 生产主机：`8.134.124.134`
- 进程：`pm2` / `sunye-api`
- API 健康地址：`https://api.xn--m5rv27f.com/health`

## 3. 本地回归结果

### 3.1 API 测试

- `pnpm -C apps/api test -- conversations.filters.spec.ts` 通过（12/12）
- `pnpm -C apps/api test -- conversations.write-flow.spec.ts auth.service.spec.ts` 通过（32/32）

### 3.2 构建

- `pnpm -C apps/api build` 通过
- `pnpm -C apps/client build:weapp` 通过
- `pnpm -C apps/client build:h5` 通过
- `pnpm -C apps/admin-web build` 通过（需显式设置 `VITE_API_BASE_URL=https://api.xn--m5rv27f.com`）

## 4. 生产可用性验收（只读）

- `pm2 ls`：`sunye-api` 在线
- `curl http://127.0.0.1:3010/health`：`ok=true`
- `curl https://api.xn--m5rv27f.com/health`：`ok=true`
- `https://admin.xn--m5rv27f.com`：HTTP 200
- `https://xn--m5rv27f.com`：HTTP 200

## 5. 批量入库结果

- 输入文件数：21
- 输入记录数：3785
- 成功：3785
- 失败：0
- 新建 Listing：3604
- 更新 Listing：181
- 平台归属卖家：`13416224476`（userId=`0d8b9d4d-b039-4b98-a744-35a5ddff4549`）

## 6. 线上数据抽检（2026-04-16）

以平台用户 `13416224476` 作为卖家抽检：

- `sellerListingsTotal = 3604`
- `sellerPlatformActiveApproved = 3604`
- `sellerOpenLicense = 3604`
- `sellerFiveStar = 0`

说明：本批挂牌主题以 `OPEN_LICENSE` 为主，五星主题未出现异常漂移。

## 7. 咨询分流链路验收（核心）

在生产内网调用链路验证：

1. 买家侧调用 `POST /listings/{listingId}/conversations`
2. 返回状态 `201`，拿到 `conversationId`
3. 管理端查询 `GET /admin/conversations/platform?channel=CONSULTATION&q={conversationId}`
4. 返回 `200`，且命中该会话（`platformInboxQueryFound=true`）
5. 无 `q` 列表查询同样 `200`

本次实测结果：

- `createStatus = 201`
- `conversationId = 045f4fc7-f45d-48c2-b84a-3b7ded9cd96c`
- `platformInboxQueryStatus = 200`
- `platformInboxQueryFound = true`
- `platformInboxNoQStatus = 200`

结论：咨询链路已正确进入平台收件箱，满足“用户咨询导到管理后台”的目标。

## 8. 结论

本次“批量解析 + 打标签 + 上架 + 分流到平台收件箱 + 修复回归”已完成并通过收尾验收，可进入持续运营阶段。

