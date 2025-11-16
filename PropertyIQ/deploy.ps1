# PropertyIQ Edge Functions Deployment Script
# PowerShell script to deploy Supabase Edge Functions

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectRef,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("all", "process-upload", "normalize-location", "generate-report")]
    [string]$Function = "all",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipEnvCheck,
    
    [Parameter(Mandatory=$false)]
    [switch]$Verify,
    
    [Parameter(Mandatory=$false)]
    [switch]$SetSecrets
)

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# Banner
Write-Host ""
Write-Info "================================================"
Write-Info "   PropertyIQ Edge Functions Deployment Tool   "
Write-Info "================================================"
Write-Host ""

# Check if running from correct directory
$currentDir = Get-Location
$expectedDir = Join-Path $currentDir "supabase"
if (-not (Test-Path $expectedDir)) {
    Write-Error "Error: supabase directory not found!"
    Write-Warning "Please run this script from the PropertyIQ directory"
    exit 1
}

# Change to supabase directory
Set-Location supabase
Write-Info "Working directory: $(Get-Location)"

# Check for Supabase CLI
Write-Info "Checking Supabase CLI installation..."
try {
    $supabaseVersion = npx supabase --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Supabase CLI not found"
    }
    Write-Success "✓ Supabase CLI found: $supabaseVersion"
} catch {
    Write-Error "✗ Supabase CLI not found!"
    Write-Warning "Installing Supabase CLI locally..."
    npm install supabase --save-dev
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install Supabase CLI"
        Set-Location $currentDir
        exit 1
    }
    Write-Success "✓ Supabase CLI installed"
}

# Check for .env file
$envFile = ".env"
$envExampleFile = "env.example"

if (-not $SkipEnvCheck) {
    if (-not (Test-Path $envFile)) {
        Write-Warning "⚠ .env file not found"
        
        if (Test-Path $envExampleFile) {
            Write-Info "Creating .env from env.example..."
            Copy-Item $envExampleFile $envFile
            Write-Warning "Please edit .env and add your Supabase credentials"
            Write-Info "Get them from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api"
            
            # Open .env file in default editor
            $openFile = Read-Host "Open .env file now? (y/n)"
            if ($openFile -eq 'y') {
                Start-Process notepad.exe $envFile -Wait
            } else {
                Set-Location $currentDir
                exit 1
            }
        } else {
            Write-Error "No env.example file found!"
            Set-Location $currentDir
            exit 1
        }
    }
    
    # Load environment variables
    Write-Info "Loading environment variables..."
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    
    # Validate required variables
    $requiredVars = @("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")
    $missingVars = @()
    
    foreach ($var in $requiredVars) {
        if (-not [Environment]::GetEnvironmentVariable($var)) {
            $missingVars += $var
        }
    }
    
    if ($missingVars.Count -gt 0) {
        Write-Error "Missing required environment variables:"
        $missingVars | ForEach-Object { Write-Error "  - $_" }
        Write-Warning "Please edit .env and add the missing values"
        Set-Location $currentDir
        exit 1
    }
    
    Write-Success "✓ Environment variables loaded"
}

# Extract project reference if not provided
if (-not $ProjectRef) {
    $supabaseUrl = [Environment]::GetEnvironmentVariable("SUPABASE_URL")
    if ($supabaseUrl -match 'https://([^.]+)\.supabase\.co') {
        $ProjectRef = $matches[1]
        Write-Info "Project reference: $ProjectRef"
    } else {
        Write-Error "Could not extract project reference from SUPABASE_URL"
        $ProjectRef = Read-Host "Enter your Supabase project reference"
    }
}

# Link to project
Write-Info "Linking to Supabase project..."
$linkOutput = npx supabase link --project-ref $ProjectRef 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "✓ Linked to project: $ProjectRef"
} else {
    if ($linkOutput -match "already linked") {
        Write-Info "Project already linked"
    } else {
        Write-Error "Failed to link project: $linkOutput"
        Set-Location $currentDir
        exit 1
    }
}

# Set secrets if requested
if ($SetSecrets) {
    Write-Info "Setting Edge Function secrets..."
    
    $secrets = @{
        "SUPABASE_URL" = [Environment]::GetEnvironmentVariable("SUPABASE_URL")
        "SUPABASE_ANON_KEY" = [Environment]::GetEnvironmentVariable("SUPABASE_ANON_KEY")
        "SUPABASE_SERVICE_ROLE_KEY" = [Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY")
    }
    
    foreach ($key in $secrets.Keys) {
        Write-Info "  Setting $key..."
        $value = $secrets[$key]
        if ($value) {
            npx supabase secrets set $key=$value --project-ref $ProjectRef 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "  ✓ $key set"
            } else {
                Write-Warning "  ⚠ Failed to set $key"
            }
        }
    }
    
    Write-Success "✓ Secrets configured"
}

# Deploy functions
Write-Info ""
Write-Info "Deploying Edge Functions..."
Write-Info "=========================="

$functions = @()
if ($Function -eq "all") {
    $functions = @("process-upload", "normalize-location", "generate-report")
} else {
    $functions = @($Function)
}

$deployedCount = 0
$failedCount = 0

foreach ($func in $functions) {
    Write-Info ""
    Write-Info "Deploying: $func"
    Write-Info "-------------------"
    
    $funcPath = Join-Path "functions" $func
    if (-not (Test-Path $funcPath)) {
        Write-Error "  ✗ Function directory not found: $funcPath"
        $failedCount++
        continue
    }
    
    # Deploy the function
    $deployCmd = "npx supabase functions deploy $func --project-ref $ProjectRef"
    Write-Info "  Running: $deployCmd"
    
    $deployOutput = Invoke-Expression $deployCmd 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "  ✓ Successfully deployed: $func"
        $deployedCount++
        
        # Get function URL
        $functionUrl = "$([Environment]::GetEnvironmentVariable('SUPABASE_URL'))/functions/v1/$func"
        Write-Info "  URL: $functionUrl"
    } else {
        Write-Error "  ✗ Failed to deploy: $func"
        Write-Error "  Error: $deployOutput"
        $failedCount++
    }
}

# Verify deployment if requested
if ($Verify -and $deployedCount -gt 0) {
    Write-Info ""
    Write-Info "Verifying deployments..."
    Write-Info "======================="
    
    foreach ($func in $functions) {
        Write-Info ""
        Write-Info "Testing: $func"
        
        $functionUrl = "$([Environment]::GetEnvironmentVariable('SUPABASE_URL'))/functions/v1/$func"
        $anonKey = [Environment]::GetEnvironmentVariable("SUPABASE_ANON_KEY")
        
        try {
            # Test with OPTIONS request (CORS preflight)
            $response = Invoke-WebRequest -Uri $functionUrl `
                -Method OPTIONS `
                -Headers @{
                    "apikey" = $anonKey
                    "Authorization" = "Bearer $anonKey"
                } `
                -ErrorAction Stop
            
            if ($response.StatusCode -eq 200) {
                Write-Success "  ✓ Function responding (CORS check passed)"
            }
        } catch {
            Write-Warning "  ⚠ Function may not be responding correctly"
            Write-Warning "    Error: $_"
        }
    }
}

# Summary
Write-Info ""
Write-Info "================================================"
Write-Info "                Deployment Summary              "
Write-Info "================================================"
Write-Success "✓ Deployed: $deployedCount function(s)"
if ($failedCount -gt 0) {
    Write-Error "✗ Failed: $failedCount function(s)"
}

Write-Info ""
Write-Info "Next steps:"
Write-Info "1. Test your functions using the Supabase Dashboard"
Write-Info "2. Check logs: npx supabase functions logs <function-name>"
Write-Info "3. Set up storage buckets if not already created:"
Write-Info "   - 'uploads' bucket for file uploads"
Write-Info "   - 'reports' bucket for generated reports"
Write-Info ""

# Function URLs
Write-Info "Function URLs:"
foreach ($func in $functions) {
    $functionUrl = "$([Environment]::GetEnvironmentVariable('SUPABASE_URL'))/functions/v1/$func"
    Write-Info "  $func : $functionUrl"
}

Write-Info ""
Write-Info "Example test commands:"
Write-Info '  curl -X POST \'
Write-Info "    $([Environment]::GetEnvironmentVariable('SUPABASE_URL'))/functions/v1/normalize-location \"
Write-Info '    -H "Authorization: Bearer YOUR_ANON_KEY" \'
Write-Info '    -H "Content-Type: application/json" \'
Write-Info '    -d ''{"locations":[{"id":"1","text":"San Francisco, CA"}]}'''

# Return to original directory
Set-Location $currentDir

Write-Info ""
Write-Success "Deployment complete!"
