[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$WorktreeRelativePath = ".claude/worktrees/beta-test",
    [string]$BranchName = "beta-test-setup",
    [int]$FrontendPort = 3002,
    [int]$BackendPort = 3003,
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if ($null -ne (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue)) {
    $PSNativeCommandUseErrorActionPreference = $false
}

function Write-Step {
    param([string]$Message)
    Write-Host "[beta-bootstrap] $Message"
}

function Resolve-RepoRoot {
    param([string]$InputPath)
    if (-not [string]::IsNullOrWhiteSpace($InputPath)) {
        return (Resolve-Path -LiteralPath $InputPath).Path
    }

    $root = (& git rev-parse --show-toplevel 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($root)) {
        throw "Could not resolve repo root. Pass -RepoRoot explicitly."
    }
    return (Resolve-Path -LiteralPath $root.Trim()).Path
}

function Normalize-PathString {
    param([string]$PathValue)
    return $PathValue.Replace('\', '/').TrimEnd('/').ToLowerInvariant()
}

function Ensure-Worktree {
    param(
        [string]$RepoRootPath,
        [string]$WorktreePath,
        [string]$TargetBranch
    )

    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $WorktreePath) | Out-Null

    $worktreeList = & git -C $RepoRootPath worktree list --porcelain
    $targetNorm = Normalize-PathString -PathValue $WorktreePath
    $registered = $false

    foreach ($line in $worktreeList) {
        if ($line.StartsWith("worktree ")) {
            $pathInList = $line.Substring(9)
            if ((Normalize-PathString -PathValue $pathInList) -eq $targetNorm) {
                $registered = $true
                break
            }
        }
    }

    if (-not $registered) {
        Write-Step "Creating worktree at $WorktreePath from develop"
        & git -C $RepoRootPath worktree add $WorktreePath develop | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create worktree at $WorktreePath"
        }
    } else {
        Write-Step "Reusing worktree at $WorktreePath"
    }

    Write-Step "Attaching worktree to branch $TargetBranch"
    & git -C $WorktreePath switch --quiet $TargetBranch *> $null
    if ($LASTEXITCODE -ne 0) {
        & git -C $WorktreePath switch --quiet -C $TargetBranch develop *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Step "Branch $TargetBranch unavailable; using detached develop"
            & git -C $WorktreePath switch --quiet --detach develop *> $null
        }
    }
}

function Sync-EnvFile {
    param(
        [string]$SourcePath,
        [string]$DestinationPath
    )

    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $DestinationPath) | Out-Null

    if (Test-Path -LiteralPath $SourcePath) {
        Copy-Item -LiteralPath $SourcePath -Destination $DestinationPath -Force
    } elseif (-not (Test-Path -LiteralPath $DestinationPath)) {
        New-Item -ItemType File -Path $DestinationPath -Force | Out-Null
    }
}

function Get-EnvValue {
    param(
        [string]$EnvPath,
        [string]$Key
    )

    if (-not (Test-Path -LiteralPath $EnvPath)) {
        return $null
    }

    $pattern = "^\s*$([regex]::Escape($Key))=(.*)$"
    foreach ($line in (Get-Content -LiteralPath $EnvPath)) {
        if ($line -match $pattern) {
            return $matches[1].Trim()
        }
    }
    return $null
}

function Set-EnvValue {
    param(
        [string]$EnvPath,
        [string]$Key,
        [string]$Value
    )

    $lines = @()
    if (Test-Path -LiteralPath $EnvPath) {
        $lines = @(Get-Content -LiteralPath $EnvPath)
    }

    $pattern = "^\s*$([regex]::Escape($Key))="
    $newLines = New-Object System.Collections.Generic.List[string]
    $updated = $false

    foreach ($line in $lines) {
        if ($line -match $pattern) {
            if (-not $updated) {
                $newLines.Add("$Key=$Value")
                $updated = $true
            }
        } else {
            $newLines.Add($line)
        }
    }

    if (-not $updated) {
        $newLines.Add("$Key=$Value")
    }

    Set-Content -LiteralPath $EnvPath -Value $newLines
}

function Ensure-WorktreeEnv {
    param(
        [string]$RepoRootPath,
        [string]$WorktreePath,
        [int]$UiPort,
        [int]$ApiPort
    )

    $sourceBackend = Join-Path $RepoRootPath "packages/backend/.env.local"
    $sourceFrontend = Join-Path $RepoRootPath "packages/frontend/.env.local"
    $destBackend = Join-Path $WorktreePath "packages/backend/.env.local"
    $destFrontend = Join-Path $WorktreePath "packages/frontend/.env.local"

    Sync-EnvFile -SourcePath $sourceBackend -DestinationPath $destBackend
    Sync-EnvFile -SourcePath $sourceFrontend -DestinationPath $destFrontend

    $serviceKey = Get-EnvValue -EnvPath $destBackend -Key "SUPABASE_SERVICE_KEY"
    if (-not [string]::IsNullOrWhiteSpace($serviceKey)) {
        Set-EnvValue -EnvPath $destFrontend -Key "SUPABASE_SERVICE_KEY" -Value $serviceKey
    }

    Set-EnvValue -EnvPath $destBackend -Key "PORT" -Value "$ApiPort"
    Set-EnvValue -EnvPath $destBackend -Key "FRONTEND_URL" -Value "http://localhost:$UiPort"
    Set-EnvValue -EnvPath $destFrontend -Key "PORT" -Value "$UiPort"
    Set-EnvValue -EnvPath $destFrontend -Key "NEXT_PUBLIC_API_URL" -Value "http://localhost:$ApiPort"
    Set-EnvValue -EnvPath $destFrontend -Key "BACKEND_URL" -Value "http://localhost:$ApiPort"
    Set-EnvValue -EnvPath $destFrontend -Key "PLAYWRIGHT_BASE_URL" -Value "http://localhost:$UiPort"
    Set-EnvValue -EnvPath $destFrontend -Key "PLAYWRIGHT_API_URL" -Value "http://localhost:$ApiPort"
}

function Ensure-Dependencies {
    param(
        [string]$WorktreePath,
        [switch]$Skip
    )

    if ($Skip) {
        Write-Step "Skipping npm install due to -SkipInstall"
        return
    }

    $nodeModulesPath = Join-Path $WorktreePath "node_modules"
    $lockPath = Join-Path $WorktreePath "package-lock.json"
    $needsInstall = -not (Test-Path -LiteralPath $nodeModulesPath)

    if (-not $needsInstall -and (Test-Path -LiteralPath $lockPath)) {
        $needsInstall = (Get-Item -LiteralPath $lockPath).LastWriteTimeUtc -gt (Get-Item -LiteralPath $nodeModulesPath).LastWriteTimeUtc
    }

    if ($needsInstall) {
        Write-Step "Installing npm dependencies in worktree"
        & npm --prefix $WorktreePath install | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed in $WorktreePath"
        }
    } else {
        Write-Step "Dependencies already up to date"
    }
}

function Get-ListenerPids {
    param([int]$Port)
    $regex = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
    $pids = New-Object System.Collections.Generic.List[int]
    foreach ($line in (netstat -ano)) {
        if ($line -match $regex) {
            $pids.Add([int]$matches[1])
        }
    }
    return @($pids | Sort-Object -Unique)
}

function Stop-ListeningPort {
    param([int]$Port)
    $pids = Get-ListenerPids -Port $Port
    foreach ($listenerPid in $pids) {
        Write-Step "Stopping PID $listenerPid on :$Port"
        & taskkill /F /T /PID $listenerPid | Out-Null
    }
}

function Start-WorktreeServers {
    param(
        [string]$WorktreePath,
        [int]$UiPort,
        [int]$ApiPort
    )

    Stop-ListeningPort -Port $UiPort
    Stop-ListeningPort -Port $ApiPort

    $logsDir = Join-Path $WorktreePath ".claude/beta-test/logs"
    New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
    $backendLog = Join-Path $logsDir "backend-$ApiPort.log"
    $frontendLog = Join-Path $logsDir "frontend-$UiPort.log"

    $backendCmd = 'cd /d "{0}\packages\backend" && set PORT={1} && npm run start:dev > "{2}" 2>&1' -f $WorktreePath, $ApiPort, $backendLog
    $frontendCmd = 'cd /d "{0}\packages\frontend" && set NEXT_DIST_DIR=.next-test && npx next dev --webpack -p {1} > "{2}" 2>&1' -f $WorktreePath, $UiPort, $frontendLog

    $backendProc = Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", $backendCmd) -PassThru
    $frontendProc = Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", $frontendCmd) -PassThru

    return [PSCustomObject]@{
        backend_cmd_pid = $backendProc.Id
        frontend_cmd_pid = $frontendProc.Id
        backend_log = $backendLog
        frontend_log = $frontendLog
    }
}

function Wait-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 120
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 8
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        } catch {
        }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Ensure-BetaFeedbackSchema {
    param([string]$RepoRootPath)
    $connectScript = Join-Path $RepoRootPath "scripts/connect-supabase.ps1"
    if (-not (Test-Path -LiteralPath $connectScript)) {
        return
    }

    Write-Step "Ensuring beta feedback table exists"
    $schemaSql = @'
CREATE TABLE IF NOT EXISTS beta_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tester_id UUID REFERENCES beta_testers(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bug', 'workflow', 'ux_ui', 'feature_request', 'performance', 'other')),
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  steps_to_reproduce TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  page_url TEXT,
  affected_component TEXT,
  browser_info JSONB,
  attachments JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'triaged', 'in_progress', 'fixed', 'deployed', 'wont_fix', 'duplicate')),
  admin_notes TEXT,
  fix_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_tester ON beta_feedback(tester_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_status ON beta_feedback(status);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_category ON beta_feedback(category);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_created ON beta_feedback(created_at DESC);
ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'beta_feedback_updated_at'
      AND tgrelid = 'public.beta_feedback'::regclass
  ) THEN
    CREATE TRIGGER beta_feedback_updated_at
      BEFORE UPDATE ON beta_feedback
      FOR EACH ROW
      EXECUTE FUNCTION update_beta_feedback_updated_at();
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'beta_feedback'
      AND policyname = 'service_role_all_feedback'
  ) THEN
    CREATE POLICY "service_role_all_feedback" ON beta_feedback
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
GRANT ALL ON beta_feedback TO service_role;
GRANT SELECT, INSERT ON beta_feedback TO anon;
'@

    $schemaFile = Join-Path $env:TEMP "beta-feedback-bootstrap.sql"
    Set-Content -LiteralPath $schemaFile -Value $schemaSql
    try {
        $sqlText = Get-Content -LiteralPath $schemaFile -Raw
        # Temporarily allow Continue so psql NOTICE output (stderr) doesn't terminate
        $prevPref = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & $connectScript $sqlText | Out-Host
        $ErrorActionPreference = $prevPref
    } catch {
        Write-Step "Schema bootstrap warning (non-fatal): $($_.Exception.Message)"
    } finally {
        Remove-Item -LiteralPath $schemaFile -ErrorAction SilentlyContinue
    }
}

function Ensure-TesterToken {
    param([int]$UiPort)

    $baseUrl = "http://localhost:$UiPort"
    $testerName = "Test Agent"
    $testerEmail = "test-agent@propertyiq.test"
    $tester = $null

    $allTesters = Invoke-RestMethod -Uri "$baseUrl/api/admin/testers" -Method GET -TimeoutSec 20
    if ($allTesters.testers) {
        $tester = $allTesters.testers | Where-Object { $_.email -eq $testerEmail } | Select-Object -First 1
        if (-not $tester) {
            $tester = $allTesters.testers | Where-Object { $_.name -eq $testerName } | Select-Object -First 1
        }
    }

    if (-not $tester) {
        $payload = @{ name = $testerName; email = $testerEmail } | ConvertTo-Json
        $created = Invoke-RestMethod -Uri "$baseUrl/api/admin/testers" -Method POST -ContentType "application/json" -Body $payload -TimeoutSec 20
        $tester = $created.tester
    }

    if (-not $tester -or [string]::IsNullOrWhiteSpace($tester.id)) {
        throw "Could not resolve Test Agent tester record."
    }

    if ([string]::IsNullOrWhiteSpace($tester.token)) {
        $allTesters = Invoke-RestMethod -Uri "$baseUrl/api/admin/testers" -Method GET -TimeoutSec 20
        $tester = $allTesters.testers | Where-Object { $_.id -eq $tester.id } | Select-Object -First 1
    }

    if (-not $tester -or [string]::IsNullOrWhiteSpace($tester.token)) {
        throw "Could not resolve Test Agent tester token."
    }

    return $tester
}

function Assert-FeedbackApi {
    param(
        [int]$UiPort,
        [string]$TesterToken
    )

    $baseUrl = "http://localhost:$UiPort"
    $headers = @{ "X-Tester-Token" = $TesterToken }
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/api/betatest/feedback" -Headers $headers -UseBasicParsing -TimeoutSec 20
        if ($response.StatusCode -ne 200) {
            throw "Unexpected feedback API status: $($response.StatusCode)"
        }
    } catch {
        if (-not [string]::IsNullOrWhiteSpace($_.ErrorDetails.Message)) {
            throw "Feedback API failed: $($_.ErrorDetails.Message)"
        }
        throw "Feedback API failed: $($_.Exception.Message)"
    }
}

$resolvedRepoRoot = Resolve-RepoRoot -InputPath $RepoRoot
$worktreePath = Join-Path $resolvedRepoRoot $WorktreeRelativePath.Replace("/", "\")

Write-Step "Repo root: $resolvedRepoRoot"
Ensure-Worktree -RepoRootPath $resolvedRepoRoot -WorktreePath $worktreePath -TargetBranch $BranchName
Ensure-WorktreeEnv -RepoRootPath $resolvedRepoRoot -WorktreePath $worktreePath -UiPort $FrontendPort -ApiPort $BackendPort
Ensure-Dependencies -WorktreePath $worktreePath -Skip:$SkipInstall

# Check if servers are already running and healthy before restarting
$logsDir = Join-Path $worktreePath ".claude/beta-test/logs"
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
$backendLogPath = Join-Path $logsDir "backend-$BackendPort.log"
$frontendLogPath = Join-Path $logsDir "frontend-$FrontendPort.log"

# Initialize $launch so StrictMode never complains
$launch = [PSCustomObject]@{
    backend_cmd_pid = $null
    frontend_cmd_pid = $null
    backend_log = $backendLogPath
    frontend_log = $frontendLogPath
}

Write-Step "Probing existing servers on :$BackendPort and :$FrontendPort..."
$backendHealthy = Wait-HttpOk -Url "http://localhost:$BackendPort/api/docs" -TimeoutSeconds 8
$frontendHealthy = Wait-HttpOk -Url "http://localhost:$FrontendPort/" -TimeoutSeconds 8
Write-Step "Backend healthy: $backendHealthy  |  Frontend healthy: $frontendHealthy"

if ($backendHealthy -and $frontendHealthy) {
    Write-Step "Both servers already healthy -- skipping restart"
} else {
    Write-Step "Starting servers..."
    $launch = Start-WorktreeServers -WorktreePath $worktreePath -UiPort $FrontendPort -ApiPort $BackendPort

    if (-not (Wait-HttpOk -Url "http://localhost:$BackendPort/api/docs" -TimeoutSeconds 180)) {
        throw "Backend did not become ready on :$BackendPort. Check log: $($launch.backend_log)"
    }
    if (-not (Wait-HttpOk -Url "http://localhost:$FrontendPort/" -TimeoutSeconds 180)) {
        throw "Frontend did not become ready on :$FrontendPort. Check log: $($launch.frontend_log)"
    }
}

Ensure-BetaFeedbackSchema -RepoRootPath $resolvedRepoRoot
$tester = Ensure-TesterToken -UiPort $FrontendPort
Assert-FeedbackApi -UiPort $FrontendPort -TesterToken $tester.token

$currentBranch = (& git -C $worktreePath rev-parse --abbrev-ref HEAD).Trim()

[PSCustomObject]@{
    repo_root = $resolvedRepoRoot
    worktree_root = $worktreePath
    worktree_branch = $currentBranch
    test_port = $FrontendPort
    api_port = $BackendPort
    frontend_url = "http://localhost:$FrontendPort"
    backend_url = "http://localhost:$BackendPort"
    tester_id = $tester.id
    tester_token = $tester.token
    backend_log = $launch.backend_log
    frontend_log = $launch.frontend_log
} | ConvertTo-Json -Depth 3
