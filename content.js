// Function to extract comments from YouTube page
function extractComments() {
    const comments = [];
    const commentElements = document.querySelectorAll('ytd-comment-thread-renderer');

    commentElements.forEach(element => {
        try {
            const commentText = element.querySelector('#content-text')?.textContent?.trim();
            const author = element.querySelector('#author-text')?.textContent?.trim();
            const likes = element.querySelector('#vote-count-middle')?.textContent?.trim();
            const timestamp = element.querySelector('.published-time-text')?.textContent?.trim();

            if (commentText) {
                comments.push({
                    text: commentText,
                    author: author || 'Anonymous',
                    likes: likes || '0',
                    timestamp: timestamp || 'Unknown time'
                });
            }
        } catch (error) {
            console.error('Error extracting comment:', error);
        }
    });

    return comments;
}

// Function to scroll and load more comments
async function loadMoreComments() {
    const commentsSection = document.querySelector('ytd-comments');
    if (!commentsSection) return;

    const previousHeight = commentsSection.scrollHeight;
    commentsSection.scrollIntoView({ behavior: 'smooth', block: 'end' });

    // Wait for new comments to load
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Check if new comments were loaded
    return commentsSection.scrollHeight > previousHeight;
}

// Function to observe DOM changes for dynamic comment loading
function observeCommentSection() {
    const observer = new MutationObserver(debounce((mutations) => {
        const comments = extractComments();
        if (comments.length > 0) {
            chrome.runtime.sendMessage({
                action: 'updateComments',
                comments: comments
            });
        }
    }, 1000));

    const config = { childList: true, subtree: true };
    const commentSection = document.querySelector('ytd-comments');

    if (commentSection) {
        observer.observe(commentSection, config);
        // Initial load of comments
        loadMoreComments().then(() => {
            const initialComments = extractComments();
            if (initialComments.length > 0) {
                chrome.runtime.sendMessage({
                    action: 'updateComments',
                    comments: initialComments
                });
            }
        });
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    // Wait for YouTube to initialize
    setTimeout(() => {
        observeCommentSection();
    }, 2000);
});

// Import debounce function from utils
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