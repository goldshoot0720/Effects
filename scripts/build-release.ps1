[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Version
)

$ErrorActionPreference = 'Stop'

$normalizedVersion = $Version.Trim().TrimStart('v')
if ($normalizedVersion -notmatch '^\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$') {
    throw "Version '$Version' must use semantic-version form, for example 1.0.0."
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$appsRoot = Join-Path $repositoryRoot 'apps\EffectsApp'
$releaseRoot = Join-Path $repositoryRoot ("artifacts\v{0}" -f $normalizedVersion)
$desktopOutput = Join-Path $releaseRoot 'desktop'
$androidOutput = Join-Path $releaseRoot 'android'

New-Item -ItemType Directory -Path $desktopOutput -Force | Out-Null
New-Item -ItemType Directory -Path $androidOutput -Force | Out-Null

# The Android build needs an SDK with API level 34. Prefer a copy checked out
# beside the repository, then fall back to the usual environment variables.
$androidSdk = @(
    (Join-Path $repositoryRoot '.android-sdk'),
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    (Join-Path $env:LOCALAPPDATA (Join-Path 'Android' 'Sdk'))
) | Where-Object { $_ -and (Test-Path (Join-Path $_ (Join-Path 'platforms' (Join-Path 'android-34' 'android.jar')))) } |
    Select-Object -First 1

$androidArgs = @()
if ($androidSdk) {
    Write-Host "Using Android SDK: $androidSdk"
    $androidArgs += "--property:AndroidSdkDirectory=$androidSdk"
} else {
    Write-Warning 'No Android SDK with API 34 found; letting the SDK resolve it.'
}

Push-Location $repositoryRoot
try {
    dotnet publish "$appsRoot\EffectsApp.Desktop\EffectsApp.Desktop.csproj" `
        --configuration Release `
        --runtime win-x64 `
        --self-contained true `
        --output $desktopOutput

    $desktopZip = Join-Path $releaseRoot ("Effects-{0}-win-x64.zip" -f $normalizedVersion)
    Compress-Archive -Path (Join-Path $desktopOutput '*') -DestinationPath $desktopZip -Force

    dotnet publish "$appsRoot\EffectsApp.Android\EffectsApp.Android.csproj" `
        --configuration Release `
        --framework net8.0-android `
        --property:AndroidPackageFormat=apk `
        --property:ApplicationDisplayVersion=$normalizedVersion `
        --output $androidOutput `
        @androidArgs

    $apk = Get-ChildItem -Path $androidOutput -Filter '*-Signed.apk' -Recurse |
        Select-Object -First 1
    if (-not $apk) {
        $apk = Get-ChildItem -Path $androidOutput -Filter '*.apk' -Recurse |
            Where-Object { $_.Name -notmatch 'unsigned' } |
            Select-Object -First 1
    }
    if (-not $apk) {
        throw 'The Android publish completed without producing an installable APK.'
    }

    $releaseApk = Join-Path $releaseRoot ("Effects-{0}.apk" -f $normalizedVersion)
    Copy-Item -LiteralPath $apk.FullName -Destination $releaseApk -Force

    Write-Host "Created release assets:"
    Write-Host "  $desktopZip"
    Write-Host "  $releaseApk"
}
finally {
    Pop-Location
}
