const fs = require('fs');
const path = require('path');

// Directories to clean
const directoriesToClean = [
  '.', // root
  'api-gateway',
  'shared',
  'services/user-service',
  'services/settings-service',
  'services/project-service',
  'services/chat-service'
];

const baseDir = path.resolve(__dirname, '..');

function removeDirectory(dirPath) {
  const fullPath = path.join(baseDir, dirPath);
  const nodeModulesPath = path.join(fullPath, 'node_modules');
  const packageLockPath = path.join(fullPath, 'package-lock.json');

  // Remove node_modules
  if (fs.existsSync(nodeModulesPath)) {
    console.log(`Removing node_modules from: ${dirPath}`);
    try {
      fs.rmSync(nodeModulesPath, { recursive: true, force: true });
      console.log(`✓ Removed node_modules from: ${dirPath}`);
    } catch (error) {
      console.error(`✗ Error removing node_modules from ${dirPath}:`, error.message);
    }
  } else {
    console.log(`  No node_modules found in: ${dirPath}`);
  }

  // Remove package-lock.json
  if (fs.existsSync(packageLockPath)) {
    console.log(`Removing package-lock.json from: ${dirPath}`);
    try {
      fs.unlinkSync(packageLockPath);
      console.log(`✓ Removed package-lock.json from: ${dirPath}`);
    } catch (error) {
      console.error(`✗ Error removing package-lock.json from ${dirPath}:`, error.message);
    }
  } else {
    console.log(`  No package-lock.json found in: ${dirPath}`);
  }
}

console.log('🧹 Starting cleanup of all node_modules and package-lock.json files...\n');

directoriesToClean.forEach(dir => {
  removeDirectory(dir);
  console.log(''); // Empty line for readability
});

console.log('✨ Cleanup complete!');
