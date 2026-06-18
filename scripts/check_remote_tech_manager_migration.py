#!/usr/bin/env python3
from __future__ import annotations

import os
import sys

import paramiko


REQUIRED_MIGRATION = "20260617113000_add_tech_manager_public_labels"


def main() -> int:
    host = os.environ.get("DEPLOY_HOST", "").strip()
    user = os.environ.get("DEPLOY_USER", "").strip()
    password = os.environ.get("DEPLOY_PASSWORD", "").strip()
    remote_root = os.environ.get("REMOTE_ROOT", "/opt/sunye/current").strip() or "/opt/sunye/current"

    if not host or not user or not password:
        print(
            "[check-remote-tech-manager-migration] DEPLOY_HOST, DEPLOY_USER and DEPLOY_PASSWORD are required.",
            file=sys.stderr,
        )
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password, timeout=15, banner_timeout=20, auth_timeout=20)
    try:
        command = f"cd {remote_root} && ls apps/api/prisma/migrations"
        stdin, stdout, stderr = ssh.exec_command(command)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        code = stdout.channel.recv_exit_status()
        if code != 0:
          print(
              f"[check-remote-tech-manager-migration] remote command failed ({code}): {err or out}",
              file=sys.stderr,
          )
          return 1

        items = [item.strip() for item in out.splitlines() if item.strip()]
        if REQUIRED_MIGRATION not in items:
            print(
                f"[check-remote-tech-manager-migration] missing remote migration: {REQUIRED_MIGRATION}",
                file=sys.stderr,
            )
            return 1

        print("[check-remote-tech-manager-migration] ok")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
