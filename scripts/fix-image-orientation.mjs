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

// Fix image orientation while preserving aspect ratio
const fixImageOrientation = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const originalPath = filePath + '.original';
  
  if (!['.jpg', '.jpeg'].includes(ext) || !fs.existsSync(originalPath)) {
    return;
  }

  try {
    // Get metadata from original file
    const originalMetadata = await sharp(originalPath).metadata();
    const { width: origWidth, height: origHeight, orientation } = originalMetadata;
    
    // Skip if no orientation issue
    if (!orientation || orientation === 1) {
      return;
    }
    
    console.log(`🔄 Fixing orientation: ${path.basename(filePath)}`);
    console.log(`   Original: ${origWidth}x${origHeight}, Orientation: ${orientation}`);
    
    // Determine if this should be a portrait image
    const shouldBePortrait = orientation === 6 || orientation === 8 || 
                           (origWidth > origHeight && (orientation === 6 || orientation === 8));
    
    let targetWidth, targetHeight;
    
    if (shouldBePortrait) {
      // Portrait orientation - height > width
      targetWidth = 1280;  // Smaller dimension
      targetHeight = 1920; // Larger dimension
    } else {
      // Landscape orientation - width > height  
      targetWidth = 1920;  // Larger dimension
      targetHeight = 1280; // Smaller dimension
    }
    
    // Process the image with proper orientation handling
    const result = await sharp(originalPath)
      .rotate() // This automatically rotates based on EXIF orientation
      .resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ 
        quality: 85, 
        progressive: true,
        mozjpeg: true 
      })
      .toBuffer();

    // Get metadata of processed image to verify
    const processedMetadata = await sharp(result).metadata();
    
    fs.writeFileSync(filePath, result);
    
    console.log(`✅ Fixed: ${path.basename(filePath)}`);
    console.log(`   Processed: ${processedMetadata.width}x${processedMetadata.height}`);
    console.log(`   Target: ${targetWidth}x${targetHeight}`);
    console.log('');

    // Also regenerate WebP version with correct orientation
    const webpPath = filePath.replace(/\.(jpe?g)$/i, '.webp');
    if (fs.existsSync(webpPath)) {
      await sharp(result)
        .webp({ 
          quality: 85, 
          effort: 6,
          nearLossless: false
        })
        .toFile(webpPath);
      
      console.log(`🔄 Updated WebP: ${path.basename(webpPath)}`);
    }

  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error);
  }
};

// Main function
const runOrientationFix = async () => {
  console.log('🎯 Starting orientation fix...');
  console.log('📁 Target directory:', directory);
  console.log('');

  const files = getAllFiles(directory);
  const imageFiles = files.filter(file => 
    ['.jpg', '.jpeg'].includes(path.extname(file).toLowerCase()) &&
    !file.includes('.original') && 
    !file.includes('.webp')
  );

  console.log(`📊 Found ${imageFiles.length} image files to check`);
  console.log('');

  let fixedCount = 0;

  for (const file of imageFiles) {
    const originalPath = file + '.original';
    if (fs.existsSync(originalPath)) {
      try {
        const metadata = await sharp(originalPath).metadata();
        if (metadata.orientation && metadata.orientation !== 1) {
          await fixImageOrientation(file);
          fixedCount++;
        }
      } catch (err) {
        // Skip files that can't be read
        continue;
      }
    }
  }

  console.log('🎉 Orientation Fix Summary:');
  console.log(`   Files checked: ${imageFiles.length}`);
  console.log(`   Files fixed: ${fixedCount}`);
  if (fixedCount === 0) {
    console.log('✨ All images have correct orientation!');
  }
};

runOrientationFix();