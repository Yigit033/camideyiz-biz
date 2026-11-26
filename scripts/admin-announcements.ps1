# Schedule an OWNER-approved special broadcast via the private API.
# This script is for a trusted administrator's LOCAL terminal, not the app.
# Never supply the ADMIN secret as a command-line argument or commit it.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('list','draft','approve','cancel')]
  [string]$Action,
  [string]$Title,
  [string]$Body,
  [string]$ScheduledAt,
  [string]$Id
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$base=$env:CB_ANNOUNCEMENTS_API_URL
$secret=$env:CB_ANNOUNCEMENT_ADMIN_SECRET
if (-not $base -or $base -notmatch '^https://[^/]+/?$') {
  throw 'Set CB_ANNOUNCEMENTS_API_URL to the deployed HTTPS API origin.'
}
if (-not $secret -or $secret.Length -lt 48) {
  throw 'Set CB_ANNOUNCEMENT_ADMIN_SECRET (48+ characters) as a LOCAL secret.'
}
$endpoint=$base.TrimEnd('/')+'/api/internal/announcements'
$headers=@{Authorization='Bearer '+$secret}
$method='GET'
$body=$null
switch ($Action) {
  'list' { $method='GET' }
  'draft' {
    $method='POST'
    if (-not $Title -or -not $Body -or -not $ScheduledAt) {
      throw 'Draft requires Title, Body and ScheduledAt with explicit offset (e.g. 2026-11-20T18:00:00+03:00).'
    }
    # Validate offset-aware local date before writing the JSON.
    $parsed=[DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse($ScheduledAt,[ref]$parsed) -or
        $ScheduledAt -notmatch '(Z|[+-]\d{2}:\d{2})$') {
      throw 'ScheduledAt must be an explicit ISO 8601 time with Z or +03:00.'
    }
    $body=@{title=$Title;body=$Body;scheduledAt=$ScheduledAt} | ConvertTo-Json -Compress
  }
  'approve' {
    $method='PATCH'
    if ($Id -notmatch '^[a-fA-F0-9-]{36}$') {throw 'Approve requires -Id UUID.'}
    $body=@{id=$Id;action='approve'} | ConvertTo-Json -Compress
  }
  'cancel' {
    $method='PATCH'
    if ($Id -notmatch '^[a-fA-F0-9-]{36}$') {throw 'Cancel requires -Id UUID.'}
    $body=@{id=$Id;action='cancel'} | ConvertTo-Json -Compress
  }
}
try {
  $arguments=@{Uri=$endpoint;Method=$method;Headers=$headers;TimeoutSec=25}
  if($null -ne $body){
    $arguments.Body=$body
    $arguments.ContentType='application/json'
  }
  $result=Invoke-RestMethod @arguments
  $result | ConvertTo-Json -Depth 8
}catch {
  Write-Error ('Announcement API request failed. Verify server activation, admin auth, migration and response: '+$_.Exception.Message)
  exit 1
}
