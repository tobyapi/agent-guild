// Fixed program only. Requests and secrets travel over stdin, never command arguments.
// CREDENTIALW: https://learn.microsoft.com/windows/win32/api/wincred/ns-wincred-credentialw
export const WINDOWS_CREDENTIAL_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.Encoding]::UTF8
[Console]::OutputEncoding = [Text.Encoding]::UTF8
try {
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class GuildCredentials {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct Credential {
    public uint Flags, Type;
    public string TargetName, Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize;
    public IntPtr CredentialBlob;
    public uint Persist, AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias, UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool Read(string target, uint type, uint flags, out IntPtr credential);
  [DllImport("advapi32.dll", EntryPoint="CredWriteW", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool Write(ref Credential credential, uint flags);
  [DllImport("advapi32.dll", EntryPoint="CredDeleteW", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool Delete(string target, uint type, uint flags);
  [DllImport("advapi32.dll", EntryPoint="CredFree")]
  public static extern void Free(IntPtr credential);
}
'@
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
if ($request.backend -cnotmatch '^[a-z][a-z0-9-]{0,31}$') { throw 'backend' }
$target = 'AI-Guild/backend-api-key/' + $request.backend
switch ($request.action) {
  'set' {
    $bytes = [Text.Encoding]::UTF8.GetBytes([string]$request.key)
    if ($bytes.Length -eq 0 -or $bytes.Length -gt 2560) { throw 'key' }
    $pointer = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
    try {
      [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $pointer, $bytes.Length)
      $credential = New-Object GuildCredentials+Credential
      $credential.Type = 1
      $credential.TargetName = $target
      $credential.UserName = 'AI-Guild'
      $credential.Persist = 2
      $credential.CredentialBlobSize = $bytes.Length
      $credential.CredentialBlob = $pointer
      if (-not [GuildCredentials]::Write([ref]$credential, 0)) { throw 'write' }
    } finally {
      [Array]::Clear($bytes, 0, $bytes.Length)
      [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $pointer, $bytes.Length)
      [Runtime.InteropServices.Marshal]::FreeHGlobal($pointer)
    }
    [Console]::Write('null')
  }
  'delete' {
    if (-not [GuildCredentials]::Delete($target, 1, 0)) {
      if ([Runtime.InteropServices.Marshal]::GetLastWin32Error() -ne 1168) { throw 'delete' }
    }
    [Console]::Write('null')
  }
  'get' {
    $pointer = [IntPtr]::Zero
    if (-not [GuildCredentials]::Read($target, 1, 0, [ref]$pointer)) {
      if ([Runtime.InteropServices.Marshal]::GetLastWin32Error() -ne 1168) { throw 'read' }
      [Console]::Write('null')
    } else {
      try {
        $credential = [Runtime.InteropServices.Marshal]::PtrToStructure($pointer, [type][GuildCredentials+Credential])
        $bytes = New-Object byte[] $credential.CredentialBlobSize
        [Runtime.InteropServices.Marshal]::Copy($credential.CredentialBlob, $bytes, 0, $bytes.Length)
        [Console]::Write((ConvertTo-Json -Compress -InputObject ([Text.Encoding]::UTF8.GetString($bytes))))
        [Array]::Clear($bytes, 0, $bytes.Length)
      } finally { [GuildCredentials]::Free($pointer) }
    }
  }
  default { throw 'action' }
}
} catch { [Console]::Error.Write('Credential store operation failed'); exit 1 }
`;
