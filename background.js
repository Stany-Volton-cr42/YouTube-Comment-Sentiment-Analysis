// Initialize sentiment analyzer
let sentimentAnalyzer;

// Process comments and analyze sentiment with error handling
function analyzeSentiment(text) {
    try {
        if (!sentimentAnalyzer) {
            // Initialize sentiment analyzer on first use
            const Sentiment = require('sentiment');
            sentimentAnalyzer = new Sentiment();
        }

        const analysis = sentimentAnalyzer.analyze(text);

        // Calculate normalized score between -1 and 1
        // Use a lower maxScore for better spread of sentiment values
        const maxScore = Math.max(Math.abs(analysis.score), 3);
        const normalizedScore = analysis.score / maxScore;

        return {
            score: analysis.score,
            normalizedScore: normalizedScore,
            comparative: analysis.comparative,
            tokens: analysis.tokens,
            words: analysis.words,
            positive: analysis.positive,
            negative: analysis.negative
        };
    } catch (error) {
        console.error('Error analyzing sentiment:', error);
        throw new Error('Sentiment analysis failed: ' + error.message);
    }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateComments') {
        try {
            const commentData = request.comments.map(comment => ({
                ...comment,
                sentiment: analyzeSentiment(comment.text)
            }));

            // Store the analyzed comments
            chrome.storage.local.set({ 
                analyzedComments: commentData,
                lastUpdated: new Date().toISOString(),
                error: null
            });

            // Send response back to content script
            sendResponse({ success: true, commentCount: commentData.length });
        } catch (error) {
            console.error('Error processing comments:', error);
            chrome.storage.local.set({ 
                error: error.message,
                errorTimestamp: new Date().toISOString()
            });
            sendResponse({ success: false, error: error.message });
        }
    }
    return true; // Required for async response
});

// Initialize data when extension is installed
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ 
        analyzedComments: [],
        lastUpdated: null,
        error: null
    });
});