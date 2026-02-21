# 数据库预检（Preflight Checks）

> 目的：上线/迁移前先做一轮“数据体检”，避免唯一索引冲突、孤儿数据、金额异常导致迁移失败或线上隐患。

## 1. 如何执行

### 1.1 使用 docker compose（本仓库默认）

```powershell
# 进入仓库根目录后执行
docker compose exec -T postgres psql -U ipmoney -d ipmoney -f -
```

然后把下方 SQL 粘贴进去（或用 heredoc/文件方式喂给 stdin）。

### 1.2 使用任意 Postgres 客户端

只要连接到目标库，执行下方 SQL 即可。

### 1.3 一键脚本（推荐）

```powershell
powershell -ExecutionPolicy Bypass -File scripts/db-preflight-check.ps1 -ReportDate 2026-02-16
```

产物：

- `.tmp/db-preflight-2026-02-16.json`
- `.tmp/db-preflight-2026-02-16-summary.json`
  
> 注：`.tmp/` 为临时输出目录，清理后可能不存在。

## 2. 迁移风险预检（唯一索引冲突）

> 对应迁移：`apps/api/prisma/migrations/20260216190000_schema_alignment/migration.sql`

```sql
-- patent_identifiers: id_value_norm 必须唯一（否则 UNIQUE INDEX 创建会失败）
select id_value_norm, count(*) as cnt
from patent_identifiers
group by id_value_norm
having count(*) > 1;

-- patents: (jurisdiction, application_no_norm) 必须唯一（否则 UNIQUE INDEX 创建会失败）
select jurisdiction, application_no_norm, count(*) as cnt
from patents
group by jurisdiction, application_no_norm
having count(*) > 1;
```

期望：无返回行（0 行）。

## 3. 数据一致性预检（订单/支付/退款/结算/发票）

```sql
-- 金额不应为负数（订单）
select count(*) as orders_negative_amount
from orders
where coalesce(deal_amount, 0) < 0
   or deposit_amount < 0
   or coalesce(final_amount, 0) < 0
   or coalesce(commission_amount, 0) < 0;

-- 孤儿数据：退款单必须能关联到订单
select count(*) as refund_orphan_order
from refund_requests rr
left join orders o on rr.order_id = o.id
where o.id is null;

-- 孤儿数据：支付记录必须能关联到订单
select count(*) as payment_orphan_order
from payments p
left join orders o on p.order_id = o.id
where o.id is null;

-- 孤儿数据：结算记录必须能关联到订单
select count(*) as settlement_orphan_order
from settlements s
left join orders o on s.order_id = o.id
where o.id is null;

-- 放款成功但缺少凭证文件（手工放款口径）
select count(*) as settlement_succeeded_without_evidence
from settlements
where payout_status = 'SUCCEEDED'
  and payout_evidence_file_id is null;

-- 发票号码存在但缺少发票文件（口径：发票文件是强约束）
select count(*) as invoice_without_file
from orders
where invoice_no is not null
  and invoice_file_id is null;

-- 回调事件：如果写了 order_id，则必须能关联到订单（否则对账/收敛会出现脏数据）
select count(*) as webhook_orphan_order
from payment_webhook_events e
left join orders o on e.order_id = o.id
where e.order_id is not null
  and o.id is null;
```

期望：以上计数均为 0。

## 4. 索引与查询路径抽检（可选）

```sql
-- 查看关键表索引是否存在（仅做存在性抽检）
select tablename, indexname
from pg_indexes
where schemaname = 'public'
  and tablename in ('orders','listings','patents','refund_requests','settlements','content_events')
order by tablename, indexname;
```

> 说明：索引存在不代表“线上性能没问题”。上线前仍需要开启 `pg_stat_statements` + 压测/回放来做慢查询审计。

### 4.1 EXPLAIN 基线抽检（Dev）

```sql
EXPLAIN SELECT * FROM orders WHERE status='PENDING' ORDER BY created_at DESC LIMIT 20;
EXPLAIN SELECT * FROM listings WHERE status='ACTIVE' AND audit_status='APPROVED' ORDER BY created_at DESC LIMIT 20;
EXPLAIN SELECT * FROM refund_requests WHERE order_id='00000000-0000-0000-0000-000000000000'::uuid ORDER BY created_at DESC LIMIT 20;
EXPLAIN SELECT * FROM patents WHERE jurisdiction='CN' AND application_no_norm='CN0000000000';
```

2026-02-16 dev 结果（摘要）：

- `orders_status_created_at_idx` 命中（Bitmap Index Scan）
- `listings_status_audit_status_created_at_idx` 命中（Index Scan Backward）
- `refund_requests_order_id_status_idx` 命中（Bitmap Index Scan）
- `patents_jurisdiction_application_no_norm_key` 命中（Index Scan）
