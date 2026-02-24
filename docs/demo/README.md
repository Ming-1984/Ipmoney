# Demo Materials

This folder stores **rendered demo artifacts** (screenshots/exports) that help with
stakeholder reviews and regression checks.

## UI smoke screenshots (H5 + Admin Web)

- Output: `docs/demo/rendered/ui-smoke-YYYY-MM-DD/`
- Generate:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ui-render-smoke.ps1 -Mode full -ReportDate 2026-02-24
```

Notes:
- The script runs `mock-api` + H5 devserver + admin devserver, then uses Edge/Chrome headless
  to capture screenshots.
- The latest run summary is also written to `.tmp/ui-render-smoke-YYYY-MM-DD-summary.json`.

## WeApp smoke (manual)

WeApp is still closed by a **manual smoke checklist**:
- Checklist: `docs/engineering/weapp-manual-smoke-checklist.md`

