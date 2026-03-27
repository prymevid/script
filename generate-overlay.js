const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

// Configuration (hardcoded but can be overridden)
const CONFIG = {
    fontPath: 'font/mineig.ttf',
    outputFolder: 'temporary/',
    category: "WARUZIKO",
    swipeText: "@waruzikofacts",
    fontSize: 50,
    fontColor: 'white',
    highlightColor: '#4a89e8',
    lineHeightMultiplier: 0.95,
    maxLineWidthPercent: 0.85,
    bottomMarginPercent: 0.1,
    swipeBottomMargin: 15,
    lineGap: 32,
    charWidthFactor: 0.6,
    targetWidth: 768,
    targetHeight: 1024,
    sharpenSigma: 1.2,
    imageAdjustments: {
        brightness: 45,
        saturation: 60,
        contrast: 55,
        hue: 50,
        blur: 0,
        grayscale: false
    },
    generateRandomOutput: true,
    randomPrefix: 'styled_war_',
    outputExtension: 'jpg'
};

// Override text from environment variable if present
if (process.env.OVERLAY_TEXT) {
    CONFIG.text = process.env.OVERLAY_TEXT;
} else {
    console.error('No overlay text provided');
    process.exit(1);
}

// Override image URL
const imageUrl = process.env.IMAGE_URL;
if (!imageUrl) {
    console.error('No image URL provided');
    process.exit(1);
}

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function escapeXml(str) {
    return str.replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','\'':'&apos;','"':'&quot;'}[c]));
}

function getRandomHighlightIndices(words) {
    const totalWords = words.length;
    const minPercent = 0.3;
    const maxPercent = 0.6;
    const countToHighlight = Math.floor(totalWords * (Math.random() * (maxPercent - minPercent) + minPercent));

    const indices = [];
    while (indices.length < countToHighlight) {
        const randomIndex = Math.floor(Math.random() * totalWords);
        if (!indices.includes(randomIndex)) indices.push(randomIndex);
    }
    return indices;
}

function wrapText(text) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = [];
    let currentChars = 0;
    const MAX_CHARS = 23;

    words.forEach(word => {
        const spaceAddition = currentLine.length > 0 ? 1 : 0;
        if (currentChars + word.length + spaceAddition <= MAX_CHARS) {
            currentLine.push(word);
            currentChars += word.length + spaceAddition;
        } else {
            lines.push(currentLine.join(' '));
            currentLine = [word];
            currentChars = word.length;
        }
    });
    if (currentLine.length > 0) lines.push(currentLine.join(' '));
    return lines;
}

function createStyledSVG(text, imgWidth, imgHeight, fontPath) {
    const wordsArray = text.split(' ');
    const highlightIndices = getRandomHighlightIndices(wordsArray);
    const lines = wrapText(text);
    
    const fontSize = CONFIG.fontSize;
    const lineHeight = fontSize * CONFIG.lineHeightMultiplier;
    const totalTextHeight = lines.length * lineHeight;
    
    const bottomY = imgHeight - (imgHeight * CONFIG.bottomMarginPercent);
    const startY = bottomY - totalTextHeight;
    const lineY = startY - 50; 

    const catFontSize = Math.round(fontSize * 0.4);
    const estimatedCatWidth = (CONFIG.category.length * catFontSize * CONFIG.charWidthFactor);
    const midX = imgWidth / 2;
    const line1End = midX - (estimatedCatWidth / 2) - CONFIG.lineGap;
    const line2Start = midX + (estimatedCatWidth / 2) + CONFIG.lineGap;

    let svg = `<svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="blackGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="black" stop-opacity="0" />
                <stop offset="30%" stop-color="black" stop-opacity="0.85" />
                <stop offset="100%" stop-color="black" stop-opacity="1" />
            </linearGradient>
        </defs>
        <style>
            @font-face { font-family: 'CustomFont'; src: url('file://${fontPath}'); }
            .text { 
                font-family: 'CustomFont', sans-serif; 
                font-size: ${fontSize}px; 
                fill: ${CONFIG.fontColor}; 
                font-weight: bold; 
                text-transform: uppercase;
                filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.8));
            }
            .category { 
                font-family: 'CustomFont', sans-serif; 
                font-size: ${catFontSize}px; 
                fill: white; 
                font-weight: bold; 
                letter-spacing: 3px;
            }
            .swipe {
                font-family: 'CustomFont', sans-serif; 
                font-size: 18px; 
                fill: #cccccc; 
                font-weight: bold;
                letter-spacing: 1px;
            }
            .accent-line { stroke: white; stroke-width: 2.5; }
            .highlight { fill: ${CONFIG.highlightColor}; }
        </style>
        
        <rect x="0" y="${lineY - 150}" width="${imgWidth}" height="${imgHeight - (lineY - 150)}" fill="url(#blackGradient)" />
        
        <line x1="${midX - (imgWidth * 0.35)}" y1="${lineY}" x2="${line1End}" y2="${lineY}" class="accent-line" />
        <text x="${midX}" y="${lineY + 6}" text-anchor="middle" class="category">${CONFIG.category}</text>
        <line x1="${line2Start}" y1="${lineY}" x2="${midX + (imgWidth * 0.35)}" y2="${lineY}" class="accent-line" />
    `;

    let globalWordIndex = 0;
    lines.forEach((line, i) => {
        const y = startY + (i * lineHeight) + fontSize;
        let lineHtml = '';
        line.split(' ').forEach((word) => {
            const isHighlighted = highlightIndices.includes(globalWordIndex);
            lineHtml += `<tspan class="${isHighlighted ? 'highlight' : ''}">${escapeXml(word)} </tspan>`;
            globalWordIndex++;
        });
        svg += `<text x="${midX}" y="${y}" text-anchor="middle" class="text" xml:space="preserve">${lineHtml}</text>`;
    });

    svg += `<text x="${midX}" y="${imgHeight - CONFIG.swipeBottomMargin}" text-anchor="middle" class="swipe">${CONFIG.swipeText}</text>`;
    svg += `</svg>`;
    return svg;
}

async function downloadImage(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
    const buffer = await response.buffer();
    return buffer;
}

async function run() {
    ensureDirectoryExists(CONFIG.outputFolder);
    const outputName = CONFIG.generateRandomOutput 
        ? `${CONFIG.randomPrefix}${Date.now()}.${CONFIG.outputExtension}` 
        : `${CONFIG.randomPrefix}output.${CONFIG.outputExtension}`;
    const outputPath = path.join(CONFIG.outputFolder, outputName);

    // Download the image
    console.log(`Downloading image from ${imageUrl}`);
    const imageBuffer = await downloadImage(imageUrl);

    // Apply adjustments
    const adj = CONFIG.imageAdjustments;
    const brightnessVal = adj.brightness / 50; 
    const saturationVal = adj.saturation / 50; 
    const hueVal = Math.round((adj.hue - 50) * 3.6); 
    const contrastInt = Math.max(1, Math.min(100, Math.round(adj.contrast / 10)));

    // Create SVG overlay
    const svgBuffer = Buffer.from(createStyledSVG(CONFIG.text, CONFIG.targetWidth, CONFIG.targetHeight, path.resolve(CONFIG.fontPath)));

    let pipeline = sharp(imageBuffer)
        .resize(CONFIG.targetWidth, CONFIG.targetHeight, { 
            fit: 'cover',
            kernel: sharp.kernel.lanczos3 
        });

    // Modulate
    pipeline = pipeline.modulate({
        brightness: brightnessVal,
        saturation: saturationVal,
        hue: hueVal
    });

    // Contrast
    pipeline = pipeline.clahe({ width: 32, height: 32, maxSlope: contrastInt });

    // Optional blur
    if (adj.blur > 0) {
        pipeline = pipeline.blur(adj.blur);
    }

    // Grayscale
    if (adj.grayscale) {
        pipeline = pipeline.grayscale();
    }

    await pipeline
        .sharpen(CONFIG.sharpenSigma) 
        .composite([{ input: svgBuffer, top: 0, left: 0 }])
        .jpeg({ quality: 95, mozjpeg: true }) 
        .toFile(outputPath);

    console.log(`🚀 Success! Image generated: ${outputPath}`);

    // Output filename for GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `filename=${path.basename(outputPath)}\n`);
    }
}

run().catch(console.error);
