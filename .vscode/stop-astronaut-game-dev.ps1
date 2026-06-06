$ErrorActionPreference = "Stop"

$workspaceHint = "C:\repos\exile"
$commandPatterns = @(
  "*npm run dev*",
  "*npm run start:build*",
  "*designer-save-server.cjs*",
  "*static-server.cjs*",
  "*lite-server --config bs-config.js --no-open*",
  "*tsc --watch*",
  "*concurrently*astronaut-game*",
  "*concurrently*designer-save-server.cjs*"
)

$knownCommandFragments = @(
  "designer-save-server.cjs",
  "static-server.cjs",
  "lite-server --config bs-config.js --no-open",
  "npm run dev",
  "npm run start:build",
  "tsc --watch",
  "astronaut-game"
)

$seen = [System.Collections.Generic.HashSet[int]]::new()
$allProcesses = Get-CimInstance Win32_Process

function Test-MatchingCommand {
  param([string]$CommandLine, [string[]]$Patterns)

  if (-not $CommandLine) {
    return $false
  }

  foreach ($pattern in $Patterns) {
    if ($CommandLine -like $pattern) {
      return $true
    }
  }

  return $false
}

function Test-WorkspaceServiceCommand {
  param([string]$CommandLine)

  if (-not $CommandLine) {
    return $false
  }

  if (($CommandLine -notlike "*$workspaceHint*") -and ($CommandLine -notlike "*astronaut-game*")) {
    return $false
  }

  foreach ($fragment in $knownCommandFragments) {
    if ($CommandLine -like "*$fragment*") {
      return $true
    }
  }

  return $false
}

function Add-Descendants {
  param([int]$ProcessId)

  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId"
  foreach ($child in $children) {
    if ($seen.Add([int]$child.ProcessId)) {
      Add-Descendants -ProcessId ([int]$child.ProcessId)
    }
  }
}

$patternTargets = $allProcesses | Where-Object { Test-MatchingCommand -CommandLine $_.CommandLine -Patterns $commandPatterns }
foreach ($target in $patternTargets) {
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

# Fallback: clean up leftover workspace-owned listeners on local debug ports.
$debugPorts = @(3000, 3001)
foreach ($port in $debugPorts) {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    $owningProcessId = [int]$listener.OwningProcess
    if ($seen.Contains($owningProcessId)) {
      continue
    }

    $proc = $allProcesses | Where-Object { [int]$_.ProcessId -eq $owningProcessId } | Select-Object -First 1
    if ($null -eq $proc) {
      continue
    }

    if (-not (Test-WorkspaceServiceCommand -CommandLine $proc.CommandLine)) {
      continue
    }

    try {
      Stop-Process -Id $owningProcessId -ErrorAction Stop
      $seen.Add($owningProcessId) | Out-Null
    } catch [System.ArgumentException] {
      # Process already exited.
    } catch [Microsoft.PowerShell.Commands.ProcessCommandException] {
      Write-Warning "Unable to stop debug-port process ${owningProcessId} on port ${port}: $($_.Exception.Message)"
    }
  }
}
