# UI v2：页面状态机接入指南（Client）

目标：所有页面统一覆盖 `permission/audit/loading/error/empty/content`，避免“卡 Loading / 空白页”，并让前后端并行对接更稳定。

## 1) 先定页面访问策略（Page Access Policy）

- `public`：游客可看；收藏/咨询/下单等动作在点击时再拦截。
- `login-required`：页面内容需要登录（P0 暂少用）。
- `approved-required`：页面需要登录 + 完成身份选择 + 审核通过。

> 口径：页面级策略只影响“是否发请求/是否展示内容”；动作级策略只影响“是否允许某个按钮触发写操作”。

## 2) 页面级（approved-required）写法范式

### 2.1 access 与加载触发

- 使用 `usePageAccess(policy, onShow)` 在“页面展示（didShow）”时刷新权限态，并在 `access.state === 'ok'` 时触发加载。
- 当 `access.state !== 'ok'` 时：必须停止请求，并把 `loading` 置为 `false`（避免 UI 停在 Loading）。

### 2.2 渲染优先级（必须）

按以下顺序渲染，确保不会白屏：

1. `AccessGate`（need-login / need-onboarding / audit-*）
2. `loading`
3. `error`
4. `empty`
5. `content`

## 3) public 页面（可看不可操作）的动作拦截

- 页面照常加载数据与展示内容。
- 收藏/咨询/下单/支付等动作：在点击时调用 `ensureApproved()`（或后续的动作级策略封装）拦截并引导登录/认证。

## 4) 常见坑（本指南要消灭）

- `load()` 内部 `if (!ensureApproved()) return;`：会导致 `loading=true` 后提前 return，页面永久卡 Loading。
- 页面“早 return null”：会导致 H5/小程序出现空白页，必须返回明确的状态卡片（Permission/Audit/Error）。
- 路由参数缺失（如 `?orderId=`）：必须返回缺参兜底页（见 UI-STD-P0-005）。

