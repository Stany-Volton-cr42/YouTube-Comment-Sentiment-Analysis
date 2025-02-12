// Function to extract comments from YouTube page
function extractComments() {
    const comments = [];
    const commentElements = document.querySelectorAll('ytd-comment-thread-renderer');
    
    commentElements.forEach(element => {
        const commentText = element.querySelector('#content-text')?.textContent?.trim();
        const author = element.querySelector('#author-text')?.textContent?.trim();
        const likes = element.querySelector('#vote-count-middle')?.textContent?.trim();
        
        if (commentText) {
            comments.push({
                text: commentText,
                author: author || 'Anonymous',
                likes: likes || '0'
            });
        }
    });
    
    return comments;
}

// Function to observe DOM changes for dynamic comment loading
function observeCommentSection() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                const comments = extractComments();
                chrome.runtime.sendMessage({
                    action: 'updateComments',
                    comments: comments
                });
            }
        });
    });

    const config = { childList: true, subtree: true };
    const commentSection = document.querySelector('ytd-comments');
    if (commentSection) {
        observer.observe(commentSection, config);
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    setTimeout(() => {
        observeCommentSection();
        const initialComments = extractComments();
        chrome.runtime.sendMessage({
            action: 'updateComments',
            comments: initialComments
        });
    }, 2000); // Delay to ensure comments are loaded
});
