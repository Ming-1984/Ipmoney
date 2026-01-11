# Fixtures（演示/回归复用）

> 目标：同一套数据同时用于开发调试 / 冒烟回归 / 甲方演示截图。

目录约定（先占位，后续逐步补齐）：

```
packages/fixtures/
  scenarios/
    happy/
    empty/
    error/
    edge/
```

场景切换规范见：`docs/engineering/mocking.md`（建议用 `X-Mock-Scenario` Header）。

