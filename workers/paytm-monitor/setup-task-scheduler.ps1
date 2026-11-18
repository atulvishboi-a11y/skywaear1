# ==============================================================================
# Windows Task Scheduler Setup for Paytm Business Dashboard Monitor
# Run this PowerShell script as Administrator to register the 24/7 worker task.
# ==============================================================================

$taskName = "PaytmBusinessMonitor"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$batPath = Join-Path $scriptDir "start-monitor.bat"

Write-Host "Registering Windows Task Scheduler Job: $taskName" -ForegroundColor Cyan
Write-Host "Target Script: $batPath" -ForegroundColor Gray

# Define action to run the batch file in working directory
$action = New-ScheduledTaskAction -Execute $batPath -WorkingDirectory $scriptDir

# Trigger at system startup or logon
$trigger = New-ScheduledTaskTrigger -AtLogOn

# Settings: Restart on failure, do not stop if battery, run indefinitely
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Days 365) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Register the task
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "24/7 Paytm Business Dashboard Transaction Monitor & Order Reconciler for Zenin Streetwear" `
    -User $env:USERNAME `
    -Force

Write-Host "`nTask '$taskName' registered successfully!" -ForegroundColor Green
Write-Host "You can view or manage it in Windows Task Scheduler (taskschd.msc)." -ForegroundColor Yellow
