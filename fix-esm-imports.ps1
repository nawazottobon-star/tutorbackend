# fix-esm-imports.ps1
# Adds .js extensions to all relative imports in TypeScript source files
# Safe: only touches relative ./ and ../ imports; skips npm packages; prevents .js.js duplicates

$srcDir = Join-Path $PSScriptRoot "src"
$tsFiles = Get-ChildItem -Path $srcDir -Recurse -Include "*.ts"

$totalFixed = 0

foreach ($file in $tsFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $original = $content

    # Replace imports with double quotes using relative paths
    # Pattern: from "./path" or from "../path" — but NOT ending in .js already
    $content = [regex]::Replace($content, 'from "(\.\.?/[^"]*?)(?<!\.js)"', 'from "$1.js"')

    # Replace imports with single quotes using relative paths  
    $content = [regex]::Replace($content, "from '(\.\.?/[^']*?)(?<!\.js)'", "from '`$1.js'")

    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        $relativePath = $file.FullName.Replace($PSScriptRoot + "\", "")
        Write-Host "Fixed: $relativePath"
        $totalFixed++
    }
}

Write-Host ""
Write-Host "Done. Fixed $totalFixed file(s)."
