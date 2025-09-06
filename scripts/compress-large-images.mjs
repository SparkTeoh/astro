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

// Optimize large images
const optimizeLargeImage = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
    return;
  }

  try {
    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    
    // Only process files larger than 1MB
    if (sizeMB < 1) {
      return;
    }

    console.log(`📸 Processing: ${path.basename(filePath)} (${sizeMB.toFixed(2)}MB)`);

    // Create backup
    const backupPath = filePath + '.original';
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
      console.log(`💾 Backup created: ${path.basename(backupPath)}`);
    }

    // Get image metadata
    const metadata = await sharp(filePath).metadata();
    
    // Calculate new dimensions (max width/height 1920px for web)
    let newWidth = metadata.width;
    let newHeight = metadata.height;
    
    if (metadata.width > 1920 || metadata.height > 1920) {
      const ratio = Math.min(1920 / metadata.width, 1920 / metadata.height);
      newWidth = Math.round(metadata.width * ratio);
      newHeight = Math.round(metadata.height * ratio);
    }

    // Optimize image with proper orientation handling
    await sharp(filePath)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ 
        quality: 85, 
        progressive: true,
        mozjpeg: true 
      })
      .toFile(filePath + '.temp');

    // Replace original with optimized version
    fs.renameSync(filePath + '.temp', filePath);

    const newStats = fs.statSync(filePath);
    const newSizeMB = newStats.size / (1024 * 1024);
    const reduction = ((sizeMB - newSizeMB) / sizeMB * 100).toFixed(1);

    console.log(`✅ Optimized: ${path.basename(filePath)}`);
    console.log(`   Original: ${sizeMB.toFixed(2)}MB → Optimized: ${newSizeMB.toFixed(2)}MB`);
    console.log(`   Reduction: ${reduction}% (${(sizeMB - newSizeMB).toFixed(2)}MB saved)`);
    console.log(`   Dimensions: ${metadata.width}x${metadata.height} → ${newWidth}x${newHeight}`);
    console.log('');

  } catch (error) {
    console.error(`❌ Error optimizing ${filePath}:`, error);
  }
};

// Main function
const runLargeImageOptimizer = async () => {
  console.log('🎯 Starting large image optimization...');
  console.log('📁 Target directory:', directory);
  console.log('');

  const files = getAllFiles(directory);
  const imageFiles = files.filter(file => 
    ['.jpg', '.jpeg', '.png'].includes(path.extname(file).toLowerCase())
  );

  console.log(`📊 Found ${imageFiles.length} image files`);
  console.log('');

  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;
  let processedCount = 0;

  for (const file of imageFiles) {
    const beforeStats = fs.statSync(file);
    const beforeSize = beforeStats.size / (1024 * 1024);
    
    if (beforeSize >= 1) {
      totalOriginalSize += beforeSize;
      await optimizeLargeImage(file);
      
      const afterStats = fs.statSync(file);
      const afterSize = afterStats.size / (1024 * 1024);
      totalOptimizedSize += afterSize;
      processedCount++;
    }
  }

  if (processedCount > 0) {
    const totalReduction = ((totalOriginalSize - totalOptimizedSize) / totalOriginalSize * 100).toFixed(1);
    console.log('🎉 Optimization Summary:');
    console.log(`   Files processed: ${processedCount}`);
    console.log(`   Total original size: ${totalOriginalSize.toFixed(2)}MB`);
    console.log(`   Total optimized size: ${totalOptimizedSize.toFixed(2)}MB`);
    console.log(`   Total saved: ${(totalOriginalSize - totalOptimizedSize).toFixed(2)}MB (${totalReduction}%)`);
  } else {
    console.log('✨ No large images found to optimize!');
  }
};

runLargeImageOptimizer();