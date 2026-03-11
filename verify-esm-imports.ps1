# verify-esm-imports.ps1
# Finds any remaining relative imports WITHOUT .js extension (these would cause ESM errors)

$srcDir = Join-Path $PSScriptRoot "src"
$tsFiles = Get-ChildItem -Path $srcDir -Recurse -Include "*.ts"

$issues = @()

foreach ($file in $tsFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    # Find relative imports that do NOT end in .js
    $matches = [regex]::Matches($content, 'from "(\.\./|\./)([^"]*?)(?<!\.js)"')
    foreach ($m in $matches) {
        $fullPath = $m.Groups[1].Value + $m.Groups[2].Value
        $issues += "$($file.Name): $fullPath"
    }
}

if ($issues.Count -eq 0) {
    Write-Host "SUCCESS: All relative imports have .js extensions. No issues found."
} else {
    Write-Host "ISSUES FOUND ($($issues.Count) imports still missing .js):"
    $issues | ForEach-Object { Write-Host "  $_" }
}
