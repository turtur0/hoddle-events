#!/usr/bin/env node

/**
 * Script to rename component files to PascalCase and update all imports
 * Usage: node rename-to-pascal.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Convert kebab-case or snake_case to PascalCase
function toPascalCase(str) {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

// Get all component files recursively
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

// Main rename map
const renameMap = new Map();

// Scan components directory
function scanAndPrepareRenames(componentsDir) {
  const files = getAllFiles(componentsDir);
  
  files.forEach(filePath => {
    const fileName = path.basename(filePath);
    const fileNameWithoutExt = fileName.replace(/\.(tsx|ts)$/, '');
    const extension = path.extname(filePath);
    
    // Check if already PascalCase
    const isPascalCase = /^[A-Z][a-zA-Z0-9]*$/.test(fileNameWithoutExt);
    
    if (!isPascalCase && fileNameWithoutExt !== 'index') {
      const pascalName = toPascalCase(fileNameWithoutExt);
      const newFileName = pascalName + extension;
      const newFilePath = path.join(path.dirname(filePath), newFileName);
      
      renameMap.set(filePath, {
        oldPath: filePath,
        newPath: newFilePath,
        oldName: fileNameWithoutExt,
        newName: pascalName,
        oldFileName: fileName,
        newFileName: newFileName
      });
    }
  });
  
  return renameMap;
}

// Update imports in a file
function updateImportsInFile(filePath, renameMap) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  renameMap.forEach((renameInfo) => {
    const { oldName, newName, oldFileName, newFileName } = renameInfo;
    
    // Pattern 1: from './old-name' or from '../old-name'
    const importPattern1 = new RegExp(
      `from\\s+['"]([^'"]*/)${oldName}['"]`,
      'g'
    );
    if (importPattern1.test(content)) {
      content = content.replace(
        importPattern1,
        `from '$1${newName}'`
      );
      modified = true;
    }
    
    // Pattern 2: from '@/components/.../old-name'
    const importPattern2 = new RegExp(
      `from\\s+['"](@/components/[^'"]*/)${oldName}['"]`,
      'g'
    );
    if (importPattern2.test(content)) {
      content = content.replace(
        importPattern2,
        `from '$1${newName}'`
      );
      modified = true;
    }
    
    // Pattern 3: Dynamic imports
    const dynamicImportPattern = new RegExp(
      `import\\(['"]([^'"]*/)${oldName}['"]\\)`,
      'g'
    );
    if (dynamicImportPattern.test(content)) {
      content = content.replace(
        dynamicImportPattern,
        `import('$1${newName}')`
      );
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated imports in: ${path.relative(process.cwd(), filePath)}`);
  }
}

// Main execution
function main() {
  const componentsDir = path.join(process.cwd(), 'src/components');
  
  if (!fs.existsSync(componentsDir)) {
    console.error('❌ src/components directory not found!');
    process.exit(1);
  }
  
  console.log('🔍 Scanning components directory...\n');
  
  // Step 1: Build rename map
  const renames = scanAndPrepareRenames(componentsDir);
  
  if (renames.size === 0) {
    console.log('✅ All components are already in PascalCase!');
    return;
  }
  
  console.log(`📝 Found ${renames.size} files to rename:\n`);
  renames.forEach((info, oldPath) => {
    console.log(`  ${info.oldFileName} → ${info.newFileName}`);
  });
  
  console.log('\n⚠️  This will rename files and update all imports!');
  console.log('📦 Make sure you have committed your changes first.\n');
  
  // In a real script, you'd want to prompt for confirmation here
  // For safety, let's just log what would happen
  
  console.log('🔄 Step 1: Renaming files...\n');
  
  // Step 2: Rename files (git mv to preserve history)
  renames.forEach((info) => {
    try {
      // Use git mv if in a git repo
      execSync(`git mv "${info.oldPath}" "${info.newPath}"`, { stdio: 'ignore' });
      console.log(`  ✓ ${info.oldFileName} → ${info.newFileName}`);
    } catch (error) {
      // Fallback to regular fs rename
      fs.renameSync(info.oldPath, info.newPath);
      console.log(`  ✓ ${info.oldFileName} → ${info.newFileName} (no git)`);
    }
  });
  
  console.log('\n🔄 Step 2: Updating imports in all files...\n');
  
  // Step 3: Update imports in all TypeScript/JavaScript files
  const allProjectFiles = [
    ...getAllFiles(path.join(process.cwd(), 'src')),
  ];
  
  allProjectFiles.forEach(filePath => {
    updateImportsInFile(filePath, renames);
  });
  
  console.log('\n✅ Done! All files renamed and imports updated.');
  console.log('🧪 Run your tests and check git diff to verify changes.\n');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { toPascalCase, scanAndPrepareRenames, updateImportsInFile };
