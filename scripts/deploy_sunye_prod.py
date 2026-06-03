#!/usr/bin/env python3
"""
Deploy ipmoney production artifacts and switch TLS certs on aliyun host.

Usage:
  python scripts/deploy_sunye_prod.py \
    --host 8.134.124.134 --user root --password '***' \
    --api-cert 'docs/secret/SSL_certs_ipmoney.cn/api.ipmoney.cn_nginx/api.ipmoney.cn_bundle.pem' \
    --api-key  'docs/secret/SSL_certs_ipmoney.cn/api.ipmoney.cn_nginx/api.ipmoney.cn.key' \
    --admin-cert 'docs/secret/SSL_certs_ipmoney.cn/admin.ipmoney.cn_nginx/admin.ipmoney.cn_bundle.pem' \
    --admin-key  'docs/secret/SSL_certs_ipmoney.cn/admin.ipmoney.cn_nginx/admin.ipmoney.cn.key' \
    --root-cert 'docs/secret/SSL_certs_ipmoney.cn/ipmoney.cn_nginx/ipmoney.cn_bundle.pem' \
    --root-key  'docs/secret/SSL_certs_ipmoney.cn/ipmoney.cn_nginx/ipmoney.cn.key' \
    --deploy-cert-only
"""

from __future__ import annotations

import argparse
import os
import shlex
import shutil
import sys
import time
import zipfile
from pathlib import Path

import paramiko


def safe_print(text: str) -> None:
    try:
        print(text)
    except UnicodeEncodeError:
        encoding = sys.stdout.encoding or "utf-8"
        fallback = text.encode(encoding, errors="replace").decode(encoding, errors="replace")
        print(fallback)


def run_local(cmd: list[str], env: dict[str, str] | None = None) -> None:
    import subprocess

    if os.name == "nt" and cmd and cmd[0] == "pnpm":
        # Windows often exposes pnpm as pnpm.cmd; resolve explicitly to avoid WinError 2.
        pnpm_bin = shutil.which("pnpm.cmd") or shutil.which("pnpm")
        if not pnpm_bin:
            raise RuntimeError("pnpm not found in PATH; please install pnpm first.")
        cmd = [pnpm_bin, *cmd[1:]]

    print(f"[local] {' '.join(shlex.quote(c) for c in cmd)}")
    proc = subprocess.run(cmd, env=env, check=False)
    if proc.returncode != 0:
        raise RuntimeError(f"local command failed: {' '.join(cmd)}")


def run_remote(ssh: paramiko.SSHClient, cmd: str) -> str:
    safe_print(f"[remote] {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode("utf-8", errors="ignore")
    err = stderr.read().decode("utf-8", errors="ignore")
    code = stdout.channel.recv_exit_status()
    if code != 0:
        raise RuntimeError(f"remote command failed ({code}): {cmd}\nSTDOUT:\n{out}\nSTDERR:\n{err}")
    if out.strip():
        safe_print(out.strip())
    if err.strip():
        safe_print(err.strip())
    return out


def sftp_put(ssh: paramiko.SSHClient, local_path: Path, remote_path: str) -> None:
    print(f"[upload] {local_path} -> {remote_path}")
    sftp = ssh.open_sftp()
    try:
        remote_dir = os.path.dirname(remote_path).replace("\\", "/")
        try:
            sftp.stat(remote_dir)
        except Exception:
            run_remote(ssh, f"mkdir -p {shlex.quote(remote_dir)}")
        sftp.put(str(local_path), remote_path)
    finally:
        sftp.close()


def ensure_ssl_cert_tree(repo_root: Path) -> None:
    cert_root = repo_root / "docs" / "secret" / "SSL_certs_ipmoney.cn"
    required = [
        cert_root / "api.ipmoney.cn_nginx" / "api.ipmoney.cn_bundle.pem",
        cert_root / "api.ipmoney.cn_nginx" / "api.ipmoney.cn.key",
        cert_root / "admin.ipmoney.cn_nginx" / "admin.ipmoney.cn_bundle.pem",
        cert_root / "admin.ipmoney.cn_nginx" / "admin.ipmoney.cn.key",
        cert_root / "ipmoney.cn_nginx" / "ipmoney.cn_bundle.pem",
        cert_root / "ipmoney.cn_nginx" / "ipmoney.cn.key",
    ]
    if all(path.exists() for path in required):
        return
    zip_path = repo_root / "docs" / "secret" / "SSL_certs_ipmoney.cn.zip"
    if not zip_path.exists():
        raise RuntimeError(f"missing certificate archive: {zip_path}")
    cert_root.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(cert_root.parent)
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise RuntimeError(f"certificate files missing after extract: {missing}")


def build_artifacts(repo_root: Path) -> tuple[Path, Path, Path]:
    env_api = os.environ.copy()
    env_api["DEPLOY_ENV"] = "prod"
    env_api["STAGE"] = "prod"
    env_api["NODE_ENV"] = "production"

    env_admin = env_api.copy()
    env_admin["VITE_API_BASE_URL"] = "https://api.ipmoney.cn"

    env_client = env_api.copy()
    env_client["TARO_APP_API_BASE_URL"] = "https://api.ipmoney.cn"

    run_local(["pnpm", "-C", "apps/api", "build"], env=env_api)
    run_local(["pnpm", "-C", "apps/admin-web", "build"], env=env_admin)
    run_local(["pnpm", "-C", "apps/client", "build:h5"], env=env_client)

    api_dist = repo_root / "apps" / "api" / "dist"
    admin_dist = repo_root / "apps" / "admin-web" / "dist"
    client_dist = repo_root / "apps" / "client" / "dist" / "h5"
    for p in (api_dist, admin_dist, client_dist):
        if not p.exists():
            raise RuntimeError(f"build output not found: {p}")
    return api_dist, admin_dist, client_dist


def tar_dir(src: Path, prefix: str, repo_root: Path) -> Path:
    import tarfile
    from datetime import datetime

    out_dir = repo_root / ".tmp" / "deploy"
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    tar_path = out_dir / f"{prefix}-{ts}.tar.gz"
    with tarfile.open(tar_path, "w:gz") as tf:
        tf.add(src, arcname=src.name)
    return tar_path


def detect_remote_layout(ssh: paramiko.SSHClient) -> dict[str, str]:
    layout_cmd = r"""
if pm2 describe ipmoney-api >/dev/null 2>&1; then pm2_name=ipmoney-api; else pm2_name=sunye-api; fi
exec_cwd=$(pm2 jlist 2>/dev/null | python3 -c 'import json,sys; target=sys.argv[1]; data=json.load(sys.stdin); proc=next((item for item in data if item.get("name")==target), {}); env=proc.get("pm2_env", {}); print(env.get("cwd") or env.get("pm_cwd") or "")' "$pm2_name")
if [ -n "$exec_cwd" ] && [ -d "$exec_cwd/apps/api" ]; then
  api_root="$exec_cwd/apps/api"
elif [ -d /opt/ipmoney/current/apps/api ]; then
  api_root=/opt/ipmoney/current/apps/api
else
  api_root=/opt/sunye/current/apps/api
fi
admin_root=/www/wwwroot/admin.ipmoney.cn
h5_root=/www/wwwroot/ipmoney.cn
printf "API_ROOT=%s\nADMIN_ROOT=%s\nH5_ROOT=%s\nPM2_NAME=%s\n" "$api_root" "$admin_root" "$h5_root" "$pm2_name"
"""
    output = run_remote(ssh, layout_cmd)
    result: dict[str, str] = {}
    for line in output.splitlines():
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        result[key.strip()] = value.strip()
    required_keys = ["API_ROOT", "ADMIN_ROOT", "H5_ROOT", "PM2_NAME"]
    missing = [key for key in required_keys if not result.get(key)]
    if missing:
        raise RuntimeError(f"failed to detect remote layout: missing {missing}")
    return result


def update_remote_certs(ssh: paramiko.SSHClient, args: argparse.Namespace) -> None:
    mapping = [
        (
            "api.ipmoney.cn",
            Path(args.api_cert),
            Path(args.api_key),
        ),
        (
            "admin.ipmoney.cn",
            Path(args.admin_cert),
            Path(args.admin_key),
        ),
        (
            "ipmoney.cn",
            Path(args.root_cert),
            Path(args.root_key),
        ),
    ]

    for host, cert, key in mapping:
        if not cert.exists() or not key.exists():
            raise RuntimeError(f"cert/key missing for {host}: {cert} / {key}")
        remote_dir = f"/www/server/panel/vhost/cert/{host}"
        run_remote(
            ssh,
            f"backup_dir=/www/server/panel/vhost/cert-backup/{host}-$(date +%Y%m%d-%H%M%S); "
            f"mkdir -p \"$backup_dir\" && "
            f"cp -a {shlex.quote(remote_dir)}/fullchain.pem \"$backup_dir\"/fullchain.pem.bak 2>/dev/null || true && "
            f"cp -a {shlex.quote(remote_dir)}/privkey.pem \"$backup_dir\"/privkey.pem.bak 2>/dev/null || true",
        )
        sftp_put(ssh, cert, f"{remote_dir}/fullchain.pem")
        sftp_put(ssh, key, f"{remote_dir}/privkey.pem")
        run_remote(ssh, f"chmod 600 {shlex.quote(remote_dir)}/privkey.pem && chmod 644 {shlex.quote(remote_dir)}/fullchain.pem")

    run_remote(ssh, "nginx -t")
    run_remote(ssh, "nginx -s reload")
    run_remote(ssh, "echo 'cert switched at:' && date")


def deploy_remote(ssh: paramiko.SSHClient, api_tar: Path, admin_tar: Path, client_tar: Path, layout: dict[str, str]) -> None:
    api_root = layout["API_ROOT"]
    admin_root = layout["ADMIN_ROOT"]
    h5_root = layout["H5_ROOT"]
    pm2_name = layout["PM2_NAME"]
    remote_tmp = "/opt/ipmoney/deploy-tmp" if api_root.startswith("/opt/ipmoney/") else "/opt/sunye/deploy-tmp"
    run_remote(ssh, f"mkdir -p {shlex.quote(remote_tmp)}")

    api_tar_remote = f"{remote_tmp}/{api_tar.name}"
    admin_tar_remote = f"{remote_tmp}/{admin_tar.name}"
    client_tar_remote = f"{remote_tmp}/{client_tar.name}"
    sftp_put(ssh, api_tar, api_tar_remote)
    sftp_put(ssh, admin_tar, admin_tar_remote)
    sftp_put(ssh, client_tar, client_tar_remote)

    run_remote(ssh, f"mkdir -p {shlex.quote(api_root)}")
    run_remote(ssh, f"mkdir -p {shlex.quote(admin_root)}")
    run_remote(ssh, f"mkdir -p {shlex.quote(h5_root)}")

    # Keep dist/ directory under apps/api so pm2 entrypoint remains apps/api/dist/main.js
    run_remote(ssh, f"mkdir -p {shlex.quote(api_root)}/dist")
    run_remote(ssh, f"find {shlex.quote(api_root)}/dist -mindepth 1 -maxdepth 1 -exec rm -rf {{}} +")
    run_remote(ssh, f"tar -xzf {shlex.quote(api_tar_remote)} -C {shlex.quote(api_root)}")
    run_remote(ssh, f"tar -xzf {shlex.quote(admin_tar_remote)} -C {shlex.quote(admin_root)} --strip-components=1")
    run_remote(ssh, f"tar -xzf {shlex.quote(client_tar_remote)} -C {shlex.quote(h5_root)} --strip-components=1")
    run_remote(ssh, f"find {shlex.quote(admin_root)} -type d -exec chmod 755 {{}} +")
    run_remote(ssh, f"find {shlex.quote(admin_root)} -type f ! -name '.user.ini' -exec chmod 644 {{}} +")
    run_remote(ssh, f"find {shlex.quote(h5_root)} -type d -exec chmod 755 {{}} +")
    run_remote(ssh, f"find {shlex.quote(h5_root)} -type f ! -name '.user.ini' -exec chmod 644 {{}} +")
    run_remote(ssh, f"chown www:www {shlex.quote(admin_root)} {shlex.quote(h5_root)} || true")
    run_remote(ssh, f"find {shlex.quote(admin_root)} -mindepth 1 ! -name '.user.ini' -exec chown www:www {{}} +")
    run_remote(ssh, f"find {shlex.quote(h5_root)} -mindepth 1 ! -name '.user.ini' -exec chown www:www {{}} +")

    run_remote(ssh, f"pm2 restart {shlex.quote(pm2_name)}")
    run_remote(ssh, "pm2 save || true")


def wait_for_api_ready(ssh: paramiko.SSHClient, retries: int = 30, interval_sec: int = 2) -> None:
    for i in range(1, retries + 1):
        try:
            run_remote(ssh, "curl -fsS http://127.0.0.1:3010/health")
            return
        except Exception:
            if i == retries:
                raise
            safe_print(f"[wait] api not ready yet ({i}/{retries}), retrying in {interval_sec}s...")
            time.sleep(interval_sec)


def verify_remote(ssh: paramiko.SSHClient) -> None:
    wait_for_api_ready(ssh)
    run_remote(ssh, "curl -fsS http://127.0.0.1:3010/health")
    run_remote(ssh, "curl -fsS https://api.ipmoney.cn/health")
    run_remote(ssh, "bash -lc \"set -o pipefail; curl -fsS https://api.ipmoney.cn/public/config/home-landing | head -c 400\"")
    run_remote(ssh, "bash -lc \"set -o pipefail; curl -I -fsS https://admin.ipmoney.cn | head -n 20\"")
    run_remote(ssh, "bash -lc \"set -o pipefail; curl -I -fsS https://ipmoney.cn | head -n 20\"")
    run_remote(
        ssh,
        "bash -lc \"set -o pipefail; openssl s_client -connect api.ipmoney.cn:443 -servername api.ipmoney.cn </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates\"",
    )
    run_remote(
        ssh,
        "bash -lc \"set -o pipefail; openssl s_client -connect admin.ipmoney.cn:443 -servername admin.ipmoney.cn </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates\"",
    )
    run_remote(
        ssh,
        "bash -lc \"set -o pipefail; openssl s_client -connect ipmoney.cn:443 -servername ipmoney.cn </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates\"",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", required=True)
    parser.add_argument("--user", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--api-cert", required=True)
    parser.add_argument("--api-key", required=True)
    parser.add_argument("--admin-cert", required=True)
    parser.add_argument("--admin-key", required=True)
    parser.add_argument("--root-cert", required=True)
    parser.add_argument("--root-key", required=True)
    parser.add_argument("--deploy-cert-only", action="store_true")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    print(f"[info] repo_root={repo_root}")
    ensure_ssl_cert_tree(repo_root)

    api_tar: Path | None = None
    admin_tar: Path | None = None
    client_tar: Path | None = None
    if not args.deploy_cert_only:
        api_dist, admin_dist, client_dist = build_artifacts(repo_root)
        api_tar = tar_dir(api_dist, "api-dist", repo_root)
        admin_tar = tar_dir(admin_dist, "admin-dist", repo_root)
        client_tar = tar_dir(client_dist, "client-h5-dist", repo_root)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(args.host, username=args.user, password=args.password, timeout=15, banner_timeout=20, auth_timeout=20)
    if ssh.get_transport():
        ssh.get_transport().set_keepalive(20)

    try:
        run_remote(ssh, "hostname && uname -a")
        run_remote(ssh, "which nginx && nginx -v")
        run_remote(ssh, "pm2 ls | head -n 40")
        layout = detect_remote_layout(ssh)
        update_remote_certs(ssh, args)
        if not args.deploy_cert_only:
            if not api_tar or not admin_tar or not client_tar:
                raise RuntimeError("build artifacts are missing")
            deploy_remote(ssh, api_tar, admin_tar, client_tar, layout)
        verify_remote(ssh)
        print("[done] deploy + cert + verify completed")
    finally:
        ssh.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
