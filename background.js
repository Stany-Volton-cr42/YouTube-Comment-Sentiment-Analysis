// Import Sentiment from CDN in manifest
importScripts('https://cdn.jsdelivr.net/npm/sentiment@5.0.2/dist/sentiment.min.js');

let commentData = [];

// Process comments and analyze sentiment
function analyzeSentiment(text) {
    const sentiment = new Sentiment();
    return sentiment.analyze(text);
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateComments') {
        commentData = request.comments.map(comment => ({
            ...comment,
            sentiment: analyzeSentiment(comment.text)
        }));
        
        // Store the analyzed comments
        chrome.storage.local.set({ analyzedComments: commentData });
    }
    return true;
});

// Initialize data when extension is installed
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ analyzedComments: [] });
});
