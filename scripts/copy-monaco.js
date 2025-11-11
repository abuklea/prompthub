#!/usr/bin/env node
/**
 * Copy Monaco Editor files from node_modules to public directory
 * This script runs automatically after npm install (postinstall hook)
 */

const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'node_modules', 'monaco-editor', 'min', 'vs');
const TARGET = path.join(__dirname, '..', 'public', 'monaco-editor', 'vs');

// Ensure target directory exists
if (!fs.existsSync(path.dirname(TARGET))) {
  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
}

// Copy function
function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursive(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Perform copy
console.log('📦 Copying Monaco Editor files to public directory...');
try {
  copyRecursive(SOURCE, TARGET);
  console.log('✅ Monaco Editor files copied successfully!');
} catch (error) {
  console.error('❌ Failed to copy Monaco Editor files:', error.message);
  process.exit(1);
}
