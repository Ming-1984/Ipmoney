#!/usr/bin/env python3
"""
Deploy sunye production artifacts and switch TLS certs on aliyun host.

Usage:
  python scripts/deploy_sunye_prod.py \
    --host 8.134.124.134 --user root --password '***' \
    --api-cert 'docs/secret/笋嘢.com_SSL证书/api.笋嘢.com_nginx/api.笋嘢.com_bundle.pem' \
    --api-key  'docs/secret/笋嘢.com_SSL证书/api.笋嘢.com_nginx/api.笋嘢.com.key' \
    --admin-cert 'docs/secret/笋嘢.com_SSL证书/admin.笋嘢.com_nginx/admin.笋嘢.com_bundle.pem' \
    --admin-key  'docs/secret/笋嘢.com_SSL证书/admin.笋嘢.com_nginx/admin.笋嘢.com.key' \
    --root-cert 'docs/secret/笋嘢.com_SSL证书/笋嘢.com_nginx/笋嘢.com_bundle.pem' \
    --root-key  'docs/secret/笋嘢.com_SSL证书/笋嘢.com_nginx/笋嘢.com.key' \
    --deploy-cert-only
"""

from __future__ import annotations

import argparse
import os
import shlex
import shutil
import sys
import time
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


def build_artifacts(repo_root: Path) -> tuple[Path, Path, Path]:
    env_api = os.environ.copy()
    env_api["DEPLOY_ENV"] = "prod"
    env_api["STAGE"] = "prod"
    env_api["NODE_ENV"] = "production"

    env_admin = env_api.copy()
    env_admin["VITE_API_BASE_URL"] = "https://api.xn--m5rv27f.com"

    env_client = env_api.copy()
    env_client["TARO_APP_API_BASE_URL"] = "https://api.xn--m5rv27f.com"

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


def update_remote_certs(ssh: paramiko.SSHClient, args: argparse.Namespace) -> None:
    mapping = [
        (
            "api.xn--m5rv27f.com",
            Path(args.api_cert),
            Path(args.api_key),
        ),
        (
            "admin.xn--m5rv27f.com",
            Path(args.admin_cert),
            Path(args.admin_key),
        ),
        (
            "xn--m5rv27f.com",
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


def deploy_remote(ssh: paramiko.SSHClient, api_tar: Path, admin_tar: Path, client_tar: Path) -> None:
    remote_tmp = "/opt/sunye/deploy-tmp"
    run_remote(ssh, f"mkdir -p {shlex.quote(remote_tmp)}")

    api_tar_remote = f"{remote_tmp}/{api_tar.name}"
    admin_tar_remote = f"{remote_tmp}/{admin_tar.name}"
    client_tar_remote = f"{remote_tmp}/{client_tar.name}"
    sftp_put(ssh, api_tar, api_tar_remote)
    sftp_put(ssh, admin_tar, admin_tar_remote)
    sftp_put(ssh, client_tar, client_tar_remote)

    run_remote(ssh, "mkdir -p /opt/sunye/current/apps/api")
    run_remote(ssh, "mkdir -p /www/wwwroot/admin.xn--m5rv27f.com")
    run_remote(ssh, "mkdir -p /www/wwwroot/xn--m5rv27f.com")

    # Keep dist/ directory under apps/api so pm2 entrypoint remains apps/api/dist/main.js
    run_remote(ssh, "mkdir -p /opt/sunye/current/apps/api/dist")
    run_remote(ssh, "find /opt/sunye/current/apps/api/dist -mindepth 1 -maxdepth 1 -exec rm -rf {} +")
    run_remote(ssh, f"tar -xzf {shlex.quote(api_tar_remote)} -C /opt/sunye/current/apps/api")
    run_remote(ssh, f"tar -xzf {shlex.quote(admin_tar_remote)} -C /www/wwwroot/admin.xn--m5rv27f.com --strip-components=1")
    run_remote(ssh, f"tar -xzf {shlex.quote(client_tar_remote)} -C /www/wwwroot/xn--m5rv27f.com --strip-components=1")
    run_remote(ssh, "find /www/wwwroot/admin.xn--m5rv27f.com -type d -exec chmod 755 {} +")
    run_remote(ssh, "find /www/wwwroot/admin.xn--m5rv27f.com -type f -exec chmod 644 {} +")
    run_remote(ssh, "find /www/wwwroot/xn--m5rv27f.com -type d -exec chmod 755 {} +")
    run_remote(ssh, "find /www/wwwroot/xn--m5rv27f.com -type f -exec chmod 644 {} +")
    run_remote(ssh, "chown -R www:www /www/wwwroot/admin.xn--m5rv27f.com /www/wwwroot/xn--m5rv27f.com")

    run_remote(ssh, "pm2 restart sunye-api")
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
    run_remote(ssh, "curl -fsS https://api.xn--m5rv27f.com/health")
    run_remote(ssh, "curl -fsS https://api.xn--m5rv27f.com/public/config/home-landing | head -c 400")
    run_remote(ssh, "curl -I -fsS https://admin.xn--m5rv27f.com | head -n 20")
    run_remote(ssh, "curl -I -fsS https://xn--m5rv27f.com | head -n 20")
    run_remote(ssh, "openssl s_client -connect api.xn--m5rv27f.com:443 -servername api.xn--m5rv27f.com </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates")
    run_remote(ssh, "openssl s_client -connect admin.xn--m5rv27f.com:443 -servername admin.xn--m5rv27f.com </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates")
    run_remote(ssh, "openssl s_client -connect xn--m5rv27f.com:443 -servername xn--m5rv27f.com </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates")


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
        update_remote_certs(ssh, args)
        if not args.deploy_cert_only:
            if not api_tar or not admin_tar or not client_tar:
                raise RuntimeError("build artifacts are missing")
            deploy_remote(ssh, api_tar, admin_tar, client_tar)
        verify_remote(ssh)
        print("[done] deploy + cert + verify completed")
    finally:
        ssh.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
