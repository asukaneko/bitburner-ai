param(
    [ValidateSet('Install', 'Restore', 'Status')][string]$Mode = 'Status',
    [Parameter(Mandatory = $true)][string]$GameDir
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-Hash([string]$Path) {
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        $stream = [IO.File]::OpenRead($Path)
        $algorithm = [Security.Cryptography.SHA256]::Create()
        try {
            return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
        } finally {
            $stream.Dispose()
            $algorithm.Dispose()
        }
    }
    return $null
}
function Get-SafePath([string]$Root, [string]$Relative) {
    $basePath = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    $targetPath = [IO.Path]::GetFullPath((Join-Path $basePath $Relative))
    if (-not $targetPath.StartsWith($basePath, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Invalid relative path: $Relative"
    }
    return $targetPath
}
function Save-State($Value) {
    $Value | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $statePath -Encoding UTF8
}

try {
    $gameRoot = [IO.Path]::GetFullPath($GameDir).TrimEnd('\')
    $payloadRoot = Join-Path $PSScriptRoot 'payload'
    $backupRoot = Join-Path $PSScriptRoot 'backup'
    $statePath = Join-Path $PSScriptRoot 'install-state.json'
    $manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not (Test-Path -LiteralPath (Join-Path $gameRoot 'bitburner.exe') -PathType Leaf)) {
        throw 'Game directory must contain bitburner.exe.'
    }
    $state = $null
    if (Test-Path -LiteralPath $statePath) {
        $state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($state.gameRoot -ne $gameRoot) { throw 'Backup belongs to another game directory.' }
    }
    if ($Mode -eq 'Status') {
        if ($null -eq $state) { Write-Host 'No installation record.'; exit 0 }
        $changed = @($state.files | Where-Object {
            (Get-Hash (Get-SafePath $gameRoot $_.path)) -ne $_.sha256
        })
        Write-Host "Installed: $($state.installed); Matching patch files: $($state.files.Count - $changed.Count)/$($state.files.Count)"
        exit 0
    }
    $running = @(Get-Process -Name 'bitburner' -ErrorAction SilentlyContinue)
    if ($running.Count -gt 0) { Write-Host 'Bitburner is running. Changes will take effect after a full restart.' -ForegroundColor Yellow }

    if ($Mode -eq 'Install') {
        foreach ($guard in $manifest.guardFiles) {
            if ((Get-Hash (Get-SafePath $gameRoot $guard.path)) -ne $guard.sha256) { throw 'Unsupported game build; the AI adapter has not been verified for it.' }
        }
        $version = (Get-Content -LiteralPath (Join-Path $gameRoot 'resources/app/package.json') -Raw | ConvertFrom-Json).version
        if ($version -ne $manifest.gameVersion) { throw "Unsupported game version: $version" }
        foreach ($entry in $manifest.files) {
            $source = Get-SafePath $payloadRoot $entry.path
            if ((Get-Hash $source) -ne $entry.sha256) { throw "Damaged patch file: $($entry.path)" }
            $target = Get-SafePath $gameRoot $entry.path
            $current = Get-Hash $target
            if ($null -eq $state) {
                if ($current -ne $entry.originalSha256) { throw "Game file differs from supported original: $($entry.path)" }
            } elseif ($current -ne $entry.sha256 -and $current -ne $entry.originalSha256 -and $current -notin @($entry.previousSha256)) {
                throw "Game file changed; refusing to overwrite: $($entry.path)"
            }
        }
        if ($null -eq $state) {
            if (Test-Path -LiteralPath $backupRoot) { throw 'Unmanaged backup already exists; preserve it before retrying.' }
            New-Item -ItemType Directory -Path $backupRoot | Out-Null
            foreach ($entry in $manifest.files) {
                if ($null -ne $entry.originalSha256) {
                    $backup = Get-SafePath $backupRoot $entry.path
                    New-Item -ItemType Directory -Path (Split-Path $backup -Parent) -Force | Out-Null
                    Copy-Item -LiteralPath (Get-SafePath $gameRoot $entry.path) -Destination $backup
                    if ((Get-Hash $backup) -ne $entry.originalSha256) { throw 'Backup verification failed.' }
                }
            }
            $state = [pscustomobject]@{ gameRoot = $gameRoot; installed = $false; source = $manifest.source; commit = $manifest.commit; files = $manifest.files }
            Save-State $state
        }
        foreach ($entry in $manifest.files) {
            if ($null -ne $entry.originalSha256 -and (Get-Hash (Get-SafePath $backupRoot $entry.path)) -ne $entry.originalSha256) {
                throw "Backup verification failed: $($entry.path)"
            }
        }
        $state.files = $manifest.files
        $state.commit = $manifest.commit
        $state.installed = $false
        Save-State $state
        foreach ($entry in $manifest.files) {
            $target = Get-SafePath $gameRoot $entry.path
            New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
            Copy-Item -LiteralPath (Get-SafePath $payloadRoot $entry.path) -Destination $target -Force
            if ((Get-Hash $target) -ne $entry.sha256) { throw "Installation verification failed: $($entry.path)" }
        }
        $state.installed = $true
        Save-State $state
        Write-Host 'AI assistant installed and verified. Fully restart Bitburner to enable it.' -ForegroundColor Green
        Write-Host "Original files: $backupRoot"
    } else {
        if ($null -eq $state) { throw 'No backup record; nothing to restore.' }
        foreach ($entry in $state.files) {
            $current = Get-Hash (Get-SafePath $gameRoot $entry.path)
            if ($current -ne $entry.sha256 -and $current -ne $entry.originalSha256 -and $current -notin @($entry.previousSha256)) {
                throw "Game file changed; refusing to restore over it: $($entry.path)"
            }
            if ($null -ne $entry.originalSha256 -and (Get-Hash (Get-SafePath $backupRoot $entry.path)) -ne $entry.originalSha256) {
                throw "Backup verification failed: $($entry.path)"
            }
        }
        foreach ($entry in $state.files) {
            $target = Get-SafePath $gameRoot $entry.path
            if ($null -ne $entry.originalSha256) {
                Copy-Item -LiteralPath (Get-SafePath $backupRoot $entry.path) -Destination $target -Force
            } elseif (Test-Path -LiteralPath $target -PathType Leaf) {
                Remove-Item -LiteralPath $target
            }
            if ((Get-Hash $target) -ne $entry.originalSha256) { throw "Restore verification failed: $($entry.path)" }
        }
        $state.installed = $false
        Save-State $state
        Write-Host 'Previous game files restored and verified. Chinese localization is preserved.' -ForegroundColor Green
    }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
