// Initialize sentiment analyzer with expanded word lists for better classification
let initialized = false;
const sentimentWords = {
    positive: [
        'good', 'great', 'awesome', 'excellent', 'love', 'amazing', 'perfect', 'beautiful', 'best', 'happy',
        'wonderful', 'fantastic', 'brilliant', 'helpful', 'enjoyed', 'favorite', 'liked', 'superb', 'outstanding',
        'interesting', 'fun', 'nice', 'cool', 'helpful', 'useful', 'recommended', 'impressive', 'inspiring'
    ],
    negative: [
        'bad', 'terrible', 'awful', 'horrible', 'hate', 'worst', 'poor', 'disappointing', 'waste', 'sad',
        'boring', 'useless', 'annoying', 'dislike', 'wrong', 'stupid', 'worse', 'ridiculous', 'garbage',
        'terrible', 'horrible', 'confusing', 'confused', 'disappointed', 'frustrating', 'pathetic', 'pointless'
    ]
};

// Initialize the extension
function initializeExtension() {
    if (!initialized) {
        initialized = true;
        console.log('Sentiment analyzer initialized successfully');
    }
}

function analyzeSentiment(text) {
    if (!initialized) {
        initializeExtension();
    }

    try {
        if (!text || typeof text !== 'string') {
            console.warn('Invalid text provided for analysis:', text);
            return {
                score: 0,
                normalizedScore: 0,
                tokens: [],
                words: [],
                positive: [],
                negative: []
            };
        }

        // Normalize text: convert to lowercase and remove punctuation
        const words = text.toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 0);

        let score = 0;
        let positiveWords = [];
        let negativeWords = [];

        // Analyze each word
        words.forEach(word => {
            if (sentimentWords.positive.includes(word)) {
                score += 1;
                positiveWords.push(word);
            }
            if (sentimentWords.negative.includes(word)) {
                score -= 1;
                negativeWords.push(word);
            }
        });

        // Normalize score between -1 and 1
        const maxPossibleScore = Math.max(1, Math.abs(score));
        const normalizedScore = score / maxPossibleScore;

        return {
            score: score,
            normalizedScore: normalizedScore,
            tokens: words,
            words: [...positiveWords, ...negativeWords],
            positive: positiveWords,
            negative: negativeWords
        };
    } catch (error) {
        console.error('Error analyzing sentiment:', error);
        return {
            score: 0,
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
            console.log('Processing comments:', request.comments?.length || 0);

            if (!Array.isArray(request.comments)) {
                throw new Error('Invalid comments data received');
            }

            const commentData = request.comments.map(comment => {
                if (!comment || !comment.text) {
                    console.warn('Invalid comment object:', comment);
                    return null;
                }

                try {
                    const sentiment = analyzeSentiment(comment.text);
                    return {
                        ...comment,
                        sentiment: sentiment
                    };
                } catch (error) {
                    console.error('Error analyzing comment:', error);
                    return null;
                }
            }).filter(Boolean); // Remove null entries

            if (commentData.length === 0) {
                throw new Error('No valid comments to analyze');
            }

            // Store the analyzed comments
            chrome.storage.local.set({ 
                analyzedComments: commentData,
                lastUpdated: new Date().toISOString(),
                error: null
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Storage error:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    console.log('Successfully stored', commentData.length, 'comments');
                    sendResponse({ success: true, commentCount: commentData.length });
                }
            });
        } catch (error) {
            console.error('Error processing comments:', error);
            chrome.storage.local.set({ 
                error: error.message,
                errorTimestamp: new Date().toISOString()
            });
            sendResponse({ success: false, error: error.message });
        }
        return true; // Required for async response
    }
});

// Initialize data when extension is installed
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ 
        analyzedComments: [],
        lastUpdated: null,
        error: null
    });
});