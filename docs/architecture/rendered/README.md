# 架构图导出目录

本目录用于存放 `docs/architecture/*.mmd` 的渲染产物（`png` / `pdf` / `svg`）。

- 源文件：`docs/architecture/`
- 批量导出命令：

```bash
powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1
```

说明：`.mmd` 源文件是唯一真实来源，图片为对外沟通与归档产物。
