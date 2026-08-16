const path = require('path');
const fs = require('fs');

// Stamp the unpacked app exe only. Never touch the portable NSIS wrapper —
// rcedit corrupts that SFX and triggers "Installer integrity check has failed".
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const icon = path.join(context.packager.projectDir, 'build', 'icon.ico');
  if (!fs.existsSync(exe) || !fs.existsSync(icon)) return;
  const { rcedit } = await import('rcedit');
  await rcedit(exe, { icon });
  console.log('[afterPack] icon stamped', path.basename(exe));
};
