// Function to extract comments from YouTube page
function extractComments() {
    console.log('Starting comment extraction...');
    const comments = [];
    const commentElements = document.querySelectorAll('ytd-comment-thread-renderer');
    console.log(`Found ${commentElements.length} comment elements`);

    commentElements.forEach((element, index) => {
        try {
            const commentText = element.querySelector('#content-text')?.textContent?.trim();
            const author = element.querySelector('#author-text span')?.textContent?.trim();
            const likes = element.querySelector('#vote-count-middle')?.textContent?.trim();
            const timestamp = element.querySelector('.published-time-text a')?.textContent?.trim();

            if (commentText && author) {
                comments.push({
                    text: commentText,
                    author: author || 'Anonymous',
                    likes: likes || '0',
                    timestamp: timestamp || 'Unknown time'
                });
            } else {
                console.log(`Skipping comment ${index} - missing required data:`, {
                    hasText: !!commentText,
                    hasAuthor: !!author
                });
            }
        } catch (error) {
            console.error(`Error extracting comment ${index}:`, error);
        }
    });

    console.log(`Successfully extracted ${comments.length} comments`);
    return comments;
}

// Function to scroll and load more comments
async function loadMoreComments(maxScrolls = 3) {
    console.log('Starting to load more comments...');
    const commentsSection = document.querySelector('ytd-comments');
    if (!commentsSection) {
        console.warn('Comments section not found');
        return false;
    }

    let scrollCount = 0;
    let hasMore = true;

    while (scrollCount < maxScrolls && hasMore) {
        console.log(`Scroll attempt ${scrollCount + 1}/${maxScrolls}`);
        const previousHeight = commentsSection.scrollHeight;
        commentsSection.scrollIntoView({ behavior: 'smooth', block: 'end' });

        // Wait for new comments to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if new comments were loaded
        hasMore = commentsSection.scrollHeight > previousHeight;
        if (hasMore) {
            console.log('New comments loaded, continuing scroll');
        } else {
            console.log('No new comments loaded, stopping scroll');
        }
        scrollCount++;
    }

    return true;
}

// Function to send comments to background script for analysis
function sendCommentsForAnalysis(comments) {
    if (!comments || !Array.isArray(comments) || comments.length === 0) {
        console.warn('No comments to analyze');
        return;
    }

    console.log('Sending comments to background script for analysis...');
    chrome.runtime.sendMessage({
        action: 'updateComments',
        comments: comments
    }, response => {
        if (response && response.success) {
            console.log(`Successfully analyzed ${response.commentCount} comments`);
        } else {
            console.error('Error analyzing comments:', response?.error);
            // Retry once after a short delay if analysis fails
            setTimeout(() => {
                console.log('Retrying comment analysis...');
                chrome.runtime.sendMessage({
                    action: 'updateComments',
                    comments: comments
                });
            }, 2000);
        }
    });
}

// Function to observe DOM changes for dynamic comment loading
function observeCommentSection() {
    console.log('Setting up comment section observer...');

    // Create observer instance
    const observer = new MutationObserver(debounce((mutations) => {
        console.log('Comment section mutation detected');
        const comments = extractComments();
        if (comments.length > 0) {
            sendCommentsForAnalysis(comments);
        }
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
                const initialComments = extractComments();
                if (initialComments.length > 0) {
                    sendCommentsForAnalysis(initialComments);
                }
            });
        } else {
            console.log('Comment section not found, retrying in 1 second...');
            setTimeout(startObserving, 1000);
        }
    }

    // Start the observation process
    startObserving();
}

// Initialize when page loads
window.addEventListener('load', () => {
    console.log('Page loaded, waiting for YouTube to initialize...');
    // Wait for YouTube to initialize
    setTimeout(() => {
        console.log('Starting comment section observation...');
        observeCommentSection();
    }, 2000);
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