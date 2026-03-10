$connections = netstat -ano | Select-String ":4000"
foreach ($line in $connections) {
    $parts = $line.ToString().Trim() -split '\s+'
    $pidNum = $parts[-1]
    if ($pidNum -match '^\d+$' -and $pidNum -ne '0') {
        Write-Host "Killing PID $pidNum on port 4000"
        taskkill /F /PID $pidNum 2>$null
    }
}
Start-Sleep -Milliseconds 500
Write-Host "Starting backend server..."
npm run dev
