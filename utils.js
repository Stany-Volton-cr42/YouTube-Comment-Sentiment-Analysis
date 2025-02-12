// Utility functions for sentiment analysis and UI helpers

// Get CSS class based on sentiment score
function getSentimentClass(score) {
    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
}

// Format large numbers
function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
}

// Truncate long text
function truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

// Error handling wrapper
function handleError(error) {
    console.error('Extension Error:', error);
    return {
        message: error.message || 'An unexpected error occurred',
        timestamp: new Date().toISOString()
    };
}

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

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getSentimentClass,
        formatNumber,
        truncateText,
        handleError,
        debounce
    };
}