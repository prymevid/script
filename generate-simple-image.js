const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Token configurations
const TOKENS = [
    {
        name: "Primary",
        api_token: process.env.CLOUDFLARE_API_TOKEN || "cfat_WoW652tCPKPL4FqAruBnYHaf01eC7upAXWAeQ8Y6b42cb6a5",
        account_id: process.env.CLOUDFLARE_ACCOUNT_ID || "b5ac16e609bbc6c43bbecd81f7bc6bd7"
    },
    {
        name: "Secondary",
        api_token: process.env.CLOUDFLARE_API_TOKEN_2 || "cfat_Uw96scgogunXsMcU4I3Q29kZ9fhfmPQOvysmNXxj2ea0d871",
        account_id: process.env.CLOUDFLARE_ACCOUNT_ID_2 || "0d0a0a287282172b39fb04d9334d8346"
    }
];

const OUTPUT_FOLDER = 'temporary';
let currentTokenIndex = 0;

async function generateImage(prompt, tokenConfig) {
    console.log(`🎨 Generating image using ${tokenConfig.name} token from prompt:`, prompt);
    
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("width", "768");
    form.append("height", "1024");

    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${tokenConfig.account_id}/ai/run/@cf/black-forest-labs/flux-2-dev`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokenConfig.api_token}`,
                ...form.getHeaders()
            },
            body: form
        }
    );

    const data = await response.json();
    
    if (!response.ok) {
        // Check if error is related to credits/usage limits
        const errorMessage = JSON.stringify(data.errors || data);
        if (errorMessage.includes('credit') || errorMessage.includes('limit') || errorMessage.includes('quota')) {
            console.log(`⚠️ ${tokenConfig.name} token has no free credits remaining`);
            return { success: false, needFallback: true };
        }
        console.error('Cloudflare API Error:', data);
        throw new Error(`API error: ${errorMessage}`);
    }
    
    if (!data?.result?.image) {
        throw new Error('No image in response');
    }
    
    return { 
        success: true, 
        imageBuffer: Buffer.from(data.result.image, "base64"),
        tokenUsed: tokenConfig.name
    };
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
        
        let result = null;
        let usedSecondary = false;
        
        // Try primary token first
        console.log(`🔑 Attempting with ${TOKENS[0].name} token...`);
        result = await generateImage(prompt, TOKENS[0]);
        
        // If primary token failed due to credits, try secondary
        if (!result.success && result.needFallback) {
            console.log(`🔄 Switching to ${TOKENS[1].name} token...`);
            result = await generateImage(prompt, TOKENS[1]);
            usedSecondary = true;
            
            if (!result.success) {
                throw new Error('Both tokens failed or ran out of credits');
            }
        } else if (!result.success) {
            throw new Error('Primary token failed for non-credit reasons');
        }
        
        // Save image
        const timestamp = Date.now();
        const filename = `generated_${timestamp}.png`;
        const filepath = path.join(OUTPUT_FOLDER, filename);
        
        fs.writeFileSync(filepath, result.imageBuffer);
        
        console.log(`✅ Image saved: ${filepath}`);
        console.log(`📏 Size: ${(result.imageBuffer.length / 1024).toFixed(2)} KB`);
        console.log(`🔑 Used token: ${result.tokenUsed}${usedSecondary ? ' (fallback)' : ''}`);
        
        // Output for GitHub Actions
        if (process.env.GITHUB_OUTPUT) {
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `filename=${filename}\n`);
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `token_used=${result.tokenUsed}\n`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
