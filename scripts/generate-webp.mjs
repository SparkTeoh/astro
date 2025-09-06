#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const directory = path.join(__dirname, "../", "src/assets/images");

// Recursively get all files
const getAllFiles = (dirPath, arrayOfFiles = []) => {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  }
  return arrayOfFiles;
};

// Generate WebP versions
const generateWebP = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
    return;
  }

  const webpPath = filePath.replace(/\.(jpe?g|png)$/i, '.webp');
  
  // Skip if WebP already exists
  if (fs.existsSync(webpPath)) {
    return;
  }

  try {
    console.log(`🔄 Converting: ${path.basename(filePath)} → ${path.basename(webpPath)}`);

    await sharp(filePath)
      .webp({ 
        quality: 85, 
        effort: 6,
        nearLossless: false
      })
      .toFile(webpPath);

    const originalStats = fs.statSync(filePath);
    const webpStats = fs.statSync(webpPath);
    
    const originalSizeKB = (originalStats.size / 1024).toFixed(1);
    const webpSizeKB = (webpStats.size / 1024).toFixed(1);
    const reduction = ((originalStats.size - webpStats.size) / originalStats.size * 100).toFixed(1);

    console.log(`✅ Created: ${path.basename(webpPath)}`);
    console.log(`   ${originalSizeKB}KB → ${webpSizeKB}KB (${reduction}% smaller)`);
    console.log('');

  } catch (error) {
    console.error(`❌ Error converting ${filePath}:`, error);
  }
};

// Main function
const runWebPGenerator = async () => {
  console.log('🌟 Starting WebP generation...');
  console.log('📁 Target directory:', directory);
  console.log('');

  const files = getAllFiles(directory);
  const imageFiles = files.filter(file => 
    ['.jpg', '.jpeg', '.png'].includes(path.extname(file).toLowerCase()) &&
    !file.includes('.original') // Skip backup files
  );

  console.log(`📊 Found ${imageFiles.length} image files`);
  console.log('');

  let convertedCount = 0;
  let totalOriginalSize = 0;
  let totalWebPSize = 0;

  for (const file of imageFiles) {
    const webpPath = file.replace(/\.(jpe?g|png)$/i, '.webp');
    
    if (!fs.existsSync(webpPath)) {
      const beforeStats = fs.statSync(file);
      totalOriginalSize += beforeStats.size;
      
      await generateWebP(file);
      
      if (fs.existsSync(webpPath)) {
        const afterStats = fs.statSync(webpPath);
        totalWebPSize += afterStats.size;
        convertedCount++;
      }
    }
  }

  if (convertedCount > 0) {
    const totalReduction = ((totalOriginalSize - totalWebPSize) / totalOriginalSize * 100).toFixed(1);
    console.log('🎉 WebP Generation Summary:');
    console.log(`   Files converted: ${convertedCount}`);
    console.log(`   Total original size: ${(totalOriginalSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Total WebP size: ${(totalWebPSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Total saved: ${((totalOriginalSize - totalWebPSize) / 1024 / 1024).toFixed(2)}MB (${totalReduction}%)`);
  } else {
    console.log('✨ All WebP versions already exist!');
  }
};

runWebPGenerator();