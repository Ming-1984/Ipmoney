[CmdletBinding()]
param(
  [string]$Service = "postgres",
  [string]$DbUser = "ipmoney",
  [string]$DbName = "ipmoney",
  [string]$ReportDate = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($ReportDate)) {
  $ReportDate = (Get-Date).ToString("yyyy-MM-dd")
}

function Invoke-PsqlAt {
  param([string]$Sql)
  $args = @("compose", "exec", "-T", $Service, "psql", "-U", $DbUser, "-d", $DbName, "-At", "-c", $Sql)
  $out = & docker @args
  if ($LASTEXITCODE -ne 0) { throw "psql failed (service=$Service db=$DbName)" }
  return $out
}

$checksSql = @"
select 'duplicate_patent_id_value_norm' as key, count(*) as value
from (select id_value_norm from patent_identifiers group by id_value_norm having count(*) > 1) t;

select 'duplicate_patent_app_no' as key, count(*) as value
from (select jurisdiction, application_no_norm from patents group by jurisdiction, application_no_norm having count(*) > 1) t;

select 'orders_negative_amount' as key, count(*) as value
from orders
where coalesce(deal_amount, 0) < 0
   or deposit_amount < 0
   or coalesce(final_amount, 0) < 0
   or coalesce(commission_amount, 0) < 0;

select 'refund_orphan_order' as key, count(*) as value
from refund_requests rr
left join orders o on rr.order_id = o.id
where o.id is null;

select 'payment_orphan_order' as key, count(*) as value
from payments p
left join orders o on p.order_id = o.id
where o.id is null;

select 'settlement_orphan_order' as key, count(*) as value
from settlements s
left join orders o on s.order_id = o.id
where o.id is null;

select 'settlement_succeeded_without_evidence' as key, count(*) as value
from settlements
where payout_status = 'SUCCEEDED'
  and payout_evidence_file_id is null;

select 'invoice_without_file' as key, count(*) as value
from orders
where invoice_no is not null
  and invoice_file_id is null;

select 'webhook_orphan_order' as key, count(*) as value
from payment_webhook_events e
left join orders o on e.order_id = o.id
where e.order_id is not null
  and o.id is null;
"@

$lines = @(Invoke-PsqlAt -Sql $checksSql)
$results = [ordered]@{}

foreach ($line in $lines) {
  $trim = [string]$line
  if ([string]::IsNullOrWhiteSpace($trim)) { continue }
  $parts = $trim.Split("|", 2)
  if ($parts.Count -ne 2) { continue }
  $k = $parts[0].Trim()
  $vRaw = $parts[1].Trim()
  $v = 0
  [int]::TryParse($vRaw, [ref]$v) | Out-Null
  $results[$k] = $v
}

$failed = @()
foreach ($k in $results.Keys) {
  if ($results[$k] -gt 0) { $failed += $k }
}

$summary = [pscustomobject]@{
  total  = $results.Keys.Count
  failed = $failed.Count
  ok     = ($failed.Count -eq 0)
  failedKeys = $failed
}

$logDir = Join-Path $repoRoot ".tmp"
New-Item -ItemType Directory -Force $logDir | Out-Null
$resultPath = Join-Path $logDir "db-preflight-$ReportDate.json"
$summaryPath = Join-Path $logDir "db-preflight-$ReportDate-summary.json"

$results | ConvertTo-Json -Depth 3 | Out-File -Encoding UTF8 $resultPath
$summary | ConvertTo-Json -Depth 3 | Out-File -Encoding UTF8 $summaryPath

Write-Host ($summary | ConvertTo-Json -Compress)

if (-not $summary.ok) {
  throw ("db-preflight-check failed: " + ($failed -join ", "))
}

