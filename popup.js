console.log('Popup script starting...');

// Error recovery function
function recoverFromLibraryError() {
    console.log('Attempting to recover from library loading error...');

    // Check only Chart.js availability since that's all we need
    const hasChartJs = typeof Chart !== 'undefined';
    console.log('Chart.js available:', hasChartJs);

    if (!hasChartJs) {
        throw new Error('Chart.js library not loaded');
    }

    return true;
}

// Function to check if Chart.js is loaded
function isChartJsLoaded() {
    return typeof Chart !== 'undefined';
}

// Function to wait for Chart.js to load
async function waitForChartJs(maxAttempts = 20) {
    console.log('Waiting for Chart.js to load...');
    for (let i = 0; i < maxAttempts; i++) {
        if (isChartJsLoaded()) {
            console.log('Chart.js loaded successfully');
            return true;
        }
        console.log(`Attempt ${i + 1}/${maxAttempts} to load Chart.js`);
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    return false;
}

// Initialize charts and comments array
let currentComments = [];
let charts = {
    distribution: null,
    trend: null
};

// Function to safely destroy a chart
function safeDestroyChart(chartInstance) {
    try {
        if (chartInstance && typeof chartInstance.destroy === 'function') {
            chartInstance.destroy();
        }
    } catch (error) {
        console.warn('Error destroying chart:', error);
    }
}

// Function to ensure libraries are loaded before initialization
function ensureLibrariesLoaded() {
    if (librariesLoaded) return Promise.resolve();

    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 5;

        function checkLibraries() {
            try {
                const hasChartJs = typeof Chart !== 'undefined';
                console.log('Chart.js available:', hasChartJs);

                if (hasChartJs) {
                    librariesLoaded = true;
                    resolve();
                    return;
                }
            } catch (error) {
                console.warn(`Library check attempt ${attempts + 1}/${maxAttempts} failed:`, error);

                if (++attempts >= maxAttempts) {
                    reject(new Error('Failed to load required libraries after multiple attempts'));
                    return;
                }

                setTimeout(checkLibraries, 500); // Retry after 500ms
            }
        }

        checkLibraries();
    });
}

// Initialize Chart.js visualizations with error recovery
async function initializeCharts(distributionData, trendData) {
    console.log('Initializing charts with data:', { distributionData, trendData });

    try {
        await ensureLibrariesLoaded();

        const distributionCtx = document.getElementById('sentimentChart').getContext('2d');
        const trendCtx = document.getElementById('trendChart').getContext('2d');

        // Destroy existing charts if they exist
        safeDestroyChart(charts.distribution);
        safeDestroyChart(charts.trend);

        // Create new charts with error handling
        try {
            charts.distribution = new Chart(distributionCtx, {
                type: 'bar',
                data: {
                    labels: ['Positive', 'Neutral', 'Negative'],
                    datasets: [{
                        label: 'Comment Sentiment Distribution',
                        data: distributionData,
                        backgroundColor: [
                            'rgba(75, 192, 192, 0.6)',
                            'rgba(201, 203, 207, 0.6)',
                            'rgba(255, 99, 132, 0.6)'
                        ],
                        borderColor: [
                            'rgb(75, 192, 192)',
                            'rgb(201, 203, 207)',
                            'rgb(255, 99, 132)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });

            charts.trend = new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels: trendData.labels,
                    datasets: [{
                        label: 'Sentiment Trend',
                        data: trendData.values,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: false,
                            suggestedMin: -1,
                            suggestedMax: 1
                        }
                    }
                }
            });

            console.log('Charts initialized successfully');

        } catch (chartError) {
            console.error('Error creating charts:', chartError);
            throw new Error(`Failed to create charts: ${chartError.message}`);
        }

    } catch (error) {
        console.error('Error initializing charts:', error);
        console.error('Error stack:', error.stack);

        const container = document.querySelector('.chart-container');
        if (container) {
            container.innerHTML = `
                <div class="error-container">
                    <p class="error-message">Error loading charts: ${error.message}</p>
                    <p>Troubleshooting steps:</p>
                    <ul>
                        <li>Check if you're on a YouTube page</li>
                        <li>Refresh the page and try again</li>
                        <li>If the issue persists, disable and re-enable the extension</li>
                    </ul>
                    <p>Debug info:</p>
                    <ul>
                        <li>Chart.js available: ${typeof Chart !== 'undefined'}</li>
                        <li>Time: ${new Date().toISOString()}</li>
                    </ul>
                </div>
            `;
        }
    }
}

// Process comments for trend data
function processTrendData(comments) {
    if (!comments || !Array.isArray(comments) || comments.length === 0) {
        return { labels: [], values: [] };
    }

    try {
        // Group comments by date
        const dateGroups = {};
        comments.forEach(comment => {
            if (!comment.timestamp || !comment.sentiment) return;
            
            const date = formatDate(comment.timestamp);
            if (!dateGroups[date]) {
                dateGroups[date] = {
                    sum: 0,
                    count: 0
                };
            }
            dateGroups[date].sum += comment.sentiment.normalizedScore;
            dateGroups[date].count++;
        });

        // Convert to arrays and sort by date
        const sortedDates = Object.keys(dateGroups).sort();
        const values = sortedDates.map(date => 
            dateGroups[date].sum / dateGroups[date].count
        );

        return {
            labels: sortedDates,
            values: values
        };
    } catch (error) {
        console.error('Error processing trend data:', error);
        return { labels: [], values: [] };
    }
}

// Helper function to format dates
function formatDate(timestamp) {
    try {
        if (timestamp.includes('ago')) {
            // Handle relative timestamps
            const now = new Date();
            const matches = timestamp.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/);
            if (matches) {
                const amount = parseInt(matches[1]);
                const unit = matches[2];
                const date = new Date(now);
                
                switch(unit) {
                    case 'second': date.setSeconds(date.getSeconds() - amount); break;
                    case 'minute': date.setMinutes(date.getMinutes() - amount); break;
                    case 'hour': date.setHours(date.getHours() - amount); break;
                    case 'day': date.setDate(date.getDate() - amount); break;
                    case 'week': date.setDate(date.getDate() - amount * 7); break;
                    case 'month': date.setMonth(date.getMonth() - amount); break;
                    case 'year': date.setFullYear(date.getFullYear() - amount); break;
                }
                return date.toISOString().split('T')[0];
            }
        }
        
        // Try parsing as direct date
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
        
        return timestamp;
    } catch (error) {
        console.warn('Error formatting date:', error);
        return timestamp;
    }
}

// Generate word cloud from comments
function generateWordCloud(comments) {
    if (!comments || !Array.isArray(comments) || comments.length === 0) {
        return;
    }

    // Extract and count words from comments
    const wordCount = comments.reduce((acc, comment) => {
        const words = comment.text.toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
            .split(/\s+/);

        words.forEach(word => {
            if (word.length > 3) { // Only count words longer than 3 characters
                acc[word] = (acc[word] || 0) + 1;
            }
        });
        return acc;
    }, {});

    // Convert to array of objects for d3-cloud
    const words = Object.entries(wordCount)
        .map(([text, size]) => ({ text, size: 10 + size * 5 }))
        .sort((a, b) => b.size - a.size)
        .slice(0, 50); // Take top 50 words

    // Clear previous word cloud
    const container = document.getElementById('wordCloud');
    container.innerHTML = '';

    // Create SVG element
    const width = container.offsetWidth;
    const height = 300;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    container.appendChild(svg);

    // Generate word cloud layout
    d3.layout.cloud()
        .size([width, height])
        .words(words)
        .padding(5)
        .rotate(() => 0)
        .fontSize(d => d.size)
        .on('end', drawWordCloud)
        .start();

    function drawWordCloud(words) {
        const g = d3.select(svg)
            .append('g')
            .attr('transform', `translate(${width / 2},${height / 2})`);

        g.selectAll('text')
            .data(words)
            .enter()
            .append('text')
            .style('font-size', d => `${d.size}px`)
            .style('fill', () => `hsl(${Math.random() * 360}, 70%, 50%)`)
            .attr('text-anchor', 'middle')
            .attr('transform', d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
            .text(d => d.text);
    }
}

// Function to update sentiment trend chart
async function updateSentimentTrendChart() {
    try {
        const data = await chrome.storage.local.get(['sentimentTrendData']);
        const trendData = data.sentimentTrendData;

        if (!trendData || !trendData.labels || trendData.labels.length === 0) {
            console.warn('No trend data available');
            return;
        }

        const ctx = document.getElementById('trendChart');
        if (!ctx) {
            console.error('Trend chart canvas not found');
            return;
        }

        // Safely destroy existing chart
        safeDestroyChart(charts.trend);
        
        // Create new chart
        charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trendData.labels,
                datasets: trendData.datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Sentiment Trend Over Time',
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Date'
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Percentage of Comments'
                        },
                        min: 0,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error updating trend chart:', error);
        const container = document.querySelector('.chart-container');
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    Error displaying trend chart: ${error.message}
                </div>
            `;
        }
    }
}

// Update UI with comment data
function updateUI(comments) {
    try {
        if (!comments || !Array.isArray(comments)) {
            console.warn('No comments data for UI update');
            return;
        }

        currentComments = comments;

        // Update total comments count
        const totalCommentsElement = document.getElementById('total-comments');
        if (totalCommentsElement) {
            totalCommentsElement.textContent = comments.length;
        }

        // Calculate and update average sentiment
        const validComments = comments.filter(c => c.sentiment && typeof c.sentiment.normalizedScore === 'number');
        if (validComments.length > 0) {
            const avgSentiment = validComments.reduce((acc, curr) => acc + curr.sentiment.normalizedScore, 0) / validComments.length;
            const avgSentimentElement = document.getElementById('avg-sentiment');
            if (avgSentimentElement) {
                avgSentimentElement.textContent = avgSentiment.toFixed(2);
            }
        }

        // Update sentiment distribution chart
        updateSentimentChart(comments);

        // Update sentiment trend chart
        updateSentimentTrendChart();

        // Display comments list
        displayComments(comments);

    } catch (error) {
        console.error('Error in updateUI:', error);
        showError('Error updating display: ' + error.message);
    }
}

// Helper functions for sentiment classification
function getSentimentClass(sentiment) {
    // Check if we're getting a sentiment object or a score
    if (typeof sentiment === 'object' && sentiment !== null) {
        return sentiment.sentiment || 'neutral';
    }
    
    // Fallback to score-based classification for backward compatibility
    if (typeof sentiment === 'number') {
        if (sentiment > 0.1) return 'positive';
        if (sentiment < -0.1) return 'negative';
        return 'neutral';
    }
    
    return 'neutral';
}

function formatNumber(num) {
    return num ? new Intl.NumberFormat().format(num) : '0';
}

function truncateText(text, maxLength = 100) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
}


// Display comments in the list
function displayComments(comments) {
    const container = document.getElementById('comments-list');
    try {
        container.innerHTML = '';

        if (!comments || !comments.length) {
            container.innerHTML = '<p class="no-comments">No comments to display.</p>';
            return;
        }

        const validComments = comments.filter(comment => comment && comment.sentiment);

        if (!validComments.length) {
            container.innerHTML = '<p class="error-message">No valid comments found. Try reloading the page.</p>';
            return;
        }

        validComments.forEach(comment => {
            const sentimentClass = getSentimentClass(comment.sentiment);
            const div = document.createElement('div');
            div.className = `comment-item ${sentimentClass}`;

            const timestamp = comment.timestamp ? `<span class="timestamp">${comment.timestamp}</span>` : '';
            const likes = comment.likes ? `<span class="likes">👍 ${formatNumber(comment.likes)}</span>` : '';

            div.innerHTML = `
                <p class="comment-text">${truncateText(comment.text)}</p>
                <div class="comment-meta">
                    <span class="author">${comment.author || 'Anonymous'}</span>
                    <div class="meta-right">
                        ${timestamp}
                        ${likes}
                        <span class="sentiment-score">Sentiment: ${comment.sentiment.sentiment} (${comment.sentiment.normalizedScore.toFixed(2)})</span>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.error('Error displaying comments:', error);
        container.innerHTML = `<p class="error-message">Error displaying comments: ${error.message}</p>`;
    }
}

// Filter comments by sentiment
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        try {
            const sentiment = e.target.dataset.sentiment;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            if (!currentComments || !currentComments.length) {
                return;
            }

            let filtered = currentComments.filter(c => c && c.sentiment);

            if (sentiment === 'positive') {
                filtered = filtered.filter(c => c.sentiment.sentiment === 'positive');
            } else if (sentiment === 'neutral') {
                filtered = filtered.filter(c => c.sentiment.sentiment === 'neutral');
            } else if (sentiment === 'negative') {
                filtered = filtered.filter(c => c.sentiment.sentiment === 'negative');
            }

            displayComments(filtered);
        } catch (error) {
            console.error('Error filtering comments:', error);
            document.getElementById('comments-list').innerHTML =
                `<p class="error-message">Error filtering comments: ${error.message}</p>`;
        }
    });
});

// Update the loading state in the UI
function updateLoadingState(isLoading, message = '') {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    
    if (isLoading) {
        loadingIndicator.style.display = 'block';
        loadingMessage.textContent = message;
        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';
    } else {
        loadingIndicator.style.display = 'none';
        loadingMessage.style.display = 'none';
    }
}

// Display error message
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

// Update comment summary in the UI
function updateCommentSummary(summary) {
    const summaryContent = document.getElementById('summary-content');
    if (!summaryContent) {
        console.error('Summary content element not found');
        return;
    }

    if (summary) {
        summaryContent.innerHTML = `<p>${summary}</p>`;
    } else {
        summaryContent.innerHTML = '<p class="no-summary">No summary available yet. Try scrolling through more comments.</p>';
    }
}

// Function to update sentiment chart
async function updateSentimentChart(comments) {
    if (!comments || !Array.isArray(comments)) {
        console.warn('No valid comments data for chart update');
        return;
    }

    try {
        // Calculate sentiment distribution using sentiment category instead of score
        const distribution = [
            comments.filter(c => c.sentiment && c.sentiment.sentiment === 'positive').length,
            comments.filter(c => c.sentiment && c.sentiment.sentiment === 'neutral').length,
            comments.filter(c => c.sentiment && c.sentiment.sentiment === 'negative').length
        ];

        console.log('Sentiment distribution for chart:', distribution);

        const ctx = document.getElementById('sentimentChart');
        if (!ctx) {
            console.error('Distribution chart canvas not found');
            return;
        }

        // Safely destroy existing chart
        safeDestroyChart(charts.distribution);

        // Create new distribution chart
        charts.distribution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Positive', 'Neutral', 'Negative'],
                datasets: [{
                    label: 'Comment Sentiment Distribution',
                    data: distribution,
                    backgroundColor: [
                        'rgba(75, 192, 75, 0.6)',
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 99, 132, 0.6)'
                    ],
                    borderColor: [
                        'rgb(75, 192, 75)',
                        'rgb(54, 162, 235)',
                        'rgb(255, 99, 132)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });

        // Update trend chart
        await updateSentimentTrendChart();

    } catch (error) {
        console.error('Error updating charts:', error);
        showError('Error updating charts: ' + error.message);
    }
}

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', async () => {
    try {
        updateLoadingState(true, 'Loading comments...');
        
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            throw new Error('No active tab found');
        }
        
        // Check if we're on a YouTube page
        if (!tab.url?.includes('youtube.com')) {
            throw new Error('This extension only works on YouTube pages');
        }

        // Get stored data
        const data = await chrome.storage.local.get(['analyzedComments', 'commentSummary']);
        
        if (!data.analyzedComments?.length) {
            // Request new comments from content script
            try {
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'getComments' });
                if (response?.success) {
                    console.log('Successfully retrieved comments:', response.commentCount);
                } else {
                    throw new Error(response?.error || 'Failed to get comments');
                }
            } catch (error) {
                console.error('Error getting comments:', error);
                showError('Error: ' + error.message);
            }
        } else {
            // Use existing data
            updateUI(data.analyzedComments);
            if (data.commentSummary) {
                updateCommentSummary(data.commentSummary);
            }
        }
        
        updateLoadingState(false);
        
    } catch (error) {
        console.error('Popup initialization error:', error);
        updateLoadingState(false);
        showError(error.message);
    }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.analyzedComments?.newValue) {
            updateUI(changes.analyzedComments.newValue);
        }
        if (changes.commentSummary?.newValue) {
            updateCommentSummary(changes.commentSummary.newValue);
        }
    }
});

// Handle refresh summary button click
document.getElementById('refresh-summary').addEventListener('click', async () => {
    try {
        updateLoadingState(true, 'Refreshing summary...');
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            throw new Error('No active tab found');
        }

        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getComments' });
        if (!response?.success) {
            throw new Error(response?.error || 'Failed to refresh comments');
        }

        updateLoadingState(false);
    } catch (error) {
        console.error('Error refreshing summary:', error);
        updateLoadingState(false);
        showError('Error refreshing: ' + error.message);
    }
});