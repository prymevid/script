const fs = require('fs');
const path = require('path');

// ===== POLLINATIONS AI CONFIGURATION =====
// All parameters are hardcoded as per the example, except the API key (from env)
const API_KEY = process.env.POLLINATIONS_API_KEY || 'sk_7seYHmZf39KYyjlGvlAJUX99Gto8Cu9o';
const MODEL = 'flux';
const WIDTH = 768;
const HEIGHT = 1024;
const SEED = 0;
const ENHANCE = false;
const NEGATIVE_PROMPT = 'worst quality, blurry , text, watermark, logo, clutter, busy composition, objects in bottom area, foreground elements, close-up, cropped subject';
const SAFE = false;
const QUALITY = 'medium';
const TRANSPARENT = false;
const AUDIO = false;
// ========================================

const OUTPUT_FOLDER = 'temporary';

async function generateImage(prompt) {
    console.log(`🎨 Generating image with Pollinations AI from prompt:`, prompt);

    // Build the URL with proper encoding
    const encodedPrompt = encodeURIComponent(prompt);
    const baseUrl = `https://gen.pollinations.ai/image/${encodedPrompt}`;

    const params = new URLSearchParams({
        model: MODEL,
        width: WIDTH,
        height: HEIGHT,
        seed: SEED,
        enhance: ENHANCE,
        negative_prompt: NEGATIVE_PROMPT,
        safe: SAFE,
        quality: QUALITY,
        transparent: TRANSPARENT,
        audio: AUDIO,
    });

    const url = `${baseUrl}?${params.toString()}`;
    console.log(`🔗 Requesting: ${url}`);

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Accept': 'image/jpeg, image/png'
        }
    });

    if (!response.ok) {
        // Try to parse error response
        let errorText;
        try {
            errorText = await response.text();
        } catch {
            errorText = 'Unable to read error response';
        }
        console.error(`❌ API request failed with status ${response.status}`);
        console.error(`Response: ${errorText}`);
        throw new Error(`Pollinations API error: ${errorText}`);
    }

    // Get image data as buffer
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    return { success: true, imageBuffer };
}

async function main() {
    try {
        const prompt = process.argv[2];
        if (!prompt) {
            throw new Error('Please provide a prompt: node generate-image.js "your prompt"');
        }

        // Create output folder if it doesn't exist
        if (!fs.existsSync(OUTPUT_FOLDER)) {
            fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
        }

        // Generate the image
        const result = await generateImage(prompt);

        // Save image with timestamp
        const timestamp = Date.now();
        const filename = `generated_${timestamp}.png`;
        const filepath = path.join(OUTPUT_FOLDER, filename);

        fs.writeFileSync(filepath, result.imageBuffer);

        console.log(`✅ Image saved: ${filepath}`);
        console.log(`📏 Size: ${(result.imageBuffer.length / 1024).toFixed(2)} KB`);

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
