[CmdletBinding()]
param(
  [int]$ApiPort = 3000,
  [string]$DatabaseUrl = "",
  [string]$RedisUrl = "",
  [string]$ReportDate = "",
  [string]$ChaosHistoryPath = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

function Read-EnvFile([string]$Path) {
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  $lines = Get-Content -Path $Path -ErrorAction SilentlyContinue
  foreach ($line in $lines) {
    $trim = $line.Trim()
    if ($trim -eq "" -or $trim.StartsWith("#")) { continue }
    $parts = $trim.Split("=", 2)
    if ($parts.Length -lt 2) { continue }
    $key = $parts[0].Trim()
    $val = $parts[1].Trim()
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $map[$key] = $val
  }
  return $map
}

function Apply-EnvMap([hashtable]$Map) {
  foreach ($key in $Map.Keys) {
    $current = (Get-Item -Path "Env:$key" -ErrorAction SilentlyContinue).Value
    if ([string]::IsNullOrWhiteSpace($current)) {
      Set-Item -Path "Env:$key" -Value $Map[$key]
    }
  }
}

function Test-PortAvailable([int]$Port) {
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    $listener.Stop()
    return $true
  } catch {
    return $false
  }
}

function Get-RandomAvailablePort() {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  try {
    $listener.Start()
    return [int]$listener.LocalEndpoint.Port
  } finally {
    $listener.Stop()
  }
}

function Resolve-ApiPort([int]$PreferredPort, [int]$MaxOffset = 200, [int]$RandomRetries = 10) {
  if (Test-PortAvailable -Port $PreferredPort) {
    return [pscustomobject]@{
      Port = $PreferredPort
      Mode = "preferred"
    }
  }

  for ($i = 1; $i -le $MaxOffset; $i++) {
    $candidate = $PreferredPort + $i
    if (Test-PortAvailable -Port $candidate) {
      return [pscustomobject]@{
        Port = $candidate
        Mode = "range-fallback"
      }
    }
  }

  for ($attempt = 1; $attempt -le $RandomRetries; $attempt++) {
    $candidate = Get-RandomAvailablePort
    if (Test-PortAvailable -Port $candidate) {
      return [pscustomobject]@{
        Port = $candidate
        Mode = "random-fallback"
      }
    }
  }

  throw "No available API port found for api-real-smoke"
}

Apply-EnvMap -Map (Read-EnvFile (Join-Path $repoRoot ".env"))

if ([string]::IsNullOrWhiteSpace($ReportDate)) {
  $ReportDate = (Get-Date).ToString("yyyy-MM-dd")
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  $DatabaseUrl = $env:DATABASE_URL
}
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  $DatabaseUrl = "postgresql://ipmoney:ipmoney@127.0.0.1:5432/ipmoney"
}
if ([string]::IsNullOrWhiteSpace($RedisUrl)) {
  $RedisUrl = $env:REDIS_URL
}
if ([string]::IsNullOrWhiteSpace($RedisUrl)) {
  $RedisUrl = "redis://127.0.0.1:6379"
}

function Wait-Health([string]$Url, [int]$TimeoutSec = 45) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $status = & curl.exe -s -o NUL -w "%{http_code}" $Url
      if ($status -eq "200") { return }
    } catch { }
    Start-Sleep -Milliseconds 400
  }
  throw "api not ready: $Url"
}

function Normalize-ResultBody {
  param(
    [string]$Raw,
    [int]$MaxChars = 65536
  )

  if ([string]::IsNullOrEmpty($Raw)) {
    return ""
  }
  if ($Raw.Length -le $MaxChars) {
    return $Raw
  }
  $rest = $Raw.Length - $MaxChars
  return $Raw.Substring(0, $MaxChars) + "`n...[truncated $rest chars]"
}

function Invoke-ApiCase {
  param(
    [string]$Name,
    [string]$Method,
    [string]$Url,
    [object]$Body,
    [hashtable]$Headers,
    [int[]]$Expected
  )

  $h = @{}
  if ($Headers) {
    foreach ($k in $Headers.Keys) { $h[$k] = $Headers[$k] }
  }

  try {
    if ($null -ne $Body) {
      $json = $Body | ConvertTo-Json -Depth 10 -Compress
      $h["Content-Type"] = "application/json"
      $resp = Invoke-WebRequest -Method $Method -Uri $Url -Headers $h -Body $json -UseBasicParsing
    } else {
      $resp = Invoke-WebRequest -Method $Method -Uri $Url -Headers $h -UseBasicParsing
    }
    $status = [int]$resp.StatusCode
    $raw = $resp.Content
  } catch {
    $status = [int]$_.Exception.Response.StatusCode.value__
    try {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $raw = $reader.ReadToEnd()
      $reader.Close()
    } catch {
      $raw = ""
    }
  }

  $raw = Normalize-ResultBody -Raw $raw

  return [pscustomobject]@{
    name = $Name
    method = $Method
    url = $Url
    status = $status
    expected = ($Expected -join "/")
    ok = ($Expected -contains $status)
    body = $raw
  }
}

function Add-ApiCaseResult {
  param(
    [System.Collections.ArrayList]$Results,
    [string]$Name,
    [string]$Method,
    [string]$Url,
    [object]$Body,
    [hashtable]$Headers,
    [int[]]$Expected
  )

  $result = Invoke-ApiCase -Name $Name -Method $Method -Url $Url -Body $Body -Headers $Headers -Expected $Expected
  [void]$Results.Add($result)
  return $result
}

function Add-ConcurrentApiCasePairResults {
  param(
    [System.Collections.ArrayList]$Results,
    [string]$NameA,
    [string]$MethodA,
    [string]$UrlA,
    [object]$BodyA,
    [hashtable]$HeadersA,
    [string]$NameB,
    [string]$MethodB,
    [string]$UrlB,
    [object]$BodyB,
    [hashtable]$HeadersB,
    [int[]]$Expected
  )

  $invokeScript = {
    param(
      [string]$Name,
      [string]$Method,
      [string]$Url,
      [string]$BodyJson,
      [hashtable]$Headers,
      [string]$ExpectedCsv
    )

    $expectedStatuses = @()
    if (-not [string]::IsNullOrWhiteSpace($ExpectedCsv)) {
      $expectedStatuses = @($ExpectedCsv.Split(",") | ForEach-Object { [int]$_ })
    }

    $requestHeaders = @{}
    if ($Headers) {
      foreach ($key in $Headers.Keys) {
        $requestHeaders[$key] = $Headers[$key]
      }
    }

    $status = 0
    $raw = ""
    try {
      if (-not [string]::IsNullOrWhiteSpace($BodyJson)) {
        $requestHeaders["Content-Type"] = "application/json"
        $resp = Invoke-WebRequest -Method $Method -Uri $Url -Headers $requestHeaders -Body $BodyJson -UseBasicParsing
      } else {
        $resp = Invoke-WebRequest -Method $Method -Uri $Url -Headers $requestHeaders -UseBasicParsing
      }
      $status = [int]$resp.StatusCode
      $raw = [string]$resp.Content
    } catch {
      if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        $status = [int]$_.Exception.Response.StatusCode.value__
        try {
          $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
          $raw = [string]$reader.ReadToEnd()
          $reader.Close()
        } catch {
          $raw = ""
        }
      } else {
        $status = 0
        $raw = [string]$_.Exception.Message
      }
    }

    if (-not [string]::IsNullOrEmpty($raw) -and $raw.Length -gt 4096) {
      $rest = $raw.Length - 4096
      $raw = $raw.Substring(0, 4096) + "`n...[truncated $rest chars]"
    }

    return [pscustomobject]@{
      name = $Name
      method = $Method
      url = $Url
      status = $status
      expected = $ExpectedCsv
      ok = ($expectedStatuses -contains $status)
      body = $raw
    }
  }

  $bodyJsonA = $null
  if ($null -ne $BodyA) { $bodyJsonA = $BodyA | ConvertTo-Json -Depth 10 -Compress }
  $bodyJsonB = $null
  if ($null -ne $BodyB) { $bodyJsonB = $BodyB | ConvertTo-Json -Depth 10 -Compress }
  $expectedCsv = ($Expected -join ",")

  $jobA = Start-Job -ScriptBlock $invokeScript -ArgumentList @($NameA, $MethodA, $UrlA, $bodyJsonA, $HeadersA, $expectedCsv)
  $jobB = Start-Job -ScriptBlock $invokeScript -ArgumentList @($NameB, $MethodB, $UrlB, $bodyJsonB, $HeadersB, $expectedCsv)

  $pairResults = @()
  try {
    [void](Wait-Job -Job @($jobA, $jobB))
    foreach ($job in @($jobA, $jobB)) {
      $received = Receive-Job -Job $job -ErrorAction SilentlyContinue
      if ($received) {
        $pairResults += @($received)
      }
    }
  } finally {
    foreach ($job in @($jobA, $jobB)) {
      if ($job) {
        Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
      }
    }
  }

  foreach ($pairResult in $pairResults) {
    [void]$Results.Add($pairResult)
  }
  return ,$pairResults
}

function Add-ConcurrentApiCaseTripleResults {
  param(
    [System.Collections.ArrayList]$Results,
    [string]$NameA,
    [string]$MethodA,
    [string]$UrlA,
    [object]$BodyA,
    [hashtable]$HeadersA,
    [string]$NameB,
    [string]$MethodB,
    [string]$UrlB,
    [object]$BodyB,
    [hashtable]$HeadersB,
    [string]$NameC,
    [string]$MethodC,
    [string]$UrlC,
    [object]$BodyC,
    [hashtable]$HeadersC,
    [int[]]$Expected
  )

  $invokeScript = {
    param(
      [string]$Name,
      [string]$Method,
      [string]$Url,
      [string]$BodyJson,
      [hashtable]$Headers,
      [string]$ExpectedCsv
    )

    $expectedStatuses = @()
    if (-not [string]::IsNullOrWhiteSpace($ExpectedCsv)) {
      $expectedStatuses = @($ExpectedCsv.Split(",") | ForEach-Object { [int]$_ })
    }

    $requestHeaders = @{}
    if ($Headers) {
      foreach ($key in $Headers.Keys) {
        $requestHeaders[$key] = $Headers[$key]
      }
    }

    $status = 0
    $raw = ""
    try {
      if (-not [string]::IsNullOrWhiteSpace($BodyJson)) {
        $requestHeaders["Content-Type"] = "application/json"
        $resp = Invoke-WebRequest -Method $Method -Uri $Url -Headers $requestHeaders -Body $BodyJson -UseBasicParsing
      } else {
        $resp = Invoke-WebRequest -Method $Method -Uri $Url -Headers $requestHeaders -UseBasicParsing
      }
      $status = [int]$resp.StatusCode
      $raw = [string]$resp.Content
    } catch {
      if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        $status = [int]$_.Exception.Response.StatusCode.value__
        try {
          $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
          $raw = [string]$reader.ReadToEnd()
          $reader.Close()
        } catch {
          $raw = ""
        }
      } else {
        $status = 0
        $raw = [string]$_.Exception.Message
      }
    }

    if (-not [string]::IsNullOrEmpty($raw) -and $raw.Length -gt 4096) {
      $rest = $raw.Length - 4096
      $raw = $raw.Substring(0, 4096) + "`n...[truncated $rest chars]"
    }

    return [pscustomobject]@{
      name = $Name
      method = $Method
      url = $Url
      status = $status
      expected = $ExpectedCsv
      ok = ($expectedStatuses -contains $status)
      body = $raw
    }
  }

  $bodyJsonA = $null
  if ($null -ne $BodyA) { $bodyJsonA = $BodyA | ConvertTo-Json -Depth 10 -Compress }
  $bodyJsonB = $null
  if ($null -ne $BodyB) { $bodyJsonB = $BodyB | ConvertTo-Json -Depth 10 -Compress }
  $bodyJsonC = $null
  if ($null -ne $BodyC) { $bodyJsonC = $BodyC | ConvertTo-Json -Depth 10 -Compress }
  $expectedCsv = ($Expected -join ",")

  $jobA = Start-Job -ScriptBlock $invokeScript -ArgumentList @($NameA, $MethodA, $UrlA, $bodyJsonA, $HeadersA, $expectedCsv)
  $jobB = Start-Job -ScriptBlock $invokeScript -ArgumentList @($NameB, $MethodB, $UrlB, $bodyJsonB, $HeadersB, $expectedCsv)
  $jobC = Start-Job -ScriptBlock $invokeScript -ArgumentList @($NameC, $MethodC, $UrlC, $bodyJsonC, $HeadersC, $expectedCsv)

  $groupResults = @()
  try {
    [void](Wait-Job -Job @($jobA, $jobB, $jobC))
    foreach ($job in @($jobA, $jobB, $jobC)) {
      $received = Receive-Job -Job $job -ErrorAction SilentlyContinue
      if ($received) {
        $groupResults += @($received)
      }
    }
  } finally {
    foreach ($job in @($jobA, $jobB, $jobC)) {
      if ($job) {
        Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
      }
    }
  }

  foreach ($groupResult in $groupResults) {
    [void]$Results.Add($groupResult)
  }
  return ,$groupResults
}

function Add-ApiFileUploadCaseResult {
  param(
    [System.Collections.ArrayList]$Results,
    [string]$Name,
    [string]$Url,
    [string]$AuthorizationToken,
    [string]$FilePath,
    [hashtable]$FormFields,
    [int[]]$Expected
  )

  $tmpBody = Join-Path $env:TEMP ("api-file-upload-{0}.json" -f ([guid]::NewGuid().ToString('N')))
  try {
    $curlArgs = @("-s", "-o", $tmpBody, "-w", "%{http_code}", "-X", "POST", $Url, "-H", "Authorization: $AuthorizationToken", "-F", "file=@$FilePath")
    if ($FormFields) {
      foreach ($key in $FormFields.Keys) {
        $curlArgs += "-F"
        $curlArgs += ("{0}={1}" -f $key, [string]$FormFields[$key])
      }
    }
    $statusText = & curl.exe @curlArgs
    $status = [int]$statusText
    $raw = ""
    if (Test-Path $tmpBody) {
      $raw = Get-Content -Path $tmpBody -Raw -ErrorAction SilentlyContinue
    }
  } finally {
    Remove-Item -Path $tmpBody -Force -ErrorAction SilentlyContinue
  }

  $result = [pscustomobject]@{
    name = $Name
    method = "POST"
    url = $Url
    status = $status
    expected = ($Expected -join "/")
    ok = ($Expected -contains $status)
    body = (Normalize-ResultBody -Raw $raw)
  }
  [void]$Results.Add($result)
  return $result
}

function Get-AuditLogTotalByAction {
  param(
    [int]$ApiPort,
    [string]$AuthorizationToken,
    [string]$Action
  )

  $encodedAction = [System.Uri]::EscapeDataString($Action)
  $resp = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$ApiPort/admin/audit-logs?action=$encodedAction&page=1&pageSize=1" -Headers @{ Authorization = $AuthorizationToken }
  if ($resp.page -and $null -ne $resp.page.total) {
    return [int]$resp.page.total
  }
  return [int](@($resp.items).Count)
}

function Add-AdminConfigPutCaseResult {
  param(
    [System.Collections.ArrayList]$Results,
    [string]$Name,
    [string]$Url,
    [object]$Body,
    [hashtable]$Headers,
    [string]$Action,
    [int]$ApiPort,
    [string]$AuthorizationToken
  )

  $beforeCount = Get-AuditLogTotalByAction -ApiPort $ApiPort -AuthorizationToken $AuthorizationToken -Action $Action
  $result = Add-ApiCaseResult -Results $Results -Name $Name -Method "PUT" -Url $Url -Body $Body -Headers $Headers -Expected @(200)
  if ($result.ok) {
    $afterCount = Get-AuditLogTotalByAction -ApiPort $ApiPort -AuthorizationToken $AuthorizationToken -Action $Action
    if ($afterCount -le $beforeCount) {
      $result.ok = $false
      $result.expected = "$($result.expected)+audit-log-increment"
      $result.body = "$($result.body)`n[audit-check] action=$Action before=$beforeCount after=$afterCount"
    }
  }
  return $result
}

function Select-ContentId {
  param(
    [object[]]$Items,
    [string]$OwnerField,
    [string]$CurrentUserId,
    [string]$Label
  )

  $list = @($Items)
  if ($list.Count -le 0) {
    throw "No $Label items found for smoke write cases"
  }

  $candidate = $null
  if (-not [string]::IsNullOrWhiteSpace($OwnerField)) {
    $candidate = $list | Where-Object {
      $owner = $_.PSObject.Properties[$OwnerField].Value
      $owner -and [string]$owner -ne $CurrentUserId
    } | Select-Object -First 1
  }
  if (-not $candidate) {
    $candidate = $list | Select-Object -First 1
  }
  if (-not $candidate -or -not $candidate.id) {
    throw "No valid $Label id available for smoke write cases"
  }
  return [string]$candidate.id
}

function New-WriteHeaders {
  param(
    [string]$AuthorizationToken,
    [string]$Prefix,
    [string]$Label
  )

  $suffix = ([guid]::NewGuid().ToString('N')).Substring(0, 8)
  return @{
    Authorization = $AuthorizationToken
    "Idempotency-Key" = "$Prefix-$Label-$suffix"
  }
}

function Get-ResultStringField {
  param(
    [pscustomobject]$Result,
    [string]$Field
  )

  if (-not $Result -or [string]::IsNullOrWhiteSpace($Result.body)) {
    throw "Result body is empty for case '$($Result.name)'"
  }
  $regex = '"' + [regex]::Escape($Field) + '"\s*:\s*"([^"]+)"'
  $match = [regex]::Match($Result.body, $regex)
  if (-not $match.Success) {
    throw "Cannot parse field '$Field' from case '$($Result.name)'"
  }
  return [string]$match.Groups[1].Value
}

function Add-ResultAssertionFailure {
  param(
    [pscustomobject]$Result,
    [string]$Assertion,
    [string]$Message
  )

  if (-not $Result) {
    throw "Cannot mark assertion failure on empty result"
  }
  $Result.ok = $false
  if (-not [string]::IsNullOrWhiteSpace($Assertion)) {
    $Result.expected = "$($Result.expected)+$Assertion"
  }
  if ([string]::IsNullOrWhiteSpace($Result.body)) {
    $Result.body = "[assert] $Message"
  } else {
    $Result.body = "$($Result.body)`n[assert] $Message"
  }
}

function Assert-ConcurrentPairOneSuccessOneConflict {
  param(
    [object[]]$PairResults,
    [int[]]$SuccessStatuses,
    [int]$ConflictStatus,
    [string]$Assertion
  )

  $results = @($PairResults)
  if ($results.Count -ne 2) {
    foreach ($result in $results) {
      Add-ResultAssertionFailure -Result $result -Assertion $Assertion -Message "Expected 2 concurrent results but got $($results.Count)"
    }
    return
  }

  $successCount = @($results | Where-Object { $SuccessStatuses -contains [int]$_.status }).Count
  $conflictCount = @($results | Where-Object { [int]$_.status -eq $ConflictStatus }).Count
  if ($successCount -ne 1 -or $conflictCount -ne 1) {
    $statusSummary = ($results | ForEach-Object { [string]$_.status }) -join ","
    foreach ($result in $results) {
      Add-ResultAssertionFailure -Result $result -Assertion $Assertion -Message "Expected one success + one conflict($ConflictStatus), got statuses [$statusSummary]"
    }
  }
}

function Assert-ConcurrentResultStatusCounts {
  param(
    [object[]]$Results,
    [int[]]$SuccessStatuses,
    [int]$ExpectedSuccessCount,
    [int]$ConflictStatus,
    [int]$ExpectedConflictCount,
    [string]$Assertion
  )

  $items = @($Results)
  $successCount = @($items | Where-Object { $SuccessStatuses -contains [int]$_.status }).Count
  $conflictCount = @($items | Where-Object { [int]$_.status -eq $ConflictStatus }).Count
  if ($successCount -ne $ExpectedSuccessCount -or $conflictCount -ne $ExpectedConflictCount) {
    $statusSummary = ($items | ForEach-Object { [string]$_.status }) -join ","
    foreach ($item in $items) {
      Add-ResultAssertionFailure -Result $item -Assertion $Assertion -Message "Expected success/conflict counts $ExpectedSuccessCount/$ExpectedConflictCount, got statuses [$statusSummary]"
    }
  }
}

function Get-ResultJsonObject {
  param(
    [pscustomobject]$Result
  )

  if (-not $Result -or [string]::IsNullOrWhiteSpace($Result.body)) {
    Add-ResultAssertionFailure -Result $Result -Assertion "json-body-present" -Message "Result body is empty"
    return $null
  }

  try {
    return $Result.body | ConvertFrom-Json
  } catch {
    Add-ResultAssertionFailure -Result $Result -Assertion "json-parse" -Message "Result body is not valid JSON"
    return $null
  }
}

function Get-ResultJsonFieldLookup {
  param(
    [object]$Json,
    [string]$FieldPath
  )

  $current = $Json
  foreach ($segment in $FieldPath.Split('.')) {
    if ($null -eq $current) {
      return [pscustomobject]@{ found = $false; value = $null }
    }

    if ($current -is [System.Collections.IDictionary]) {
      if ($current.Contains($segment)) {
        $current = $current[$segment]
        continue
      }
      return [pscustomobject]@{ found = $false; value = $null }
    }

    if ($current -is [System.Array]) {
      if ($segment -match '^\d+$') {
        $index = [int]$segment
        if ($index -ge 0 -and $index -lt $current.Length) {
          $current = $current[$index]
          continue
        }
      }
      return [pscustomobject]@{ found = $false; value = $null }
    }

    $prop = $current.PSObject.Properties[$segment]
    if (-not $prop) {
      return [pscustomobject]@{ found = $false; value = $null }
    }
    $current = $prop.Value
  }

  return [pscustomobject]@{ found = $true; value = $current }
}

function Assert-ResultJsonFieldIn {
  param(
    [pscustomobject]$Result,
    [string]$Field,
    [object[]]$ExpectedValues,
    [string]$Assertion
  )

  $json = Get-ResultJsonObject -Result $Result
  if (-not $json) { return }
  $lookup = Get-ResultJsonFieldLookup -Json $json -FieldPath $Field
  if (-not $lookup.found) {
    Add-ResultAssertionFailure -Result $Result -Assertion $Assertion -Message "Missing field '$Field'"
    return
  }
  $actual = [string]$lookup.value
  $expectedNormalized = @($ExpectedValues | ForEach-Object { [string]$_ })
  if (-not ($expectedNormalized -contains $actual)) {
    Add-ResultAssertionFailure -Result $Result -Assertion $Assertion -Message "Field '$Field' expected one of [$($expectedNormalized -join ', ')] but got '$actual'"
  }
}

function Assert-ResultJsonFieldEquals {
  param(
    [pscustomobject]$Result,
    [string]$Field,
    [object]$ExpectedValue,
    [string]$Assertion
  )

  Assert-ResultJsonFieldIn -Result $Result -Field $Field -ExpectedValues @($ExpectedValue) -Assertion $Assertion
}

function Assert-ResultJsonArrayContains {
  param(
    [pscustomobject]$Result,
    [string]$Field,
    [object]$ExpectedValue,
    [string]$Assertion
  )

  $json = Get-ResultJsonObject -Result $Result
  if (-not $json) { return }
  $lookup = Get-ResultJsonFieldLookup -Json $json -FieldPath $Field
  if (-not $lookup.found) {
    Add-ResultAssertionFailure -Result $Result -Assertion $Assertion -Message "Missing array field '$Field'"
    return
  }
  if ($lookup.value -is [string] -or -not ($lookup.value -is [System.Collections.IEnumerable])) {
    Add-ResultAssertionFailure -Result $Result -Assertion $Assertion -Message "Field '$Field' is not an array"
    return
  }
  $items = @($lookup.value | ForEach-Object { [string]$_ })
  if (-not ($items -contains [string]$ExpectedValue)) {
    Add-ResultAssertionFailure -Result $Result -Assertion $Assertion -Message "Array '$Field' does not contain '$ExpectedValue'"
  }
}

function Assert-ResultJsonArrayItemFieldEquals {
  param(
    [pscustomobject]$Result,
    [string]$ArrayField,
    [string]$MatchField,
    [object]$MatchValue,
    [string]$TargetField,
    [object]$ExpectedValue,
    [string]$Assertion
  )

  $json = Get-ResultJsonObject -Result $Result
  if (-not $json) { return }
  $arrayLookup = Get-ResultJsonFieldLookup -Json $json -FieldPath $ArrayField
  if (-not $arrayLookup.found) {
    Add-ResultAssertionFailure -Result $Result -Assertion $Assertion -Message "Missing array field '$ArrayField'"
    return
  }
  if ($arrayLookup.value -is [string] -or -not ($arrayLookup.value -is [System.Collections.IEnumerable])) {
    Add-ResultAssertionFailure -Result $Result -Assertion $Assertion -Message "Field '$ArrayField' is not an array"
    return
  }

  $matchedItem = $null
  foreach ($item in @($arrayLookup.value)) {
    $matchLookup = Get-ResultJsonFieldLookup -Json $item -FieldPath $MatchField
    if ($matchLookup.found -and [string]$matchLookup.value -eq [string]$MatchValue) {
      $matchedItem = $item
      break
    }
  }
  if (-not $matchedItem) {
    Add-ResultAssertionFailure -Result $Result -Assertion $Assertion -Message "Array '$ArrayField' has no item where '$MatchField' == '$MatchValue'"
    return
  }

  $targetLookup = Get-ResultJsonFieldLookup -Json $matchedItem -FieldPath $TargetField
  if (-not $targetLookup.found) {
    Add-ResultAssertionFailure -Result $Result -Assertion $Assertion -Message "Matched item missing field '$TargetField'"
    return
  }
  if ([string]$targetLookup.value -ne [string]$ExpectedValue) {
    Add-ResultAssertionFailure -Result $Result -Assertion $Assertion -Message "Matched item field '$TargetField' expected '$ExpectedValue' but got '$($targetLookup.value)'"
  }
}

function New-RefundReadyOrder {
  param(
    [System.Collections.ArrayList]$Results,
    [int]$ApiPort,
    [string]$UserToken,
    [string]$AdminToken,
    [string]$ListingId,
    [string]$IdempotencyPrefix,
    [string]$CasePrefix
  )

  $orderCreate = Add-ApiCaseResult -Results $Results -Name "$CasePrefix-order-create" -Method "POST" -Url "http://127.0.0.1:$ApiPort/orders" -Body @{ listingId = $ListingId } -Headers (New-WriteHeaders -AuthorizationToken $UserToken -Prefix $IdempotencyPrefix -Label "$CasePrefix-order-create") -Expected @(200, 201)
  $orderId = Get-ResultStringField -Result $orderCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($orderId)) { throw "$CasePrefix-order-create missing id" }
  [void](Add-ApiCaseResult -Results $Results -Name "$CasePrefix-order-payment-intent-deposit" -Method "POST" -Url "http://127.0.0.1:$ApiPort/orders/$orderId/payment-intents" -Body @{ payType = "DEPOSIT" } -Headers (New-WriteHeaders -AuthorizationToken $UserToken -Prefix $IdempotencyPrefix -Label "$CasePrefix-order-payment-intent-deposit") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $Results -Name "$CasePrefix-admin-order-manual-payment-deposit" -Method "POST" -Url "http://127.0.0.1:$ApiPort/admin/orders/$orderId/payments/manual" -Body @{ payType = "DEPOSIT" } -Headers (New-WriteHeaders -AuthorizationToken $AdminToken -Prefix $IdempotencyPrefix -Label "$CasePrefix-admin-order-manual-payment-deposit") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $Results -Name "$CasePrefix-admin-order-contract-signed" -Method "POST" -Url "http://127.0.0.1:$ApiPort/admin/orders/$orderId/milestones/contract-signed" -Body @{ dealAmountFen = 2000000 } -Headers (New-WriteHeaders -AuthorizationToken $AdminToken -Prefix $IdempotencyPrefix -Label "$CasePrefix-admin-order-contract-signed") -Expected @(200, 201))
  return $orderId
}

$portResolution = Resolve-ApiPort -PreferredPort $ApiPort
$resolvedApiPort = [int]$portResolution.Port
if ($portResolution.Mode -eq "range-fallback") {
  Write-Host ("[api-real-smoke] api port {0} unavailable, fallback to nearby port {1}" -f $ApiPort, $resolvedApiPort)
}
if ($portResolution.Mode -eq "random-fallback") {
  Write-Host ("[api-real-smoke] api port range [{0}, {1}] unavailable, fallback to random port {2}" -f $ApiPort, ($ApiPort + 200), $resolvedApiPort)
}

$env:PORT = "$resolvedApiPort"
$env:DATABASE_URL = $DatabaseUrl
$env:REDIS_URL = $RedisUrl
$env:DEMO_AUTH_ENABLED = "true"
$env:DEMO_PAYMENT_ENABLED = "true"
# Ensure admin actor/token are UUIDs so admin write audit logs remain valid.
if ([string]::IsNullOrWhiteSpace($env:DEMO_ADMIN_ID)) {
  $env:DEMO_ADMIN_ID = [guid]::NewGuid().ToString()
}
$env:DEMO_ADMIN_TOKEN = $env:DEMO_ADMIN_ID
if ([string]::IsNullOrWhiteSpace($env:DEMO_USER_TOKEN)) {
  $env:DEMO_USER_TOKEN = "demo-user-$([guid]::NewGuid().ToString('N'))"
}
if ([string]::IsNullOrWhiteSpace($env:DEMO_USER_ID)) {
  $env:DEMO_USER_ID = [guid]::NewGuid().ToString()
}
# Smoke tests should not rely on UUID passthrough tokens; keep it off explicitly.
$env:DEMO_AUTH_ALLOW_UUID_TOKENS = "false"
# Keep smoke focused on business behavior instead of local rate-limit noise.
$env:RATE_LIMIT_ENABLED = "false"
# Keep file upload smoke local-only to avoid external object storage dependency.
$env:S3_BUCKET = ""
$env:S3_ACCESS_KEY_ID = ""
$env:S3_SECRET_ACCESS_KEY = ""
$env:UPLOAD_DIR = (Join-Path $repoRoot ".tmp/uploads")
New-Item -ItemType Directory -Force $env:UPLOAD_DIR | Out-Null

$logDir = Join-Path $repoRoot ".tmp"
New-Item -ItemType Directory -Force $logDir | Out-Null
$stdoutPath = Join-Path $logDir "api-real-smoke.out.log"
$stderrPath = Join-Path $logDir "api-real-smoke.err.log"
$resultsPath = Join-Path $logDir "api-real-smoke-$ReportDate.json"
$summaryPath = Join-Path $logDir "api-real-smoke-$ReportDate-summary.json"
$smokeEvidencePath = Join-Path $logDir "api-real-smoke-evidence-$ReportDate.txt"
"api smoke evidence $ReportDate" | Out-File -Encoding ASCII $smokeEvidencePath

$proc = Start-Process -FilePath "node" -ArgumentList @("apps/api/dist/main.js") -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

try {
  Wait-Health -Url "http://127.0.0.1:$resolvedApiPort/health" -TimeoutSec 45

  $wechatLogin = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$resolvedApiPort/auth/wechat/mp-login" -Body (@{ code = "demo-code" } | ConvertTo-Json -Compress) -ContentType "application/json"
  $userToken = "Bearer $($wechatLogin.accessToken)"
  $adminToken = "Bearer $($env:DEMO_ADMIN_TOKEN)"
  $currentUserId = [string]$wechatLogin.user.id
  $idempotencyPrefix = "smoke-$ReportDate"

  $cases = @(
    @{ name = "health"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/health"; body = $null; headers = @{}; expected = @(200) },
    @{ name = "auth-sms-send"; method = "POST"; url = "http://127.0.0.1:$resolvedApiPort/auth/sms/send"; body = @{ phone = "13800138000" }; headers = @{}; expected = @(200, 201) },
    @{ name = "auth-sms-verify"; method = "POST"; url = "http://127.0.0.1:$resolvedApiPort/auth/sms/verify"; body = @{ phone = "13800138000"; code = "123456" }; headers = @{}; expected = @(200, 201) },
    @{ name = "me"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/me"; body = $null; headers = @{ Authorization = $userToken }; expected = @(200) },
    @{ name = "orders-user"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/orders"; body = $null; headers = @{ Authorization = $userToken }; expected = @(200) },
    @{ name = "admin-listings"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/listings"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-demands"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/demands"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-achievements"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/achievements"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-artworks"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/artworks"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-user-verifications"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/user-verifications"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-audit-logs"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/audit-logs"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-rbac-roles"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-rbac-permissions"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/rbac/permissions"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-report-summary"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/reports/finance/summary"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-patents"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/patents"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-config-trade-rules-get"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/config/trade-rules"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-config-customer-service-get"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/config/customer-service"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-config-recommendation-get"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/config/recommendation"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-config-alerts-get"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/config/alerts"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-config-banner-get"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/config/banner"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-config-taxonomy-get"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/config/taxonomy"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-config-sensitive-words-get"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/config/sensitive-words"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-config-hot-search-get"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/config/hot-search"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "patent-map-summary"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/patent-map/summary?year=2025&level=PROVINCE"; body = $null; headers = @{}; expected = @(200) },
    @{ name = "search-listings"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/search/listings"; body = $null; headers = @{}; expected = @(200) },
    @{ name = "search-demands"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/search/demands"; body = $null; headers = @{}; expected = @(200) },
    @{ name = "search-achievements"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/search/achievements"; body = $null; headers = @{}; expected = @(200) },
    @{ name = "search-artworks"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/search/artworks"; body = $null; headers = @{}; expected = @(200) },
    @{ name = "search-tech-managers"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/search/tech-managers"; body = $null; headers = @{}; expected = @(200) }
  )

  $results = New-Object System.Collections.ArrayList
  foreach ($c in $cases) {
    [void](Add-ApiCaseResult -Results $results -Name $c.name -Method $c.method -Url $c.url -Body $c.body -Headers $c.headers -Expected $c.expected)
  }

  $adminListingsForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/listings" -Headers @{ Authorization = $adminToken }
  $adminDemandsForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/demands" -Headers @{ Authorization = $adminToken }
  $adminAchievementsForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/achievements" -Headers @{ Authorization = $adminToken }
  $adminArtworksForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/artworks" -Headers @{ Authorization = $adminToken }
  $adminPatentsForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/patents" -Headers @{ Authorization = $adminToken }
  $adminIndustryTagsForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/industry-tags" -Headers @{ Authorization = $adminToken }
  $regionsForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/regions"
  $searchTechManagersForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/search/tech-managers"
  $adminUserVerificationsForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/user-verifications" -Headers @{ Authorization = $adminToken }
  $adminTradeRulesConfig = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/config/trade-rules" -Headers @{ Authorization = $adminToken }
  $adminCustomerServiceConfig = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/config/customer-service" -Headers @{ Authorization = $adminToken }
  $adminRecommendationConfig = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/config/recommendation" -Headers @{ Authorization = $adminToken }
  $adminAlertsConfig = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/config/alerts" -Headers @{ Authorization = $adminToken }
  $adminBannerConfig = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/config/banner" -Headers @{ Authorization = $adminToken }
  $adminTaxonomyConfig = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/config/taxonomy" -Headers @{ Authorization = $adminToken }
  $adminSensitiveWordsConfig = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/config/sensitive-words" -Headers @{ Authorization = $adminToken }
  $adminHotSearchConfig = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/config/hot-search" -Headers @{ Authorization = $adminToken }

  $listingCandidates = @($adminListingsForWrites.items)
  if ($listingCandidates.Count -le 0) {
    throw "No listing items found for smoke write/order cases"
  }
  $nonSelfListings = @($listingCandidates | Where-Object { $_.sellerUserId -and [string]$_.sellerUserId -ne $currentUserId })
  $selectedListing = $null
  if ($nonSelfListings.Count -gt 0) {
    $selectedListing = @($nonSelfListings | Select-Object -First 1)[0]
  } else {
    $selectedListing = @($listingCandidates | Select-Object -First 1)[0]
  }
  $listingId = [string]$selectedListing.id
  if ([string]::IsNullOrWhiteSpace($listingId)) {
    throw "No valid listing id available for smoke write/order cases"
  }
  if ([string]$selectedListing.status -ne "ACTIVE") {
    [void](Add-ApiCaseResult -Results $results -Name "admin-listing-prepare-orderable-publish" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$listingId/publish" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-prepare-orderable-publish") -Expected @(200, 201, 409))
  }
  if ([string]$selectedListing.auditStatus -ne "APPROVED") {
    [void](Add-ApiCaseResult -Results $results -Name "admin-listing-prepare-orderable-approve" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$listingId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-prepare-orderable-approve") -Expected @(200, 201, 409))
  }
  $demandId = Select-ContentId -Items @($adminDemandsForWrites.items) -OwnerField "publisherUserId" -CurrentUserId $currentUserId -Label "demand"
  $achievementId = Select-ContentId -Items @($adminAchievementsForWrites.items) -OwnerField "publisherUserId" -CurrentUserId $currentUserId -Label "achievement"
  $artworkId = Select-ContentId -Items @($adminArtworksForWrites.items) -OwnerField "sellerUserId" -CurrentUserId $currentUserId -Label "artwork"
  $patentId = Select-ContentId -Items @($adminPatentsForWrites.items) -OwnerField "" -CurrentUserId $currentUserId -Label "patent"
  $regionCandidates = @()
  if ($regionsForWrites -is [System.Array]) {
    $regionCandidates = @($regionsForWrites)
  } elseif ($regionsForWrites -and $regionsForWrites.items) {
    $regionCandidates = @($regionsForWrites.items)
  }
  $regionItem = $regionCandidates | Select-Object -First 1
  $importRegionCode = ""
  if ($regionItem) {
    if ($regionItem.code) { $importRegionCode = [string]$regionItem.code }
    elseif ($regionItem.regionCode) { $importRegionCode = [string]$regionItem.regionCode }
  }
  if ([string]::IsNullOrWhiteSpace($importRegionCode)) {
    throw "No region code available for patent-map import smoke cases"
  }
  $industryTagCandidates = @()
  if ($adminIndustryTagsForWrites -is [System.Array]) {
    $industryTagCandidates = @($adminIndustryTagsForWrites)
  } elseif ($adminIndustryTagsForWrites -and $adminIndustryTagsForWrites.items) {
    $industryTagCandidates = @($adminIndustryTagsForWrites.items)
  }
  $regionIndustryTags = @()
  foreach ($industryTagItem in @($industryTagCandidates | Select-Object -First 2)) {
    $industryTagName = ""
    if ($industryTagItem.name) { $industryTagName = [string]$industryTagItem.name }
    elseif ($industryTagItem.label) { $industryTagName = [string]$industryTagItem.label }
    elseif ($industryTagItem.id) { $industryTagName = [string]$industryTagItem.id }
    if (-not [string]::IsNullOrWhiteSpace($industryTagName) -and -not ($regionIndustryTags -contains $industryTagName)) {
      $regionIndustryTags += $industryTagName
    }
  }
  $missingOrderId = [guid]::NewGuid().ToString()

  $techManagerId = $null
  $searchTechManagerItem = @($searchTechManagersForWrites.items) | Select-Object -First 1
  if ($searchTechManagerItem) {
    if ($searchTechManagerItem.userId) { $techManagerId = [string]$searchTechManagerItem.userId }
    elseif ($searchTechManagerItem.id) { $techManagerId = [string]$searchTechManagerItem.id }
  }
  if ([string]::IsNullOrWhiteSpace($techManagerId)) {
    $techManagerVerification = @($adminUserVerificationsForWrites.items | Where-Object { $_.type -eq "TECH_MANAGER" }) | Select-Object -First 1
    if ($techManagerVerification -and $techManagerVerification.userId) {
      $techManagerId = [string]$techManagerVerification.userId
    }
  }
  if ([string]::IsNullOrWhiteSpace($techManagerId)) {
    throw "No tech manager id available for smoke write cases"
  }

  $smokeUserListingTitle = "Smoke User Listing $ReportDate $([guid]::NewGuid().ToString('N').Substring(0, 8))"
  $listingCreate = Add-ApiCaseResult -Results $results -Name "listing-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings" -Body @{ title = $smokeUserListingTitle; tradeMode = "LICENSE"; licenseMode = "EXCLUSIVE"; priceType = "FIXED"; priceAmountFen = 321000; depositAmountFen = 800; pledgeStatus = "NONE"; existingLicenseStatus = "SOLE"; regionCode = $importRegionCode } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-create") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $listingCreate -Field "title" -ExpectedValue $smokeUserListingTitle -Assertion "listing-create-title"
  Assert-ResultJsonFieldEquals -Result $listingCreate -Field "tradeMode" -ExpectedValue "LICENSE" -Assertion "listing-create-trade-mode"
  Assert-ResultJsonFieldEquals -Result $listingCreate -Field "priceType" -ExpectedValue "FIXED" -Assertion "listing-create-price-type"
  Assert-ResultJsonFieldEquals -Result $listingCreate -Field "priceAmountFen" -ExpectedValue 321000 -Assertion "listing-create-price-amount"
  Assert-ResultJsonFieldEquals -Result $listingCreate -Field "depositAmountFen" -ExpectedValue 800 -Assertion "listing-create-deposit-amount"
  Assert-ResultJsonFieldEquals -Result $listingCreate -Field "pledgeStatus" -ExpectedValue "NONE" -Assertion "listing-create-pledge-status"
  Assert-ResultJsonFieldEquals -Result $listingCreate -Field "existingLicenseStatus" -ExpectedValue "SOLE" -Assertion "listing-create-existing-license-status"
  $smokeUserListingId = Get-ResultStringField -Result $listingCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($smokeUserListingId)) { throw "listing-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "listing-create-invalid-trade-mode" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings" -Body @{ title = "Smoke User Listing Invalid Trade"; tradeMode = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-create-invalid-trade-mode") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "listing-create-invalid-license-mode" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings" -Body @{ title = "Smoke User Listing Invalid License"; licenseMode = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-create-invalid-license-mode") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "listing-create-invalid-price-type" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings" -Body @{ title = "Smoke User Listing Invalid Price Type"; priceType = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-create-invalid-price-type") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "listing-create-invalid-pledge-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings" -Body @{ title = "Smoke User Listing Invalid Pledge"; pledgeStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-create-invalid-pledge-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "listing-create-invalid-existing-license-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings" -Body @{ title = "Smoke User Listing Invalid Existing License"; existingLicenseStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-create-invalid-existing-license-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "listing-create-invalid-price-amount" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings" -Body @{ title = "Smoke User Listing Invalid Price Amount"; priceAmountFen = -1 } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-create-invalid-price-amount") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "listing-create-invalid-deposit-amount" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings" -Body @{ title = "Smoke User Listing Invalid Deposit Amount"; depositAmountFen = -1 } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-create-invalid-deposit-amount") -Expected @(400))
  $listingUpdate = Add-ApiCaseResult -Results $results -Name "listing-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/listings/$smokeUserListingId" -Body @{ title = "$smokeUserListingTitle Updated"; tradeMode = "ASSIGNMENT"; licenseMode = "SOLE"; priceType = "NEGOTIABLE"; priceAmountFen = 654000; depositAmountFen = 1200; pledgeStatus = "UNKNOWN"; existingLicenseStatus = "UNKNOWN" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-update") -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $listingUpdate -Field "tradeMode" -ExpectedValue "ASSIGNMENT" -Assertion "listing-update-trade-mode"
  Assert-ResultJsonFieldEquals -Result $listingUpdate -Field "priceType" -ExpectedValue "NEGOTIABLE" -Assertion "listing-update-price-type"
  Assert-ResultJsonFieldEquals -Result $listingUpdate -Field "priceAmountFen" -ExpectedValue 654000 -Assertion "listing-update-price-amount"
  Assert-ResultJsonFieldEquals -Result $listingUpdate -Field "depositAmountFen" -ExpectedValue 1200 -Assertion "listing-update-deposit-amount"
  Assert-ResultJsonFieldEquals -Result $listingUpdate -Field "pledgeStatus" -ExpectedValue "UNKNOWN" -Assertion "listing-update-pledge-status"
  Assert-ResultJsonFieldEquals -Result $listingUpdate -Field "existingLicenseStatus" -ExpectedValue "UNKNOWN" -Assertion "listing-update-existing-license-status"
  [void](Add-ApiCaseResult -Results $results -Name "listing-update-invalid-trade-mode" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/listings/$smokeUserListingId" -Body @{ tradeMode = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-update-invalid-trade-mode") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "listing-update-invalid-license-mode" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/listings/$smokeUserListingId" -Body @{ licenseMode = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-update-invalid-license-mode") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "listing-update-invalid-price-type" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/listings/$smokeUserListingId" -Body @{ priceType = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-update-invalid-price-type") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "listing-update-invalid-pledge-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/listings/$smokeUserListingId" -Body @{ pledgeStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-update-invalid-pledge-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "listing-update-invalid-existing-license-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/listings/$smokeUserListingId" -Body @{ existingLicenseStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-update-invalid-existing-license-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "listing-update-invalid-price-amount" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/listings/$smokeUserListingId" -Body @{ priceAmountFen = -1 } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-update-invalid-price-amount") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "listing-update-invalid-deposit-amount" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/listings/$smokeUserListingId" -Body @{ depositAmountFen = -1 } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-update-invalid-deposit-amount") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "listing-update-missing" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/listings/$([guid]::NewGuid().ToString())" -Body @{ title = "Smoke User Listing Missing" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "listing-update-missing") -Expected @(404))

  $newIndustryTagName = "smoke-tag-$ReportDate-$([guid]::NewGuid().ToString('N').Substring(0,8))"
  $adminIndustryTagCreate = Add-ApiCaseResult -Results $results -Name "admin-industry-tag-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/industry-tags" -Body @{ name = $newIndustryTagName } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-industry-tag-create") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminIndustryTagCreate -Field "name" -ExpectedValue $newIndustryTagName -Assertion "admin-industry-tag-create-name"
  [void](Add-ApiCaseResult -Results $results -Name "admin-industry-tag-create-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/industry-tags" -Body @{ name = $newIndustryTagName } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-industry-tag-create-duplicate") -Expected @(409))
  [void](Add-ApiCaseResult -Results $results -Name "admin-industry-tag-create-invalid-empty" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/industry-tags" -Body @{ name = "   " } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-industry-tag-create-invalid-empty") -Expected @(400))
  $adminIndustryTagsAfterCreate = Add-ApiCaseResult -Results $results -Name "admin-industry-tags-list-after-create" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/industry-tags" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  $adminIndustryTagsAfterCreateJson = Get-ResultJsonObject -Result $adminIndustryTagsAfterCreate
  $adminIndustryTagsAfterCreateItems = @()
  if ($adminIndustryTagsAfterCreateJson -is [System.Array]) {
    $adminIndustryTagsAfterCreateItems = @($adminIndustryTagsAfterCreateJson)
  } elseif ($adminIndustryTagsAfterCreateJson -and $adminIndustryTagsAfterCreateJson.items) {
    $adminIndustryTagsAfterCreateItems = @($adminIndustryTagsAfterCreateJson.items)
  }
  $adminIndustryTagCreatedVisible = $false
  foreach ($adminIndustryTagItem in $adminIndustryTagsAfterCreateItems) {
    if ($adminIndustryTagItem -and $adminIndustryTagItem.name -and [string]$adminIndustryTagItem.name -eq $newIndustryTagName) {
      $adminIndustryTagCreatedVisible = $true
      break
    }
  }
  if (-not $adminIndustryTagCreatedVisible) {
    Add-ResultAssertionFailure -Result $adminIndustryTagsAfterCreate -Assertion "admin-industry-tags-created-visible" -Message "Created industry tag '$newIndustryTagName' not found in admin list"
  }
  $publicIndustryTagsList = Add-ApiCaseResult -Results $results -Name "public-industry-tags-list" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/public/industry-tags" -Body $null -Headers @{} -Expected @(200)
  $publicIndustryTagsJson = Get-ResultJsonObject -Result $publicIndustryTagsList
  $publicIndustryTagItems = @()
  if ($publicIndustryTagsJson -is [System.Array]) {
    $publicIndustryTagItems = @($publicIndustryTagsJson)
  } elseif ($publicIndustryTagsJson -and $publicIndustryTagsJson.items) {
    $publicIndustryTagItems = @($publicIndustryTagsJson.items)
  }
  $publicIndustryTagNames = @()
  foreach ($publicIndustryTagItem in $publicIndustryTagItems) {
    if ($publicIndustryTagItem -and $publicIndustryTagItem.name -and -not [string]::IsNullOrWhiteSpace([string]$publicIndustryTagItem.name)) {
      $publicIndustryTagNames += [string]$publicIndustryTagItem.name
    }
  }
  if (-not ($publicIndustryTagNames -contains $newIndustryTagName)) {
    Add-ResultAssertionFailure -Result $publicIndustryTagsList -Assertion "public-industry-tags-created-visible" -Message "Created industry tag '$newIndustryTagName' not found in public list"
  }
  $regionIndustryTags = @($newIndustryTagName) + @($regionIndustryTags | Where-Object { $_ -ne $newIndustryTagName } | Select-Object -First 1)

  [void](Add-ApiCaseResult -Results $results -Name "ai-agent-query-text" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/ai/agent/query" -Body @{ inputType = "TEXT"; inputText = "smoke ai query $ReportDate"; contentScope = "LISTING"; regionCode = $importRegionCode } -Headers @{} -Expected @(200, 204, 404))
  [void](Add-ApiCaseResult -Results $results -Name "ai-agent-query-invalid-content-scope" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/ai/agent/query" -Body @{ inputType = "TEXT"; inputText = "smoke ai invalid scope $ReportDate"; contentScope = "INVALID" } -Headers @{} -Expected @(400, 404))
  [void](Add-ApiCaseResult -Results $results -Name "ai-agent-query-invalid-content-type" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/ai/agent/query" -Body @{ inputType = "TEXT"; inputText = "smoke ai invalid type $ReportDate"; contentScope = "LISTING"; contentType = "INVALID" } -Headers @{} -Expected @(400, 404))
  $adminAiParseList = Add-ApiCaseResult -Results $results -Name "admin-ai-parse-results-list" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/ai/parse-results" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200, 404)
  $aiParseResultId = ""
  if ([int]$adminAiParseList.status -eq 200) {
    $adminAiParseListJson = Get-ResultJsonObject -Result $adminAiParseList
    if ($adminAiParseListJson -and $adminAiParseListJson.items -and @($adminAiParseListJson.items).Count -gt 0) {
      $aiParseResultId = [string]@($adminAiParseListJson.items | Select-Object -First 1).id
    }
  }
  if ([string]::IsNullOrWhiteSpace($aiParseResultId)) {
    foreach ($aiParseSource in @($adminListingsForWrites.items + $adminDemandsForWrites.items + $adminAchievementsForWrites.items + $adminArtworksForWrites.items)) {
      if ($aiParseSource -and $aiParseSource.aiParse -and $aiParseSource.aiParse.id) {
        $aiParseResultId = [string]$aiParseSource.aiParse.id
        break
      }
    }
  }
  if (-not [string]::IsNullOrWhiteSpace($aiParseResultId)) {
    $adminAiParseGet = Add-ApiCaseResult -Results $results -Name "admin-ai-parse-result-get-existing" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/ai/parse-results/$aiParseResultId" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200, 404)
    if ([int]$adminAiParseGet.status -eq 200) {
      Assert-ResultJsonFieldEquals -Result $adminAiParseGet -Field "id" -ExpectedValue $aiParseResultId -Assertion "admin-ai-parse-result-id-match"
      $adminAiParseUpdate = Add-ApiCaseResult -Results $results -Name "admin-ai-parse-result-update-existing" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/ai/parse-results/$aiParseResultId" -Body @{ status = "ACTIVE"; note = "smoke ai parse review $ReportDate" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-ai-parse-result-update-existing") -Expected @(200)
      Assert-ResultJsonFieldEquals -Result $adminAiParseUpdate -Field "id" -ExpectedValue $aiParseResultId -Assertion "admin-ai-parse-update-id-match"
      $aiParseFeedbackHeaders = New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "ai-parse-feedback-create"
      $aiParseFeedbackCreate = Add-ApiCaseResult -Results $results -Name "ai-parse-feedback-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/ai/parse-results/$aiParseResultId/feedback" -Body @{ score = 5; reasonTags = @("SMOKE"); comment = "smoke ai feedback" } -Headers $aiParseFeedbackHeaders -Expected @(200, 201)
      Assert-ResultJsonFieldEquals -Result $aiParseFeedbackCreate -Field "parseResultId" -ExpectedValue $aiParseResultId -Assertion "ai-parse-feedback-target-id"
      $aiParseFeedbackReplay = Add-ApiCaseResult -Results $results -Name "ai-parse-feedback-idempotent-replay" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/ai/parse-results/$aiParseResultId/feedback" -Body @{ score = 5; reasonTags = @("SMOKE"); comment = "smoke ai feedback replay" } -Headers $aiParseFeedbackHeaders -Expected @(200, 201)
      Assert-ResultJsonFieldEquals -Result $aiParseFeedbackReplay -Field "parseResultId" -ExpectedValue $aiParseResultId -Assertion "ai-parse-feedback-replay-target-id"
    }
  } else {
    $missingAiParseResultId = [guid]::NewGuid().ToString()
    [void](Add-ApiCaseResult -Results $results -Name "admin-ai-parse-result-get-missing" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/ai/parse-results/$missingAiParseResultId" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(404))
    [void](Add-ApiCaseResult -Results $results -Name "admin-ai-parse-result-update-missing" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/ai/parse-results/$missingAiParseResultId" -Body @{ status = "ACTIVE"; note = "smoke missing parse result" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-ai-parse-result-update-missing") -Expected @(404))
    [void](Add-ApiCaseResult -Results $results -Name "ai-parse-feedback-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/ai/parse-results/$missingAiParseResultId/feedback" -Body @{ score = 4; reasonTags = @("SMOKE"); comment = "smoke missing feedback" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "ai-parse-feedback-missing") -Expected @(404))
  }

  $existingRegionCodes = @()
  foreach ($regionCandidate in @($regionCandidates)) {
    $regionCandidateCode = ""
    if ($regionCandidate -and $regionCandidate.code) { $regionCandidateCode = [string]$regionCandidate.code }
    elseif ($regionCandidate -and $regionCandidate.regionCode) { $regionCandidateCode = [string]$regionCandidate.regionCode }
    if (-not [string]::IsNullOrWhiteSpace($regionCandidateCode)) {
      $existingRegionCodes += $regionCandidateCode
    }
  }
  $missingRegionCode = ""
  for ($missingRegionTry = 0; $missingRegionTry -lt 20; $missingRegionTry++) {
    $candidateRegionCode = (Get-Random -Minimum 100000 -Maximum 1000000).ToString()
    if (-not ($existingRegionCodes -contains $candidateRegionCode)) {
      $missingRegionCode = $candidateRegionCode
      break
    }
  }
  if ([string]::IsNullOrWhiteSpace($missingRegionCode)) {
    $missingRegionCode = "999998"
  }
  $newRegionCode = ""
  for ($newRegionTry = 0; $newRegionTry -lt 50; $newRegionTry++) {
    $candidateRegionCode = (Get-Random -Minimum 100000 -Maximum 1000000).ToString()
    if ($candidateRegionCode -ne $missingRegionCode -and -not ($existingRegionCodes -contains $candidateRegionCode)) {
      $newRegionCode = $candidateRegionCode
      break
    }
  }
  if ([string]::IsNullOrWhiteSpace($newRegionCode)) {
    foreach ($fallbackRegionCode in @("999997", "999996", "999995")) {
      if ($fallbackRegionCode -ne $missingRegionCode -and -not ($existingRegionCodes -contains $fallbackRegionCode)) {
        $newRegionCode = $fallbackRegionCode
        break
      }
    }
  }
  if ([string]::IsNullOrWhiteSpace($newRegionCode)) {
    throw "No available region code for create/update smoke cases"
  }

  $adminRegionCreate = Add-ApiCaseResult -Results $results -Name "admin-region-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions" -Body @{ code = $newRegionCode; name = "Smoke Region $ReportDate"; level = "CITY"; parentCode = $importRegionCode; centerLat = 31.23; centerLng = 121.47 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-create") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminRegionCreate -Field "code" -ExpectedValue $newRegionCode -Assertion "admin-region-create-code"
  Assert-ResultJsonFieldEquals -Result $adminRegionCreate -Field "parentCode" -ExpectedValue $importRegionCode -Assertion "admin-region-create-parent-code"
  [void](Add-ApiCaseResult -Results $results -Name "admin-region-create-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions" -Body @{ code = $newRegionCode; name = "Smoke Region Duplicate"; level = "CITY" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-create-duplicate") -Expected @(409))
  [void](Add-ApiCaseResult -Results $results -Name "admin-region-create-invalid-code" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions" -Body @{ code = "abc"; name = "Smoke Region Invalid Code"; level = "CITY" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-create-invalid-code") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-region-create-invalid-level" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions" -Body @{ code = "$($newRegionCode.Substring(0, 5))1"; name = "Smoke Region Invalid Level"; level = "TOWN" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-create-invalid-level") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-region-create-invalid-center-lat" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions" -Body @{ code = "$($newRegionCode.Substring(0, 5))2"; name = "Smoke Region Invalid Lat"; level = "CITY"; centerLat = "not-a-number" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-create-invalid-center-lat") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-region-create-invalid-center-lng" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions" -Body @{ code = "$($newRegionCode.Substring(0, 5))3"; name = "Smoke Region Invalid Lng"; level = "CITY"; centerLng = 181 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-create-invalid-center-lng") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-region-create-missing-name" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions" -Body @{ code = "$($newRegionCode.Substring(0, 5))4"; level = "CITY" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-create-missing-name") -Expected @(400))
  $adminRegionUpdate = Add-ApiCaseResult -Results $results -Name "admin-region-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions/$newRegionCode" -Body @{ name = "Smoke Region Updated $ReportDate"; centerLat = 30.11; centerLng = 120.22 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-update") -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $adminRegionUpdate -Field "name" -ExpectedValue "Smoke Region Updated $ReportDate" -Assertion "admin-region-update-name"
  [void](Add-ApiCaseResult -Results $results -Name "admin-region-update-missing" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions/$missingRegionCode" -Body @{ name = "Smoke Region Missing" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-update-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-region-update-invalid-code" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions/abc" -Body @{ name = "Smoke Region Invalid Code Update" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-update-invalid-code") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-region-update-invalid-parent-code" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions/$newRegionCode" -Body @{ parentCode = "abc" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-update-invalid-parent-code") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-region-update-invalid-center-lat" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions/$newRegionCode" -Body @{ centerLat = 95 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-update-invalid-center-lat") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-region-update-invalid-center-lng" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions/$newRegionCode" -Body @{ centerLng = "oops" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-update-invalid-center-lng") -Expected @(400))

  $smokePatentSeq = (Get-Random -Minimum 1000000 -Maximum 10000000).ToString().PadLeft(7, '0')
  $smokePatentApplicationNoNorm = "20261$smokePatentSeq" + "1"
  $smokePatentTitle = "Smoke Patent $ReportDate $smokePatentSeq"
  $adminPatentCreate = Add-ApiCaseResult -Results $results -Name "admin-patent-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patents" -Body @{ applicationNoNorm = $smokePatentApplicationNoNorm; patentType = "INVENTION"; title = $smokePatentTitle; legalStatus = "PENDING"; sourceUpdatedAt = (Get-Date).ToString("o") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-patent-create") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminPatentCreate -Field "applicationNoNorm" -ExpectedValue $smokePatentApplicationNoNorm -Assertion "admin-patent-create-application-no"
  Assert-ResultJsonFieldEquals -Result $adminPatentCreate -Field "title" -ExpectedValue $smokePatentTitle -Assertion "admin-patent-create-title"
  $smokePatentId = Get-ResultStringField -Result $adminPatentCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($smokePatentId)) { throw "admin-patent-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "admin-patent-create-invalid-application-no" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patents" -Body @{ applicationNoNorm = "INVALID"; patentType = "INVENTION"; title = "Smoke Patent Invalid" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-patent-create-invalid-application-no") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-patent-create-missing-patent-type" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patents" -Body @{ applicationNoNorm = "2026123456781"; title = "Smoke Patent Missing Type" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-patent-create-missing-patent-type") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-patent-create-invalid-source-primary" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patents" -Body @{ applicationNoNorm = "2026123456771"; patentType = "INVENTION"; title = "Smoke Patent Invalid Source Primary"; sourcePrimary = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-patent-create-invalid-source-primary") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-patent-create-empty-source-primary" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patents" -Body @{ applicationNoNorm = "2026123456741"; patentType = "INVENTION"; title = "Smoke Patent Empty Source Primary"; sourcePrimary = "" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-patent-create-empty-source-primary") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-patent-create-invalid-legal-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patents" -Body @{ applicationNoNorm = "2026123456761"; patentType = "INVENTION"; title = "Smoke Patent Invalid Legal Status"; legalStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-patent-create-invalid-legal-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-patent-create-empty-jurisdiction" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patents" -Body @{ applicationNoNorm = "2026123456751"; patentType = "INVENTION"; title = "Smoke Patent Empty Jurisdiction"; jurisdiction = "" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-patent-create-empty-jurisdiction") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-patent-create-invalid-source-updated-at" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patents" -Body @{ applicationNoNorm = "2026123456791"; patentType = "INVENTION"; title = "Smoke Patent Invalid Source"; sourceUpdatedAt = "invalid-date" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-patent-create-invalid-source-updated-at") -Expected @(400))
  $adminPatentUpdate = Add-ApiCaseResult -Results $results -Name "admin-patent-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patents/$smokePatentId" -Body @{ title = "$smokePatentTitle Updated"; filingDate = "2026-01-02"; legalStatus = "GRANTED" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-patent-update") -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $adminPatentUpdate -Field "title" -ExpectedValue "$smokePatentTitle Updated" -Assertion "admin-patent-update-title"
  [void](Add-ApiCaseResult -Results $results -Name "admin-patent-update-invalid-filing-date" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patents/$smokePatentId" -Body @{ filingDate = "invalid-date" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-patent-update-invalid-filing-date") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-patent-update-invalid-legal-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patents/$smokePatentId" -Body @{ legalStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-patent-update-invalid-legal-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-patent-update-invalid-source-primary" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patents/$smokePatentId" -Body @{ sourcePrimary = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-patent-update-invalid-source-primary") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-patent-update-missing" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patents/$([guid]::NewGuid().ToString())" -Body @{ title = "Smoke Patent Missing" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-patent-update-missing") -Expected @(404))

  $smokeAnnouncementTitle = "Smoke Announcement $ReportDate $([guid]::NewGuid().ToString('N').Substring(0, 8))"
  $adminAnnouncementCreate = Add-ApiCaseResult -Results $results -Name "admin-announcement-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/announcements" -Body @{ title = $smokeAnnouncementTitle; status = "DRAFT"; summary = "smoke announcement summary" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-announcement-create") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminAnnouncementCreate -Field "title" -ExpectedValue $smokeAnnouncementTitle -Assertion "admin-announcement-create-title"
  $smokeAnnouncementId = Get-ResultStringField -Result $adminAnnouncementCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($smokeAnnouncementId)) { throw "admin-announcement-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "admin-announcement-create-missing-title" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/announcements" -Body @{ summary = "missing title" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-announcement-create-missing-title") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-announcement-create-invalid-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/announcements" -Body @{ title = "Smoke Announcement Invalid Status"; status = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-announcement-create-invalid-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-announcement-list-invalid-status" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/announcements?status=INVALID" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-announcement-update-invalid-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/announcements/$smokeAnnouncementId" -Body @{ status = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-announcement-update-invalid-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-announcement-update-empty-title" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/announcements/$smokeAnnouncementId" -Body @{ title = "   " } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-announcement-update-empty-title") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-announcement-update-missing" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/announcements/$([guid]::NewGuid().ToString())" -Body @{ title = "Smoke Announcement Missing" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-announcement-update-missing") -Expected @(404))
  $adminAnnouncementUpdate = Add-ApiCaseResult -Results $results -Name "admin-announcement-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/announcements/$smokeAnnouncementId" -Body @{ title = "$smokeAnnouncementTitle Updated"; status = "PUBLISHED" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-announcement-update") -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $adminAnnouncementUpdate -Field "status" -ExpectedValue "PUBLISHED" -Assertion "admin-announcement-update-status"
  [void](Add-ApiCaseResult -Results $results -Name "admin-announcement-delete-missing" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/admin/announcements/$([guid]::NewGuid().ToString())" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-announcement-delete-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-announcement-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/admin/announcements/$smokeAnnouncementId" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-announcement-delete") -Expected @(204))
  [void](Add-ApiCaseResult -Results $results -Name "public-announcement-get-deleted" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/public/announcements/$smokeAnnouncementId" -Body $null -Headers @{} -Expected @(404))

  $smokeAdminDemandTitle = "Smoke Admin Demand $ReportDate $([guid]::NewGuid().ToString('N').Substring(0, 8))"
  $adminDemandCreate = Add-ApiCaseResult -Results $results -Name "admin-demand-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands" -Body @{ title = $smokeAdminDemandTitle; source = "ADMIN"; status = "DRAFT"; auditStatus = "PENDING"; budgetType = "FIXED"; budgetMinFen = 1000; budgetMaxFen = 3000; deliveryPeriod = "MONTH_1_3" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-create") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminDemandCreate -Field "title" -ExpectedValue $smokeAdminDemandTitle -Assertion "admin-demand-create-title"
  Assert-ResultJsonFieldEquals -Result $adminDemandCreate -Field "status" -ExpectedValue "DRAFT" -Assertion "admin-demand-create-status"
  $smokeAdminDemandId = Get-ResultStringField -Result $adminDemandCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($smokeAdminDemandId)) { throw "admin-demand-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "admin-demand-create-invalid-source" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands" -Body @{ title = "Smoke Admin Demand Invalid Source"; source = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-create-invalid-source") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-demand-create-invalid-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands" -Body @{ title = "Smoke Admin Demand Invalid Status"; status = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-create-invalid-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-demand-create-invalid-audit-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands" -Body @{ title = "Smoke Admin Demand Invalid Audit"; auditStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-create-invalid-audit-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-demand-create-invalid-budget-type" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands" -Body @{ title = "Smoke Admin Demand Invalid Budget"; budgetType = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-create-invalid-budget-type") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-demand-create-invalid-delivery-period" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands" -Body @{ title = "Smoke Admin Demand Invalid Delivery"; deliveryPeriod = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-create-invalid-delivery-period") -Expected @(400))
  $adminDemandUpdate = Add-ApiCaseResult -Results $results -Name "admin-demand-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands/$smokeAdminDemandId" -Body @{ title = "$smokeAdminDemandTitle Updated"; source = "PLATFORM"; status = "ACTIVE"; auditStatus = "APPROVED"; budgetType = "NEGOTIABLE"; deliveryPeriod = "WITHIN_1_MONTH" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-update") -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $adminDemandUpdate -Field "source" -ExpectedValue "PLATFORM" -Assertion "admin-demand-update-source"
  Assert-ResultJsonFieldEquals -Result $adminDemandUpdate -Field "auditStatus" -ExpectedValue "APPROVED" -Assertion "admin-demand-update-audit-status"
  [void](Add-ApiCaseResult -Results $results -Name "admin-demand-update-invalid-source" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands/$smokeAdminDemandId" -Body @{ source = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-update-invalid-source") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-demand-update-invalid-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands/$smokeAdminDemandId" -Body @{ status = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-update-invalid-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-demand-update-invalid-audit-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands/$smokeAdminDemandId" -Body @{ auditStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-update-invalid-audit-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-demand-update-invalid-budget-type" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands/$smokeAdminDemandId" -Body @{ budgetType = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-update-invalid-budget-type") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-demand-update-invalid-delivery-period" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands/$smokeAdminDemandId" -Body @{ deliveryPeriod = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-update-invalid-delivery-period") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-demand-update-missing" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands/$([guid]::NewGuid().ToString())" -Body @{ title = "Smoke Admin Demand Missing" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-update-missing") -Expected @(404))
  $adminDemandOffShelf = Add-ApiCaseResult -Results $results -Name "admin-demand-off-shelf" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands/$smokeAdminDemandId/off-shelf" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-off-shelf") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminDemandOffShelf -Field "status" -ExpectedValue "OFF_SHELF" -Assertion "admin-demand-off-shelf-status"
  $adminDemandPublish = Add-ApiCaseResult -Results $results -Name "admin-demand-publish" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands/$smokeAdminDemandId/publish" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-publish") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminDemandPublish -Field "status" -ExpectedValue "ACTIVE" -Assertion "admin-demand-publish-status"
  $adminDemandApprove = Add-ApiCaseResult -Results $results -Name "admin-demand-approve" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands/$smokeAdminDemandId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-approve") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminDemandApprove -Field "auditStatus" -ExpectedValue "APPROVED" -Assertion "admin-demand-approve-audit-status"
  $adminDemandReject = Add-ApiCaseResult -Results $results -Name "admin-demand-reject" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands/$smokeAdminDemandId/reject" -Body @{ reason = "smoke reject admin demand" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-reject") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminDemandReject -Field "auditStatus" -ExpectedValue "REJECTED" -Assertion "admin-demand-reject-audit-status"

  $smokeAdminAchievementTitle = "Smoke Admin Achievement $ReportDate $([guid]::NewGuid().ToString('N').Substring(0, 8))"
  $adminAchievementCreate = Add-ApiCaseResult -Results $results -Name "admin-achievement-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements" -Body @{ title = $smokeAdminAchievementTitle; source = "ADMIN"; status = "DRAFT"; auditStatus = "PENDING"; maturity = "CONCEPT" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-create") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminAchievementCreate -Field "title" -ExpectedValue $smokeAdminAchievementTitle -Assertion "admin-achievement-create-title"
  Assert-ResultJsonFieldEquals -Result $adminAchievementCreate -Field "maturity" -ExpectedValue "CONCEPT" -Assertion "admin-achievement-create-maturity"
  $smokeAdminAchievementId = Get-ResultStringField -Result $adminAchievementCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($smokeAdminAchievementId)) { throw "admin-achievement-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "admin-achievement-create-invalid-source" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements" -Body @{ title = "Smoke Admin Achievement Invalid Source"; source = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-create-invalid-source") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-achievement-create-invalid-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements" -Body @{ title = "Smoke Admin Achievement Invalid Status"; status = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-create-invalid-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-achievement-create-invalid-audit-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements" -Body @{ title = "Smoke Admin Achievement Invalid Audit"; auditStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-create-invalid-audit-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-achievement-create-invalid-maturity" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements" -Body @{ title = "Smoke Admin Achievement Invalid Maturity"; maturity = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-create-invalid-maturity") -Expected @(400))
  $adminAchievementUpdate = Add-ApiCaseResult -Results $results -Name "admin-achievement-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements/$smokeAdminAchievementId" -Body @{ title = "$smokeAdminAchievementTitle Updated"; source = "PLATFORM"; status = "ACTIVE"; auditStatus = "APPROVED"; maturity = "PILOT" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-update") -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $adminAchievementUpdate -Field "source" -ExpectedValue "PLATFORM" -Assertion "admin-achievement-update-source"
  Assert-ResultJsonFieldEquals -Result $adminAchievementUpdate -Field "maturity" -ExpectedValue "PILOT" -Assertion "admin-achievement-update-maturity"
  [void](Add-ApiCaseResult -Results $results -Name "admin-achievement-update-invalid-source" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements/$smokeAdminAchievementId" -Body @{ source = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-update-invalid-source") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-achievement-update-invalid-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements/$smokeAdminAchievementId" -Body @{ status = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-update-invalid-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-achievement-update-invalid-audit-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements/$smokeAdminAchievementId" -Body @{ auditStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-update-invalid-audit-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-achievement-update-invalid-maturity" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements/$smokeAdminAchievementId" -Body @{ maturity = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-update-invalid-maturity") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-achievement-update-missing" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements/$([guid]::NewGuid().ToString())" -Body @{ title = "Smoke Admin Achievement Missing" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-update-missing") -Expected @(404))
  $adminAchievementOffShelf = Add-ApiCaseResult -Results $results -Name "admin-achievement-off-shelf" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements/$smokeAdminAchievementId/off-shelf" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-off-shelf") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminAchievementOffShelf -Field "status" -ExpectedValue "OFF_SHELF" -Assertion "admin-achievement-off-shelf-status"
  $adminAchievementPublish = Add-ApiCaseResult -Results $results -Name "admin-achievement-publish" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements/$smokeAdminAchievementId/publish" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-publish") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminAchievementPublish -Field "status" -ExpectedValue "ACTIVE" -Assertion "admin-achievement-publish-status"
  $adminAchievementApprove = Add-ApiCaseResult -Results $results -Name "admin-achievement-approve" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements/$smokeAdminAchievementId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-approve") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminAchievementApprove -Field "auditStatus" -ExpectedValue "APPROVED" -Assertion "admin-achievement-approve-audit-status"
  $adminAchievementReject = Add-ApiCaseResult -Results $results -Name "admin-achievement-reject" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements/$smokeAdminAchievementId/reject" -Body @{ reason = "smoke reject admin achievement" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-reject") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminAchievementReject -Field "auditStatus" -ExpectedValue "REJECTED" -Assertion "admin-achievement-reject-audit-status"

  $smokeAdminArtworkTitle = "Smoke Admin Artwork $ReportDate $([guid]::NewGuid().ToString('N').Substring(0, 8))"
  $adminArtworkCreate = Add-ApiCaseResult -Results $results -Name "admin-artwork-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks" -Body @{ title = $smokeAdminArtworkTitle; category = "PAINTING"; creatorName = "Smoke Artist"; priceType = "FIXED"; source = "ADMIN"; status = "DRAFT"; auditStatus = "PENDING"; paintingGenre = "LANDSCAPE" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-create") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminArtworkCreate -Field "title" -ExpectedValue $smokeAdminArtworkTitle -Assertion "admin-artwork-create-title"
  Assert-ResultJsonFieldEquals -Result $adminArtworkCreate -Field "category" -ExpectedValue "PAINTING" -Assertion "admin-artwork-create-category"
  $smokeAdminArtworkId = Get-ResultStringField -Result $adminArtworkCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($smokeAdminArtworkId)) { throw "admin-artwork-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "admin-artwork-create-invalid-source" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks" -Body @{ title = "Smoke Admin Artwork Invalid Source"; category = "PAINTING"; creatorName = "Smoke Artist"; priceType = "FIXED"; source = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-create-invalid-source") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-artwork-create-invalid-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks" -Body @{ title = "Smoke Admin Artwork Invalid Status"; category = "PAINTING"; creatorName = "Smoke Artist"; priceType = "FIXED"; status = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-create-invalid-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-artwork-create-invalid-audit-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks" -Body @{ title = "Smoke Admin Artwork Invalid Audit"; category = "PAINTING"; creatorName = "Smoke Artist"; priceType = "FIXED"; auditStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-create-invalid-audit-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-artwork-create-invalid-painting-genre" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks" -Body @{ title = "Smoke Admin Artwork Invalid Genre"; category = "PAINTING"; creatorName = "Smoke Artist"; priceType = "FIXED"; paintingGenre = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-create-invalid-painting-genre") -Expected @(400))
  $adminArtworkUpdate = Add-ApiCaseResult -Results $results -Name "admin-artwork-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$smokeAdminArtworkId" -Body @{ title = "$smokeAdminArtworkTitle Updated"; source = "PLATFORM"; category = "CALLIGRAPHY"; calligraphyScript = "KAISHU"; paintingGenre = $null; priceType = "NEGOTIABLE"; status = "ACTIVE"; auditStatus = "APPROVED" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-update") -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $adminArtworkUpdate -Field "source" -ExpectedValue "PLATFORM" -Assertion "admin-artwork-update-source"
  Assert-ResultJsonFieldEquals -Result $adminArtworkUpdate -Field "category" -ExpectedValue "CALLIGRAPHY" -Assertion "admin-artwork-update-category"
  [void](Add-ApiCaseResult -Results $results -Name "admin-artwork-update-invalid-source" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$smokeAdminArtworkId" -Body @{ source = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-update-invalid-source") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-artwork-update-invalid-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$smokeAdminArtworkId" -Body @{ status = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-update-invalid-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-artwork-update-invalid-audit-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$smokeAdminArtworkId" -Body @{ auditStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-update-invalid-audit-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-artwork-update-invalid-category" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$smokeAdminArtworkId" -Body @{ category = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-update-invalid-category") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-artwork-update-invalid-price-type" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$smokeAdminArtworkId" -Body @{ priceType = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-update-invalid-price-type") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-artwork-update-invalid-calligraphy-script" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$smokeAdminArtworkId" -Body @{ calligraphyScript = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-update-invalid-calligraphy-script") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-artwork-update-invalid-painting-genre" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$smokeAdminArtworkId" -Body @{ paintingGenre = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-update-invalid-painting-genre") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-artwork-update-missing" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$([guid]::NewGuid().ToString())" -Body @{ title = "Smoke Admin Artwork Missing" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-update-missing") -Expected @(404))
  $adminArtworkOffShelf = Add-ApiCaseResult -Results $results -Name "admin-artwork-off-shelf" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$smokeAdminArtworkId/off-shelf" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-off-shelf") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminArtworkOffShelf -Field "status" -ExpectedValue "OFF_SHELF" -Assertion "admin-artwork-off-shelf-status"
  $adminArtworkPublish = Add-ApiCaseResult -Results $results -Name "admin-artwork-publish" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$smokeAdminArtworkId/publish" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-publish") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminArtworkPublish -Field "status" -ExpectedValue "ACTIVE" -Assertion "admin-artwork-publish-status"
  $adminArtworkApprove = Add-ApiCaseResult -Results $results -Name "admin-artwork-approve" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$smokeAdminArtworkId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-approve") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminArtworkApprove -Field "auditStatus" -ExpectedValue "APPROVED" -Assertion "admin-artwork-approve-audit-status"
  $adminArtworkReject = Add-ApiCaseResult -Results $results -Name "admin-artwork-reject" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$smokeAdminArtworkId/reject" -Body @{ reason = "smoke reject admin artwork" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-reject") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminArtworkReject -Field "auditStatus" -ExpectedValue "REJECTED" -Assertion "admin-artwork-reject-audit-status"

  if ($regionIndustryTags.Count -gt 0) {
    $adminSetRegionIndustryTags = Add-ApiCaseResult -Results $results -Name "admin-region-industry-tags-set" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions/$importRegionCode/industry-tags" -Body @{ industryTags = $regionIndustryTags } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-industry-tags-set") -Expected @(200)
    Assert-ResultJsonArrayContains -Result $adminSetRegionIndustryTags -Field "industryTags" -ExpectedValue $regionIndustryTags[0] -Assertion "admin-region-industry-tags-persisted"
    [void](Add-ApiCaseResult -Results $results -Name "admin-region-industry-tags-set-invalid-body" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions/$importRegionCode/industry-tags" -Body @{ industryTags = "SMOKE" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-industry-tags-set-invalid-body") -Expected @(400))
    [void](Add-ApiCaseResult -Results $results -Name "admin-region-industry-tags-set-missing-field" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions/$importRegionCode/industry-tags" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-industry-tags-set-missing-field") -Expected @(400))
  }
  [void](Add-ApiCaseResult -Results $results -Name "admin-region-industry-tags-set-missing" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions/$missingRegionCode/industry-tags" -Body @{ industryTags = @($newIndustryTagName) } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-industry-tags-set-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-region-industry-tags-set-invalid-code" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/regions/abc/industry-tags" -Body @{ industryTags = @($newIndustryTagName) } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-region-industry-tags-set-invalid-code") -Expected @(400))

  $smokeAdminListingTitle = "Smoke Admin Listing $ReportDate $([guid]::NewGuid().ToString('N').Substring(0, 8))"
  $adminListingCreate = Add-ApiCaseResult -Results $results -Name "admin-listing-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings" -Body @{ title = $smokeAdminListingTitle; sellerUserId = $currentUserId; source = "ADMIN"; status = "DRAFT"; auditStatus = "PENDING"; tradeMode = "LICENSE"; licenseMode = "EXCLUSIVE"; priceType = "FIXED"; priceAmountFen = 123456; depositAmountFen = 1000; pledgeStatus = "NONE"; existingLicenseStatus = "SOLE"; regionCode = $importRegionCode } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-create") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminListingCreate -Field "title" -ExpectedValue $smokeAdminListingTitle -Assertion "admin-listing-create-title"
  Assert-ResultJsonFieldEquals -Result $adminListingCreate -Field "tradeMode" -ExpectedValue "LICENSE" -Assertion "admin-listing-create-trade-mode"
  Assert-ResultJsonFieldEquals -Result $adminListingCreate -Field "priceType" -ExpectedValue "FIXED" -Assertion "admin-listing-create-price-type"
  Assert-ResultJsonFieldEquals -Result $adminListingCreate -Field "priceAmountFen" -ExpectedValue 123456 -Assertion "admin-listing-create-price-amount"
  Assert-ResultJsonFieldEquals -Result $adminListingCreate -Field "depositAmountFen" -ExpectedValue 1000 -Assertion "admin-listing-create-deposit-amount"
  Assert-ResultJsonFieldEquals -Result $adminListingCreate -Field "pledgeStatus" -ExpectedValue "NONE" -Assertion "admin-listing-create-pledge-status"
  Assert-ResultJsonFieldEquals -Result $adminListingCreate -Field "existingLicenseStatus" -ExpectedValue "SOLE" -Assertion "admin-listing-create-existing-license-status"
  $smokeAdminListingId = Get-ResultStringField -Result $adminListingCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($smokeAdminListingId)) { throw "admin-listing-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-create-invalid-source" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings" -Body @{ title = "Smoke Admin Listing Invalid Source"; sellerUserId = $currentUserId; source = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-create-invalid-source") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-create-invalid-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings" -Body @{ title = "Smoke Admin Listing Invalid Status"; sellerUserId = $currentUserId; status = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-create-invalid-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-create-invalid-audit-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings" -Body @{ title = "Smoke Admin Listing Invalid Audit"; sellerUserId = $currentUserId; auditStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-create-invalid-audit-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-create-invalid-trade-mode" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings" -Body @{ title = "Smoke Admin Listing Invalid Trade"; sellerUserId = $currentUserId; tradeMode = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-create-invalid-trade-mode") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-create-invalid-license-mode" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings" -Body @{ title = "Smoke Admin Listing Invalid License"; sellerUserId = $currentUserId; licenseMode = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-create-invalid-license-mode") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-create-invalid-price-type" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings" -Body @{ title = "Smoke Admin Listing Invalid Price Type"; sellerUserId = $currentUserId; priceType = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-create-invalid-price-type") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-create-invalid-pledge-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings" -Body @{ title = "Smoke Admin Listing Invalid Pledge"; sellerUserId = $currentUserId; pledgeStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-create-invalid-pledge-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-create-invalid-existing-license-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings" -Body @{ title = "Smoke Admin Listing Invalid Existing License"; sellerUserId = $currentUserId; existingLicenseStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-create-invalid-existing-license-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-create-invalid-price-amount" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings" -Body @{ title = "Smoke Admin Listing Invalid Price Amount"; sellerUserId = $currentUserId; priceAmountFen = -1 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-create-invalid-price-amount") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-create-invalid-deposit-amount" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings" -Body @{ title = "Smoke Admin Listing Invalid Deposit Amount"; sellerUserId = $currentUserId; depositAmountFen = -1 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-create-invalid-deposit-amount") -Expected @(400))
  $adminListingUpdate = Add-ApiCaseResult -Results $results -Name "admin-listing-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$smokeAdminListingId" -Body @{ title = "$smokeAdminListingTitle Updated"; source = "PLATFORM"; status = "ACTIVE"; auditStatus = "APPROVED"; tradeMode = "ASSIGNMENT"; licenseMode = "SOLE"; priceType = "NEGOTIABLE"; priceAmountFen = 654321; depositAmountFen = 2000; pledgeStatus = "UNKNOWN"; existingLicenseStatus = "UNKNOWN" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-update") -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $adminListingUpdate -Field "source" -ExpectedValue "PLATFORM" -Assertion "admin-listing-update-source"
  Assert-ResultJsonFieldEquals -Result $adminListingUpdate -Field "tradeMode" -ExpectedValue "ASSIGNMENT" -Assertion "admin-listing-update-trade-mode"
  Assert-ResultJsonFieldEquals -Result $adminListingUpdate -Field "priceType" -ExpectedValue "NEGOTIABLE" -Assertion "admin-listing-update-price-type"
  Assert-ResultJsonFieldEquals -Result $adminListingUpdate -Field "priceAmountFen" -ExpectedValue 654321 -Assertion "admin-listing-update-price-amount"
  Assert-ResultJsonFieldEquals -Result $adminListingUpdate -Field "depositAmountFen" -ExpectedValue 2000 -Assertion "admin-listing-update-deposit-amount"
  Assert-ResultJsonFieldEquals -Result $adminListingUpdate -Field "pledgeStatus" -ExpectedValue "UNKNOWN" -Assertion "admin-listing-update-pledge-status"
  Assert-ResultJsonFieldEquals -Result $adminListingUpdate -Field "existingLicenseStatus" -ExpectedValue "UNKNOWN" -Assertion "admin-listing-update-existing-license-status"
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-update-invalid-source" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$smokeAdminListingId" -Body @{ source = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-update-invalid-source") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-update-invalid-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$smokeAdminListingId" -Body @{ status = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-update-invalid-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-update-invalid-audit-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$smokeAdminListingId" -Body @{ auditStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-update-invalid-audit-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-update-invalid-trade-mode" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$smokeAdminListingId" -Body @{ tradeMode = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-update-invalid-trade-mode") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-update-invalid-license-mode" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$smokeAdminListingId" -Body @{ licenseMode = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-update-invalid-license-mode") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-update-invalid-price-type" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$smokeAdminListingId" -Body @{ priceType = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-update-invalid-price-type") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-update-invalid-pledge-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$smokeAdminListingId" -Body @{ pledgeStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-update-invalid-pledge-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-update-invalid-existing-license-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$smokeAdminListingId" -Body @{ existingLicenseStatus = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-update-invalid-existing-license-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-update-invalid-price-amount" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$smokeAdminListingId" -Body @{ priceAmountFen = -1 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-update-invalid-price-amount") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-update-invalid-deposit-amount" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$smokeAdminListingId" -Body @{ depositAmountFen = -1 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-update-invalid-deposit-amount") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-update-missing" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$([guid]::NewGuid().ToString())" -Body @{ title = "Smoke Admin Listing Missing" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-update-missing") -Expected @(404))
  $adminListingOffShelf = Add-ApiCaseResult -Results $results -Name "admin-listing-off-shelf" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$smokeAdminListingId/off-shelf" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-off-shelf") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminListingOffShelf -Field "status" -ExpectedValue "OFF_SHELF" -Assertion "admin-listing-off-shelf-status"
  $adminListingPublish = Add-ApiCaseResult -Results $results -Name "admin-listing-publish" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$smokeAdminListingId/publish" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-publish") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminListingPublish -Field "status" -ExpectedValue "ACTIVE" -Assertion "admin-listing-publish-status"
  $adminListingApprove = Add-ApiCaseResult -Results $results -Name "admin-listing-approve" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$smokeAdminListingId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-approve") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminListingApprove -Field "auditStatus" -ExpectedValue "APPROVED" -Assertion "admin-listing-approve-audit-status"
  $adminListingReject = Add-ApiCaseResult -Results $results -Name "admin-listing-reject" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$smokeAdminListingId/reject" -Body @{ reason = "smoke reject admin listing" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-reject") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminListingReject -Field "auditStatus" -ExpectedValue "REJECTED" -Assertion "admin-listing-reject-audit-status"

  $adminSetListingFeaturedCity = Add-ApiCaseResult -Results $results -Name "admin-listing-featured-set-city" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$listingId/featured" -Body @{ featuredLevel = "CITY"; featuredRegionCode = $importRegionCode; featuredRank = 0 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-featured-set-city") -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $adminSetListingFeaturedCity -Field "featuredLevel" -ExpectedValue "CITY" -Assertion "admin-listing-featured-level-city"
  Assert-ResultJsonFieldEquals -Result $adminSetListingFeaturedCity -Field "featuredRegionCode" -ExpectedValue $importRegionCode -Assertion "admin-listing-featured-region-city"
  $adminSetListingFeatured = Add-ApiCaseResult -Results $results -Name "admin-listing-featured-set-none" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$listingId/featured" -Body @{ featuredLevel = "NONE" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-featured-set-none") -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $adminSetListingFeatured -Field "featuredLevel" -ExpectedValue "NONE" -Assertion "admin-listing-featured-level-none"
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-featured-set-city-missing-region" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$listingId/featured" -Body @{ featuredLevel = "CITY" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-featured-set-city-missing-region") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-featured-set-invalid-level" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$listingId/featured" -Body @{ featuredLevel = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-featured-set-invalid-level") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-featured-set-city-invalid-rank" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$listingId/featured" -Body @{ featuredLevel = "CITY"; featuredRegionCode = $importRegionCode; featuredRank = -1 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-featured-set-city-invalid-rank") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-featured-set-city-invalid-until" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$listingId/featured" -Body @{ featuredLevel = "CITY"; featuredRegionCode = $importRegionCode; featuredUntil = "not-a-date" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-featured-set-city-invalid-until") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-featured-set-missing" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$([guid]::NewGuid().ToString())/featured" -Body @{ featuredLevel = "NONE" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-featured-set-missing") -Expected @(404))
  $missingListingAuditId = [guid]::NewGuid().ToString()
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-approve-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$missingListingAuditId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-approve-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-reject-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$missingListingAuditId/reject" -Body @{ reason = "smoke reject missing listing" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-reject-missing") -Expected @(404))
  $missingDemandAuditId = [guid]::NewGuid().ToString()
  [void](Add-ApiCaseResult -Results $results -Name "admin-demand-approve-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands/$missingDemandAuditId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-approve-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-demand-reject-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands/$missingDemandAuditId/reject" -Body @{ reason = "smoke reject missing demand" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-reject-missing") -Expected @(404))
  $missingAchievementAuditId = [guid]::NewGuid().ToString()
  [void](Add-ApiCaseResult -Results $results -Name "admin-achievement-approve-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements/$missingAchievementAuditId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-approve-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-achievement-reject-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements/$missingAchievementAuditId/reject" -Body @{ reason = "smoke reject missing achievement" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-reject-missing") -Expected @(404))
  $missingArtworkAuditId = [guid]::NewGuid().ToString()
  [void](Add-ApiCaseResult -Results $results -Name "admin-artwork-approve-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$missingArtworkAuditId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-approve-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-artwork-reject-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$missingArtworkAuditId/reject" -Body @{ reason = "smoke reject missing artwork" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-reject-missing") -Expected @(404))
  $missingListingPublishId = [guid]::NewGuid().ToString()
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-publish-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$missingListingPublishId/publish" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-publish-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-listing-off-shelf-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/listings/$missingListingPublishId/off-shelf" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-listing-off-shelf-missing") -Expected @(404))
  $missingDemandPublishId = [guid]::NewGuid().ToString()
  [void](Add-ApiCaseResult -Results $results -Name "admin-demand-publish-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands/$missingDemandPublishId/publish" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-publish-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-demand-off-shelf-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/demands/$missingDemandPublishId/off-shelf" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-demand-off-shelf-missing") -Expected @(404))
  $missingAchievementPublishId = [guid]::NewGuid().ToString()
  [void](Add-ApiCaseResult -Results $results -Name "admin-achievement-publish-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements/$missingAchievementPublishId/publish" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-publish-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-achievement-off-shelf-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/achievements/$missingAchievementPublishId/off-shelf" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-achievement-off-shelf-missing") -Expected @(404))
  $missingArtworkPublishId = [guid]::NewGuid().ToString()
  [void](Add-ApiCaseResult -Results $results -Name "admin-artwork-publish-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$missingArtworkPublishId/publish" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-publish-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-artwork-off-shelf-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/artworks/$missingArtworkPublishId/off-shelf" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-artwork-off-shelf-missing") -Expected @(404))
  $missingAnnouncementId = [guid]::NewGuid().ToString()
  [void](Add-ApiCaseResult -Results $results -Name "admin-announcement-publish-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/announcements/$missingAnnouncementId/publish" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-announcement-publish-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-announcement-off-shelf-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/announcements/$missingAnnouncementId/off-shelf" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-announcement-off-shelf-missing") -Expected @(404))
  $missingTechManagerId = [guid]::NewGuid().ToString()
  [void](Add-ApiCaseResult -Results $results -Name "admin-tech-manager-update-missing" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/tech-managers/$missingTechManagerId" -Body @{ intro = "smoke tech manager missing" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-tech-manager-update-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-tech-manager-update-invalid-featured-rank" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/tech-managers/$techManagerId" -Body @{ featuredRank = -1 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-tech-manager-update-invalid-featured-rank") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-tech-manager-update-invalid-featured-until" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/tech-managers/$techManagerId" -Body @{ featuredUntil = "invalid-date" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-tech-manager-update-invalid-featured-until") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-tech-manager-update-invalid-service-tags" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/tech-managers/$techManagerId" -Body @{ serviceTags = "not-array" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-tech-manager-update-invalid-service-tags") -Expected @(400))
  $techManagerServiceTag = "smoke-service-$($ReportDate.Replace('-', ''))"
  $adminTechManagerUpdate = Add-ApiCaseResult -Results $results -Name "admin-tech-manager-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/tech-managers/$techManagerId" -Body @{ intro = "smoke tech manager intro $ReportDate"; serviceTags = @($techManagerServiceTag); featuredRank = 0; featuredUntil = (Get-Date).AddDays(7).ToString("o") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-tech-manager-update") -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $adminTechManagerUpdate -Field "userId" -ExpectedValue $techManagerId -Assertion "admin-tech-manager-update-user-id"
  Assert-ResultJsonArrayContains -Result $adminTechManagerUpdate -Field "serviceTags" -ExpectedValue $techManagerServiceTag -Assertion "admin-tech-manager-update-service-tag"

  $listingFavoriteHeaders = New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "favorite-listing-post"
  [void](Add-ApiCaseResult -Results $results -Name "listing-favorite-post" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings/$listingId/favorites" -Body $null -Headers $listingFavoriteHeaders -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "listing-favorite-post-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings/$listingId/favorites" -Body $null -Headers $listingFavoriteHeaders -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "listing-favorite-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/listings/$listingId/favorites" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "favorite-listing-delete") -Expected @(200))
  $demandFavoriteHeaders = New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "favorite-demand-post"
  [void](Add-ApiCaseResult -Results $results -Name "demand-favorite-post" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/demands/$demandId/favorites" -Body $null -Headers $demandFavoriteHeaders -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "demand-favorite-post-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/demands/$demandId/favorites" -Body $null -Headers $demandFavoriteHeaders -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "demand-favorite-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/demands/$demandId/favorites" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "favorite-demand-delete") -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "achievement-favorite-post" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/achievements/$achievementId/favorites" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "favorite-achievement-post") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "achievement-favorite-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/achievements/$achievementId/favorites" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "favorite-achievement-delete") -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "artwork-favorite-post" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/artworks/$artworkId/favorites" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "favorite-artwork-post") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "artwork-favorite-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/artworks/$artworkId/favorites" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "favorite-artwork-delete") -Expected @(200))

  [void](Add-ApiCaseResult -Results $results -Name "listing-consult-post" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings/$listingId/consultations" -Body @{ channel = "FORM" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "consult-listing-post") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "listing-consult-post-invalid-channel" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings/$listingId/consultations" -Body @{ channel = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "consult-listing-post-invalid-channel") -Expected @(400))

  [void](Add-AdminConfigPutCaseResult -Results $results -Name "admin-config-trade-rules-put" -Url "http://127.0.0.1:$resolvedApiPort/admin/config/trade-rules" -Body $adminTradeRulesConfig -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-config-trade-rules-put") -Action "CONFIG_TRADE_RULES_UPDATE" -ApiPort $resolvedApiPort -AuthorizationToken $adminToken)
  [void](Add-AdminConfigPutCaseResult -Results $results -Name "admin-config-customer-service-put" -Url "http://127.0.0.1:$resolvedApiPort/admin/config/customer-service" -Body $adminCustomerServiceConfig -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-config-customer-service-put") -Action "CONFIG_CS_UPDATE" -ApiPort $resolvedApiPort -AuthorizationToken $adminToken)
  [void](Add-AdminConfigPutCaseResult -Results $results -Name "admin-config-recommendation-put" -Url "http://127.0.0.1:$resolvedApiPort/admin/config/recommendation" -Body $adminRecommendationConfig -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-config-recommendation-put") -Action "CONFIG_RECOMMENDATION_UPDATE" -ApiPort $resolvedApiPort -AuthorizationToken $adminToken)
  [void](Add-AdminConfigPutCaseResult -Results $results -Name "admin-config-alerts-put" -Url "http://127.0.0.1:$resolvedApiPort/admin/config/alerts" -Body $adminAlertsConfig -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-config-alerts-put") -Action "CONFIG_ALERT_UPDATE" -ApiPort $resolvedApiPort -AuthorizationToken $adminToken)
  [void](Add-AdminConfigPutCaseResult -Results $results -Name "admin-config-banner-put" -Url "http://127.0.0.1:$resolvedApiPort/admin/config/banner" -Body $adminBannerConfig -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-config-banner-put") -Action "CONFIG_BANNER_UPDATE" -ApiPort $resolvedApiPort -AuthorizationToken $adminToken)
  [void](Add-AdminConfigPutCaseResult -Results $results -Name "admin-config-taxonomy-put" -Url "http://127.0.0.1:$resolvedApiPort/admin/config/taxonomy" -Body $adminTaxonomyConfig -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-config-taxonomy-put") -Action "CONFIG_TAXONOMY_UPDATE" -ApiPort $resolvedApiPort -AuthorizationToken $adminToken)
  [void](Add-AdminConfigPutCaseResult -Results $results -Name "admin-config-sensitive-words-put" -Url "http://127.0.0.1:$resolvedApiPort/admin/config/sensitive-words" -Body $adminSensitiveWordsConfig -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-config-sensitive-words-put") -Action "CONFIG_SENSITIVE_UPDATE" -ApiPort $resolvedApiPort -AuthorizationToken $adminToken)
  [void](Add-AdminConfigPutCaseResult -Results $results -Name "admin-config-hot-search-put" -Url "http://127.0.0.1:$resolvedApiPort/admin/config/hot-search" -Body $adminHotSearchConfig -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-config-hot-search-put") -Action "CONFIG_HOT_SEARCH_UPDATE" -ApiPort $resolvedApiPort -AuthorizationToken $adminToken)
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-manual-payment-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$missingOrderId/payments/manual" -Body @{ payType = "DEPOSIT"; amount = 100 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payment-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-contract-signed-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$missingOrderId/milestones/contract-signed" -Body @{ dealAmountFen = 100 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-contract-signed-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-transfer-completed-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$missingOrderId/milestones/transfer-completed" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-transfer-completed-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-payout-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$missingOrderId/payouts/manual" -Body @{ payoutEvidenceFileId = [guid]::NewGuid().ToString() } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-payout-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-issue-invoice-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$missingOrderId/invoice" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-issue-invoice-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-upsert-invoice-missing" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$missingOrderId/invoice" -Body @{ invoiceFileId = [guid]::NewGuid().ToString() } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-upsert-invoice-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-delete-invoice-missing" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$missingOrderId/invoice" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-delete-invoice-missing") -Expected @(404))
  $missingVerificationId = [guid]::NewGuid().ToString()
  [void](Add-ApiCaseResult -Results $results -Name "admin-user-verification-approve-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/user-verifications/$missingVerificationId/approve" -Body @{ comment = "smoke approve missing verification" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-user-verification-approve-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-user-verification-reject-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/user-verifications/$missingVerificationId/reject" -Body @{ reason = "smoke reject missing verification" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-user-verification-reject-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-user-verification-reject-missing-reason" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/user-verifications/$missingVerificationId/reject" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-user-verification-reject-missing-reason") -Expected @(400))
  $missingRefundRequestId = [guid]::NewGuid().ToString()
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-approve-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$missingRefundRequestId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-approve-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-reject-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$missingRefundRequestId/reject" -Body @{ reason = "smoke missing refund" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-reject-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-complete-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$missingRefundRequestId/complete" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-complete-missing") -Expected @(404))

  $orderCreateHeaders = New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-create"
  $orderCreate = Add-ApiCaseResult -Results $results -Name "order-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders" -Body @{ listingId = $listingId } -Headers $orderCreateHeaders -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $orderCreate -Field "status" -ExpectedValue "DEPOSIT_PENDING" -Assertion "order-status-created"
  $orderId = Get-ResultStringField -Result $orderCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($orderId)) { throw "order-create missing id" }
  $orderCreateReplay = Add-ApiCaseResult -Results $results -Name "order-create-idempotent-replay" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders" -Body @{ listingId = $listingId } -Headers $orderCreateHeaders -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $orderCreateReplay -Field "id" -ExpectedValue $orderId -Assertion "order-create-idempotent-id"
  [void](Add-ApiCaseResult -Results $results -Name "order-payment-intent-invalid-pay-type" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/payment-intents" -Body @{ payType = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-payment-intent-invalid-pay-type") -Expected @(400))
  $orderPaymentIntentDepositHeaders = New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-payment-intent-deposit"
  $orderPaymentIntentDeposit = Add-ApiCaseResult -Results $results -Name "order-payment-intent-deposit" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/payment-intents" -Body @{ payType = "DEPOSIT" } -Headers $orderPaymentIntentDepositHeaders -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $orderPaymentIntentDeposit -Field "payType" -ExpectedValue "DEPOSIT" -Assertion "payment-intent-deposit-pay-type"
  $orderPaymentIntentDepositPaymentId = Get-ResultStringField -Result $orderPaymentIntentDeposit -Field "paymentId"
  $orderPaymentIntentDepositReplay = Add-ApiCaseResult -Results $results -Name "order-payment-intent-deposit-idempotent-replay" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/payment-intents" -Body @{ payType = "DEPOSIT" } -Headers $orderPaymentIntentDepositHeaders -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $orderPaymentIntentDepositReplay -Field "paymentId" -ExpectedValue $orderPaymentIntentDepositPaymentId -Assertion "payment-intent-deposit-idempotent-payment-id"
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-manual-payment-deposit-invalid-paid-at" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/payments/manual" -Body @{ payType = "DEPOSIT"; paidAt = "invalid-date" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payment-deposit-invalid-paid-at") -Expected @(400))
  $adminOrderManualPaymentDeposit = Add-ApiCaseResult -Results $results -Name "admin-order-manual-payment-deposit" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/payments/manual" -Body @{ payType = "DEPOSIT" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payment-deposit") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminOrderManualPaymentDeposit -Field "payType" -ExpectedValue "DEPOSIT" -Assertion "manual-payment-deposit-pay-type"
  Assert-ResultJsonFieldEquals -Result $adminOrderManualPaymentDeposit -Field "status" -ExpectedValue "PAID" -Assertion "manual-payment-deposit-status"
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-manual-payment-deposit-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/payments/manual" -Body @{ payType = "DEPOSIT" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payment-deposit-duplicate") -Expected @(409))
  $orderDetailAfterDeposit = Add-ApiCaseResult -Results $results -Name "order-detail-after-deposit-paid" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $orderDetailAfterDeposit -Field "status" -ExpectedValue "DEPOSIT_PAID" -Assertion "order-status-after-deposit"
  [void](Add-ApiCaseResult -Results $results -Name "order-refund-request-missing-reason-code" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/refund-requests" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-refund-request-missing-reason-code") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "order-refund-request-invalid-reason-code" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/refund-requests" -Body @{ reasonCode = "INVALID"; reasonText = "smoke invalid reasonCode" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-refund-request-invalid-reason-code") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-contract-signed-invalid-signed-at" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/milestones/contract-signed" -Body @{ dealAmountFen = 2000000; signedAt = "invalid-date" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-contract-signed-invalid-signed-at") -Expected @(400))
  $adminOrderContractSigned = Add-ApiCaseResult -Results $results -Name "admin-order-contract-signed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/milestones/contract-signed" -Body @{ dealAmountFen = 2000000 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-contract-signed") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminOrderContractSigned -Field "status" -ExpectedValue "WAIT_FINAL_PAYMENT" -Assertion "order-status-after-contract"
  $orderDetailAfterContractSigned = Add-ApiCaseResult -Results $results -Name "order-detail-after-contract-signed" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $orderDetailAfterContractSigned -Field "status" -ExpectedValue "WAIT_FINAL_PAYMENT" -Assertion "order-detail-status-after-contract"
  $orderPaymentIntentFinalHeaders = New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-payment-intent-final"
  $orderPaymentIntentFinal = Add-ApiCaseResult -Results $results -Name "order-payment-intent-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/payment-intents" -Body @{ payType = "FINAL" } -Headers $orderPaymentIntentFinalHeaders -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $orderPaymentIntentFinal -Field "payType" -ExpectedValue "FINAL" -Assertion "payment-intent-final-pay-type"
  $orderPaymentIntentFinalPaymentId = Get-ResultStringField -Result $orderPaymentIntentFinal -Field "paymentId"
  $orderPaymentIntentFinalReplay = Add-ApiCaseResult -Results $results -Name "order-payment-intent-final-idempotent-replay" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/payment-intents" -Body @{ payType = "FINAL" } -Headers $orderPaymentIntentFinalHeaders -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $orderPaymentIntentFinalReplay -Field "paymentId" -ExpectedValue $orderPaymentIntentFinalPaymentId -Assertion "payment-intent-final-idempotent-payment-id"
  $adminOrderManualPaymentFinal = Add-ApiCaseResult -Results $results -Name "admin-order-manual-payment-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/payments/manual" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payment-final") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminOrderManualPaymentFinal -Field "payType" -ExpectedValue "FINAL" -Assertion "manual-payment-final-pay-type"
  Assert-ResultJsonFieldEquals -Result $adminOrderManualPaymentFinal -Field "status" -ExpectedValue "PAID" -Assertion "manual-payment-final-status"
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-manual-payment-final-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/payments/manual" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payment-final-duplicate") -Expected @(409))
  $orderDetailAfterFinalPaid = Add-ApiCaseResult -Results $results -Name "order-detail-after-final-paid" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $orderDetailAfterFinalPaid -Field "status" -ExpectedValue "FINAL_PAID_ESCROW" -Assertion "order-status-after-final-paid"
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-transfer-completed-invalid-completed-at" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/milestones/transfer-completed" -Body @{ completedAt = "invalid-date" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-transfer-completed-invalid-completed-at") -Expected @(400))
  $adminOrderTransferCompleted = Add-ApiCaseResult -Results $results -Name "admin-order-transfer-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/milestones/transfer-completed" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-transfer-completed") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminOrderTransferCompleted -Field "status" -ExpectedValue "READY_TO_SETTLE" -Assertion "order-status-after-transfer"
  $orderCaseAfterTransfer = Add-ApiCaseResult -Results $results -Name "order-case-after-transfer-completed" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/case" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonArrayItemFieldEquals -Result $orderCaseAfterTransfer -ArrayField "milestones" -MatchField "name" -MatchValue "CONTRACT_SIGNED" -TargetField "status" -ExpectedValue "DONE" -Assertion "order-case-contract-milestone"
  Assert-ResultJsonArrayItemFieldEquals -Result $orderCaseAfterTransfer -ArrayField "milestones" -MatchField "name" -MatchValue "TRANSFER_COMPLETED" -TargetField "status" -ExpectedValue "DONE" -Assertion "order-case-transfer-milestone"
  $orderDetailAfterTransfer = Add-ApiCaseResult -Results $results -Name "order-detail-after-transfer-completed" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $orderDetailAfterTransfer -Field "status" -ExpectedValue "READY_TO_SETTLE" -Assertion "order-detail-status-after-transfer"
  $adminOrderSettlementGet = Add-ApiCaseResult -Results $results -Name "admin-order-settlement-get" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/settlement" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $adminOrderSettlementGet -Field "payoutStatus" -ExpectedValue "PENDING" -Assertion "settlement-status-before-payout"
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-manual-payout-missing-evidence" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/payouts/manual" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payout-missing-evidence") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-upsert-invoice-missing-file" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/invoice" -Body @{ invoiceFileId = [guid]::NewGuid().ToString() } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-upsert-invoice-missing-file") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "order-refund-request-not-allowed-ready-to-settle" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/refund-requests" -Body @{ reasonCode = "OTHER"; reasonText = "smoke not allowed" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-refund-request-not-allowed-ready-to-settle") -Expected @(409))
  [void](Add-ApiCaseResult -Results $results -Name "order-invoice-request-not-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/invoice-requests" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-invoice-request-not-completed") -Expected @(409))
  $evidenceUpload = Add-ApiFileUploadCaseResult -Results $results -Name "file-upload-evidence" -Url "http://127.0.0.1:$resolvedApiPort/files" -AuthorizationToken $userToken -FilePath $smokeEvidencePath -FormFields $null -Expected @(200, 201)
  $evidenceFileId = Get-ResultStringField -Result $evidenceUpload -Field "id"
  if ([string]::IsNullOrWhiteSpace($evidenceFileId)) { throw "file-upload-evidence missing id" }
  $fileTemporaryAccess = Add-ApiCaseResult -Results $results -Name "file-temporary-access-create-preview" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/files/$evidenceFileId/temporary-access" -Body @{ scope = "preview"; ttlSeconds = 600 } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "file-temporary-access-create-preview") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $fileTemporaryAccess -Field "scope" -ExpectedValue "preview" -Assertion "file-temporary-access-scope-preview"
  [void](Add-ApiCaseResult -Results $results -Name "file-temporary-access-invalid-scope" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/files/$evidenceFileId/temporary-access" -Body @{ scope = "invalid"; ttlSeconds = 600 } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "file-temporary-access-invalid-scope") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "file-temporary-access-invalid-ttl" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/files/$evidenceFileId/temporary-access" -Body @{ scope = "preview"; ttlSeconds = -1 } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "file-temporary-access-invalid-ttl") -Expected @(400))
  $fileTemporaryAccessUrl = Get-ResultStringField -Result $fileTemporaryAccess -Field "url"
  if ([string]::IsNullOrWhiteSpace($fileTemporaryAccessUrl)) {
    Add-ResultAssertionFailure -Result $fileTemporaryAccess -Assertion "file-temporary-access-url" -Message "Temporary access url is empty"
  }
  [void](Add-ApiCaseResult -Results $results -Name "file-temporary-access-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/files/$([guid]::NewGuid().ToString())/temporary-access" -Body @{ scope = "preview"; ttlSeconds = 600 } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "file-temporary-access-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-manual-payout-invalid-payout-at" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/payouts/manual" -Body @{ payoutEvidenceFileId = $evidenceFileId; payoutAt = "invalid-date" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payout-invalid-payout-at") -Expected @(400))
  $adminOrderManualPayoutWithEvidence = Add-ApiCaseResult -Results $results -Name "admin-order-manual-payout-with-evidence" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/payouts/manual" -Body @{ payoutEvidenceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payout-with-evidence") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminOrderManualPayoutWithEvidence -Field "payoutStatus" -ExpectedValue "SUCCEEDED" -Assertion "settlement-status-after-payout"
  Assert-ResultJsonFieldEquals -Result $adminOrderManualPayoutWithEvidence -Field "status" -ExpectedValue "COMPLETED" -Assertion "order-status-after-payout"
  Assert-ResultJsonFieldEquals -Result $adminOrderManualPayoutWithEvidence -Field "payoutEvidenceFileId" -ExpectedValue $evidenceFileId -Assertion "payout-evidence-file-linked"
  $orderDetailAfterPayout = Add-ApiCaseResult -Results $results -Name "order-detail-after-manual-payout" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $orderDetailAfterPayout -Field "status" -ExpectedValue "COMPLETED" -Assertion "order-detail-status-after-payout"
  $adminOrderSettlementGetAfterPayout = Add-ApiCaseResult -Results $results -Name "admin-order-settlement-get-after-payout" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/settlement" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $adminOrderSettlementGetAfterPayout -Field "payoutStatus" -ExpectedValue "SUCCEEDED" -Assertion "settlement-detail-status-after-payout"
  $orderInvoiceRequestHeaders = New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-invoice-request-completed"
  $orderInvoiceRequestCompleted = Add-ApiCaseResult -Results $results -Name "order-invoice-request-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/invoice-requests" -Body @{} -Headers $orderInvoiceRequestHeaders -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $orderInvoiceRequestCompleted -Field "status" -ExpectedValue "APPLYING" -Assertion "invoice-request-status-applying"
  $orderInvoiceRequestCompletedReplay = Add-ApiCaseResult -Results $results -Name "order-invoice-request-completed-idempotent-replay" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/invoice-requests" -Body @{} -Headers $orderInvoiceRequestHeaders -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $orderInvoiceRequestCompletedReplay -Field "orderId" -ExpectedValue $orderId -Assertion "invoice-request-idempotent-order-id"
  Assert-ResultJsonFieldEquals -Result $orderInvoiceRequestCompletedReplay -Field "status" -ExpectedValue "APPLYING" -Assertion "invoice-request-idempotent-status"
  [void](Add-ApiCaseResult -Results $results -Name "order-invoice-request-completed-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/invoice-requests" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-invoice-request-completed-duplicate") -Expected @(409))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-upsert-invoice-invalid-issued-at" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/invoice" -Body @{ invoiceFileId = $evidenceFileId; issuedAt = "invalid-date" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-upsert-invoice-invalid-issued-at") -Expected @(400))
  $adminOrderUpsertInvoiceWithFile = Add-ApiCaseResult -Results $results -Name "admin-order-upsert-invoice-with-file" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/invoice" -Body @{ invoiceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-upsert-invoice-with-file") -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $adminOrderUpsertInvoiceWithFile -Field "invoiceFile.id" -ExpectedValue $evidenceFileId -Assertion "invoice-upsert-file-linked"
  $orderInvoiceGetExisting = Add-ApiCaseResult -Results $results -Name "order-invoice-get-existing" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/invoice" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $orderInvoiceGetExisting -Field "invoiceFile.id" -ExpectedValue $evidenceFileId -Assertion "invoice-get-file-linked"
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-delete-invoice-existing" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/invoice" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-delete-invoice-existing") -Expected @(204))
  [void](Add-ApiCaseResult -Results $results -Name "order-invoice-get-after-delete" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/invoice" -Body $null -Headers @{ Authorization = $userToken } -Expected @(404))

  $payoutRaceOrderId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "payout-race"
  [void](Add-ApiCaseResult -Results $results -Name "payout-race-order-payment-intent-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$payoutRaceOrderId/payment-intents" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "payout-race-order-payment-intent-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "payout-race-admin-order-manual-payment-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$payoutRaceOrderId/payments/manual" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "payout-race-admin-order-manual-payment-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "payout-race-admin-order-transfer-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$payoutRaceOrderId/milestones/transfer-completed" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "payout-race-admin-order-transfer-completed") -Expected @(200, 201))
  $payoutRaceOrderDetailBefore = Add-ApiCaseResult -Results $results -Name "payout-race-order-detail-before" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$payoutRaceOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $payoutRaceOrderDetailBefore -Field "status" -ExpectedValue "READY_TO_SETTLE" -Assertion "payout-race-order-status-before"
  $payoutRaceResults = Add-ConcurrentApiCasePairResults -Results $results -NameA "admin-order-manual-payout-race-a" -MethodA "POST" -UrlA "http://127.0.0.1:$resolvedApiPort/admin/orders/$payoutRaceOrderId/payouts/manual" -BodyA @{ payoutEvidenceFileId = $evidenceFileId } -HeadersA (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payout-race-a") -NameB "admin-order-manual-payout-race-b" -MethodB "POST" -UrlB "http://127.0.0.1:$resolvedApiPort/admin/orders/$payoutRaceOrderId/payouts/manual" -BodyB @{ payoutEvidenceFileId = $evidenceFileId } -HeadersB (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payout-race-b") -Expected @(200, 201, 409)
  Assert-ConcurrentPairOneSuccessOneConflict -PairResults $payoutRaceResults -SuccessStatuses @(200, 201) -ConflictStatus 409 -Assertion "order-payout-race"
  $payoutRaceSuccess = @($payoutRaceResults | Where-Object { @(200, 201) -contains [int]$_.status } | Select-Object -First 1)
  if ($payoutRaceSuccess) {
    Assert-ResultJsonFieldEquals -Result $payoutRaceSuccess -Field "payoutStatus" -ExpectedValue "SUCCEEDED" -Assertion "order-payout-race-success-status"
  }
  $payoutRaceOrderDetailAfter = Add-ApiCaseResult -Results $results -Name "payout-race-order-detail-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$payoutRaceOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $payoutRaceOrderDetailAfter -Field "status" -ExpectedValue "COMPLETED" -Assertion "payout-race-order-status-after"
  $payoutRaceSettlementAfter = Add-ApiCaseResult -Results $results -Name "payout-race-settlement-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$payoutRaceOrderId/settlement" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $payoutRaceSettlementAfter -Field "payoutStatus" -ExpectedValue "SUCCEEDED" -Assertion "payout-race-settlement-status-after"

  $payoutTripleRaceOrderId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "payout-race-triple"
  [void](Add-ApiCaseResult -Results $results -Name "payout-race-triple-order-payment-intent-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$payoutTripleRaceOrderId/payment-intents" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "payout-race-triple-order-payment-intent-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "payout-race-triple-admin-order-manual-payment-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$payoutTripleRaceOrderId/payments/manual" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "payout-race-triple-admin-order-manual-payment-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "payout-race-triple-admin-order-transfer-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$payoutTripleRaceOrderId/milestones/transfer-completed" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "payout-race-triple-admin-order-transfer-completed") -Expected @(200, 201))
  $payoutTripleRaceResults = Add-ConcurrentApiCaseTripleResults -Results $results -NameA "admin-order-manual-payout-race-triple-a" -MethodA "POST" -UrlA "http://127.0.0.1:$resolvedApiPort/admin/orders/$payoutTripleRaceOrderId/payouts/manual" -BodyA @{ payoutEvidenceFileId = $evidenceFileId } -HeadersA (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payout-race-triple-a") -NameB "admin-order-manual-payout-race-triple-b" -MethodB "POST" -UrlB "http://127.0.0.1:$resolvedApiPort/admin/orders/$payoutTripleRaceOrderId/payouts/manual" -BodyB @{ payoutEvidenceFileId = $evidenceFileId } -HeadersB (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payout-race-triple-b") -NameC "admin-order-manual-payout-race-triple-c" -MethodC "POST" -UrlC "http://127.0.0.1:$resolvedApiPort/admin/orders/$payoutTripleRaceOrderId/payouts/manual" -BodyC @{ payoutEvidenceFileId = $evidenceFileId } -HeadersC (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payout-race-triple-c") -Expected @(200, 201, 409)
  Assert-ConcurrentResultStatusCounts -Results $payoutTripleRaceResults -SuccessStatuses @(200, 201) -ExpectedSuccessCount 1 -ConflictStatus 409 -ExpectedConflictCount 2 -Assertion "order-payout-race-triple"
  $payoutTripleRaceOrderDetailAfter = Add-ApiCaseResult -Results $results -Name "payout-race-triple-order-detail-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$payoutTripleRaceOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $payoutTripleRaceOrderDetailAfter -Field "status" -ExpectedValue "COMPLETED" -Assertion "payout-race-triple-order-status-after"
  $payoutTripleRaceSettlementAfter = Add-ApiCaseResult -Results $results -Name "payout-race-triple-settlement-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$payoutTripleRaceOrderId/settlement" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $payoutTripleRaceSettlementAfter -Field "payoutStatus" -ExpectedValue "SUCCEEDED" -Assertion "payout-race-triple-settlement-status-after"

  $settlementRefundRaceOrderId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "settlement-refund-race"
  $settlementRefundRaceResults = Add-ConcurrentApiCasePairResults -Results $results -NameA "settlement-refund-race-user-refund-create" -MethodA "POST" -UrlA "http://127.0.0.1:$resolvedApiPort/orders/$settlementRefundRaceOrderId/refund-requests" -BodyA @{ reasonCode = "OTHER"; reasonText = "smoke settlement-refund race" } -HeadersA (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "settlement-refund-race-user-refund-create") -NameB "settlement-refund-race-admin-transfer-completed" -MethodB "POST" -UrlB "http://127.0.0.1:$resolvedApiPort/admin/orders/$settlementRefundRaceOrderId/milestones/transfer-completed" -BodyB @{} -HeadersB (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "settlement-refund-race-admin-transfer-completed") -Expected @(200, 201, 409)
  Assert-ConcurrentPairOneSuccessOneConflict -PairResults $settlementRefundRaceResults -SuccessStatuses @(200, 201) -ConflictStatus 409 -Assertion "settlement-refund-race"
  $settlementRefundRaceOrderDetail = Add-ApiCaseResult -Results $results -Name "settlement-refund-race-order-detail" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$settlementRefundRaceOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldIn -Result $settlementRefundRaceOrderDetail -Field "status" -ExpectedValues @("WAIT_FINAL_PAYMENT", "READY_TO_SETTLE") -Assertion "settlement-refund-race-order-status"
  $settlementRefundRaceRefundCreateSuccess = @($settlementRefundRaceResults | Where-Object { $_.name -eq "settlement-refund-race-user-refund-create" -and @(200, 201) -contains [int]$_.status } | Select-Object -First 1)
  if ($settlementRefundRaceRefundCreateSuccess) {
    Assert-ResultJsonFieldEquals -Result $settlementRefundRaceRefundCreateSuccess -Field "status" -ExpectedValue "PENDING" -Assertion "settlement-refund-race-refund-created-status"
    $settlementRefundRaceRequestId = Get-ResultStringField -Result $settlementRefundRaceRefundCreateSuccess -Field "id"
    if ([string]::IsNullOrWhiteSpace($settlementRefundRaceRequestId)) { throw "settlement-refund-race refund create missing id" }
    [void](Add-ApiCaseResult -Results $results -Name "settlement-refund-race-admin-approve" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$settlementRefundRaceRequestId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "settlement-refund-race-admin-approve") -Expected @(200, 201))
    [void](Add-ApiCaseResult -Results $results -Name "settlement-refund-race-admin-complete" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$settlementRefundRaceRequestId/complete" -Body @{ remark = "smoke settlement-refund race completion" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "settlement-refund-race-admin-complete") -Expected @(200, 201))
    $settlementRefundRaceOrderAfterComplete = Add-ApiCaseResult -Results $results -Name "settlement-refund-race-order-detail-after-complete" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$settlementRefundRaceOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
    Assert-ResultJsonFieldEquals -Result $settlementRefundRaceOrderAfterComplete -Field "status" -ExpectedValue "REFUNDED" -Assertion "settlement-refund-race-order-status-after-complete"
  } else {
    [void](Add-ApiCaseResult -Results $results -Name "settlement-refund-race-refund-create-after-transfer" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$settlementRefundRaceOrderId/refund-requests" -Body @{ reasonCode = "OTHER"; reasonText = "smoke disallowed after transfer won race" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "settlement-refund-race-refund-create-after-transfer") -Expected @(409))
  }

  $mixedRaceOrderId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "mixed-race"
  [void](Add-ApiCaseResult -Results $results -Name "mixed-race-order-payment-intent-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$mixedRaceOrderId/payment-intents" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "mixed-race-order-payment-intent-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "mixed-race-admin-order-manual-payment-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedRaceOrderId/payments/manual" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "mixed-race-admin-order-manual-payment-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "mixed-race-admin-order-transfer-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedRaceOrderId/milestones/transfer-completed" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "mixed-race-admin-order-transfer-completed") -Expected @(200, 201))
  $mixedRaceOrderDetailBefore = Add-ApiCaseResult -Results $results -Name "mixed-race-order-detail-before" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$mixedRaceOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $mixedRaceOrderDetailBefore -Field "status" -ExpectedValue "READY_TO_SETTLE" -Assertion "mixed-race-order-status-before"
  $mixedRaceResults = Add-ConcurrentApiCaseTripleResults -Results $results -NameA "mixed-race-admin-order-payout" -MethodA "POST" -UrlA "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedRaceOrderId/payouts/manual" -BodyA @{ payoutEvidenceFileId = $evidenceFileId } -HeadersA (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "mixed-race-admin-order-payout") -NameB "mixed-race-order-invoice-request" -MethodB "POST" -UrlB "http://127.0.0.1:$resolvedApiPort/orders/$mixedRaceOrderId/invoice-requests" -BodyB @{} -HeadersB (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "mixed-race-order-invoice-request") -NameC "mixed-race-order-refund-request" -MethodC "POST" -UrlC "http://127.0.0.1:$resolvedApiPort/orders/$mixedRaceOrderId/refund-requests" -BodyC @{ reasonCode = "OTHER"; reasonText = "smoke mixed race refund" } -HeadersC (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "mixed-race-order-refund-request") -Expected @(200, 201, 409)
  $mixedRacePayoutResult = @($mixedRaceResults | Where-Object { $_.name -eq "mixed-race-admin-order-payout" } | Select-Object -First 1)
  $mixedRaceInvoiceResult = @($mixedRaceResults | Where-Object { $_.name -eq "mixed-race-order-invoice-request" } | Select-Object -First 1)
  $mixedRaceRefundResult = @($mixedRaceResults | Where-Object { $_.name -eq "mixed-race-order-refund-request" } | Select-Object -First 1)
  if (-not $mixedRacePayoutResult -or -not (@(200, 201) -contains [int]$mixedRacePayoutResult.status)) {
    foreach ($mixedRaceResult in @($mixedRaceResults)) {
      Add-ResultAssertionFailure -Result $mixedRaceResult -Assertion "mixed-race-payout-success" -Message "Expected payout branch to succeed once in mixed race scenario"
    }
  }
  if (-not $mixedRaceRefundResult -or [int]$mixedRaceRefundResult.status -ne 409) {
    foreach ($mixedRaceResult in @($mixedRaceResults)) {
      Add-ResultAssertionFailure -Result $mixedRaceResult -Assertion "mixed-race-refund-conflict" -Message "Expected refund branch to conflict in mixed race scenario"
    }
  }
  if (-not $mixedRaceInvoiceResult -or -not (@(200, 201, 409) -contains [int]$mixedRaceInvoiceResult.status)) {
    foreach ($mixedRaceResult in @($mixedRaceResults)) {
      Add-ResultAssertionFailure -Result $mixedRaceResult -Assertion "mixed-race-invoice-status" -Message "Expected invoice branch status to be one of [200,201,409]"
    }
  }
  if ($mixedRaceInvoiceResult -and (@(200, 201) -contains [int]$mixedRaceInvoiceResult.status)) {
    Assert-ResultJsonFieldEquals -Result $mixedRaceInvoiceResult -Field "status" -ExpectedValue "APPLYING" -Assertion "mixed-race-invoice-success-status"
  }
  $mixedRaceInvoiceResultFinal = $mixedRaceInvoiceResult
  $mixedRaceOrderDetailAfter = Add-ApiCaseResult -Results $results -Name "mixed-race-order-detail-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$mixedRaceOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $mixedRaceOrderDetailAfter -Field "status" -ExpectedValue "COMPLETED" -Assertion "mixed-race-order-status-after"
  $mixedRaceSettlementAfter = Add-ApiCaseResult -Results $results -Name "mixed-race-settlement-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedRaceOrderId/settlement" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $mixedRaceSettlementAfter -Field "payoutStatus" -ExpectedValue "SUCCEEDED" -Assertion "mixed-race-settlement-status-after"
  if ($mixedRaceInvoiceResult -and [int]$mixedRaceInvoiceResult.status -eq 409) {
    $mixedRaceInvoiceRequestAfter = Add-ApiCaseResult -Results $results -Name "mixed-race-order-invoice-request-after-payout" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$mixedRaceOrderId/invoice-requests" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "mixed-race-order-invoice-request-after-payout") -Expected @(200, 201)
    Assert-ResultJsonFieldEquals -Result $mixedRaceInvoiceRequestAfter -Field "status" -ExpectedValue "APPLYING" -Assertion "mixed-race-invoice-after-payout-status"
    $mixedRaceInvoiceResultFinal = $mixedRaceInvoiceRequestAfter
  }
  if ($mixedRaceInvoiceResultFinal -and (@(200, 201) -contains [int]$mixedRaceInvoiceResultFinal.status)) {
    $mixedRaceInvoiceUpsert = Add-ApiCaseResult -Results $results -Name "mixed-race-admin-order-upsert-invoice-with-file" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedRaceOrderId/invoice" -Body @{ invoiceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "mixed-race-admin-order-upsert-invoice-with-file") -Expected @(200)
    Assert-ResultJsonFieldEquals -Result $mixedRaceInvoiceUpsert -Field "invoiceFile.id" -ExpectedValue $evidenceFileId -Assertion "mixed-race-invoice-upsert-file-linked"
  }
  [void](Add-ApiCaseResult -Results $results -Name "mixed-race-order-refund-request-after-payout" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$mixedRaceOrderId/refund-requests" -Body @{ reasonCode = "OTHER"; reasonText = "smoke mixed race disallowed after payout" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "mixed-race-order-refund-request-after-payout") -Expected @(409))
  $mixedRaceRepeatResults = Add-ConcurrentApiCaseTripleResults -Results $results -NameA "mixed-race-repeat-admin-order-payout" -MethodA "POST" -UrlA "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedRaceOrderId/payouts/manual" -BodyA @{ payoutEvidenceFileId = $evidenceFileId } -HeadersA (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "mixed-race-repeat-admin-order-payout") -NameB "mixed-race-repeat-order-invoice-request" -MethodB "POST" -UrlB "http://127.0.0.1:$resolvedApiPort/orders/$mixedRaceOrderId/invoice-requests" -BodyB @{} -HeadersB (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "mixed-race-repeat-order-invoice-request") -NameC "mixed-race-repeat-order-refund-request" -MethodC "POST" -UrlC "http://127.0.0.1:$resolvedApiPort/orders/$mixedRaceOrderId/refund-requests" -BodyC @{ reasonCode = "OTHER"; reasonText = "smoke mixed race repeat refund" } -HeadersC (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "mixed-race-repeat-order-refund-request") -Expected @(200, 201, 409)
  $mixedRaceRepeatPayoutResult = @($mixedRaceRepeatResults | Where-Object { $_.name -eq "mixed-race-repeat-admin-order-payout" } | Select-Object -First 1)
  $mixedRaceRepeatInvoiceResult = @($mixedRaceRepeatResults | Where-Object { $_.name -eq "mixed-race-repeat-order-invoice-request" } | Select-Object -First 1)
  $mixedRaceRepeatRefundResult = @($mixedRaceRepeatResults | Where-Object { $_.name -eq "mixed-race-repeat-order-refund-request" } | Select-Object -First 1)
  if (-not $mixedRaceRepeatPayoutResult -or [int]$mixedRaceRepeatPayoutResult.status -ne 409) {
    foreach ($mixedRaceRepeatResult in @($mixedRaceRepeatResults)) {
      Add-ResultAssertionFailure -Result $mixedRaceRepeatResult -Assertion "mixed-race-repeat-payout-conflict" -Message "Expected repeated payout branch to conflict after settlement already succeeded"
    }
  }
  if (-not $mixedRaceRepeatRefundResult -or [int]$mixedRaceRepeatRefundResult.status -ne 409) {
    foreach ($mixedRaceRepeatResult in @($mixedRaceRepeatResults)) {
      Add-ResultAssertionFailure -Result $mixedRaceRepeatResult -Assertion "mixed-race-repeat-refund-conflict" -Message "Expected repeated refund branch to conflict after payout terminal state"
    }
  }
  if (-not $mixedRaceRepeatInvoiceResult -or -not (@(200, 201, 409) -contains [int]$mixedRaceRepeatInvoiceResult.status)) {
    foreach ($mixedRaceRepeatResult in @($mixedRaceRepeatResults)) {
      Add-ResultAssertionFailure -Result $mixedRaceRepeatResult -Assertion "mixed-race-repeat-invoice-status" -Message "Expected repeated invoice branch status to be one of [200,201,409]"
    }
  }
  if ($mixedRaceRepeatInvoiceResult -and (@(200, 201) -contains [int]$mixedRaceRepeatInvoiceResult.status)) {
    Assert-ResultJsonFieldEquals -Result $mixedRaceRepeatInvoiceResult -Field "status" -ExpectedValue "APPLYING" -Assertion "mixed-race-repeat-invoice-success-status"
    $mixedRaceRepeatInvoiceUpsert = Add-ApiCaseResult -Results $results -Name "mixed-race-repeat-admin-order-upsert-invoice-with-file" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedRaceOrderId/invoice" -Body @{ invoiceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "mixed-race-repeat-admin-order-upsert-invoice-with-file") -Expected @(200)
    Assert-ResultJsonFieldEquals -Result $mixedRaceRepeatInvoiceUpsert -Field "invoiceFile.id" -ExpectedValue $evidenceFileId -Assertion "mixed-race-repeat-invoice-upsert-file-linked"
  }
  $mixedRaceOrderDetailAfterRepeat = Add-ApiCaseResult -Results $results -Name "mixed-race-order-detail-after-repeat" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$mixedRaceOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $mixedRaceOrderDetailAfterRepeat -Field "status" -ExpectedValue "COMPLETED" -Assertion "mixed-race-repeat-order-status-after"
  $mixedRaceSettlementAfterRepeat = Add-ApiCaseResult -Results $results -Name "mixed-race-settlement-after-repeat" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedRaceOrderId/settlement" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $mixedRaceSettlementAfterRepeat -Field "payoutStatus" -ExpectedValue "SUCCEEDED" -Assertion "mixed-race-repeat-settlement-status-after"

  $crossOrderPayoutOrderAId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "cross-order-a"
  [void](Add-ApiCaseResult -Results $results -Name "cross-order-a-order-payment-intent-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$crossOrderPayoutOrderAId/payment-intents" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "cross-order-a-order-payment-intent-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "cross-order-a-admin-order-manual-payment-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$crossOrderPayoutOrderAId/payments/manual" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "cross-order-a-admin-order-manual-payment-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "cross-order-a-admin-order-transfer-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$crossOrderPayoutOrderAId/milestones/transfer-completed" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "cross-order-a-admin-order-transfer-completed") -Expected @(200, 201))
  $crossOrderPayoutOrderBId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "cross-order-b"
  [void](Add-ApiCaseResult -Results $results -Name "cross-order-b-order-payment-intent-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$crossOrderPayoutOrderBId/payment-intents" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "cross-order-b-order-payment-intent-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "cross-order-b-admin-order-manual-payment-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$crossOrderPayoutOrderBId/payments/manual" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "cross-order-b-admin-order-manual-payment-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "cross-order-b-admin-order-transfer-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$crossOrderPayoutOrderBId/milestones/transfer-completed" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "cross-order-b-admin-order-transfer-completed") -Expected @(200, 201))
  $crossOrderPayoutResults = Add-ConcurrentApiCasePairResults -Results $results -NameA "cross-order-admin-payout-a" -MethodA "POST" -UrlA "http://127.0.0.1:$resolvedApiPort/admin/orders/$crossOrderPayoutOrderAId/payouts/manual" -BodyA @{ payoutEvidenceFileId = $evidenceFileId } -HeadersA (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "cross-order-admin-payout-a") -NameB "cross-order-admin-payout-b" -MethodB "POST" -UrlB "http://127.0.0.1:$resolvedApiPort/admin/orders/$crossOrderPayoutOrderBId/payouts/manual" -BodyB @{ payoutEvidenceFileId = $evidenceFileId } -HeadersB (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "cross-order-admin-payout-b") -Expected @(200, 201, 409)
  $crossOrderPayoutResultA = @($crossOrderPayoutResults | Where-Object { $_.name -eq "cross-order-admin-payout-a" } | Select-Object -First 1)
  $crossOrderPayoutResultB = @($crossOrderPayoutResults | Where-Object { $_.name -eq "cross-order-admin-payout-b" } | Select-Object -First 1)
  if (-not $crossOrderPayoutResultA -or -not (@(200, 201) -contains [int]$crossOrderPayoutResultA.status)) {
    foreach ($crossOrderPayoutResult in @($crossOrderPayoutResults)) {
      Add-ResultAssertionFailure -Result $crossOrderPayoutResult -Assertion "cross-order-payout-a-success" -Message "Expected cross-order payout A to succeed under parallel writes"
    }
  }
  if (-not $crossOrderPayoutResultB -or -not (@(200, 201) -contains [int]$crossOrderPayoutResultB.status)) {
    foreach ($crossOrderPayoutResult in @($crossOrderPayoutResults)) {
      Add-ResultAssertionFailure -Result $crossOrderPayoutResult -Assertion "cross-order-payout-b-success" -Message "Expected cross-order payout B to succeed under parallel writes"
    }
  }
  $crossOrderPayoutOrderADetailAfter = Add-ApiCaseResult -Results $results -Name "cross-order-order-a-detail-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$crossOrderPayoutOrderAId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $crossOrderPayoutOrderADetailAfter -Field "status" -ExpectedValue "COMPLETED" -Assertion "cross-order-order-a-status-after"
  $crossOrderPayoutOrderBDetailAfter = Add-ApiCaseResult -Results $results -Name "cross-order-order-b-detail-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$crossOrderPayoutOrderBId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $crossOrderPayoutOrderBDetailAfter -Field "status" -ExpectedValue "COMPLETED" -Assertion "cross-order-order-b-status-after"
  $crossOrderPayoutSettlementA = Add-ApiCaseResult -Results $results -Name "cross-order-settlement-a-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$crossOrderPayoutOrderAId/settlement" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $crossOrderPayoutSettlementA -Field "payoutStatus" -ExpectedValue "SUCCEEDED" -Assertion "cross-order-settlement-a-status-after"
  $crossOrderPayoutSettlementB = Add-ApiCaseResult -Results $results -Name "cross-order-settlement-b-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$crossOrderPayoutOrderBId/settlement" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $crossOrderPayoutSettlementB -Field "payoutStatus" -ExpectedValue "SUCCEEDED" -Assertion "cross-order-settlement-b-status-after"

  $mixedStaggeredOrderId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "mixed-staggered"
  [void](Add-ApiCaseResult -Results $results -Name "mixed-staggered-order-payment-intent-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$mixedStaggeredOrderId/payment-intents" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "mixed-staggered-order-payment-intent-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "mixed-staggered-admin-order-manual-payment-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedStaggeredOrderId/payments/manual" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "mixed-staggered-admin-order-manual-payment-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "mixed-staggered-admin-order-transfer-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedStaggeredOrderId/milestones/transfer-completed" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "mixed-staggered-admin-order-transfer-completed") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "mixed-staggered-admin-order-payout" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedStaggeredOrderId/payouts/manual" -Body @{ payoutEvidenceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "mixed-staggered-admin-order-payout") -Expected @(200, 201))
  $mixedStaggeredTailResults = Add-ConcurrentApiCasePairResults -Results $results -NameA "mixed-staggered-order-invoice-request" -MethodA "POST" -UrlA "http://127.0.0.1:$resolvedApiPort/orders/$mixedStaggeredOrderId/invoice-requests" -BodyA @{} -HeadersA (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "mixed-staggered-order-invoice-request") -NameB "mixed-staggered-order-refund-request" -MethodB "POST" -UrlB "http://127.0.0.1:$resolvedApiPort/orders/$mixedStaggeredOrderId/refund-requests" -BodyB @{ reasonCode = "OTHER"; reasonText = "smoke mixed staggered refund" } -HeadersB (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "mixed-staggered-order-refund-request") -Expected @(200, 201, 409)
  $mixedStaggeredInvoiceResult = @($mixedStaggeredTailResults | Where-Object { $_.name -eq "mixed-staggered-order-invoice-request" } | Select-Object -First 1)
  $mixedStaggeredRefundResult = @($mixedStaggeredTailResults | Where-Object { $_.name -eq "mixed-staggered-order-refund-request" } | Select-Object -First 1)
  if (-not $mixedStaggeredRefundResult -or [int]$mixedStaggeredRefundResult.status -ne 409) {
    foreach ($mixedStaggeredTailResult in @($mixedStaggeredTailResults)) {
      Add-ResultAssertionFailure -Result $mixedStaggeredTailResult -Assertion "mixed-staggered-refund-conflict" -Message "Expected staggered refund branch to conflict after payout terminal state"
    }
  }
  if (-not $mixedStaggeredInvoiceResult -or -not (@(200, 201, 409) -contains [int]$mixedStaggeredInvoiceResult.status)) {
    foreach ($mixedStaggeredTailResult in @($mixedStaggeredTailResults)) {
      Add-ResultAssertionFailure -Result $mixedStaggeredTailResult -Assertion "mixed-staggered-invoice-status" -Message "Expected staggered invoice branch status to be one of [200,201,409]"
    }
  }
  if ($mixedStaggeredInvoiceResult -and (@(200, 201) -contains [int]$mixedStaggeredInvoiceResult.status)) {
    Assert-ResultJsonFieldEquals -Result $mixedStaggeredInvoiceResult -Field "status" -ExpectedValue "APPLYING" -Assertion "mixed-staggered-invoice-success-status"
    $mixedStaggeredInvoiceUpsert = Add-ApiCaseResult -Results $results -Name "mixed-staggered-admin-order-upsert-invoice-with-file" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedStaggeredOrderId/invoice" -Body @{ invoiceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "mixed-staggered-admin-order-upsert-invoice-with-file") -Expected @(200)
    Assert-ResultJsonFieldEquals -Result $mixedStaggeredInvoiceUpsert -Field "invoiceFile.id" -ExpectedValue $evidenceFileId -Assertion "mixed-staggered-invoice-upsert-file-linked"
  }
  $mixedStaggeredOrderDetailAfter = Add-ApiCaseResult -Results $results -Name "mixed-staggered-order-detail-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$mixedStaggeredOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $mixedStaggeredOrderDetailAfter -Field "status" -ExpectedValue "COMPLETED" -Assertion "mixed-staggered-order-status-after"
  $mixedStaggeredSettlementAfter = Add-ApiCaseResult -Results $results -Name "mixed-staggered-settlement-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedStaggeredOrderId/settlement" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $mixedStaggeredSettlementAfter -Field "payoutStatus" -ExpectedValue "SUCCEEDED" -Assertion "mixed-staggered-settlement-status-after"

  $mixedJitterOrderId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "mixed-jitter"
  [void](Add-ApiCaseResult -Results $results -Name "mixed-jitter-order-payment-intent-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$mixedJitterOrderId/payment-intents" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "mixed-jitter-order-payment-intent-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "mixed-jitter-admin-order-manual-payment-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedJitterOrderId/payments/manual" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "mixed-jitter-admin-order-manual-payment-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "mixed-jitter-admin-order-transfer-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedJitterOrderId/milestones/transfer-completed" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "mixed-jitter-admin-order-transfer-completed") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "mixed-jitter-admin-order-payout" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedJitterOrderId/payouts/manual" -Body @{ payoutEvidenceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "mixed-jitter-admin-order-payout") -Expected @(200, 201))
  $mixedJitterBurstDelays = @(17, 43, 71)
  $mixedJitterIteration = 0
  foreach ($mixedJitterDelayMs in $mixedJitterBurstDelays) {
    $mixedJitterIteration++
    Start-Sleep -Milliseconds $mixedJitterDelayMs
    $mixedJitterInvoiceName = "mixed-jitter-$mixedJitterIteration-order-invoice-request"
    $mixedJitterRefundName = "mixed-jitter-$mixedJitterIteration-order-refund-request"
    $mixedJitterResults = Add-ConcurrentApiCasePairResults -Results $results -NameA $mixedJitterInvoiceName -MethodA "POST" -UrlA "http://127.0.0.1:$resolvedApiPort/orders/$mixedJitterOrderId/invoice-requests" -BodyA @{} -HeadersA (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label $mixedJitterInvoiceName) -NameB $mixedJitterRefundName -MethodB "POST" -UrlB "http://127.0.0.1:$resolvedApiPort/orders/$mixedJitterOrderId/refund-requests" -BodyB @{ reasonCode = "OTHER"; reasonText = "smoke mixed jitter refund $mixedJitterIteration" } -HeadersB (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label $mixedJitterRefundName) -Expected @(200, 201, 409)
    $mixedJitterInvoiceResult = @($mixedJitterResults | Where-Object { $_.name -eq $mixedJitterInvoiceName } | Select-Object -First 1)
    $mixedJitterRefundResult = @($mixedJitterResults | Where-Object { $_.name -eq $mixedJitterRefundName } | Select-Object -First 1)
    if (-not $mixedJitterRefundResult -or [int]$mixedJitterRefundResult.status -ne 409) {
      foreach ($mixedJitterResult in @($mixedJitterResults)) {
        Add-ResultAssertionFailure -Result $mixedJitterResult -Assertion "mixed-jitter-refund-conflict-$mixedJitterIteration" -Message "Expected jitter loop refund branch to conflict after payout terminal state"
      }
    }
    if (-not $mixedJitterInvoiceResult -or -not (@(200, 201, 409) -contains [int]$mixedJitterInvoiceResult.status)) {
      foreach ($mixedJitterResult in @($mixedJitterResults)) {
        Add-ResultAssertionFailure -Result $mixedJitterResult -Assertion "mixed-jitter-invoice-status-$mixedJitterIteration" -Message "Expected jitter loop invoice branch status to be one of [200,201,409]"
      }
    }
    if ($mixedJitterInvoiceResult -and (@(200, 201) -contains [int]$mixedJitterInvoiceResult.status)) {
      Assert-ResultJsonFieldEquals -Result $mixedJitterInvoiceResult -Field "status" -ExpectedValue "APPLYING" -Assertion "mixed-jitter-invoice-success-status-$mixedJitterIteration"
      $mixedJitterInvoiceUpsertName = "mixed-jitter-$mixedJitterIteration-admin-order-upsert-invoice-with-file"
      $mixedJitterInvoiceUpsert = Add-ApiCaseResult -Results $results -Name $mixedJitterInvoiceUpsertName -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedJitterOrderId/invoice" -Body @{ invoiceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label $mixedJitterInvoiceUpsertName) -Expected @(200)
      Assert-ResultJsonFieldEquals -Result $mixedJitterInvoiceUpsert -Field "invoiceFile.id" -ExpectedValue $evidenceFileId -Assertion "mixed-jitter-invoice-upsert-file-linked-$mixedJitterIteration"
    }
  }
  $mixedJitterOrderDetailAfter = Add-ApiCaseResult -Results $results -Name "mixed-jitter-order-detail-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$mixedJitterOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $mixedJitterOrderDetailAfter -Field "status" -ExpectedValue "COMPLETED" -Assertion "mixed-jitter-order-status-after"
  $mixedJitterSettlementAfter = Add-ApiCaseResult -Results $results -Name "mixed-jitter-settlement-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedJitterOrderId/settlement" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $mixedJitterSettlementAfter -Field "payoutStatus" -ExpectedValue "SUCCEEDED" -Assertion "mixed-jitter-settlement-status-after"

  $mixedRandomizedOrderId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "mixed-randomized"
  [void](Add-ApiCaseResult -Results $results -Name "mixed-randomized-order-payment-intent-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$mixedRandomizedOrderId/payment-intents" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "mixed-randomized-order-payment-intent-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "mixed-randomized-admin-order-manual-payment-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedRandomizedOrderId/payments/manual" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "mixed-randomized-admin-order-manual-payment-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "mixed-randomized-admin-order-transfer-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedRandomizedOrderId/milestones/transfer-completed" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "mixed-randomized-admin-order-transfer-completed") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "mixed-randomized-admin-order-payout" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedRandomizedOrderId/payouts/manual" -Body @{ payoutEvidenceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "mixed-randomized-admin-order-payout") -Expected @(200, 201))
  $mixedRandomizedSeedBatches = @(@(1301, 1303, 1307), @(2309, 2311, 2317))
  $mixedRandomizedDistribution = @{
    invoiceSuccess = 0
    invoiceConflict = 0
    invoiceOther = 0
    refundConflict = 0
    refundOther = 0
  }
  $mixedRandomizedSeedDetails = New-Object System.Collections.ArrayList
  $mixedRandomizedRuns = 0
  $mixedRandomizedBatchIndex = 0
  foreach ($mixedRandomizedSeedBatch in $mixedRandomizedSeedBatches) {
    $mixedRandomizedBatchIndex++
    foreach ($mixedRandomizedSeed in $mixedRandomizedSeedBatch) {
      $mixedRandomizedRuns++
      $mixedRandomizedRandom = [System.Random]::new([int]$mixedRandomizedSeed)
      $mixedRandomizedDelayMs = 15 + $mixedRandomizedRandom.Next(0, 120)
      Start-Sleep -Milliseconds $mixedRandomizedDelayMs
      $mixedRandomizedInvoiceName = "mixed-randomized-b$mixedRandomizedBatchIndex-r$mixedRandomizedRuns-order-invoice-request"
      $mixedRandomizedRefundName = "mixed-randomized-b$mixedRandomizedBatchIndex-r$mixedRandomizedRuns-order-refund-request"
      $mixedRandomizedPairResults = Add-ConcurrentApiCasePairResults -Results $results -NameA $mixedRandomizedInvoiceName -MethodA "POST" -UrlA "http://127.0.0.1:$resolvedApiPort/orders/$mixedRandomizedOrderId/invoice-requests" -BodyA @{} -HeadersA (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label $mixedRandomizedInvoiceName) -NameB $mixedRandomizedRefundName -MethodB "POST" -UrlB "http://127.0.0.1:$resolvedApiPort/orders/$mixedRandomizedOrderId/refund-requests" -BodyB @{ reasonCode = "OTHER"; reasonText = "smoke mixed randomized refund b$mixedRandomizedBatchIndex-r$mixedRandomizedRuns" } -HeadersB (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label $mixedRandomizedRefundName) -Expected @(200, 201, 409)
      $mixedRandomizedInvoiceResult = @($mixedRandomizedPairResults | Where-Object { $_.name -eq $mixedRandomizedInvoiceName } | Select-Object -First 1)
      $mixedRandomizedRefundResult = @($mixedRandomizedPairResults | Where-Object { $_.name -eq $mixedRandomizedRefundName } | Select-Object -First 1)
      $mixedRandomizedInvoiceStatus = if ($mixedRandomizedInvoiceResult) { [int]$mixedRandomizedInvoiceResult.status } else { -1 }
      $mixedRandomizedRefundStatus = if ($mixedRandomizedRefundResult) { [int]$mixedRandomizedRefundResult.status } else { -1 }
      if ($mixedRandomizedInvoiceStatus -in @(200, 201)) {
        $mixedRandomizedDistribution.invoiceSuccess = [int]$mixedRandomizedDistribution.invoiceSuccess + 1
        Assert-ResultJsonFieldEquals -Result $mixedRandomizedInvoiceResult -Field "status" -ExpectedValue "APPLYING" -Assertion "mixed-randomized-invoice-success-status-b$mixedRandomizedBatchIndex-r$mixedRandomizedRuns"
        $mixedRandomizedInvoiceUpsertName = "mixed-randomized-b$mixedRandomizedBatchIndex-r$mixedRandomizedRuns-admin-order-upsert-invoice-with-file"
        $mixedRandomizedInvoiceUpsert = Add-ApiCaseResult -Results $results -Name $mixedRandomizedInvoiceUpsertName -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedRandomizedOrderId/invoice" -Body @{ invoiceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label $mixedRandomizedInvoiceUpsertName) -Expected @(200)
        Assert-ResultJsonFieldEquals -Result $mixedRandomizedInvoiceUpsert -Field "invoiceFile.id" -ExpectedValue $evidenceFileId -Assertion "mixed-randomized-invoice-upsert-file-linked-b$mixedRandomizedBatchIndex-r$mixedRandomizedRuns"
      } elseif ($mixedRandomizedInvoiceStatus -eq 409) {
        $mixedRandomizedDistribution.invoiceConflict = [int]$mixedRandomizedDistribution.invoiceConflict + 1
      } else {
        $mixedRandomizedDistribution.invoiceOther = [int]$mixedRandomizedDistribution.invoiceOther + 1
        foreach ($mixedRandomizedPairResult in @($mixedRandomizedPairResults)) {
          Add-ResultAssertionFailure -Result $mixedRandomizedPairResult -Assertion "mixed-randomized-invoice-status-b$mixedRandomizedBatchIndex-r$mixedRandomizedRuns" -Message "Expected randomized invoice status to be one of [200,201,409], got [$mixedRandomizedInvoiceStatus]"
        }
      }
      if ($mixedRandomizedRefundStatus -eq 409) {
        $mixedRandomizedDistribution.refundConflict = [int]$mixedRandomizedDistribution.refundConflict + 1
      } else {
        $mixedRandomizedDistribution.refundOther = [int]$mixedRandomizedDistribution.refundOther + 1
        foreach ($mixedRandomizedPairResult in @($mixedRandomizedPairResults)) {
          Add-ResultAssertionFailure -Result $mixedRandomizedPairResult -Assertion "mixed-randomized-refund-status-b$mixedRandomizedBatchIndex-r$mixedRandomizedRuns" -Message "Expected randomized refund status to be conflict 409, got [$mixedRandomizedRefundStatus]"
        }
      }
      [void]$mixedRandomizedSeedDetails.Add([pscustomobject]@{
        batch = $mixedRandomizedBatchIndex
        run = $mixedRandomizedRuns
        seed = $mixedRandomizedSeed
        delayMs = $mixedRandomizedDelayMs
        invoiceStatus = $mixedRandomizedInvoiceStatus
        refundStatus = $mixedRandomizedRefundStatus
      })
    }
  }
  $mixedRandomizedSummaryPayload = [ordered]@{
    seedBatches = $mixedRandomizedSeedBatches
    runs = $mixedRandomizedRuns
    distribution = $mixedRandomizedDistribution
    details = $mixedRandomizedSeedDetails
  }
  $mixedRandomizedSummaryResult = [pscustomobject]@{
    name = "mixed-randomized-outcome-distribution"
    method = "GET"
    url = "internal://mixed-randomized-outcome-distribution"
    status = 200
    expected = "200"
    ok = $true
    body = ($mixedRandomizedSummaryPayload | ConvertTo-Json -Depth 8 -Compress)
  }
  [void]$results.Add($mixedRandomizedSummaryResult)
  if ([int]$mixedRandomizedDistribution.invoiceOther -ne 0 -or [int]$mixedRandomizedDistribution.refundOther -ne 0) {
    Add-ResultAssertionFailure -Result $mixedRandomizedSummaryResult -Assertion "mixed-randomized-distribution-no-other-status" -Message "Randomized distribution contains unexpected statuses: invoiceOther=$($mixedRandomizedDistribution.invoiceOther), refundOther=$($mixedRandomizedDistribution.refundOther)"
  }
  if ([int]$mixedRandomizedDistribution.refundConflict -ne $mixedRandomizedRuns) {
    Add-ResultAssertionFailure -Result $mixedRandomizedSummaryResult -Assertion "mixed-randomized-distribution-refund-conflict" -Message "Expected refund conflict count $mixedRandomizedRuns, got $($mixedRandomizedDistribution.refundConflict)"
  }
  if (([int]$mixedRandomizedDistribution.invoiceSuccess + [int]$mixedRandomizedDistribution.invoiceConflict) -ne $mixedRandomizedRuns) {
    Add-ResultAssertionFailure -Result $mixedRandomizedSummaryResult -Assertion "mixed-randomized-distribution-invoice-bounded" -Message "Expected invoice success+conflict count $mixedRandomizedRuns, got $([int]$mixedRandomizedDistribution.invoiceSuccess + [int]$mixedRandomizedDistribution.invoiceConflict)"
  }
  $mixedRandomizedOrderDetailAfter = Add-ApiCaseResult -Results $results -Name "mixed-randomized-order-detail-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$mixedRandomizedOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $mixedRandomizedOrderDetailAfter -Field "status" -ExpectedValue "COMPLETED" -Assertion "mixed-randomized-order-status-after"
  $mixedRandomizedSettlementAfter = Add-ApiCaseResult -Results $results -Name "mixed-randomized-settlement-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$mixedRandomizedOrderId/settlement" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $mixedRandomizedSettlementAfter -Field "payoutStatus" -ExpectedValue "SUCCEEDED" -Assertion "mixed-randomized-settlement-status-after"

  $multiAggOrderAId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "multi-agg-a"
  [void](Add-ApiCaseResult -Results $results -Name "multi-agg-a-order-payment-intent-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$multiAggOrderAId/payment-intents" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "multi-agg-a-order-payment-intent-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "multi-agg-a-admin-order-manual-payment-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$multiAggOrderAId/payments/manual" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "multi-agg-a-admin-order-manual-payment-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "multi-agg-a-admin-order-transfer-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$multiAggOrderAId/milestones/transfer-completed" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "multi-agg-a-admin-order-transfer-completed") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "multi-agg-a-admin-order-payout" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$multiAggOrderAId/payouts/manual" -Body @{ payoutEvidenceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "multi-agg-a-admin-order-payout") -Expected @(200, 201))
  $multiAggOrderBId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "multi-agg-b"
  [void](Add-ApiCaseResult -Results $results -Name "multi-agg-b-order-payment-intent-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$multiAggOrderBId/payment-intents" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "multi-agg-b-order-payment-intent-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "multi-agg-b-admin-order-manual-payment-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$multiAggOrderBId/payments/manual" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "multi-agg-b-admin-order-manual-payment-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "multi-agg-b-admin-order-transfer-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$multiAggOrderBId/milestones/transfer-completed" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "multi-agg-b-admin-order-transfer-completed") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "multi-agg-b-admin-order-payout" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$multiAggOrderBId/payouts/manual" -Body @{ payoutEvidenceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "multi-agg-b-admin-order-payout") -Expected @(200, 201))
  $multiAggSeedBatches = @(@(4101, 4103), @(5101, 5107))
  $multiAggDistribution = @{
    invoiceSuccess = 0
    invoiceConflict = 0
    invoiceOther = 0
    refundConflict = 0
    refundOther = 0
  }
  $multiAggDetails = New-Object System.Collections.ArrayList
  $multiAggRuns = 0
  $multiAggBatchIndex = 0
  foreach ($multiAggSeedBatch in $multiAggSeedBatches) {
    $multiAggBatchIndex++
    foreach ($multiAggSeed in $multiAggSeedBatch) {
      $multiAggRuns++
      $multiAggRandom = [System.Random]::new([int]$multiAggSeed)
      $multiAggInvoiceDelayMs = 15 + $multiAggRandom.Next(0, 120)
      Start-Sleep -Milliseconds $multiAggInvoiceDelayMs
      $multiAggInvoiceNameA = "multi-agg-b$multiAggBatchIndex-r$multiAggRuns-order-a-invoice-request"
      $multiAggInvoiceNameB = "multi-agg-b$multiAggBatchIndex-r$multiAggRuns-order-b-invoice-request"
      $multiAggInvoicePairResults = Add-ConcurrentApiCasePairResults -Results $results -NameA $multiAggInvoiceNameA -MethodA "POST" -UrlA "http://127.0.0.1:$resolvedApiPort/orders/$multiAggOrderAId/invoice-requests" -BodyA @{} -HeadersA (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label $multiAggInvoiceNameA) -NameB $multiAggInvoiceNameB -MethodB "POST" -UrlB "http://127.0.0.1:$resolvedApiPort/orders/$multiAggOrderBId/invoice-requests" -BodyB @{} -HeadersB (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label $multiAggInvoiceNameB) -Expected @(200, 201, 409)
      $multiAggInvoiceResultA = @($multiAggInvoicePairResults | Where-Object { $_.name -eq $multiAggInvoiceNameA } | Select-Object -First 1)
      $multiAggInvoiceResultB = @($multiAggInvoicePairResults | Where-Object { $_.name -eq $multiAggInvoiceNameB } | Select-Object -First 1)
      $multiAggInvoiceStatusA = if ($multiAggInvoiceResultA) { [int]$multiAggInvoiceResultA.status } else { -1 }
      $multiAggInvoiceStatusB = if ($multiAggInvoiceResultB) { [int]$multiAggInvoiceResultB.status } else { -1 }
      foreach ($multiAggInvoiceResult in @($multiAggInvoiceResultA, $multiAggInvoiceResultB)) {
        if ($null -eq $multiAggInvoiceResult) {
          $multiAggDistribution.invoiceOther = [int]$multiAggDistribution.invoiceOther + 1
          continue
        }
        $multiAggInvoiceStatus = [int]$multiAggInvoiceResult.status
        if ($multiAggInvoiceStatus -in @(200, 201)) {
          $multiAggDistribution.invoiceSuccess = [int]$multiAggDistribution.invoiceSuccess + 1
          Assert-ResultJsonFieldEquals -Result $multiAggInvoiceResult -Field "status" -ExpectedValue "APPLYING" -Assertion "multi-agg-invoice-success-status-$($multiAggInvoiceResult.name)"
          $multiAggInvoiceOrderId = if ($multiAggInvoiceResult.name -eq $multiAggInvoiceNameA) { $multiAggOrderAId } else { $multiAggOrderBId }
          $multiAggInvoiceUpsertName = "$($multiAggInvoiceResult.name)-admin-order-upsert-invoice-with-file"
          $multiAggInvoiceUpsert = Add-ApiCaseResult -Results $results -Name $multiAggInvoiceUpsertName -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$multiAggInvoiceOrderId/invoice" -Body @{ invoiceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label $multiAggInvoiceUpsertName) -Expected @(200)
          Assert-ResultJsonFieldEquals -Result $multiAggInvoiceUpsert -Field "invoiceFile.id" -ExpectedValue $evidenceFileId -Assertion "multi-agg-invoice-upsert-file-linked-$($multiAggInvoiceResult.name)"
        } elseif ($multiAggInvoiceStatus -eq 409) {
          $multiAggDistribution.invoiceConflict = [int]$multiAggDistribution.invoiceConflict + 1
        } else {
          $multiAggDistribution.invoiceOther = [int]$multiAggDistribution.invoiceOther + 1
          foreach ($multiAggInvoicePairResult in @($multiAggInvoicePairResults)) {
            Add-ResultAssertionFailure -Result $multiAggInvoicePairResult -Assertion "multi-agg-invoice-status-$($multiAggInvoiceResult.name)" -Message "Expected multi-aggregate invoice status to be one of [200,201,409], got [$multiAggInvoiceStatus]"
          }
        }
      }
      $multiAggRefundDelayMs = 15 + $multiAggRandom.Next(0, 120)
      Start-Sleep -Milliseconds $multiAggRefundDelayMs
      $multiAggRefundNameA = "multi-agg-b$multiAggBatchIndex-r$multiAggRuns-order-a-refund-request"
      $multiAggRefundNameB = "multi-agg-b$multiAggBatchIndex-r$multiAggRuns-order-b-refund-request"
      $multiAggRefundPairResults = Add-ConcurrentApiCasePairResults -Results $results -NameA $multiAggRefundNameA -MethodA "POST" -UrlA "http://127.0.0.1:$resolvedApiPort/orders/$multiAggOrderAId/refund-requests" -BodyA @{ reasonCode = "OTHER"; reasonText = "smoke multi-agg refund A b$multiAggBatchIndex-r$multiAggRuns" } -HeadersA (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label $multiAggRefundNameA) -NameB $multiAggRefundNameB -MethodB "POST" -UrlB "http://127.0.0.1:$resolvedApiPort/orders/$multiAggOrderBId/refund-requests" -BodyB @{ reasonCode = "OTHER"; reasonText = "smoke multi-agg refund B b$multiAggBatchIndex-r$multiAggRuns" } -HeadersB (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label $multiAggRefundNameB) -Expected @(200, 201, 409)
      $multiAggRefundResultA = @($multiAggRefundPairResults | Where-Object { $_.name -eq $multiAggRefundNameA } | Select-Object -First 1)
      $multiAggRefundResultB = @($multiAggRefundPairResults | Where-Object { $_.name -eq $multiAggRefundNameB } | Select-Object -First 1)
      $multiAggRefundStatusA = if ($multiAggRefundResultA) { [int]$multiAggRefundResultA.status } else { -1 }
      $multiAggRefundStatusB = if ($multiAggRefundResultB) { [int]$multiAggRefundResultB.status } else { -1 }
      foreach ($multiAggRefundResult in @($multiAggRefundResultA, $multiAggRefundResultB)) {
        if ($null -eq $multiAggRefundResult) {
          $multiAggDistribution.refundOther = [int]$multiAggDistribution.refundOther + 1
          continue
        }
        $multiAggRefundStatus = [int]$multiAggRefundResult.status
        if ($multiAggRefundStatus -eq 409) {
          $multiAggDistribution.refundConflict = [int]$multiAggDistribution.refundConflict + 1
        } else {
          $multiAggDistribution.refundOther = [int]$multiAggDistribution.refundOther + 1
          foreach ($multiAggRefundPairResult in @($multiAggRefundPairResults)) {
            Add-ResultAssertionFailure -Result $multiAggRefundPairResult -Assertion "multi-agg-refund-status-$($multiAggRefundResult.name)" -Message "Expected multi-aggregate refund status to be conflict 409, got [$multiAggRefundStatus]"
          }
        }
      }
      [void]$multiAggDetails.Add([pscustomobject]@{
        batch = $multiAggBatchIndex
        run = $multiAggRuns
        seed = $multiAggSeed
        invoiceDelayMs = $multiAggInvoiceDelayMs
        refundDelayMs = $multiAggRefundDelayMs
        invoiceStatusA = $multiAggInvoiceStatusA
        invoiceStatusB = $multiAggInvoiceStatusB
        refundStatusA = $multiAggRefundStatusA
        refundStatusB = $multiAggRefundStatusB
      })
    }
  }
  $multiAggSummaryPayload = [ordered]@{
    orderAId = $multiAggOrderAId
    orderBId = $multiAggOrderBId
    seedBatches = $multiAggSeedBatches
    runs = $multiAggRuns
    distribution = $multiAggDistribution
    details = $multiAggDetails
  }
  $multiAggSummaryResult = [pscustomobject]@{
    name = "multi-agg-randomized-outcome-distribution"
    method = "GET"
    url = "internal://multi-agg-randomized-outcome-distribution"
    status = 200
    expected = "200"
    ok = $true
    body = ($multiAggSummaryPayload | ConvertTo-Json -Depth 8 -Compress)
  }
  [void]$results.Add($multiAggSummaryResult)
  if ([int]$multiAggDistribution.invoiceOther -ne 0 -or [int]$multiAggDistribution.refundOther -ne 0) {
    Add-ResultAssertionFailure -Result $multiAggSummaryResult -Assertion "multi-agg-distribution-no-other-status" -Message "Multi-aggregate distribution contains unexpected statuses: invoiceOther=$($multiAggDistribution.invoiceOther), refundOther=$($multiAggDistribution.refundOther)"
  }
  if ([int]$multiAggDistribution.refundConflict -ne ($multiAggRuns * 2)) {
    Add-ResultAssertionFailure -Result $multiAggSummaryResult -Assertion "multi-agg-distribution-refund-conflict" -Message "Expected multi-aggregate refund conflict count $($multiAggRuns * 2), got $($multiAggDistribution.refundConflict)"
  }
  if (([int]$multiAggDistribution.invoiceSuccess + [int]$multiAggDistribution.invoiceConflict) -ne ($multiAggRuns * 2)) {
    Add-ResultAssertionFailure -Result $multiAggSummaryResult -Assertion "multi-agg-distribution-invoice-bounded" -Message "Expected multi-aggregate invoice success+conflict count $($multiAggRuns * 2), got $([int]$multiAggDistribution.invoiceSuccess + [int]$multiAggDistribution.invoiceConflict)"
  }
  $multiAggOrderADetailAfter = Add-ApiCaseResult -Results $results -Name "multi-agg-order-a-detail-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$multiAggOrderAId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $multiAggOrderADetailAfter -Field "status" -ExpectedValue "COMPLETED" -Assertion "multi-agg-order-a-status-after"
  $multiAggOrderBDetailAfter = Add-ApiCaseResult -Results $results -Name "multi-agg-order-b-detail-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$multiAggOrderBId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $multiAggOrderBDetailAfter -Field "status" -ExpectedValue "COMPLETED" -Assertion "multi-agg-order-b-status-after"
  $multiAggSettlementAfterA = Add-ApiCaseResult -Results $results -Name "multi-agg-settlement-after-a" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$multiAggOrderAId/settlement" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $multiAggSettlementAfterA -Field "payoutStatus" -ExpectedValue "SUCCEEDED" -Assertion "multi-agg-settlement-status-after-a"
  $multiAggSettlementAfterB = Add-ApiCaseResult -Results $results -Name "multi-agg-settlement-after-b" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$multiAggOrderBId/settlement" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $multiAggSettlementAfterB -Field "payoutStatus" -ExpectedValue "SUCCEEDED" -Assertion "multi-agg-settlement-status-after-b"

  $chaosOrderId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "chaos"
  [void](Add-ApiCaseResult -Results $results -Name "chaos-order-payment-intent-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$chaosOrderId/payment-intents" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "chaos-order-payment-intent-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "chaos-admin-order-manual-payment-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$chaosOrderId/payments/manual" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "chaos-admin-order-manual-payment-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "chaos-admin-order-transfer-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$chaosOrderId/milestones/transfer-completed" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "chaos-admin-order-transfer-completed") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "chaos-admin-order-payout" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$chaosOrderId/payouts/manual" -Body @{ payoutEvidenceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "chaos-admin-order-payout") -Expected @(200, 201))
  $chaosSeedBatches = @(
    @(6101, 6103, 6107, 6113, 6121, 6131),
    @(7103, 7109, 7121, 7127, 7151, 7159),
    @(8101, 8111, 8117, 8123, 8147, 8161),
    @(9103, 9109, 9127, 9133, 9151, 9161),
    @(10103, 10111, 10141, 10151, 10159, 10163)
  )
  $chaosDistribution = @{
    invoiceSuccess = 0
    invoiceConflict = 0
    invoiceOther = 0
    refundConflict = 0
    refundOther = 0
  }
  $chaosDetails = New-Object System.Collections.ArrayList
  $chaosDurationsMs = New-Object System.Collections.ArrayList
  $chaosRuns = 0
  $chaosBatchIndex = 0
  foreach ($chaosSeedBatch in $chaosSeedBatches) {
    $chaosBatchIndex++
    foreach ($chaosSeed in $chaosSeedBatch) {
      $chaosRuns++
      $chaosRandom = [System.Random]::new([int]$chaosSeed)
      $chaosDelayMs = 10 + $chaosRandom.Next(0, 180)
      Start-Sleep -Milliseconds $chaosDelayMs
      $chaosInvoiceName = "chaos-b$chaosBatchIndex-r$chaosRuns-order-invoice-request"
      $chaosRefundName = "chaos-b$chaosBatchIndex-r$chaosRuns-order-refund-request"
      $chaosStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
      $chaosPairResults = Add-ConcurrentApiCasePairResults -Results $results -NameA $chaosInvoiceName -MethodA "POST" -UrlA "http://127.0.0.1:$resolvedApiPort/orders/$chaosOrderId/invoice-requests" -BodyA @{} -HeadersA (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label $chaosInvoiceName) -NameB $chaosRefundName -MethodB "POST" -UrlB "http://127.0.0.1:$resolvedApiPort/orders/$chaosOrderId/refund-requests" -BodyB @{ reasonCode = "OTHER"; reasonText = "smoke chaos refund b$chaosBatchIndex-r$chaosRuns" } -HeadersB (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label $chaosRefundName) -Expected @(200, 201, 409)
      $chaosStopwatch.Stop()
      [void]$chaosDurationsMs.Add([int]$chaosStopwatch.ElapsedMilliseconds)
      $chaosInvoiceResult = @($chaosPairResults | Where-Object { $_.name -eq $chaosInvoiceName } | Select-Object -First 1)
      $chaosRefundResult = @($chaosPairResults | Where-Object { $_.name -eq $chaosRefundName } | Select-Object -First 1)
      $chaosInvoiceStatus = if ($chaosInvoiceResult) { [int]$chaosInvoiceResult.status } else { -1 }
      $chaosRefundStatus = if ($chaosRefundResult) { [int]$chaosRefundResult.status } else { -1 }
      if ($chaosInvoiceStatus -in @(200, 201)) {
        $chaosDistribution.invoiceSuccess = [int]$chaosDistribution.invoiceSuccess + 1
        Assert-ResultJsonFieldEquals -Result $chaosInvoiceResult -Field "status" -ExpectedValue "APPLYING" -Assertion "chaos-invoice-success-status-b$chaosBatchIndex-r$chaosRuns"
        $chaosInvoiceUpsertName = "chaos-b$chaosBatchIndex-r$chaosRuns-admin-order-upsert-invoice-with-file"
        $chaosInvoiceUpsert = Add-ApiCaseResult -Results $results -Name $chaosInvoiceUpsertName -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$chaosOrderId/invoice" -Body @{ invoiceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label $chaosInvoiceUpsertName) -Expected @(200)
        Assert-ResultJsonFieldEquals -Result $chaosInvoiceUpsert -Field "invoiceFile.id" -ExpectedValue $evidenceFileId -Assertion "chaos-invoice-upsert-file-linked-b$chaosBatchIndex-r$chaosRuns"
      } elseif ($chaosInvoiceStatus -eq 409) {
        $chaosDistribution.invoiceConflict = [int]$chaosDistribution.invoiceConflict + 1
      } else {
        $chaosDistribution.invoiceOther = [int]$chaosDistribution.invoiceOther + 1
        foreach ($chaosPairResult in @($chaosPairResults)) {
          Add-ResultAssertionFailure -Result $chaosPairResult -Assertion "chaos-invoice-status-b$chaosBatchIndex-r$chaosRuns" -Message "Expected chaos invoice status to be one of [200,201,409], got [$chaosInvoiceStatus]"
        }
      }
      if ($chaosRefundStatus -eq 409) {
        $chaosDistribution.refundConflict = [int]$chaosDistribution.refundConflict + 1
      } else {
        $chaosDistribution.refundOther = [int]$chaosDistribution.refundOther + 1
        foreach ($chaosPairResult in @($chaosPairResults)) {
          Add-ResultAssertionFailure -Result $chaosPairResult -Assertion "chaos-refund-status-b$chaosBatchIndex-r$chaosRuns" -Message "Expected chaos refund status to be conflict 409, got [$chaosRefundStatus]"
        }
      }
      [void]$chaosDetails.Add([pscustomobject]@{
        batch = $chaosBatchIndex
        run = $chaosRuns
        seed = $chaosSeed
        delayMs = $chaosDelayMs
        pairDurationMs = [int]$chaosStopwatch.ElapsedMilliseconds
        invoiceStatus = $chaosInvoiceStatus
        refundStatus = $chaosRefundStatus
      })
    }
  }
  $computePercentile = {
    param(
      [int[]]$Values,
      [double]$Percentile
    )
    if (-not $Values -or $Values.Count -eq 0) { return 0 }
    $sorted = @($Values | Sort-Object)
    $index = [int][Math]::Ceiling($Percentile * $sorted.Count) - 1
    if ($index -lt 0) { $index = 0 }
    if ($index -ge $sorted.Count) { $index = $sorted.Count - 1 }
    return [int]$sorted[$index]
  }
  $chaosDurationsArray = @($chaosDurationsMs | ForEach-Object { [int]$_ })
  $chaosP50Ms = & $computePercentile -Values $chaosDurationsArray -Percentile 0.50
  $chaosP95Ms = & $computePercentile -Values $chaosDurationsArray -Percentile 0.95
  $chaosMaxMs = if ($chaosDurationsArray.Count -gt 0) { [int](($chaosDurationsArray | Measure-Object -Maximum).Maximum) } else { 0 }
  $chaosAbsoluteP95ThresholdMs = 3000
  $chaosTrendMinSamples = 6
  $chaosTrendHistoryWindow = 20
  $chaosHistoryMaxEntries = 120
  if ([string]::IsNullOrWhiteSpace($ChaosHistoryPath)) {
    $chaosHistoryPath = Join-Path $logDir "api-real-smoke-chaos-history.json"
  } else {
    $chaosHistoryPath = $ChaosHistoryPath
    $chaosHistoryParent = Split-Path -Path $chaosHistoryPath -Parent
    if (-not [string]::IsNullOrWhiteSpace($chaosHistoryParent)) {
      New-Item -ItemType Directory -Force -Path $chaosHistoryParent | Out-Null
    }
  }
  $chaosInvoiceSuccessRate = if ($chaosRuns -gt 0) { [math]::Round(([double]$chaosDistribution.invoiceSuccess / [double]$chaosRuns), 4) } else { 0.0 }
  $chaosRefundConflictRate = if ($chaosRuns -gt 0) { [math]::Round(([double]$chaosDistribution.refundConflict / [double]$chaosRuns), 4) } else { 0.0 }
  $chaosHistoryEntries = @()
  if (Test-Path $chaosHistoryPath) {
    try {
      $chaosHistoryRaw = Get-Content -Path $chaosHistoryPath -Raw -ErrorAction Stop
      if (-not [string]::IsNullOrWhiteSpace($chaosHistoryRaw)) {
        $chaosHistoryParsed = ConvertFrom-Json -InputObject $chaosHistoryRaw
        foreach ($chaosParsedEntry in @($chaosHistoryParsed)) {
          if ($chaosParsedEntry -is [System.Array]) {
            foreach ($chaosInnerEntry in @($chaosParsedEntry)) {
              $chaosHistoryEntries += $chaosInnerEntry
            }
          } else {
            $chaosHistoryEntries += $chaosParsedEntry
          }
        }
      }
    } catch {
      Write-Host "[api-real-smoke] chaos history parse failed; trend baseline reset for this run."
      $chaosHistoryEntries = @()
    }
  }
  $chaosHistoryWindowEntries = @($chaosHistoryEntries | Select-Object -Last $chaosTrendHistoryWindow)
  $chaosHistoryP95Values = New-Object System.Collections.ArrayList
  foreach ($chaosHistoryEntry in @($chaosHistoryWindowEntries)) {
    if ($chaosHistoryEntry -and $chaosHistoryEntry.metrics -and $null -ne $chaosHistoryEntry.metrics.p95) {
      [void]$chaosHistoryP95Values.Add([int]$chaosHistoryEntry.metrics.p95)
    }
  }
  $chaosTrendCheckApplied = $false
  $chaosTrendBaselineP50Ms = 0
  $chaosTrendBaselineP90Ms = 0
  $chaosTrendThresholdMs = 0
  if ($chaosHistoryP95Values.Count -ge $chaosTrendMinSamples) {
    $chaosTrendCheckApplied = $true
    $chaosTrendP95Array = @($chaosHistoryP95Values | ForEach-Object { [int]$_ })
    $chaosTrendBaselineP50Ms = & $computePercentile -Values $chaosTrendP95Array -Percentile 0.50
    $chaosTrendBaselineP90Ms = & $computePercentile -Values $chaosTrendP95Array -Percentile 0.90
    $chaosTrendThresholdMs = [math]::Max(1400, [math]::Max([int]([math]::Ceiling($chaosTrendBaselineP50Ms * 2.6)), [int]($chaosTrendBaselineP90Ms + 450)))
  }
  $chaosSummaryPayload = [ordered]@{
    seedBatches = $chaosSeedBatches
    runs = $chaosRuns
    distribution = $chaosDistribution
    rates = @{
      invoiceSuccess = $chaosInvoiceSuccessRate
      refundConflict = $chaosRefundConflictRate
    }
    durationsMs = @{
      p50 = $chaosP50Ms
      p95 = $chaosP95Ms
      max = $chaosMaxMs
      thresholdP95 = $chaosAbsoluteP95ThresholdMs
      trendThresholdP95 = if ($chaosTrendCheckApplied) { $chaosTrendThresholdMs } else { $null }
    }
    trend = @{
      historyPath = ".tmp/api-real-smoke-chaos-history.json"
      historyWindow = $chaosTrendHistoryWindow
      priorSamples = $chaosHistoryP95Values.Count
      minSamples = $chaosTrendMinSamples
      checkApplied = $chaosTrendCheckApplied
      baselineP95 = @{
        p50 = if ($chaosTrendCheckApplied) { $chaosTrendBaselineP50Ms } else { $null }
        p90 = if ($chaosTrendCheckApplied) { $chaosTrendBaselineP90Ms } else { $null }
      }
    }
    details = $chaosDetails
  }
  $chaosSummaryResult = [pscustomobject]@{
    name = "chaos-randomized-outcome-distribution"
    method = "GET"
    url = "internal://chaos-randomized-outcome-distribution"
    status = 200
    expected = "200"
    ok = $true
    body = ($chaosSummaryPayload | ConvertTo-Json -Depth 8 -Compress)
  }
  [void]$results.Add($chaosSummaryResult)
  if ([int]$chaosDistribution.invoiceOther -ne 0 -or [int]$chaosDistribution.refundOther -ne 0) {
    Add-ResultAssertionFailure -Result $chaosSummaryResult -Assertion "chaos-distribution-no-other-status" -Message "Chaos distribution contains unexpected statuses: invoiceOther=$($chaosDistribution.invoiceOther), refundOther=$($chaosDistribution.refundOther)"
  }
  if ([int]$chaosDistribution.refundConflict -ne $chaosRuns) {
    Add-ResultAssertionFailure -Result $chaosSummaryResult -Assertion "chaos-distribution-refund-conflict" -Message "Expected chaos refund conflict count $chaosRuns, got $($chaosDistribution.refundConflict)"
  }
  if (([int]$chaosDistribution.invoiceSuccess + [int]$chaosDistribution.invoiceConflict) -ne $chaosRuns) {
    Add-ResultAssertionFailure -Result $chaosSummaryResult -Assertion "chaos-distribution-invoice-bounded" -Message "Expected chaos invoice success+conflict count $chaosRuns, got $([int]$chaosDistribution.invoiceSuccess + [int]$chaosDistribution.invoiceConflict)"
  }
  if ($chaosP95Ms -gt $chaosAbsoluteP95ThresholdMs) {
    Add-ResultAssertionFailure -Result $chaosSummaryResult -Assertion "chaos-p95-threshold" -Message "Expected chaos p95 <= $chaosAbsoluteP95ThresholdMs ms, got $chaosP95Ms ms"
  }
  if ($chaosTrendCheckApplied -and $chaosP95Ms -gt $chaosTrendThresholdMs) {
    Add-ResultAssertionFailure -Result $chaosSummaryResult -Assertion "chaos-p95-trend-threshold" -Message "Expected chaos p95 <= trend threshold $chaosTrendThresholdMs ms (baseline p50=$chaosTrendBaselineP50Ms, p90=$chaosTrendBaselineP90Ms), got $chaosP95Ms ms"
  }
  $chaosHistoryEntry = [ordered]@{
    recordedAt = (Get-Date).ToUniversalTime().ToString("o")
    reportDate = $ReportDate
    runs = $chaosRuns
    distribution = $chaosDistribution
    rates = @{
      invoiceSuccess = $chaosInvoiceSuccessRate
      refundConflict = $chaosRefundConflictRate
    }
    metrics = @{
      p50 = $chaosP50Ms
      p95 = $chaosP95Ms
      max = $chaosMaxMs
    }
  }
  $chaosHistoryUpdated = @($chaosHistoryEntries + @([pscustomobject]$chaosHistoryEntry))
  if ($chaosHistoryUpdated.Count -gt $chaosHistoryMaxEntries) {
    $chaosHistoryUpdated = @($chaosHistoryUpdated | Select-Object -Last $chaosHistoryMaxEntries)
  }
  $chaosHistoryUpdated | ConvertTo-Json -Depth 8 | Out-File -Encoding UTF8 $chaosHistoryPath
  $chaosOrderDetailAfter = Add-ApiCaseResult -Results $results -Name "chaos-order-detail-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$chaosOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $chaosOrderDetailAfter -Field "status" -ExpectedValue "COMPLETED" -Assertion "chaos-order-status-after"
  $chaosSettlementAfter = Add-ApiCaseResult -Results $results -Name "chaos-settlement-after" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$chaosOrderId/settlement" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $chaosSettlementAfter -Field "payoutStatus" -ExpectedValue "SUCCEEDED" -Assertion "chaos-settlement-status-after"

  $refundApproveOrderId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "refund-approve"
  $refundApproveCreateHeaders = New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "refund-approve-create"
  $refundApproveCreate = Add-ApiCaseResult -Results $results -Name "refund-approve-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$refundApproveOrderId/refund-requests" -Body @{ reasonCode = "OTHER"; reasonText = "smoke approve flow" } -Headers $refundApproveCreateHeaders -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $refundApproveCreate -Field "status" -ExpectedValue "PENDING" -Assertion "refund-request-created-status"
  $refundApproveRequestId = Get-ResultStringField -Result $refundApproveCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($refundApproveRequestId)) { throw "refund-approve-create missing id" }
  $refundApproveCreateReplay = Add-ApiCaseResult -Results $results -Name "refund-approve-create-idempotent-replay" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$refundApproveOrderId/refund-requests" -Body @{ reasonCode = "OTHER"; reasonText = "smoke approve flow replay" } -Headers $refundApproveCreateHeaders -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $refundApproveCreateReplay -Field "id" -ExpectedValue $refundApproveRequestId -Assertion "refund-approve-idempotent-request-id"
  [void](Add-ApiCaseResult -Results $results -Name "refund-approve-list" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$refundApproveOrderId/refund-requests" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200))
  $adminRefundApproveExisting = Add-ApiCaseResult -Results $results -Name "admin-refund-approve-existing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundApproveRequestId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-approve-existing") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminRefundApproveExisting -Field "status" -ExpectedValue "REFUNDING" -Assertion "refund-request-approved-status"
  $refundApproveOrderDetail = Add-ApiCaseResult -Results $results -Name "refund-approve-order-detail" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$refundApproveOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $refundApproveOrderDetail -Field "status" -ExpectedValue "REFUNDING" -Assertion "refund-order-status-after-approve"
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-approve-existing-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundApproveRequestId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-approve-existing-duplicate") -Expected @(409))
  $adminRefundCompleteExisting = Add-ApiCaseResult -Results $results -Name "admin-refund-complete-existing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundApproveRequestId/complete" -Body @{ remark = "smoke complete flow" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-complete-existing") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminRefundCompleteExisting -Field "status" -ExpectedValue "REFUNDED" -Assertion "refund-request-completed-status"
  $refundCompleteOrderDetail = Add-ApiCaseResult -Results $results -Name "refund-complete-order-detail" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$refundApproveOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $refundCompleteOrderDetail -Field "status" -ExpectedValue "REFUNDED" -Assertion "refund-order-status-after-complete"
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-complete-existing-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundApproveRequestId/complete" -Body @{ remark = "smoke duplicate complete flow" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-complete-existing-duplicate") -Expected @(409))
  [void](Add-ApiCaseResult -Results $results -Name "order-refund-request-after-refunded" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$refundApproveOrderId/refund-requests" -Body @{ reasonCode = "OTHER"; reasonText = "smoke disallowed after refunded" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-refund-request-after-refunded") -Expected @(409))

  $refundRejectOrderId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "refund-reject"
  $refundRejectCreateHeaders = New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "refund-reject-create"
  $refundRejectCreate = Add-ApiCaseResult -Results $results -Name "refund-reject-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$refundRejectOrderId/refund-requests" -Body @{ reasonCode = "OTHER"; reasonText = "smoke reject flow" } -Headers $refundRejectCreateHeaders -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $refundRejectCreate -Field "status" -ExpectedValue "PENDING" -Assertion "refund-reject-created-status"
  $refundRejectRequestId = Get-ResultStringField -Result $refundRejectCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($refundRejectRequestId)) { throw "refund-reject-create missing id" }
  $refundRejectCreateReplay = Add-ApiCaseResult -Results $results -Name "refund-reject-create-idempotent-replay" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$refundRejectOrderId/refund-requests" -Body @{ reasonCode = "OTHER"; reasonText = "smoke reject flow replay" } -Headers $refundRejectCreateHeaders -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $refundRejectCreateReplay -Field "id" -ExpectedValue $refundRejectRequestId -Assertion "refund-reject-idempotent-request-id"
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-reject-existing-missing-reason" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundRejectRequestId/reject" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-reject-existing-missing-reason") -Expected @(400))
  $adminRefundRejectExisting = Add-ApiCaseResult -Results $results -Name "admin-refund-reject-existing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundRejectRequestId/reject" -Body @{ reason = "smoke reject reason" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-reject-existing") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $adminRefundRejectExisting -Field "status" -ExpectedValue "REJECTED" -Assertion "refund-request-rejected-status"
  $refundRejectOrderDetail = Add-ApiCaseResult -Results $results -Name "refund-reject-order-detail" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$refundRejectOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $refundRejectOrderDetail -Field "status" -ExpectedValue "WAIT_FINAL_PAYMENT" -Assertion "refund-order-status-after-reject"
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-reject-existing-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundRejectRequestId/reject" -Body @{ reason = "smoke reject reason duplicate" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-reject-existing-duplicate") -Expected @(409))
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-complete-rejected" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundRejectRequestId/complete" -Body @{ remark = "smoke complete rejected" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-complete-rejected") -Expected @(409))
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-approve-rejected" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundRejectRequestId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-approve-rejected") -Expected @(409))

  $refundRaceOrderId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "refund-race"
  $refundRaceCreate = Add-ApiCaseResult -Results $results -Name "refund-race-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$refundRaceOrderId/refund-requests" -Body @{ reasonCode = "OTHER"; reasonText = "smoke race flow" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "refund-race-create") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $refundRaceCreate -Field "status" -ExpectedValue "PENDING" -Assertion "refund-race-create-status"
  $refundRaceRequestId = Get-ResultStringField -Result $refundRaceCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($refundRaceRequestId)) { throw "refund-race-create missing id" }
  $refundRaceDecisionResults = Add-ConcurrentApiCasePairResults -Results $results -NameA "admin-refund-race-approve" -MethodA "POST" -UrlA "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundRaceRequestId/approve" -BodyA @{} -HeadersA (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-race-approve") -NameB "admin-refund-race-reject" -MethodB "POST" -UrlB "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundRaceRequestId/reject" -BodyB @{ reason = "smoke race reject" } -HeadersB (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-race-reject") -Expected @(200, 201, 409)
  Assert-ConcurrentPairOneSuccessOneConflict -PairResults $refundRaceDecisionResults -SuccessStatuses @(200, 201) -ConflictStatus 409 -Assertion "refund-race-decision"
  $refundRaceDecisionSuccess = @($refundRaceDecisionResults | Where-Object { @(200, 201) -contains [int]$_.status } | Select-Object -First 1)
  if ($refundRaceDecisionSuccess) {
    Assert-ResultJsonFieldIn -Result $refundRaceDecisionSuccess -Field "status" -ExpectedValues @("REFUNDING", "REJECTED") -Assertion "refund-race-decision-status"
  }
  $refundRaceOrderDetail = Add-ApiCaseResult -Results $results -Name "refund-race-order-detail" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$refundRaceOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
  Assert-ResultJsonFieldIn -Result $refundRaceOrderDetail -Field "status" -ExpectedValues @("REFUNDING", "WAIT_FINAL_PAYMENT") -Assertion "refund-race-order-status"
  if ($refundRaceDecisionSuccess) {
    $refundRaceDecisionStatus = ""
    try {
      $refundRaceDecisionStatus = Get-ResultStringField -Result $refundRaceDecisionSuccess -Field "status"
    } catch { }
    if ($refundRaceDecisionStatus -eq "REFUNDING") {
      $adminRefundRaceComplete = Add-ApiCaseResult -Results $results -Name "admin-refund-race-complete-after-approve" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundRaceRequestId/complete" -Body @{ remark = "smoke race approve completion" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-race-complete-after-approve") -Expected @(200, 201)
      Assert-ResultJsonFieldEquals -Result $adminRefundRaceComplete -Field "status" -ExpectedValue "REFUNDED" -Assertion "refund-race-complete-status"
      $refundRaceOrderDetailAfterComplete = Add-ApiCaseResult -Results $results -Name "refund-race-order-detail-after-complete" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$refundRaceOrderId" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200)
      Assert-ResultJsonFieldEquals -Result $refundRaceOrderDetailAfterComplete -Field "status" -ExpectedValue "REFUNDED" -Assertion "refund-race-order-status-after-complete"
    } elseif ($refundRaceDecisionStatus -eq "REJECTED") {
      [void](Add-ApiCaseResult -Results $results -Name "admin-refund-race-complete-rejected" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundRaceRequestId/complete" -Body @{ remark = "smoke race rejected completion" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-race-complete-rejected") -Expected @(409))
    }
  }

  [void](Add-ApiCaseResult -Results $results -Name "admin-case-list" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200))
  $caseCreate = Add-ApiCaseResult -Results $results -Name "admin-case-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases" -Body @{ type = "DISPUTE"; title = "smoke case $ReportDate"; orderId = $refundApproveOrderId; requesterName = "smoke"; priority = "HIGH"; description = "smoke case description" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-create") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $caseCreate -Field "status" -ExpectedValue "OPEN" -Assertion "case-create-status"
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-create-invalid-type" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases" -Body @{ type = "UNKNOWN"; title = "smoke case invalid type $ReportDate" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-create-invalid-type") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-create-invalid-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases" -Body @{ status = "UNKNOWN"; title = "smoke case invalid status $ReportDate" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-create-invalid-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-create-invalid-priority" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases" -Body @{ priority = "UNKNOWN"; title = "smoke case invalid priority $ReportDate" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-create-invalid-priority") -Expected @(400))
  $caseId = Get-ResultStringField -Result $caseCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($caseId)) { throw "admin-case-create missing id" }
  $caseDetail = Add-ApiCaseResult -Results $results -Name "admin-case-detail" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $caseDetail -Field "status" -ExpectedValue "OPEN" -Assertion "case-detail-status-open"
  $missingCaseId = [guid]::NewGuid().ToString()
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-detail-missing" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$missingCaseId" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-assign-missing-assignee" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/assign" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-assign-missing-assignee") -Expected @(400))
  $caseAssign = Add-ApiCaseResult -Results $results -Name "admin-case-assign" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/assign" -Body @{ assigneeId = $currentUserId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-assign") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $caseAssign -Field "assigneeId" -ExpectedValue $currentUserId -Assertion "case-assignee-linked"
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-status-invalid" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/status" -Body @{ status = "UNKNOWN" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-status-invalid") -Expected @(400))
  $caseStatusInProgress = Add-ApiCaseResult -Results $results -Name "admin-case-status-in-progress" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/status" -Body @{ status = "IN_PROGRESS" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-status-in-progress") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $caseStatusInProgress -Field "status" -ExpectedValue "IN_PROGRESS" -Assertion "case-status-in-progress"
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-note-empty" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/notes" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-note-empty") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-note-add" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/notes" -Body @{ note = "smoke case note" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-note-add") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-evidence-missing-file" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/evidence" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-evidence-missing-file") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-evidence-add" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/evidence" -Body @{ fileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-evidence-add") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-evidence-add-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/evidence" -Body @{ fileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-evidence-add-duplicate") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-sla-missing-due-at" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/sla" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-sla-missing-due-at") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-sla-invalid-due-at" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/sla" -Body @{ dueAt = "invalid-date" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-sla-invalid-due-at") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-sla-update" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/sla" -Body @{ dueAt = (Get-Date).AddDays(2).ToString("o") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-sla-update") -Expected @(200, 201))
  $caseStatusClosed = Add-ApiCaseResult -Results $results -Name "admin-case-status-closed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/status" -Body @{ status = "CLOSED" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-status-closed") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $caseStatusClosed -Field "status" -ExpectedValue "CLOSED" -Assertion "case-status-closed"

  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedules-list" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-create-missing-patent" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules" -Body @{ yearNo = 1; dueDate = (Get-Date).AddDays(30).ToString("o") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-schedule-create-missing-patent") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-create-invalid-patent" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules" -Body @{ patentId = [guid]::NewGuid().ToString(); yearNo = 1; dueDate = (Get-Date).AddDays(30).ToString("o") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-schedule-create-invalid-patent") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-create-invalid-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules" -Body @{ patentId = $patentId; yearNo = ([int][double]::Parse((Get-Date -UFormat %s)) + 20000); dueDate = (Get-Date).AddDays(47).ToString("o"); status = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-schedule-create-invalid-status") -Expected @(400))
  $maintenanceYearNo = [int][double]::Parse((Get-Date -UFormat %s))
  $maintenanceRaceYearNo = $maintenanceYearNo + 10000
  $maintenanceScheduleRaceBody = @{ patentId = $patentId; yearNo = $maintenanceRaceYearNo; dueDate = (Get-Date).AddDays(44).ToString("o"); status = "DUE" }
  $maintenanceScheduleCreateRaceResults = Add-ConcurrentApiCasePairResults -Results $results -NameA "admin-maintenance-schedule-create-race-a" -MethodA "POST" -UrlA "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules" -BodyA $maintenanceScheduleRaceBody -HeadersA (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-schedule-create-race-a") -NameB "admin-maintenance-schedule-create-race-b" -MethodB "POST" -UrlB "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules" -BodyB $maintenanceScheduleRaceBody -HeadersB (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-schedule-create-race-b") -Expected @(200, 201, 409)
  Assert-ConcurrentPairOneSuccessOneConflict -PairResults $maintenanceScheduleCreateRaceResults -SuccessStatuses @(200, 201) -ConflictStatus 409 -Assertion "maintenance-schedule-create-race"
  $maintenanceScheduleRaceSuccess = @($maintenanceScheduleCreateRaceResults | Where-Object { @(200, 201) -contains [int]$_.status } | Select-Object -First 1)
  if ($maintenanceScheduleRaceSuccess) {
    $maintenanceScheduleRaceId = Get-ResultStringField -Result $maintenanceScheduleRaceSuccess -Field "id"
    $maintenanceScheduleRaceDetail = Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-create-race-detail" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules/$maintenanceScheduleRaceId" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
    Assert-ResultJsonFieldEquals -Result $maintenanceScheduleRaceDetail -Field "status" -ExpectedValue "DUE" -Assertion "maintenance-schedule-race-detail-status"
  }
  $scheduleCreate = Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules" -Body @{ patentId = $patentId; yearNo = $maintenanceYearNo; dueDate = (Get-Date).AddDays(45).ToString("o"); status = "DUE" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-schedule-create") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $scheduleCreate -Field "status" -ExpectedValue "DUE" -Assertion "maintenance-schedule-create-status"
  $scheduleId = Get-ResultStringField -Result $scheduleCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($scheduleId)) { throw "admin-maintenance-schedule-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-create-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules" -Body @{ patentId = $patentId; yearNo = $maintenanceYearNo; dueDate = (Get-Date).AddDays(46).ToString("o"); status = "DUE" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-schedule-create-duplicate") -Expected @(409))
  $maintenanceScheduleDetail = Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-detail" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules/$scheduleId" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $maintenanceScheduleDetail -Field "status" -ExpectedValue "DUE" -Assertion "maintenance-schedule-detail-status"
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-detail-missing" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules/$([guid]::NewGuid().ToString())" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-update-invalid-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules/$scheduleId" -Body @{ status = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-schedule-update-invalid-status") -Expected @(400))
  $maintenanceGracePeriodIso = (Get-Date).AddDays(60).ToString("o")
  $maintenanceGracePeriodExpectedDate = ([datetime]::Parse($maintenanceGracePeriodIso).ToUniversalTime()).ToString("yyyy-MM-dd")
  $maintenanceScheduleUpdate = Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules/$scheduleId" -Body @{ status = "PAID"; gracePeriodEnd = $maintenanceGracePeriodIso } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-schedule-update") -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $maintenanceScheduleUpdate -Field "status" -ExpectedValue "PAID" -Assertion "maintenance-schedule-update-status"
  Assert-ResultJsonFieldEquals -Result $maintenanceScheduleUpdate -Field "gracePeriodEnd" -ExpectedValue $maintenanceGracePeriodExpectedDate -Assertion "maintenance-schedule-grace-period"
  $maintenanceScheduleDetailAfterUpdate = Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-detail-after-update" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules/$scheduleId" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $maintenanceScheduleDetailAfterUpdate -Field "status" -ExpectedValue "PAID" -Assertion "maintenance-schedule-detail-after-update-status"

  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-tasks-list" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-task-create-missing-schedule" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-task-create-missing-schedule") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-task-create-invalid-schedule" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks" -Body @{ scheduleId = [guid]::NewGuid().ToString() } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-task-create-invalid-schedule") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-task-create-invalid-status" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks" -Body @{ scheduleId = $scheduleId; status = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-task-create-invalid-status") -Expected @(400))
  $taskCreate = Add-ApiCaseResult -Results $results -Name "admin-maintenance-task-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks" -Body @{ scheduleId = $scheduleId; assignedCsUserId = $currentUserId; status = "OPEN"; note = "smoke maintenance task" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-task-create") -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $taskCreate -Field "status" -ExpectedValue "OPEN" -Assertion "maintenance-task-create-status"
  $taskId = Get-ResultStringField -Result $taskCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($taskId)) { throw "admin-maintenance-task-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-task-update-invalid-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks/$taskId" -Body @{ status = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-task-update-invalid-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-task-update-invalid-evidence" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks/$taskId" -Body @{ evidenceFileId = [guid]::NewGuid().ToString() } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-task-update-invalid-evidence") -Expected @(400))
  $maintenanceTaskUpdate = Add-ApiCaseResult -Results $results -Name "admin-maintenance-task-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks/$taskId" -Body @{ status = "DONE"; evidenceFileId = $evidenceFileId; note = "smoke maintenance done" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-task-update") -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $maintenanceTaskUpdate -Field "status" -ExpectedValue "DONE" -Assertion "maintenance-task-update-status"
  Assert-ResultJsonFieldEquals -Result $maintenanceTaskUpdate -Field "evidenceFileId" -ExpectedValue $evidenceFileId -Assertion "maintenance-task-evidence-linked"
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-task-update-missing" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks/$([guid]::NewGuid().ToString())" -Body @{ status = "DONE" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-task-update-missing") -Expected @(404))
  $maintenanceTasksBySchedule = Add-ApiCaseResult -Results $results -Name "admin-maintenance-tasks-list-by-schedule" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks?scheduleId=$scheduleId" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonArrayItemFieldEquals -Result $maintenanceTasksBySchedule -ArrayField "items" -MatchField "id" -MatchValue $taskId -TargetField "status" -ExpectedValue "DONE" -Assertion "maintenance-task-list-status"

  $rbacUsersListBefore = Add-ApiCaseResult -Results $results -Name "admin-rbac-users-list" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/users" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonArrayItemFieldEquals -Result $rbacUsersListBefore -ArrayField "items" -MatchField "id" -MatchValue $currentUserId -TargetField "id" -ExpectedValue $currentUserId -Assertion "rbac-users-list-contains-current-user"
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-role-create-missing-name" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles" -Body @{ permissionIds = @("report.read") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-create-missing-name") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-role-create-invalid-permission" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles" -Body @{ name = "smoke invalid role $ReportDate"; permissionIds = @("unknown.permission") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-create-invalid-permission") -Expected @(400))
  $rbacRoleCreate = Add-ApiCaseResult -Results $results -Name "admin-rbac-role-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles" -Body @{ name = "smoke role $ReportDate"; description = "smoke role"; permissionIds = @("report.read", "auditLog.read") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-create") -Expected @(200, 201)
  Assert-ResultJsonArrayContains -Result $rbacRoleCreate -Field "permissionIds" -ExpectedValue "report.read" -Assertion "rbac-role-create-permission-report-read"
  Assert-ResultJsonArrayContains -Result $rbacRoleCreate -Field "permissionIds" -ExpectedValue "auditLog.read" -Assertion "rbac-role-create-permission-audit-log-read"
  $rbacRoleId = Get-ResultStringField -Result $rbacRoleCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($rbacRoleId)) { throw "admin-rbac-role-create missing id" }
  $rbacRolesAfterCreate = Add-ApiCaseResult -Results $results -Name "admin-rbac-roles-list-after-create" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonArrayItemFieldEquals -Result $rbacRolesAfterCreate -ArrayField "items" -MatchField "id" -MatchValue $rbacRoleId -TargetField "name" -ExpectedValue "smoke role $ReportDate" -Assertion "rbac-role-created-visible-in-list"
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-role-update-missing" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles/$([guid]::NewGuid().ToString())" -Body @{ name = "missing role" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-update-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-role-update-invalid-permission" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles/$rbacRoleId" -Body @{ permissionIds = @("unknown.permission") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-update-invalid-permission") -Expected @(400))
  $rbacRoleUpdate = Add-ApiCaseResult -Results $results -Name "admin-rbac-role-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles/$rbacRoleId" -Body @{ name = "smoke role updated $ReportDate"; permissionIds = @("report.read") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-update") -Expected @(200)
  Assert-ResultJsonFieldEquals -Result $rbacRoleUpdate -Field "name" -ExpectedValue "smoke role updated $ReportDate" -Assertion "rbac-role-update-name"
  Assert-ResultJsonArrayContains -Result $rbacRoleUpdate -Field "permissionIds" -ExpectedValue "report.read" -Assertion "rbac-role-update-permission-report-read"
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-user-update-missing-role-ids" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/users/$currentUserId" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-user-update-missing-role-ids") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-user-update-unknown-role" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/users/$currentUserId" -Body @{ roleIds = @([guid]::NewGuid().ToString()) } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-user-update-unknown-role") -Expected @(400))
  $rbacUserUpdateCustomRole = Add-ApiCaseResult -Results $results -Name "admin-rbac-user-update-custom-role" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/users/$currentUserId" -Body @{ roleIds = @($rbacRoleId) } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-user-update-custom-role") -Expected @(200)
  Assert-ResultJsonArrayContains -Result $rbacUserUpdateCustomRole -Field "roleIds" -ExpectedValue $rbacRoleId -Assertion "rbac-user-custom-role-linked"
  $rbacUsersAfterCustomRole = Add-ApiCaseResult -Results $results -Name "admin-rbac-users-list-after-custom-role" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/users" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  Assert-ResultJsonArrayItemFieldEquals -Result $rbacUsersAfterCustomRole -ArrayField "items" -MatchField "id" -MatchValue $currentUserId -TargetField "id" -ExpectedValue $currentUserId -Assertion "rbac-users-list-after-custom-role-current-user"
  $rbacUsersAfterCustomRoleJson = Get-ResultJsonObject -Result $rbacUsersAfterCustomRole
  if ($rbacUsersAfterCustomRoleJson) {
    $currentUserInList = @($rbacUsersAfterCustomRoleJson.items | Where-Object { [string]$_.id -eq $currentUserId }) | Select-Object -First 1
    if ($currentUserInList -and -not (@($currentUserInList.roleIds) | ForEach-Object { [string]$_ } | Where-Object { $_ -eq $rbacRoleId })) {
      Add-ResultAssertionFailure -Result $rbacUsersAfterCustomRole -Assertion "rbac-users-list-custom-role-linked" -Message "Current user '$currentUserId' does not include role '$rbacRoleId' in users list"
    }
  }
  $rbacUserUpdateClearRoles = Add-ApiCaseResult -Results $results -Name "admin-rbac-user-update-clear-roles" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/users/$currentUserId" -Body @{ roleIds = @() } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-user-update-clear-roles") -Expected @(200)
  $rbacUserClearJson = Get-ResultJsonObject -Result $rbacUserUpdateClearRoles
  if ($rbacUserClearJson -and @($rbacUserClearJson.roleIds).Count -ne 0) {
    Add-ResultAssertionFailure -Result $rbacUserUpdateClearRoles -Assertion "rbac-user-clear-roles-empty" -Message "Expected roleIds to be empty after clear"
  }
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-role-delete-system-forbidden" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles/role-admin" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-delete-system-forbidden") -Expected @(403))
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-role-delete-missing" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles/$([guid]::NewGuid().ToString())" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-delete-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-role-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles/$rbacRoleId" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-delete") -Expected @(200))
  $rbacRolesAfterDelete = Add-ApiCaseResult -Results $results -Name "admin-rbac-roles-list-after-delete" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200)
  $rbacRolesAfterDeleteJson = Get-ResultJsonObject -Result $rbacRolesAfterDelete
  if ($rbacRolesAfterDeleteJson) {
    $deletedRoleStillExists = @($rbacRolesAfterDeleteJson.items | Where-Object { [string]$_.id -eq $rbacRoleId }).Count -gt 0
    if ($deletedRoleStillExists) {
      Add-ResultAssertionFailure -Result $rbacRolesAfterDelete -Assertion "rbac-role-deleted-removed-from-list" -Message "Deleted role '$rbacRoleId' still exists in roles list"
    }
  }

  $reportExport = Add-ApiCaseResult -Results $results -Name "admin-report-export" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/reports/finance/export" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-report-export") -Expected @(200, 201)
  $reportExportJson = Get-ResultJsonObject -Result $reportExport
  if ($reportExportJson) {
    $exportUrl = [string]$reportExportJson.exportUrl
    if ([string]::IsNullOrWhiteSpace($exportUrl) -or -not $exportUrl.Contains("/files/")) {
      Add-ResultAssertionFailure -Result $reportExport -Assertion "report-export-url" -Message "Export URL is empty or invalid: '$exportUrl'"
    }
  }
  [void](Add-ApiCaseResult -Results $results -Name "admin-report-export-invalid-range" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/reports/finance/export" -Body @{ start = "2026-12-31T00:00:00.000Z"; end = "2026-01-01T00:00:00.000Z" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-report-export-invalid-range") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-patent-map-import-missing-file" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-map/import" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-patent-map-import-missing-file") -Expected @(400))
  $patentMapImportPath = Join-Path $logDir "api-real-smoke-patent-map-import-$ReportDate.csv"
  @(
    "regionCode,year,patentCount,industryBreakdown,topAssignees",
    "$importRegionCode,$((Get-Date).Year),1,," 
  ) | Out-File -Encoding UTF8 $patentMapImportPath
  $patentMapImportDryRun = Add-ApiFileUploadCaseResult -Results $results -Name "admin-patent-map-import-dry-run" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-map/import" -AuthorizationToken $adminToken -FilePath $patentMapImportPath -FormFields @{ dryRun = "true" } -Expected @(200, 201)
  Assert-ResultJsonFieldEquals -Result $patentMapImportDryRun -Field "dryRun" -ExpectedValue "True" -Assertion "patent-map-import-dry-run-flag"
  Assert-ResultJsonFieldEquals -Result $patentMapImportDryRun -Field "importedCount" -ExpectedValue "1" -Assertion "patent-map-import-dry-run-count"

  $listingCommentCreate = Add-ApiCaseResult -Results $results -Name "listing-comment-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings/$listingId/comments" -Body @{ text = "smoke listing comment $ReportDate" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-listing-create") -Expected @(200, 201)
  $listingCommentId = Get-ResultStringField -Result $listingCommentCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($listingCommentId)) { throw "listing-comment-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "listing-comment-create-empty-text" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings/$listingId/comments" -Body @{ text = "" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-listing-empty") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "listing-comment-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/comments/$listingCommentId" -Body @{ text = "smoke listing comment updated $ReportDate" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-listing-update") -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "listing-comment-update-empty-text" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/comments/$listingCommentId" -Body @{ text = "" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-listing-update-empty") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "listing-comment-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/comments/$listingCommentId" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-listing-delete") -Expected @(200))

  $demandCommentCreate = Add-ApiCaseResult -Results $results -Name "demand-comment-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/demands/$demandId/comments" -Body @{ text = "smoke demand comment $ReportDate" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-demand-create") -Expected @(200, 201)
  $demandCommentId = Get-ResultStringField -Result $demandCommentCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($demandCommentId)) { throw "demand-comment-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "demand-comment-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/comments/$demandCommentId" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-demand-delete") -Expected @(200))

  $achievementCommentCreate = Add-ApiCaseResult -Results $results -Name "achievement-comment-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/achievements/$achievementId/comments" -Body @{ text = "smoke achievement comment $ReportDate" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-achievement-create") -Expected @(200, 201)
  $achievementCommentId = Get-ResultStringField -Result $achievementCommentCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($achievementCommentId)) { throw "achievement-comment-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "achievement-comment-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/comments/$achievementCommentId" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-achievement-delete") -Expected @(200))

  $artworkCommentCreate = Add-ApiCaseResult -Results $results -Name "artwork-comment-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/artworks/$artworkId/comments" -Body @{ text = "smoke artwork comment $ReportDate" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-artwork-create") -Expected @(200, 201)
  $artworkCommentId = Get-ResultStringField -Result $artworkCommentCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($artworkCommentId)) { throw "artwork-comment-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "artwork-comment-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/comments/$artworkCommentId" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-artwork-delete") -Expected @(200))

  $addressCreate = Add-ApiCaseResult -Results $results -Name "me-address-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/me/addresses" -Body @{ name = "Smoke Receiver"; phone = "13800138001"; regionCode = "110000"; addressLine = "Smoke Street 1"; isDefault = $false } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "address-create") -Expected @(200, 201)
  $addressId = Get-ResultStringField -Result $addressCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($addressId)) { throw "me-address-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "me-address-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/me/addresses/$addressId" -Body @{ addressLine = "Smoke Street 2"; isDefault = $true } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "address-update") -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "me-address-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/me/addresses/$addressId" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "address-delete") -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "me-address-delete-missing" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/me/addresses/$addressId" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "address-delete-missing") -Expected @(404))

  $listingConversation = Add-ApiCaseResult -Results $results -Name "listing-conversation-upsert" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings/$listingId/conversations" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-listing-upsert") -Expected @(200, 201)
  $listingConversationId = Get-ResultStringField -Result $listingConversation -Field "id"
  if ([string]::IsNullOrWhiteSpace($listingConversationId)) { throw "listing-conversation-upsert missing id" }

  [void](Add-ApiCaseResult -Results $results -Name "demand-conversation-upsert" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/demands/$demandId/conversations" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-demand-upsert") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "achievement-conversation-upsert" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/achievements/$achievementId/conversations" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-achievement-upsert") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "artwork-conversation-upsert" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/artworks/$artworkId/conversations" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-artwork-upsert") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "tech-manager-conversation-upsert" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/tech-managers/$techManagerId/conversations" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-tech-manager-upsert") -Expected @(200, 201))

  [void](Add-ApiCaseResult -Results $results -Name "conversation-message-send" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/conversations/$listingConversationId/messages" -Body @{ type = "TEXT"; text = "smoke message $ReportDate" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-message-send") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "conversation-message-invalid-type" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/conversations/$listingConversationId/messages" -Body @{ type = "SYSTEM"; text = "invalid type" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-message-invalid-type") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "conversation-message-empty-type" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/conversations/$listingConversationId/messages" -Body @{ type = ""; text = "invalid empty type" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-message-empty-type") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "conversation-message-empty-text" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/conversations/$listingConversationId/messages" -Body @{ type = "TEXT"; text = "" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-message-empty-text") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "conversation-read" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/conversations/$listingConversationId/read" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-read") -Expected @(200, 201))

  $failedCount = [int](@($results | Where-Object { -not $_.ok }).Count)
  $writeMethods = @("POST", "PUT", "PATCH", "DELETE")
  $writeResults = @($results | Where-Object { $writeMethods -contains $_.method.ToUpper() })
  $readResults = @($results | Where-Object { -not ($writeMethods -contains $_.method.ToUpper()) })
  $summary = [pscustomobject]@{
    total = $results.Count
    passed = [int](@($results | Where-Object { $_.ok }).Count)
    failed = $failedCount
    writesTotal = $writeResults.Count
    writesPassed = [int](@($writeResults | Where-Object { $_.ok }).Count)
    readsTotal = $readResults.Count
    readsPassed = [int](@($readResults | Where-Object { $_.ok }).Count)
  }

  $results | ConvertTo-Json -Depth 8 | Out-File -Encoding UTF8 $resultsPath
  $summary | ConvertTo-Json -Depth 3 | Out-File -Encoding UTF8 $summaryPath

  if ($failedCount -gt 0) {
    $failed = $results | Where-Object { -not $_.ok } | Select-Object name, status, expected, url
    $failed | Format-Table -AutoSize | Out-Host
    throw "api-real-smoke failed: $failedCount"
  }

  Write-Host ($summary | ConvertTo-Json -Compress)
} finally {
  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  }
}
