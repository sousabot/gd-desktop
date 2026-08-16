$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'

Add-Type @"
using System.Runtime.InteropServices;

public static class GdKeys {
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);

  public static bool CtrlB() {
    bool ctrl = (GetAsyncKeyState(0x11) & 0x8000) != 0;
    bool b = (GetAsyncKeyState(0x42) & 0x8000) != 0;
    return ctrl && b;
  }
}
"@

$wasDown = $false
while ($true) {
  $down = [GdKeys]::CtrlB()
  if ($down -and -not $wasDown) {
    [Console]::WriteLine('HOTKEY')
    [Console]::Out.Flush()
  }
  $wasDown = $down
  Start-Sleep -Milliseconds 40
}
