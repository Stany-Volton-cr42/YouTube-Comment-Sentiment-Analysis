const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#4285f4');
    gradient.addColorStop(1, '#34a853');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Add text
    ctx.fillStyle = 'white';
    ctx.font = `bold ${size * 0.5}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YT', size/2, size/2);
    
    // Save to file
    const buffer = canvas.toBuffer('image/png');
    const iconPath = path.join(__dirname, 'icons', `icon${size}.png`);
    fs.writeFileSync(iconPath, buffer);
}

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir);
}

// Generate icons
generateIcon(48);
generateIcon(128);

console.log('Icons generated successfully!'); 