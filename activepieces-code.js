const GITHUB_TOKEN = "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";   // Hardcoded (replace with your token)
const GITHUB_USERNAME = "prymevid";
const GITHUB_REPO = "script";
const GITHUB_BRANCH = "main";
const TEMP_FOLDER = "temporary";

export const code = async (inputs) => {
    // Get prompt from inputs.x (as per the incoming object: { "x": "futuristic world" })
    const prompt = inputs.x;
    if (!prompt) {
        throw new Error('No prompt provided. Please provide "x" in the input.');
    }

    // 1. Trigger workflow_dispatch
    const triggerUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/actions/workflows/generate-image.yml/dispatches`;
    const triggerResponse = await fetch(triggerUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ref: GITHUB_BRANCH,
            inputs: { prompt }   // Pass the prompt to the workflow
        })
    });

    if (!triggerResponse.ok) {
        throw new Error(`Failed to trigger workflow: ${triggerResponse.status} ${await triggerResponse.text()}`);
    }

    // 2. Poll for the latest workflow run
    let runId = null;
    let runStatus = null;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes (60 * 5s)
    const pollInterval = 5000; // 5 seconds

    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        const runsUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/actions/runs?event=workflow_dispatch&per_page=1`;
        const runsResponse = await fetch(runsUrl, {
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` }
        });
        const runsData = await runsResponse.json();
        if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
            const latestRun = runsData.workflow_runs[0];
            runId = latestRun.id;
            runStatus = latestRun.status;
            if (runStatus === 'completed') {
                break;
            }
        }
        attempts++;
    }

    if (!runId || runStatus !== 'completed') {
        throw new Error('Workflow did not complete in time');
    }

    // 3. Get the latest file from the temporary folder
    const contentsUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${TEMP_FOLDER}`;
    const contentsResponse = await fetch(contentsUrl, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` }
    });
    if (!contentsResponse.ok) {
        throw new Error(`Failed to list temporary folder: ${contentsResponse.status}`);
    }
    const files = await contentsResponse.json();
    if (!files.length) {
        throw new Error('No files found in temporary folder');
    }

    // Sort by timestamp in filename (assumes filename contains a number)
    const latestFile = files.sort((a, b) => {
        const tsA = parseInt(a.name.match(/\d+/)?.[0] || 0);
        const tsB = parseInt(b.name.match(/\d+/)?.[0] || 0);
        return tsB - tsA;
    })[0];

    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/${GITHUB_BRANCH}/${TEMP_FOLDER}/${latestFile.name}`;

    return {
        success: true,
        url: rawUrl,
        filename: latestFile.name
    };
};
