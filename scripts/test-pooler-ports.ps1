$hostName = "aws-0-us-east-1.pooler.supabase.com"

Write-Host "Testing connection to $hostName on Port 5432 (Session/Direct?)" -ForegroundColor Cyan
try {
    $tcp = New-Object Net.Sockets.TcpClient
    $result = $tcp.BeginConnect($hostName, 5432, $null, $null)
    $success = $result.AsyncWaitHandle.WaitOne(2000)
    if ($success) {
        $tcp.EndConnect($result)
        Write-Host "SUCCESS: Port 5432 is open." -ForegroundColor Green
        $tcp.Close()
    }
    else {
        Write-Host "FAILURE: Port 5432 timed out." -ForegroundColor Red
    }
}
catch {
    Write-Host "FAILURE: Port 5432 error: $_" -ForegroundColor Red
}

Write-Host "Testing connection to $hostName on Port 6543 (Pooler)" -ForegroundColor Cyan
try {
    $tcp = New-Object Net.Sockets.TcpClient
    $result = $tcp.BeginConnect($hostName, 6543, $null, $null)
    $success = $result.AsyncWaitHandle.WaitOne(2000)
    if ($success) {
        $tcp.EndConnect($result)
        Write-Host "SUCCESS: Port 6543 is open." -ForegroundColor Green
        $tcp.Close()
    }
    else {
        Write-Host "FAILURE: Port 6543 timed out." -ForegroundColor Red
    }
}
catch {
    Write-Host "FAILURE: Port 6543 error: $_" -ForegroundColor Red
}
