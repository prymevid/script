const sharp = require('sharp');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Configuration
const CONFIG = {
    text: "WARUZIKO BURI MUNOTA KU ISI HABAHO DATA NYINSHI CYANE ZINYUZWA KURI INTERNET KURUSHA IBYO UMUNTU UMWE YAKWIBWIRA MU BUZIMA BWE BWOSÉ",
    category: "WARUZIKO",
    fontSize: 50,
    fontColor: 'white',
    highlightColor: '#4AB6E8',
    highlightKeywords: ['DATA', 'INTERNET', 'ISI'],
    lineHeightMultiplier: 0.95,
    maxLineWidthPercent: 0.85,
    bottomMarginPercent: 0.08,
    wordSpacing: 8,
    imageWidth: 768,
    imageHeight: 1024
};

// Cloudflare AI credentials
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "cfat_Uw96scgogunXsMcU4I3Q29kZ9fhfmPQOvysmNXxj2ea0d871";
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "0d0a0a287282172b39fb04d9334d8346";

const OUTPUT_FOLDER = 'temporary';

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        console.log(`Creating directory: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function escapeXml(str) {
    return str.replace(/[<>&'"]/g, c => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;'
    })[c]);
}

function wrapText(text, maxWidthPx, fontSize, wordSpacing) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = [];
    const avgCharWidth = fontSize * 0.5;
    const spaceWidth = avgCharWidth + wordSpacing;

    const getLineWidth = (lineWords) => {
        if (lineWords.length === 0) return 0;
        const totalChars = lineWords.join('').length;
        const charWidth = totalChars * avgCharWidth;
        const spacesWidth = (lineWords.length - 1) * spaceWidth;
        return charWidth + spacesWidth;
    };

    for (const word of words) {
        const testLine = [...currentLine, word];
        if (getLineWidth(testLine) <= maxWidthPx) {
            currentLine.push(word);
        } else {
            if (currentLine.length === 0) {
                currentLine.push(word);
            } else {
                lines.push(currentLine.join(' '));
                currentLine = [word];
            }
        }
    }
    if (currentLine.length > 0) {
        lines.push(currentLine.join(' '));
    }
    return lines;
}

function createStyledSVG(text, imgWidth, imgHeight) {
    console.log('Creating SVG overlay...');
    const maxLineWidth = imgWidth * CONFIG.maxLineWidthPercent;
    const lines = wrapText(text, maxLineWidth, CONFIG.fontSize, CONFIG.wordSpacing);
    console.log(`Lines created: ${lines.length}`);
    
    const fontSize = CONFIG.fontSize;
    const lineHeight = fontSize * CONFIG.lineHeightMultiplier;
    const totalTextHeight = lines.length * lineHeight;
    const bottomY = imgHeight - (imgHeight * CONFIG.bottomMarginPercent);
    const startY = bottomY - totalTextHeight;
    const lineY = startY - 40;
    const centerX = imgWidth / 2;

    const styleContent = `
        .text {
            font-family: 'Arial', 'sans-serif';
            font-size: ${fontSize}px;
            fill: ${CONFIG.fontColor};
            font-weight: bold;
            text-transform: uppercase;
            filter: drop-shadow(2px 2px 3px rgba(0,0,0,0.7));
            word-spacing: ${CONFIG.wordSpacing}px;
        }
        .category {
            font-family: 'Arial', 'sans-serif';
            font-size: ${Math.round(fontSize * 0.4)}px;
            fill: white;
            font-weight: bold;
            letter-spacing: 2px;
        }
        .accent-line {
            stroke: white;
            stroke-width: 2;
        }
        .highlight {
            fill: ${CONFIG.highlightColor};
        }
    `;

    let svg = `<svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="blackGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="black" stop-opacity="0" />
                <stop offset="20%" stop-color="black" stop-opacity="0.8" />
                <stop offset="100%" stop-color="black" stop-opacity="1" />
            </linearGradient>
        </defs>
        <style><![CDATA[${styleContent}]]></style>
        <rect x="0" y="${lineY - 100}" width="${imgWidth}" height="${imgHeight - (lineY - 100)}" fill="url(#blackGradient)" />
        <line x1="${centerX - (imgWidth * 0.3)}" y1="${lineY}" x2="${centerX - 20}" y2="${lineY}" class="accent-line" />
        <text x="${centerX}" y="${lineY + 5}" text-anchor="middle" class="category">${escapeXml(CONFIG.category)}</text>
        <line x1="${centerX + 20 + (CONFIG.category.length * 15)}" y1="${lineY}" x2="${centerX + (imgWidth * 0.3)}" y2="${lineY}" class="accent-line" />
    `;

    lines.forEach((line, i) => {
        const y = startY + (i * lineHeight) + fontSize;
        let lineHtml = '';
        const words = line.split(' ');
        words.forEach((word) => {
            const cleanWord = word.replace(/[^\w]/gi, '');
            const isHighlighted = CONFIG.highlightKeywords.includes(cleanWord.toUpperCase());
            if (isHighlighted) {
                lineHtml += `<tspan class="highlight">${escapeXml(word)} </tspan>`;
            } else {
                lineHtml += `<tspan>${escapeXml(word)} </tspan>`;
            }
        });
        svg += `<text x="${centerX}" y="${y}" text-anchor="middle" class="text">${lineHtml}</text>`;
    });

    svg += `</svg>`;
    console.log(`SVG created, size: ${svg.length} bytes`);
    return svg;
}

async function generateBaseImage(prompt) {
    console.log('🎨 Generating base image with prompt:', prompt.substring(0, 100) + '...');
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("width", CONFIG.imageWidth.toString());
    form.append("height", CONFIG.imageHeight.toString());

    console.log('Calling Cloudflare API...');
    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-2-klein-9b`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${API_TOKEN}`,
                ...form.getHeaders()
            },
            body: form
        }
    );

    console.log(`Cloudflare API response status: ${response.status}`);
    const data = await response.json();
    
    if (!response.ok) {
        console.error('Cloudflare API Error:', JSON.stringify(data, null, 2));
        throw new Error(`Cloudflare API error: ${JSON.stringify(data.errors || data)}`);
    }
    
    if (!data?.result?.image) {
        console.error('No image in response:', JSON.stringify(data, null, 2));
        throw new Error(`Failed to generate image: ${JSON.stringify(data.errors)}`);
    }
    
    console.log(`Image generated, base64 length: ${data.result.image.length}`);
    return Buffer.from(data.result.image, "base64");
}

async function main() {
    try {
        console.log('=== Starting Image Generation ===');
        console.log(`Node version: ${process.version}`);
        console.log(`Working directory: ${process.cwd()}`);
        
        if (!API_TOKEN || !ACCOUNT_ID) {
            throw new Error('Missing Cloudflare credentials');
        }

        const prompt = process.argv[2];
        if (!prompt) {
            throw new Error('No prompt provided. Usage: node generate-image.js "your prompt"');
        }
        
        console.log(`📝 Prompt: ${prompt.substring(0, 150)}...`);

        // Generate base image
        const baseImageBuffer = await generateBaseImage(prompt);
        console.log(`Base image buffer size: ${baseImageBuffer.length} bytes`);

        // Create temporary folder if not exists
        ensureDirectoryExists(OUTPUT_FOLDER);

        // Create SVG overlay
        const svgText = createStyledSVG(CONFIG.text, CONFIG.imageWidth, CONFIG.imageHeight);
        const svgBuffer = Buffer.from(svgText);
        console.log(`SVG buffer size: ${svgBuffer.length} bytes`);

        // Composite and save final image
        const timestamp = Date.now();
        const randomId = crypto.randomBytes(4).toString('hex');
        const outputFilename = `styled_waruziko_${timestamp}_${randomId}.png`;
        const outputPath = path.join(OUTPUT_FOLDER, outputFilename);

        console.log(`Processing image with sharp...`);
        await sharp(baseImageBuffer)
            .resize(CONFIG.imageWidth, CONFIG.imageHeight, { fit: 'cover' })
            .composite([{ input: svgBuffer, top: 0, left: 0 }])
            .png()
            .toFile(outputPath);

        console.log(`✅ Final image saved to: ${outputPath}`);
        
        // Verify file exists
        if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            console.log(`📏 File size: ${(stats.size / 1024).toFixed(2)} KB`);
        } else {
            console.error('❌ File was not created!');
            process.exit(1);
        }

        // List files in temporary folder
        console.log('Files in temporary folder:');
        const files = fs.readdirSync(OUTPUT_FOLDER);
        files.forEach(file => console.log(`  - ${file}`));

        // Set output for GitHub Actions
        if (process.env.GITHUB_OUTPUT) {
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `filename=${outputFilename}\n`);
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `files=${files.join(',')}\n`);
        }
        
        console.log('=== Image Generation Completed Successfully ===');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

main();
