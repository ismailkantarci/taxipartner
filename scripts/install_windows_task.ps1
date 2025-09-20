$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Join-Path $repo '..' | Resolve-Path | Select-Object -ExpandProperty Path
$py = (Get-Command py -ErrorAction SilentlyContinue)
if ($py) { $python = 'py -3' } else { $python = 'python' }

$cmd = "& { $python `"$repo\scripts\local_watch_auto_release.py`" --interval 5 }"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -Command \"$cmd\""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew

try { Unregister-ScheduledTask -TaskName 'ReleaseWatch' -Confirm:$false -ErrorAction SilentlyContinue } catch {}
Register-ScheduledTask -TaskName 'ReleaseWatch' -Action $action -Trigger $trigger -Settings $settings | Out-Null
Start-ScheduledTask -TaskName 'ReleaseWatch'
Write-Host 'Windows Scheduled Task installed and started (ReleaseWatch)'

