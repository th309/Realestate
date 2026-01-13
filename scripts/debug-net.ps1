$hostName = "db.pysflbhpnqwoczyuaaif.supabase.co"

Write-Host "1. Testing local DNS resolution for $hostName" -ForegroundColor Cyan
nslookup $hostName

Write-Host "`n2. Testing Google DNS (8.8.8.8) resolution for $hostName" -ForegroundColor Cyan
nslookup $hostName 8.8.8.8

Write-Host "`n3. Testing connection to Port 5432 (Direct)" -ForegroundColor Cyan
try {
    $tcp = New-Object Net.Sockets.TcpClient
    $result = $tcp.BeginConnect($hostName, 5432, $null, $null)
    $success = $result.AsyncWaitHandle.WaitOne(2000)
    if ($success) {
        $tcp.EndConnect($result)
        Write-Host "SUCCESS: Port 5432 is open/reachable." -ForegroundColor Green
        $tcp.Close()
    } else {
        Write-Host "FAILURE: Port 5432 timed out." -ForegroundColor Red
    }
} catch {
    Write-Host "FAILURE: Port 5432 error: $_" -ForegroundColor Red
}

Write-Host "`n4. Testing connection to Port 6543 (Pooler)" -ForegroundColor Cyan
try {
    $tcp = New-Object Net.Sockets.TcpClient
    $result = $tcp.BeginConnect($hostName, 6543, $null, $null)
    $success = $result.AsyncWaitHandle.WaitOne(2000)
    if ($success) {
        $tcp.EndConnect($result)
        Write-Host "SUCCESS: Port 6543 is open/reachable." -ForegroundColor Green
        $tcp.Close()
    } else {
        Write-Host "FAILURE: Port 6543 timed out." -ForegroundColor Red
    }
} catch {
    Write-Host "FAILURE: Port 6543 error: $_" -ForegroundColor Red
}
