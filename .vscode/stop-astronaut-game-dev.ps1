$ErrorActionPreference = "Stop"

$patterns = @(
  "*npm run dev*",
  "*designer-save-server.cjs*",
  "*lite-server --config bs-config.js --no-open*",
  "*tsc --watch*",
  "*concurrently*astronaut-game*",
  "*concurrently*designer-save-server.cjs*"
)

$targets = Get-CimInstance Win32_Process | Where-Object {
  $cmd = $_.CommandLine
  if (-not $cmd) { return $false }
  foreach ($pattern in $patterns) {
    if ($cmd -like $pattern) { return $true }
  }
  return $false
}

$seen = [System.Collections.Generic.HashSet[int]]::new()

function Add-Descendants {
  param([int]$ProcessId)

  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId"
  foreach ($child in $children) {
    if ($seen.Add([int]$child.ProcessId)) {
      Add-Descendants -ProcessId ([int]$child.ProcessId)
    }
  }
}

foreach ($target in $targets) {
  if ($seen.Add([int]$target.ProcessId)) {
    Add-Descendants -ProcessId ([int]$target.ProcessId)
  }
}

foreach ($processId in ($seen | Sort-Object -Descending)) {
  try {
    Stop-Process -Id $processId -ErrorAction Stop
  } catch [System.ArgumentException] {
    # Process already exited between discovery and termination.
  } catch [Microsoft.PowerShell.Commands.ProcessCommandException] {
    Write-Warning "Unable to stop process ${processId}: $($_.Exception.Message)"
  }
}
