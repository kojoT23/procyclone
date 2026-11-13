// electron-builder hook: copies the bundled backend and admin portal into the app's resources folder.
// (electron-builder's own "extraResources" silently drops node_modules, so we copy manually.)
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  const resources = electronPlatformName === 'darwin'
    ? path.join(appOutDir, `${packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(appOutDir, 'resources');

  // skip .bin folders: they hold symlinks that are not needed at runtime and upset macOS code signing
  const skipBin = (src) => !src.split(path.sep).includes('.bin');

  for (const name of ['backend', 'frontend']) {
    const from = path.join(__dirname, '..', 'app', name);
    if (!fs.existsSync(from)) throw new Error(`desktop/app/${name} is missing. Run "npm run prepare-app" first.`);
    fs.cpSync(from, path.join(resources, name), { recursive: true, filter: skipBin });
  }
  console.log('  • copied backend + frontend into', resources);
};
