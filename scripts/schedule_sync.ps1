$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$syncScript = Join-Path $repoRoot "tally_sync.py"
if (-not (Test-Path -LiteralPath $syncScript -PathType Leaf)) {
    throw "Sync script not found: $syncScript"
}

$pythonCommand = Get-Command python -ErrorAction Stop
$pythonPath = $pythonCommand.Source
$action = New-ScheduledTaskAction `
    -Execute $pythonPath `
    -Argument "`"$syncScript`"" `
    -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -Daily -At "3:00 AM"
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
    -TaskName "Tally Client Portal Sync" `
    -Description "Synchronizes TallyPrime Day Book data to the configured Supabase project." `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Force | Out-Null

Write-Output "Scheduled daily sync at 3:00 AM for the current Windows user."
Write-Output "Configure TALLY_COMPANY_ID, TALLY_COMPANY_NAME, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY in that user's environment."
