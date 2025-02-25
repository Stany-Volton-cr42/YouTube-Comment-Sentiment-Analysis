// Vader-Sentiment library
const vader = {
    SentimentIntensityAnalyzer: {
        // Lexicon with sentiment scores
        lexicon: {
            // Core sentiment words with strong weights
            "good": 1.9, "great": 3.2, "awesome": 4.2, "excellent": 3.5, "amazing": 3.8,
            "terrible": -3.5, "horrible": -3.8, "bad": -2.5, "worst": -4.0,
            "love": 2.5, "hate": -2.5, "like": 1.0, "dislike": -1.0,
            "best": 3.0, "better": 1.5, "worse": -1.5,
            "perfect": 3.5, "nice": 1.8, "beautiful": 2.5,
            "awful": -3.2, "ugly": -2.5, "poor": -2.0,
            "wonderful": 3.2, "fantastic": 3.8, "superb": 3.5,
            "boring": -2.0, "interesting": 1.5, "excited": 2.0,
            "happy": 2.0, "sad": -1.8, "angry": -2.2,
            "brilliant": 3.0, "stupid": -2.5, "smart": 1.8,
            "easy": 1.5, "difficult": -1.2, "hard": -1.0,
            "impressive": 2.5, "disappointed": -2.2, "disappointing": -2.0,
            "thank": 1.5, "thanks": 1.5, "helpful": 1.8,
            "useless": -2.2, "waste": -2.0, "worthless": -2.5,
            
            // Punctuation and emoji
            "!": 0.5, "!!": 1.0, "!!!": 1.5,
            "?": -0.5, "??": -1.0, "???": -1.5,
            "😊": 2.0, "😃": 2.0, "😄": 2.0, "😍": 3.0,
            "😢": -2.0, "😭": -2.5, "😡": -3.0, "😠": -2.5,
            
            // YouTube-specific terms with stronger weights
            "subscribe": 2.0, "subscribed": 2.5,
            "cool": 2.5, "lit": 3.0, "fire": 3.0,
            "trash": -3.0, "clickbait": -2.5,
            "fake": -2.5, "cringe": -2.5,
            "lol": 1.5, "lmao": 2.0, "rofl": 2.5,
            "wow": 2.5, "wtf": -2.0, "omg": 2.0,
            "goat": 3.5, "mid": -2.0,
            "cap": -1.5, "based": 2.5,
            "ratio": -2.0, "W": 2.5, "L": -2.5,
            
            // Common positive/negative terms
            "yes": 1.0, "no": -1.0,
            "correct": 1.5, "incorrect": -1.5,
            "right": 1.0, "wrong": -1.0,
            "true": 1.0, "false": -1.0,
            "agree": 1.5, "disagree": -1.5,
            "success": 2.0, "fail": -2.0,
            "win": 2.0, "lose": -2.0,
            "good job": 2.5, "bad job": -2.5,
            "well done": 2.5, "poorly done": -2.5,
            "accurate": 1.5, "inaccurate": -1.5,
            "fast": 1.0, "slow": -1.0,
            "clear": 1.5, "unclear": -1.5,
            "informative": 2.0, "misleading": -2.0,
            "recommend": 2.0, "avoid": -2.0
        },

        polarity_scores: function(text) {
            if (!text) return { pos: 0.01, neg: 0.01, neu: 0.98, compound: 0 };
            
            // Aggressive preprocessing to improve matches
            // Convert to lowercase, normalize spaces, keep letters, numbers, and basic punctuation
            const cleanText = text.toLowerCase()
                .replace(/\s+/g, ' ')
                .trim();
            
            // Very simple tokenization that splits on spaces but keeps some punctuation
            const simpleTokens = cleanText.split(' ');
            
            // Handle multi-word expressions
            const tokens = [];
            for (let i = 0; i < simpleTokens.length; i++) {
                // Clean individual tokens
                const cleanToken = simpleTokens[i].replace(/[^\w!?]/g, '');
                if (cleanToken) tokens.push(cleanToken);
                
                // Check for two-word phrases (if we have enough tokens)
                if (i < simpleTokens.length - 1) {
                    const twoWordPhrase = simpleTokens[i] + ' ' + simpleTokens[i+1];
                    if (this.lexicon[twoWordPhrase] !== undefined) {
                        tokens.push(twoWordPhrase);
                    }
                }
            }
            
            // Check for emojis separately using regex
            const emojiRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27FF]/g;
            const emojis = cleanText.match(emojiRegex) || [];
            tokens.push(...emojis);
            
            // Debug logging
            console.log('=== Enhanced Sentiment Analysis Debug ===');
            console.log('Input text:', text);
            console.log('Tokens after processing:', tokens);
            
            // Track sentiment scores
            let posTotal = 0;
            let negTotal = 0;
            let matchedTokens = [];
            
            // Score each token
            tokens.forEach(token => {
                if (this.lexicon[token] !== undefined) {
                    const score = this.lexicon[token];
                    
                    // Boost all scores by 25% to increase sensitivity
                    const boostedScore = score * 1.25;
                    
                    if (boostedScore > 0) {
                        posTotal += boostedScore;
                    } else if (boostedScore < 0) {
                        negTotal += Math.abs(boostedScore);
                    }
                    
                    matchedTokens.push({token, score: boostedScore});
                }
            });
            
            // Debug logging
            console.log('Matched tokens:', matchedTokens);
            console.log('Positive total:', posTotal.toFixed(3));
            console.log('Negative total:', negTotal.toFixed(3));

            // Default values for when no matches are found
            let compound = 0;
            let pos = 0.01;
            let neg = 0.01;
            let neu = 0.98;
            
            // Calculate metrics if we have matched tokens
            if (matchedTokens.length > 0) {
                // Calculate pos/neg proportions
                const total = posTotal + negTotal;
                
                if (total > 0) {
                    pos = posTotal / (total || 1);
                    neg = negTotal / (total || 1);
                    
                    // Normalize neu based on ratio of matched vs total tokens
                    neu = Math.max(0, 1 - (matchedTokens.length / tokens.length));
                    
                    // Calculate compound score - bias toward detection
                    const scoreDiff = posTotal - negTotal;
                    compound = Math.tanh(scoreDiff * 1.5);
                }
            }
            
            // PREVENT NEUTRAL BIAS: If we have any non-zero scores, ensure we don't return neutral
            if (posTotal > 0 && posTotal > negTotal) {
                compound = Math.max(0.05, compound); // Force at least slightly positive
            } else if (negTotal > 0 && negTotal > posTotal) {
                compound = Math.min(-0.05, compound); // Force at least slightly negative
            }
            
            console.log('Final compound score:', compound.toFixed(3));
            if (compound >= 0.05) {
                console.log('Detected sentiment: POSITIVE');
            } else if (compound <= -0.05) {
                console.log('Detected sentiment: NEGATIVE');
            } else {
                console.log('Detected sentiment: NEUTRAL');
            }
            console.log('=== End Debug ===');

            return {
                pos: pos,
                neg: neg,
                neu: neu,
                compound: compound
            };
        }
    }
}; 