#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import imagemin from "imagemin";
import imageminMozjpeg from "imagemin-mozjpeg";
import imageminPngquant from "imagemin-pngquant";
import imageminSvgo from "imagemin-svgo";
import ffmpeg from "fluent-ffmpeg";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const directory = path.join(__dirname, "../", "public");

// Supported file types
const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
const videoExtensions = [".mp4", ".webm", ".mov"];

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

// Optimize images with better compression and WebP generation
const optimizeImage = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  try {
    if (ext === ".svg") {
      const optimized = await imagemin.buffer(buffer, {
        plugins: [imageminSvgo()],
      });
      fs.writeFileSync(filePath, optimized);
    } else if ([".png", ".jpg", ".jpeg"].includes(ext)) {
      // Generate WebP version first
      const webpPath = filePath.replace(/\.(png|jpe?g)$/i, '.webp');
      await sharp(filePath)
        .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85, effort: 6 })
        .toFile(webpPath);
      
      console.log(`✅ Generated WebP: ${webpPath}`);
      
      // Optimize original with better compression
      const optimized = await imagemin.buffer(buffer, {
        plugins: [
          imageminMozjpeg({ quality: 85, progressive: true }), // Reduced from 100 to 85
          imageminPngquant({ quality: [0.7, 0.85] }), // Reduced from [0.9, 1] to [0.7, 0.85]
        ],
      });
      
      // Resize large images
      const sharpOptimized = await sharp(optimized)
        .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
        .toBuffer();
        
      fs.writeFileSync(filePath, sharpOptimized);
    } else {
      // For other formats, just resize if too large
      const optimized = await sharp(filePath)
        .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
        .toBuffer();
      fs.writeFileSync(filePath, optimized);
    }
    console.log(`✅ Optimized image: ${filePath}`);
  } catch (error) {
    console.error(`❌ Error optimizing image ${filePath}:`, error);
  }
};

// Compress videos
const compressVideo = (filePath) => {
  const outputFilePath = `${filePath}.tmp`;
  ffmpeg(filePath)
    .outputOptions([
      "-c:v libx264",
      "-crf 18", // Lossless compression
      "-preset slow",
      "-c:a copy",
    ])
    .on("end", () => {
      fs.renameSync(outputFilePath, filePath);
      console.log(`🎥 Compressed video: ${filePath}`);
    })
    .on("error", (err) => {
      console.error(`❌ Error compressing video ${filePath}:`, err);
      if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
    })
    .save(outputFilePath);
};

// Main function
const runOptimizer = async () => {
  console.log('✨ Starting image optimization...');
  const files = getAllFiles(directory);
  let optimizedCount = 0;
  
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (imageExtensions.includes(ext)) {
      const stats = fs.statSync(file);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      if (stats.size > 100 * 1024) { // Only optimize files larger than 100KB
        console.log(`📄 Processing: ${file} (${sizeMB}MB)`);
        await optimizeImage(file);
        optimizedCount++;
      }
    }
  }
  
  console.log(`✅ Optimization complete! Processed ${optimizedCount} images.`);
};

runOptimizer();
