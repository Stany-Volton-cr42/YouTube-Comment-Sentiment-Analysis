// Initialize sentiment analyzer
let initialized = false;

// Initialize the extension
async function initializeExtension() {
    if (!initialized) {
        try {
            initialized = true;
            await chrome.storage.local.set({ 
                GEMINI_API_KEY: 'AIzaSyAkJhoLpii7p-weqUIE8oO1hQJy8FFH8b0',
                analyzedComments: [],
                commentSummary: null,
                lastUpdated: null,
                error: null
            });
            console.log('Extension initialized successfully');
        } catch (error) {
            console.error('Error initializing extension:', error);
        }
    }
}

// Analyze sentiment using Vader-Sentiment
function analyzeSentiment(text) {
    try {
        if (!text || typeof text !== 'string') {
            console.warn('Invalid text provided for analysis:', text);
            return getDefaultSentimentResult();
        }

        // Get sentiment scores using Vader
        const analysis = vader.SentimentIntensityAnalyzer.polarity_scores(text);
        
        // Detailed logging for debugging
        console.log('=== Sentiment Analysis Debug ===');
        console.log('Input text:', text);
        console.log('Raw scores:', {
            pos: analysis.pos.toFixed(3),
            neg: analysis.neg.toFixed(3),
            neu: analysis.neu.toFixed(3),
            compound: analysis.compound.toFixed(3)
        });

        // Determine sentiment category based on compound score
        // ANTI-NEUTRAL BIAS: Prefer categorizing as positive or negative
        let sentimentCategory;
        if (analysis.compound >= 0.05) {  // Very sensitive threshold
            sentimentCategory = 'positive';
        } else if (analysis.compound <= -0.05) {  // Very sensitive threshold
            sentimentCategory = 'negative';
        } else {
            // Additional check to break ties in neutral zone
            if (analysis.pos > analysis.neg) {
                sentimentCategory = 'positive';
            } else if (analysis.neg > analysis.pos) {
                sentimentCategory = 'negative';
            } else {
                sentimentCategory = 'neutral';
            }
        }

        console.log('Final sentiment category:', sentimentCategory);
        console.log('=== End Debug ===');

        // Calculate intensity based on absolute compound score
        const intensity = Math.abs(analysis.compound);
        const intensityCategory = 
            intensity >= 0.5 ? 'high' :
            intensity >= 0.2 ? 'medium' : 'low';

        console.log('Text:', text);
        console.log('Compound score:', analysis.compound);
        console.log('Final sentiment:', sentimentCategory);
        console.log('Intensity:', intensityCategory);

        return {
            score: analysis.compound,
            normalizedScore: analysis.compound,
            confidence: Math.abs(analysis.compound),
            sentiment: sentimentCategory,
            explanation: `Compound Score: ${analysis.compound.toFixed(3)}, Pos: ${analysis.pos.toFixed(3)}, Neg: ${analysis.neg.toFixed(3)}, Neu: ${analysis.neu.toFixed(3)}`,
            aspects: {
                emotion: sentimentCategory,
                sarcasm: false,
                intensity: intensityCategory
            },
            details: {
                positive: analysis.pos,
                negative: analysis.neg,
                neutral: analysis.neu,
                compound: analysis.compound
            }
        };
    } catch (error) {
        console.error('Error in sentiment analysis:', error);
        return getDefaultSentimentResult();
    }
}

// Default sentiment result for error cases
function getDefaultSentimentResult() {
    return {
        score: 0,
        normalizedScore: 0,
        confidence: 0,
        sentiment: 'neutral',
        explanation: 'Could not analyze sentiment',
        aspects: {
            emotion: 'neutral',
            sarcasm: false,
            intensity: 'low'
        },
        details: {
            positive: [],
            negative: [],
            words: [],
            comparative: 0
        }
    };
}

// Generate summary using Gemini API
async function generateSummary(comments) {
    try {
        if (!comments || comments.length === 0) {
            return "No comments available to summarize.";
        }

        // Get API key from storage
        const result = await chrome.storage.local.get('GEMINI_API_KEY');
        const apiKey = result.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error('Gemini API key not found');
        }

        // Prepare the comments data
        const commentStats = {
            total: comments.length,
            positive: comments.filter(c => c.sentiment.normalizedScore > 0.1).length,
            negative: comments.filter(c => c.sentiment.normalizedScore < -0.1).length,
            neutral: comments.filter(c => Math.abs(c.sentiment.normalizedScore) <= 0.1).length
        };

        // Get top commented topics using optimized word frequency analysis
        const wordFreq = new Map();
        const stopWords = new Set(['this', 'that', 'they', 'their', 'there', 'here', 'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how']);

        comments.forEach(comment => {
            const words = comment.text.toLowerCase()
                .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
                .split(/\s+/)
                .filter(word => word.length > 3 && !stopWords.has(word));
            
            words.forEach(word => {
                wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
            });
        });

        const topTopics = Array.from(wordFreq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);

        const prompt = `
        Analyze these YouTube comments statistics and provide a concise summary:
        
        Total Comments: ${commentStats.total}
        Sentiment Distribution:
        - Positive: ${commentStats.positive}
        - Neutral: ${commentStats.neutral}
        - Negative: ${commentStats.negative}
        
        Most discussed topics: ${topTopics.join(', ')}
        
        Sample comments:
        ${comments.slice(0, 3).map(c => `- "${c.text}"`).join('\n')}
        
        Please provide a 2-3 sentence summary that includes:
        1. What overall talk in the video
        2. what is the suggestion for the video creator
        3. what is the negative and positive feedback
        
        Keep the response under 150 words.
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 150
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API request failed: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response format from Gemini API');
        }

        const summary = data.candidates[0].content.parts[0].text.trim();
        await chrome.storage.local.set({ commentSummary: summary });
        return summary;

    } catch (error) {
        console.error('Error generating summary:', error);
        const errorMessage = `Error generating summary: ${error.message}`;
        await chrome.storage.local.set({ commentSummary: errorMessage });
        return errorMessage;
    }
}

// Helper function to parse YouTube timestamps
function parseYouTubeTimestamp(timestamp) {
    try {
        if (!timestamp) return new Date();

        if (timestamp.includes('ago')) {
            const now = new Date();
            const matches = timestamp.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);
            if (!matches) return now;

            const [_, amount, unit] = matches;
            const value = parseInt(amount);
            
            switch(unit.toLowerCase()) {
                case 'second': return new Date(now - value * 1000);
                case 'minute': return new Date(now - value * 60 * 1000);
                case 'hour': return new Date(now - value * 60 * 60 * 1000);
                case 'day': return new Date(now - value * 24 * 60 * 60 * 1000);
                case 'week': return new Date(now - value * 7 * 24 * 60 * 60 * 1000);
                case 'month': return new Date(now - value * 30 * 24 * 60 * 60 * 1000);
                case 'year': return new Date(now - value * 365 * 24 * 60 * 60 * 1000);
                default: return now;
            }
        }

        // Try parsing direct date format
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? new Date() : date;
    } catch (error) {
        console.error('Error parsing timestamp:', error);
        return new Date();
    }
}

// Function to prepare time-series data for sentiment trend
function prepareSentimentTrendData(comments) {
    try {
        if (!comments || !Array.isArray(comments) || comments.length === 0) {
            return {
                labels: [],
                datasets: []
            };
        }

        // Sort comments by timestamp
        const sortedComments = [...comments].sort((a, b) => {
            const dateA = parseYouTubeTimestamp(a.timestamp);
            const dateB = parseYouTubeTimestamp(b.timestamp);
            return dateA - dateB;
        });

        // Group comments by date and sentiment
        const dateGroups = new Map();
        sortedComments.forEach(comment => {
            const date = parseYouTubeTimestamp(comment.timestamp);
            const dateStr = date.toISOString().split('T')[0];
            
            if (!dateGroups.has(dateStr)) {
                dateGroups.set(dateStr, {
                    positive: 0,
                    negative: 0,
                    neutral: 0,
                    total: 0
                });
            }
            
            const group = dateGroups.get(dateStr);
            // Use the sentiment category directly instead of the score
            const sentiment = comment.sentiment.sentiment;
            
            if (sentiment === 'positive') group.positive++;
            else if (sentiment === 'negative') group.negative++;
            else group.neutral++;
            
            group.total++;
        });

        // Convert to arrays for Chart.js
        const dates = Array.from(dateGroups.keys()).sort();
        const positive = [];
        const negative = [];
        const neutral = [];

        dates.forEach(date => {
            const group = dateGroups.get(date);
            const total = group.total;
            
            // Convert to percentages
            positive.push((group.positive / total) * 100);
            negative.push((group.negative / total) * 100);
            neutral.push((group.neutral / total) * 100);
        });

        // Format dates for display
        const formattedDates = dates.map(date => {
            const [year, month, day] = date.split('-');
            return `${day}. ${new Date(date).toLocaleString('default', { month: 'short' })}`;
        });

        return {
            labels: formattedDates,
            datasets: [
                {
                    label: 'Positive',
                    data: positive,
                    borderColor: 'rgb(75, 192, 75)',
                    backgroundColor: 'rgba(75, 192, 75, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Neutral',
                    data: neutral,
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Negative',
                    data: negative,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        };
    } catch (error) {
        console.error('Error preparing trend data:', error);
        return {
            labels: [],
            datasets: []
        };
    }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateComments') {
        (async () => {
            try {
                console.log('Processing comments:', request.comments?.length || 0);

                if (!Array.isArray(request.comments)) {
                    throw new Error('Invalid comments data received');
                }

                // Process all comments at once using local sentiment analysis
                const commentData = request.comments
                    .filter(comment => comment && comment.text)
                    .map(comment => ({
                        ...comment,
                        sentiment: analyzeSentiment(comment.text),
                        parsedDate: parseYouTubeTimestamp(comment.timestamp)
                    }));

                if (commentData.length === 0) {
                    throw new Error('No valid comments to analyze');
                }

                // Generate summary using API
                const summary = await generateSummary(commentData);

                // Prepare trend data
                const trendData = prepareSentimentTrendData(commentData);

                // Store the analyzed comments, summary, and trend data
                await chrome.storage.local.set({
                    analyzedComments: commentData,
                    commentSummary: summary,
                    sentimentTrendData: trendData,
                    lastUpdated: new Date().toISOString(),
                    error: null
                });

                // Send response back to content script
                sendResponse({ 
                    success: true, 
                    commentCount: commentData.length,
                    summary: summary,
                    comments: commentData // Include analyzed comments in response
                });

            } catch (error) {
                console.error('Error processing comments:', error);
                await chrome.storage.local.set({
                    error: error.message,
                    errorTimestamp: new Date().toISOString()
                });
                sendResponse({ 
                    success: false, 
                    error: error.message,
                    comments: [] // Send empty array on error
                });
            }
        })();
        return true; // Keep the message channel open for async response
    }
});

// Initialize when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    initializeExtension();
});

// Initialize when extension starts
initializeExtension();