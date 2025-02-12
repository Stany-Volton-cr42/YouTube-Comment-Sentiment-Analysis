// Import Sentiment from CDN in manifest
importScripts('https://cdn.jsdelivr.net/npm/sentiment@5.0.2/dist/sentiment.min.js');

let commentData = [];

// Process comments and analyze sentiment with error handling
function analyzeSentiment(text) {
    try {
        const sentiment = new Sentiment();
        const analysis = sentiment.analyze(text);

        // Normalize the score to be between -1 and 1
        analysis.normalizedScore = analysis.score / Math.max(Math.abs(analysis.score), 1);

        return analysis;
    } catch (error) {
        console.error('Error analyzing sentiment:', error);
        return {
            score: 0,
            comparative: 0,
            normalizedScore: 0,
            tokens: [],
            words: [],
            positive: [],
            negative: []
        };
    }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateComments') {
        try {
            commentData = request.comments.map(comment => ({
                ...comment,
                sentiment: analyzeSentiment(comment.text)
            }));

            // Store the analyzed comments
            chrome.storage.local.set({ 
                analyzedComments: commentData,
                lastUpdated: new Date().toISOString(),
                error: null,
                errorTimestamp: null
            });
        } catch (error) {
            console.error('Error processing comments:', error);
            // Store error state
            chrome.storage.local.set({ 
                error: error.message,
                errorTimestamp: new Date().toISOString()
            });
        }
    }
    return true; // Required for async response
});

// Initialize data when extension is installed
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ 
        analyzedComments: [],
        lastUpdated: null,
        error: null,
        errorTimestamp: null
    });
});