# UI screenshots export (Client H5 + Admin Web)

This repo already supports exporting two kinds of demo materials:

1) **Scope/flow diagrams (Mermaid -> PNG/PDF/SVG)**: `powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1`
2) **Real UI page screenshots (H5 + Admin)**: `powershell -ExecutionPolicy Bypass -File scripts/capture-ui.ps1`

## 1) Start demo servers

```powershell
powershell -ExecutionPolicy Bypass -File scripts/demo.ps1
```

If you want separate windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/demo.ps1 -SplitWindows
```

## 2) Export screenshots (PNG / optional PDF / optional ZIP)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/capture-ui.ps1 -Zip
```

Outputs:
- `docs/demo/rendered/ui/client/`
- `docs/demo/rendered/ui/admin/`
- `docs/demo/rendered/ui/ui-screenshots.zip` (when `-Zip`)

### Ports are not 5173/5174?

Use the URLs printed by `scripts/demo.ps1`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/capture-ui.ps1 `
  -ClientBaseUrl http://127.0.0.1:5175 `
  -AdminBaseUrl  http://127.0.0.1:5176 `
  -Zip
```

### Include PDF

```powershell
powershell -ExecutionPolicy Bypass -File scripts/capture-ui.ps1 -IncludePdf -Zip
```

### Only list planned pages (no capture)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/capture-ui.ps1 -ListOnly
```

## 3) Demo auth bootstrap (H5 only, for screenshots)

H5 supports a lightweight demo bootstrap (dev mode, or when MockTools is enabled):

- `?__demo_auth=1`: set demo token + onboardingDone + APPROVED in local storage
- `?__demo_reset=1`: clear the above local storage keys
- `?__demo_scenario=happy|empty|error|...`: set `ipmoney.mockScenario`

`scripts/capture-ui.ps1` automatically adds `__demo_auth=1` for pages that require login/approval, and removes these params from the URL after load (so they won't appear in screenshots).

## 4) Troubleshooting

- Browser not found: pass `-BrowserExe` (Edge/Chrome)
- Wrong sizes:
  - H5: `-ClientWidth/-ClientHeight`
  - Admin: `-AdminWidth/-AdminHeight`
