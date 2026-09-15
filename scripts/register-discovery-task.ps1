# Windows Gorev Zamanlayici'ya "JobDiscovery" gorevini kaydeder (her gun 09:00 ve 18:00; kacirilirsa ilk firsatta).
# Kullanim: powershell -ExecutionPolicy Bypass -File scripts\register-discovery-task.ps1
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$cmd = Join-Path $repo "scripts\run-discovery.cmd"
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$cmd`"" -WorkingDirectory $repo
$triggers = @((New-ScheduledTaskTrigger -Daily -At 09:00), (New-ScheduledTaskTrigger -Daily -At 18:00))
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "JobDiscovery" -Action $action -Trigger $triggers -Settings $settings -Description "Kisisel is ilani kesfi: Gmail is alarmi e-postalarini okuyup Firestore'a yazar." -Force | Out-Null
Get-ScheduledTask -TaskName "JobDiscovery" | Get-ScheduledTaskInfo | Select-Object NextRunTime
