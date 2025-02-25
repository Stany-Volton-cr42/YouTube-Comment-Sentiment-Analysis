// Function to extract comments using document.querySelectorAll
function extractComments() {
    console.log('Starting comment extraction...');
    const comments = [];
    const commentElements = document.querySelectorAll('ytd-comment-thread-renderer');
    console.log(`Found ${commentElements.length} comment elements`);

    commentElements.forEach((commentEl, index) => {
        try {
            // More specific selectors for better reliability
            const contentEl = commentEl.querySelector('#content-text');
            const authorEl = commentEl.querySelector('#author-text span');
            const timestampEl = commentEl.querySelector('yt-formatted-string.published-time-text');
            const likesEl = commentEl.querySelector('#vote-count-middle');

            if (contentEl && authorEl) {
                const comment = {
                    text: contentEl.textContent.trim(),
                    author: authorEl.textContent.trim(),
                    timestamp: timestampEl ? timestampEl.textContent.trim() : '',
                    likes: likesEl ? parseInt(likesEl.textContent.replace(/[^0-9]/g, '')) || 0 : 0,
                    url: window.location.href,
                    videoId: new URLSearchParams(window.location.search).get('v')
                };
                
                if (comment.text) {
                    comments.push(comment);
                    console.log(`Extracted comment ${index + 1}:`, { 
                        text: comment.text.substring(0, 50) + '...',
                        author: comment.author
                    });
                }
            }
        } catch (error) {
            console.warn(`Error extracting comment ${index}:`, error);
        }
    });

    console.log(`Successfully extracted ${comments.length} comments`);
    return comments;
}

// Function to scroll and load more comments
async function loadMoreComments(targetCount = 100) {
    console.log('Starting to load more comments...');
    const commentsSection = document.querySelector('ytd-comments');
    if (!commentsSection) {
        console.warn('Comments section not found');
        return [];
    }

    let previousCommentCount = 0;
    let attempts = 0;
    const maxAttempts = 10;
    const waitTime = 1500;

    while (attempts < maxAttempts) {
        const currentComments = extractComments();
        console.log(`Attempt ${attempts + 1}: Found ${currentComments.length} comments`);
        
        if (currentComments.length >= targetCount || 
            currentComments.length === previousCommentCount) {
            return currentComments;
        }

        previousCommentCount = currentComments.length;
        commentsSection.scrollIntoView({ behavior: 'smooth', block: 'end' });
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        attempts++;
    }

    return extractComments();
}

// Function to send comments to background script
async function sendCommentsToBackground(comments) {
    console.log('Sending comments to background script for analysis...');
    
    try {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'updateComments',
                comments: comments
            }, response => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });

        if (response && response.success) {
            console.log(`Successfully analyzed ${response.commentCount} comments`);
            return response.comments; // Return the analyzed comments
        } else {
            throw new Error(response?.error || 'Failed to analyze comments');
        }
    } catch (error) {
        console.error('Error sending comments to background:', error);
        throw error;
    }
}

// Function to process comments
async function processComments() {
    try {
        const comments = await extractComments();
        if (!comments || comments.length === 0) {
            console.log('No comments found to analyze');
            return;
        }

        const analyzedComments = await sendCommentsToBackground(comments);
        console.log('Analyzed comments:', analyzedComments);
        
        // Update UI with analyzed comments if needed
        if (typeof updateUI === 'function') {
            updateUI(analyzedComments);
        }
    } catch (error) {
        console.error('Error processing comments:', error);
    }
}

// Function to check if comments section exists and is loaded
function isCommentsSectionLoaded() {
    const commentsSection = document.querySelector('ytd-comments');
    const hasComments = document.querySelectorAll('ytd-comment-thread-renderer').length > 0;
    return commentsSection && hasComments;
}

// Function to initialize comment extraction
async function initializeCommentExtraction(maxRetries = 10, retryInterval = 2000) {
    console.log('Initializing comment extraction...');
    let retries = 0;

    const tryInitialize = async () => {
        if (retries >= maxRetries) {
            console.warn('Max retries reached for comment initialization');
            return;
        }

        if (!isCommentsSectionLoaded()) {
            console.log(`Comments section not ready, retry ${retries + 1}/${maxRetries}`);
            retries++;
            setTimeout(tryInitialize, retryInterval);
            return;
        }

        console.log('Comments section found, starting extraction');
        const comments = await loadMoreComments();
        if (comments.length > 0) {
            console.log(`Sending ${comments.length} comments for analysis...`);
            await processComments();
        }

        // Set up observer for future changes
        observeCommentSection();
    };

    await tryInitialize();
}

// Function to observe DOM changes for dynamic comment loading
function observeCommentSection() {
    console.log('Setting up comment section observer...');

    // Create observer instance
    const observer = new MutationObserver(debounce((mutations) => {
        console.log('Comment section mutation detected');
        processComments();
    }, 1000));

    // Configuration for the observer
    const config = { childList: true, subtree: true };

    // Function to start observing
    function startObserving() {
        const commentSection = document.querySelector('ytd-comments');
        if (commentSection) {
            console.log('Found comment section, starting observation');
            observer.observe(commentSection, config);
            // Initial load of comments
            loadMoreComments().then(() => {
                processComments();
            });
        } else {
            console.log('Comment section not found, retrying in 1 second...');
            setTimeout(startObserving, 1000);
        }
    }

    // Start the observation process
    startObserving();
}

// Handle YouTube's SPA navigation
let currentVideoId = null;

function handleUrlChange() {
    const videoId = new URLSearchParams(window.location.search).get('v');
    if (videoId && videoId !== currentVideoId) {
        currentVideoId = videoId;
        if (window.location.href.includes('youtube.com/watch')) {
            console.log('New video detected, reinitializing comment extraction...');
            initializeCommentExtraction();
        }
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    if (window.location.href.includes('youtube.com/watch')) {
        initializeCommentExtraction();
    }
});

// Listen for URL changes (YouTube SPA navigation)
const urlObserver = new MutationObserver(() => {
    handleUrlChange();
});

urlObserver.observe(document.querySelector('title'), {
    subtree: true,
    characterData: true,
    childList: true
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getComments') {
        (async () => {
            try {
                if (!window.location.href.includes('youtube.com/watch')) {
                    throw new Error('Not a YouTube video page');
                }

                console.log('Fetching comments...');
                const comments = await loadMoreComments();
                
                if (comments.length === 0) {
                    throw new Error('No comments found');
                }

                console.log(`Sending ${comments.length} comments for analysis...`);
                const analyzedComments = await processComments();
                sendResponse(analyzedComments);

            } catch (error) {
                console.error('Error getting comments:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();

        return true; // Required for async response
    }
});

// Debounce function for performance optimization
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}