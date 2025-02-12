// Initialize chart and comments array
let chart;
let currentComments = [];

// Initialize Chart.js visualization with error handling
function initializeChart(data) {
    const ctx = document.getElementById('sentimentChart').getContext('2d');
    const chartContainer = document.querySelector('.chart-container');

    try {
        if (typeof Chart === 'undefined') {
            throw new Error('Chart.js library not loaded');
        }

        if (chart) {
            chart.destroy();
        }

        chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Positive', 'Neutral', 'Negative'],
                datasets: [{
                    label: 'Comment Sentiment Distribution',
                    data: data,
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
    } catch (error) {
        console.error('Error initializing chart:', error);
        chartContainer.innerHTML = `
            <p class="error-message">Error loading chart: ${error.message}</p>
            <p>Please reload the extension</p>
        `;
    }
}

// Update UI with comment data
function updateUI(comments) {
    try {
        currentComments = comments || [];

        // Update total comments count
        document.getElementById('total-comments').textContent = formatNumber(currentComments.length);

        if (!currentComments.length) {
            document.getElementById('avg-sentiment').textContent = '0.00';
            document.getElementById('comments-list').innerHTML = 
                '<p class="no-comments">No comments found. Try scrolling the YouTube comments section to load more.</p>';
            initializeChart([0, 0, 0]);
            return;
        }

        // Calculate average sentiment
        const validComments = currentComments.filter(c => c.sentiment && typeof c.sentiment.normalizedScore === 'number');
        const avgSentiment = validComments.length > 0 
            ? validComments.reduce((acc, curr) => acc + curr.sentiment.normalizedScore, 0) / validComments.length
            : 0;

        document.getElementById('avg-sentiment').textContent = avgSentiment.toFixed(2);

        // Calculate sentiment distribution
        const distribution = [
            validComments.filter(c => c.sentiment.normalizedScore > 0.2).length,
            validComments.filter(c => Math.abs(c.sentiment.normalizedScore) <= 0.2).length,
            validComments.filter(c => c.sentiment.normalizedScore < -0.2).length
        ];

        // Initialize chart with distribution data
        initializeChart(distribution);

        // Display comments
        displayComments(currentComments);
    } catch (error) {
        console.error('Error updating UI:', error);
        document.getElementById('comments-list').innerHTML = 
            `<p class="error-message">Error updating display: ${error.message}</p>`;
    }
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
            const sentimentClass = getSentimentClass(comment.sentiment.normalizedScore);
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
                        <span class="sentiment-score">Sentiment: ${comment.sentiment.normalizedScore.toFixed(2)}</span>
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
                filtered = filtered.filter(c => c.sentiment.normalizedScore > 0.2);
            } else if (sentiment === 'neutral') {
                filtered = filtered.filter(c => Math.abs(c.sentiment.normalizedScore) <= 0.2);
            } else if (sentiment === 'negative') {
                filtered = filtered.filter(c => c.sentiment.normalizedScore < -0.2);
            }

            displayComments(filtered);
        } catch (error) {
            console.error('Error filtering comments:', error);
            document.getElementById('comments-list').innerHTML = 
                `<p class="error-message">Error filtering comments: ${error.message}</p>`;
        }
    });
});

// Load initial data
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['analyzedComments', 'error'], (result) => {
        try {
            if (result.error) {
                document.getElementById('comments-list').innerHTML = 
                    `<p class="error-message">Error: ${result.error}</p>`;
                return;
            }

            updateUI(result.analyzedComments || []);
        } catch (error) {
            console.error('Error loading initial data:', error);
            document.getElementById('comments-list').innerHTML = 
                `<p class="error-message">Error loading data: ${error.message}</p>`;
        }
    });
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    try {
        if (changes.analyzedComments) {
            updateUI(changes.analyzedComments.newValue);
        }
    } catch (error) {
        console.error('Error handling storage changes:', error);
        document.getElementById('comments-list').innerHTML = 
            `<p class="error-message">Error updating data: ${error.message}</p>`;
    }
});

// Helper functions
function formatNumber(num) {
    return num ? new Intl.NumberFormat().format(num) : '0';
}

function truncateText(text, maxLength = 100) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
}

function getSentimentClass(score) {
    if (!score && score !== 0) return 'neutral';
    if (score > 0.2) return 'positive';
    if (score < -0.2) return 'negative';
    return 'neutral';
}