# 架构与流程图（Mermaid）

本目录包含 `.mmd` 源文件，用于架构/流程/时序/ER 对齐与演示。

## 查看与编辑
- 在 Cursor / VS Code 安装 Mermaid 插件可直接预览 `.mmd`
- 或使用 Mermaid Live Editor 在线预览

## 导出（可选）
需要 Node.js：

- 单个文件：
  - `npx -y @mermaid-js/mermaid-cli -i docs/architecture/c4-context.mmd -o docs/architecture/rendered/c4-context.svg -b white`
- 批量：
  - `powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1`

导出文件默认放在 `docs/architecture/rendered/`（可选提交）。
