# 阿里云证书切换与三端发布 Runbook（2026-04-15）

## 目标

1. 将 `api/admin/主站` 三个域名证书切换到 `笋嘢.com_SSL证书` 对应文件。  
2. 发布最新 API / Admin / H5 到阿里云现网目录。  
3. 产出最新小程序上传包用于微信公众平台提交。

## 本次已准备产物（本地）

- API：`.tmp/deploy/deploy-api-latest.zip`
- Admin：`.tmp/deploy/deploy-admin-latest.zip`
- H5：`.tmp/deploy/deploy-client-h5-latest.zip`
- WeApp 上传包：`.tmp/deploy/weapp-release-latest.zip`

证书源目录：
- `docs/secret/笋嘢.com_SSL证书/api.笋嘢.com_nginx/`
- `docs/secret/笋嘢.com_SSL证书/admin.笋嘢.com_nginx/`
- `docs/secret/笋嘢.com_SSL证书/笋嘢.com_nginx/`

## 自动化脚本

脚本路径：`scripts/deploy_sunye_prod.py`

用途：
- 备份旧证书
- 覆盖宝塔证书目录 `fullchain.pem/privkey.pem`
- `nginx -t && nginx -s reload`
- （可选）发布 API/Admin/H5 并 `pm2 restart sunye-api`
- 自动验收 `health` 与证书主题

## 执行命令（在可直连服务器的机器执行）

```powershell
python scripts/deploy_sunye_prod.py `
  --host 8.134.124.134 `
  --user root `
  --password "Eifq168168168!" `
  --api-cert "docs/secret/笋嘢.com_SSL证书/api.笋嘢.com_nginx/api.笋嘢.com_bundle.pem" `
  --api-key "docs/secret/笋嘢.com_SSL证书/api.笋嘢.com_nginx/api.笋嘢.com.key" `
  --admin-cert "docs/secret/笋嘢.com_SSL证书/admin.笋嘢.com_nginx/admin.笋嘢.com_bundle.pem" `
  --admin-key "docs/secret/笋嘢.com_SSL证书/admin.笋嘢.com_nginx/admin.笋嘢.com.key" `
  --root-cert "docs/secret/笋嘢.com_SSL证书/笋嘢.com_nginx/笋嘢.com_bundle.pem" `
  --root-key "docs/secret/笋嘢.com_SSL证书/笋嘢.com_nginx/笋嘢.com.key"
```

只切证书（不发布）：

```powershell
python scripts/deploy_sunye_prod.py ... --deploy-cert-only
```

## 远端目录（与 2026-04-15 验收记录一致）

- API 运行目录：`/opt/sunye/current/apps/api/dist/`
- H5 目录：`/www/wwwroot/xn--m5rv27f.com/`
- Admin 目录：`/www/wwwroot/admin.xn--m5rv27f.com/`
- 证书目录：
  - `/www/server/panel/vhost/cert/api.xn--m5rv27f.com/`
  - `/www/server/panel/vhost/cert/admin.xn--m5rv27f.com/`
  - `/www/server/panel/vhost/cert/xn--m5rv27f.com/`

## 发布后验收

```bash
curl -fsS http://127.0.0.1:3010/health
curl -fsS https://api.xn--m5rv27f.com/health
curl -fsS https://api.xn--m5rv27f.com/public/config/home-landing | head -c 300
openssl s_client -connect api.xn--m5rv27f.com:443 -servername api.xn--m5rv27f.com </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates
openssl s_client -connect admin.xn--m5rv27f.com:443 -servername admin.xn--m5rv27f.com </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates
openssl s_client -connect xn--m5rv27f.com:443 -servername xn--m5rv27f.com </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates
```

本次（2026-04-15）实际验收结果：

- `http://127.0.0.1:3010/health`：`ok:true`
- `https://api.xn--m5rv27f.com/health`：`ok:true`
- `https://admin.xn--m5rv27f.com`：`HTTP/2 200`
- `https://xn--m5rv27f.com`：`HTTP/2 200`
- 证书主题已匹配新域名（`api/admin/xn--m5rv27f.com`），有效期至 `2026-06-29 23:59:59 GMT`

## 微信小程序发布

1. 使用微信开发者工具打开：`apps/client/dist/weapp/`  
2. 生产提审前确认：
   - request 合法域名含：`https://api.笋嘢.com`（或 Punycode）
   - 业务域名（web-view）已配置
   - 关闭“忽略合法域名校验”
3. 如需交付压缩包：`.tmp/deploy/weapp-release-latest.zip`

## 脚本补丁记录（2026-04-15）

- `scripts/deploy_sunye_prod.py` 已增加：
  - Windows `pnpm.cmd` 兼容调用
  - API 解压路径修复（防止未真正更新 `dist`）
  - API 重启后的健康检查重试
  - Admin/H5 发布后静态目录权限与归属修复（防止 `403`）
