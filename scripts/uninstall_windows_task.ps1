$ErrorActionPreference = 'Stop'
try {
  Unregister-ScheduledTask -TaskName 'ReleaseWatch' -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host 'Windows Scheduled Task removed (ReleaseWatch)'
} catch {}

