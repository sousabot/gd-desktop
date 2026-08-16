process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';

const { build, Platform } = require('electron-builder');

const args = process.argv.slice(2);
const wantRelease = args.includes('--release');
const portableOnly = args.includes('--portable') || args.includes('portable');

async function main() {
  if (wantRelease && !String(process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '').trim()) {
    console.error('[electron-build] npm run release needs GH_TOKEN in the environment.');
    console.error('  $env:GH_TOKEN = "YOUR_TOKEN"');
    console.error('  npm run release');
    console.error('For a local installer only, use: npm run dist');
    process.exit(1);
  }

  const options = {
    publish: wantRelease ? 'always' : 'never',
  };
  if (portableOnly) {
    options.targets = Platform.WINDOWS.createTarget(['portable']);
  } else {
    options.targets = Platform.WINDOWS.createTarget(['nsis', 'portable']);
  }

  await build(options);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
