param([Parameter(Mandatory=$true)][string]$OutputDir, [ValidateSet('grok', 'muse')][string]$Backend = 'grok')
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$taskRoot = [IO.Path]::GetFullPath($OutputDir)
$launchFile = Join-Path $taskRoot 'launch.json'
if (Test-Path -LiteralPath $launchFile) { Remove-Item -LiteralPath $launchFile }
$serverScript = Join-Path $PSScriptRoot 'mock-server.mjs'
$server = Start-Process node -ArgumentList @(('"' + $serverScript + '"'), ('"' + $taskRoot + '"'), $Backend) -WindowStyle Hidden -PassThru
try {
    $deadline = (Get-Date).AddSeconds(10)
    while (!(Test-Path -LiteralPath $launchFile)) {
        if ((Get-Date) -gt $deadline) { throw 'Local server did not start' }
        Start-Sleep -Milliseconds 100
    }
    $launch = Get-Content -LiteralPath $launchFile -Raw | ConvertFrom-Json
    New-Item -ItemType Directory -Force -Path $launch.home | Out-Null
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $launch.executable
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.EnvironmentVariables.Clear()
    foreach ($entry in $launch.env.PSObject.Properties) { $startInfo.EnvironmentVariables[$entry.Name] = $entry.Value }
    $startInfo.Arguments = ($launch.args | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }) -join ' '
    $cli = [Diagnostics.Process]::Start($startInfo)
    $cli.StandardInput.WriteLine('Local synthetic wire test.')
    $cli.StandardInput.Close()
    $output = $cli.StandardOutput.ReadToEndAsync()
    if (!$cli.WaitForExit(30000)) { $cli.Kill(); throw 'Local CLI timed out' }
    [IO.File]::WriteAllText((Join-Path $taskRoot 'cli-events.jsonl'), $output.Result, [Text.UTF8Encoding]::new($false))
    Write-Output $output.Result
    if ($cli.ExitCode -ne 0) { throw 'Local CLI failed' }
    node (Join-Path $PSScriptRoot 'verify.mjs') $taskRoot $Backend
    if ($LASTEXITCODE -ne 0) { throw 'Wire assertions failed' }
} finally {
    if (!$server.HasExited) { Stop-Process -Id $server.Id }
}
