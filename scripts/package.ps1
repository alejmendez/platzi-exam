param([string]$ExpectedTag = "")

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
$manifest = Get-Content (Join-Path $projectRoot "manifest.json") -Raw | ConvertFrom-Json
$version = $manifest.version
if ($version -notmatch '^\d+\.\d+\.\d+(\.\d+)?$') { throw "Version de manifest.json no valida." }
if ($ExpectedTag -and $ExpectedTag -cne "v$version") {
    throw "La etiqueta $ExpectedTag debe coincidir con v$version en manifest.json."
}

# Include only extension runtime files, never repository files or local exports.
$files = @(
    "manifest.json", "background.js", "ai.js", "vault.js", "core.js", "content.js",
    "history.html", "history.css", "history.js", "settings.js",
    "icons/icon-16.png", "icons/icon-32.png", "icons/icon-48.png", "icons/icon-128.png"
)
foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $file) -PathType Leaf)) {
        throw "Falta un archivo requerido: $file"
    }
}

$outputDir = Join-Path $projectRoot "dist"
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$outputPath = Join-Path $outputDir "platzi-exam-$version.zip"
Add-Type -AssemblyName System.IO.Compression
$stream = [System.IO.File]::Open($outputPath, [System.IO.FileMode]::Create)
try {
    $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in $files) {
            $entry = $archive.CreateEntry($file)
            $destination = $entry.Open()
            try {
                $source = [System.IO.File]::OpenRead((Join-Path $projectRoot $file))
                try { $source.CopyTo($destination) } finally { $source.Dispose() }
            } finally { $destination.Dispose() }
        }
    } finally { $archive.Dispose() }
} finally { $stream.Dispose() }
Write-Output "Paquete generado: $outputPath"
