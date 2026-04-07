#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
兼容入口：
- 供 build-client-handover.ps1 的 -Regenerate 调用
- 当前实现为执行统一中文化修复脚本
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    script = repo_root / "scripts" / "normalize-client-handover-cn.py"
    md_path = repo_root / "docs" / "architecture" / "client-handover-mini-program-admin.md"

    cmd = [
        sys.executable,
        str(script),
        "--input",
        str(md_path),
        "--output",
        str(md_path),
    ]
    subprocess.run(cmd, check=True)
    print(str(md_path))


if __name__ == "__main__":
    main()
