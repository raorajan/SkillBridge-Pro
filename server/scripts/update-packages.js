const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Directories with package.json to update
const directoriesToUpdate = [
  '.', // root
  'api-gateway',
  'shared',
  'services/user-service',
  'services/settings-service',
  'services/project-service',
  'services/chat-service'
];

const baseDir = path.resolve(__dirname, '..');

// Create backup of package.json before updating
function createBackup(dirPath) {
  const fullPath = path.join(baseDir, dirPath);
  const packageJsonPath = path.join(fullPath, 'package.json');
  const backupPath = path.join(fullPath, 'package.json.backup');

  if (fs.existsSync(packageJsonPath)) {
    try {
      fs.copyFileSync(packageJsonPath, backupPath);
      console.log(`  💾 Backup created: package.json.backup`);
      return true;
    } catch (error) {
      console.error(`  ⚠️  Could not create backup: ${error.message}`);
      return false;
    }
  }
  return false;
}

function updatePackages(dirPath) {
  const fullPath = path.join(baseDir, dirPath);
  const packageJsonPath = path.join(fullPath, 'package.json');

  // Check if package.json exists
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`⚠️  No package.json found in: ${dirPath}`);
    return false;
  }

  console.log(`\n📦 Updating packages in: ${dirPath}`);
  console.log('─'.repeat(50));

  try {
    // Create backup first
    createBackup(dirPath);

    // Change to the directory
    process.chdir(fullPath);

    // Check for updates (dry run first to show what will be updated)
    console.log('🔍 Checking for available updates...');
    try {
      execSync('npx -y npm-check-updates --format group', { 
        stdio: 'inherit',
        cwd: fullPath 
      });
    } catch (error) {
      // ncu exits with code 1 if there are updates, which is expected
      // We'll continue to update
    }

    // Update package.json to latest versions
    console.log('\n⬆️  Updating package.json to latest versions...');
    execSync('npx -y npm-check-updates -u', { 
      stdio: 'inherit',
      cwd: fullPath 
    });

    console.log(`✓ Successfully updated package.json in: ${dirPath}`);
    return true;
  } catch (error) {
    console.error(`✗ Error updating packages in ${dirPath}:`, error.message);
    return false;
  }
}

function installPackages(dirPath) {
  const fullPath = path.join(baseDir, dirPath);
  const packageJsonPath = path.join(fullPath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  console.log(`\n📥 Installing updated packages in: ${dirPath}`);
  console.log('─'.repeat(50));

  try {
    process.chdir(fullPath);
    execSync('npm install', { 
      stdio: 'inherit',
      cwd: fullPath 
    });
    console.log(`✓ Successfully installed packages in: ${dirPath}`);
    return true;
  } catch (error) {
    console.error(`✗ Error installing packages in ${dirPath}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🚀 Starting package update process...');
console.log('='.repeat(60));
console.log('This will update all packages to their latest versions.');
console.log('='.repeat(60));

// Step 1: Update all package.json files
console.log('\n📝 STEP 1: Updating package.json files...');
const updateResults = [];
directoriesToUpdate.forEach(dir => {
  const result = updatePackages(dir);
  updateResults.push({ dir, updated: result });
});

// Step 2: Install updated packages
console.log('\n\n📦 STEP 2: Installing updated packages...');
const installResults = [];
directoriesToUpdate.forEach(dir => {
  const result = installPackages(dir);
  installResults.push({ dir, installed: result });
});

// Summary
console.log('\n\n' + '='.repeat(60));
console.log('📊 UPDATE SUMMARY');
console.log('='.repeat(60));

console.log('\n📝 Package.json Updates:');
updateResults.forEach(({ dir, updated }) => {
  console.log(`  ${updated ? '✓' : '✗'} ${dir}`);
});

console.log('\n📦 Package Installations:');
installResults.forEach(({ dir, installed }) => {
  console.log(`  ${installed ? '✓' : '✗'} ${dir}`);
});

const allUpdated = updateResults.every(r => r.updated);
const allInstalled = installResults.every(r => r.installed);

if (allUpdated && allInstalled) {
  console.log('\n✨ All packages updated and installed successfully!');
} else {
  console.log('\n⚠️  Some packages may not have been updated. Please check the errors above.');
}

// Return to base directory
process.chdir(baseDir);

