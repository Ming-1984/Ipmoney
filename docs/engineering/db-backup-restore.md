# 数据库备份与回滚（Dev/Staging/Prod）

> 目的：为上线迁移提供可执行的“备份 + 回滚”路径。对于包含 enum 变更/唯一索引的迁移，生产回滚通常依赖备份恢复，而非 SQL 逆向回退。

## 1. Dev（docker compose）

### 1.1 备份

```powershell
# 备份到 .tmp/（推荐）
powershell -ExecutionPolicy Bypass -File scripts/db-backup.ps1 -Clean

# 或指定输出文件
powershell -ExecutionPolicy Bypass -File scripts/db-backup.ps1 -Clean -OutFile .tmp/db-backup.sql
```

> 注：`.tmp/` 为临时输出目录，清理后可能不存在。

### 1.2 恢复（危险操作）

```powershell
powershell -ExecutionPolicy Bypass -File scripts/db-restore.ps1 -Force -InFile .tmp/db-backup.sql
```

说明：

- `-Clean` 会在 dump 中包含 `DROP ... IF EXISTS`，便于恢复覆盖。
- 恢复会覆盖当前库数据，请确保是 dev 环境或已确认可覆盖。

## 2. Staging / Prod（最佳实践）

- **优先**使用云厂商/托管数据库的快照（snapshot）能力：创建快照 → 演练恢复 → 上线窗口前再创建一次快照。
- 若使用 `pg_dump`：
  - 备份文件需加密、带校验（hash）并存储到可靠介质（对象存储/备份盘）。
  - 必须做一次“可恢复性演练”（restore drill），否则备份没有意义。
- 对不可逆迁移（如 `ALTER TYPE ... ADD VALUE`）：
  - 回滚策略以“恢复快照/备份”作为主路径；
  - 不建议尝试手工逆向修改 enum/索引来回退，风险极高且不可预测。

## 3. 与迁移联动的固定动作

上线窗口建议固定顺序：

1) DB 预检（唯一索引冲突/一致性）：见 `docs/engineering/db-preflight-check.md`  
2) 备份/快照  
3) `prisma migrate deploy`（推荐：`pnpm -C apps/api db:deploy`）  
4) 冒烟（API + 关键管理读写接口）
