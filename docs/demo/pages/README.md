# 页面功能图（从 `Ipmoney.md` 提炼）

目标：把 PRD 中“每页核心功能”做成可导出的图片（Mermaid → PNG/PDF），便于评审、讲解与对齐范围。

导出位置：
- PNG/PDF：`docs/demo/rendered/`（文件名与 `.mmd` 的 baseName 一致）
- 批量导出脚本：`scripts/render-diagrams.ps1`
- 小程序 01-15 合成单图（便于快速评审）：`docs/demo/rendered/miniapp-pages-01-15.png`（生成脚本：`scripts/merge-miniapp-pages.py`）

## 小程序（买家/卖家）

- 登录/注册与角色引导：`docs/demo/pages/miniapp/01-login.mmd`
- 首页：`docs/demo/pages/miniapp/02-home.mmd`
- 区域产业专利地图：`docs/demo/pages/miniapp/03-patent-map.mmd`
- 信息展示/搜索结果：`docs/demo/pages/miniapp/04-feeds.mmd`
- 详情页：`docs/demo/pages/miniapp/05-detail.mmd`
- 聊天与咨询：`docs/demo/pages/miniapp/06-message.mmd`
- 订金支付页：`docs/demo/pages/miniapp/07-checkout-deposit-pay.mmd`
- 订金支付成功页：`docs/demo/pages/miniapp/08-checkout-deposit-success.mmd`
- 尾款支付页：`docs/demo/pages/miniapp/09-checkout-final-pay.mmd`
- 尾款支付成功页：`docs/demo/pages/miniapp/10-checkout-final-success.mmd`
- 我的：`docs/demo/pages/miniapp/11-user-center.mmd`
- 发布入口：`docs/demo/pages/miniapp/12-publish-chooser.mmd`
- 专利交易发布：`docs/demo/pages/miniapp/13-publish-patent.mmd`
- 产学研需求发布：`docs/demo/pages/miniapp/14-publish-demand.mmd`
- 成果展示发布：`docs/demo/pages/miniapp/15-publish-achievement.mmd`

## 管理后台（PC Web）

- 工作台/数据看板：`docs/demo/pages/admin/01-dashboard.mmd`
- 专利地图数据管理：`docs/demo/pages/admin/02-map-cms.mmd`
- 交易订单管理（列表）：`docs/demo/pages/admin/03-order-list.mmd`
- 交易订单管理（详情/跟单）：`docs/demo/pages/admin/04-order-detail.mmd`
- 信息发布审核：`docs/demo/pages/admin/05-content-audit.mmd`
- 用户与认证管理：`docs/demo/pages/admin/06-user-auth.mmd`
- 财务管理：`docs/demo/pages/admin/07-finance.mmd`
- 系统设置：`docs/demo/pages/admin/08-system-settings.mmd`
