const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Hardcoded credentials
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "cfat_WoW652tCPKPL4FqAruBnYHaf01eC7upAXWAeQ8Y6b42cb6a5";
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "b5ac16e609bbc6c43bbecd81f7bc6bd7";

const OUTPUT_FOLDER = 'temporary';

async function generateImage(prompt) {
    console.log('🎨 Generating image from prompt:', prompt);
    
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("width", "768");
    form.append("height", "1024");

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

    const data = await response.json();
    
    if (!response.ok) {
        console.error('Cloudflare API Error:', data);
        throw new Error(`API error: ${JSON.stringify(data.errors || data)}`);
    }
    
    if (!data?.result?.image) {
        throw new Error('No image in response');
    }
    
    return Buffer.from(data.result.image, "base64");
}

async function main() {
    try {
        const prompt = process.argv[2];
        if (!prompt) {
            throw new Error('Please provide a prompt: node generate-simple-image.js "your prompt"');
        }
        
        // Create output folder if it doesn't exist
        if (!fs.existsSync(OUTPUT_FOLDER)) {
            fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
        }
        
        // Generate image
        const imageBuffer = await generateImage(prompt);
        
        // Save image
        const timestamp = Date.now();
        const filename = `generated_${timestamp}.png`;
        const filepath = path.join(OUTPUT_FOLDER, filename);
        
        fs.writeFileSync(filepath, imageBuffer);
        
        console.log(`✅ Image saved: ${filepath}`);
        console.log(`📏 Size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
        
        // Output for GitHub Actions
        if (process.env.GITHUB_OUTPUT) {
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `filename=${filename}\n`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
