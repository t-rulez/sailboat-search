#!/usr/bin/env node
// Run: node generate-icons.js
// Requires: npm install canvas (or use an online SVG-to-PNG converter)
// 
// ALTERNATIVE: Use https://realfavicongenerator.net with the favicon.svg
// and place the generated icons in public/icons/

import { createCanvas } from 'canvas';
import fs from 'fs';

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size;

  // Background
  ctx.fillStyle = '#0a1628';
  ctx.beginPath();
  ctx.roundRect(0, 0, s, s, s * 0.2);
  ctx.fill();

  // Main sail (left)
  ctx.fillStyle = 'rgba(232, 213, 176, 0.9)';
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.1);
  ctx.lineTo(s * 0.5, s * 0.75);
  ctx.lineTo(s * 0.2, s * 0.75);
  ctx.closePath();
  ctx.fill();

  // Jib sail (right)
  ctx.fillStyle = 'rgba(192, 154, 106, 0.85)';
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.2);
  ctx.lineTo(s * 0.5, s * 0.75);
  ctx.lineTo(s * 0.78, s * 0.75);
  ctx.closePath();
  ctx.fill();

  // Hull
  ctx.fillStyle = '#d4b896';
  ctx.beginPath();
  ctx.moveTo(s * 0.15, s * 0.78);
  ctx.quadraticCurveTo(s * 0.5, s * 0.92, s * 0.85, s * 0.78);
  ctx.lineTo(s * 0.8, s * 0.85);
  ctx.quadraticCurveTo(s * 0.5, s * 0.97, s * 0.2, s * 0.85);
  ctx.closePath();
  ctx.fill();

  // Mast
  ctx.strokeStyle = '#e8d5b0';
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.08);
  ctx.lineTo(s * 0.5, s * 0.78);
  ctx.stroke();

  return canvas;
}

[192, 512].forEach(size => {
  const canvas = drawIcon(size);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`public/icons/icon-${size}.png`, buffer);
  console.log(`Generated icon-${size}.png`);
});
