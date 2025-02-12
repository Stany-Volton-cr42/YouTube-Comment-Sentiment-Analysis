let chart;
let currentComments = [];

// Initialize Chart.js visualization
function initializeChart(data) {
    const ctx = document.getElementById('sentimentChart').getContext('2d');

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
}

// Update UI with comment data
function updateUI(comments) {
    if (!comments || comments.length === 0) {
        document.getElementById('total-comments').textContent = '0';
        document.getElementById('avg-sentiment').textContent = '0.00';
        document.getElementById('comments-list').innerHTML = '<p class="no-comments">No comments found. Try scrolling the YouTube comments section to load more.</p>';
        initializeChart([0, 0, 0]);
        return;
    }

    currentComments = comments;

    // Update statistics
    document.getElementById('total-comments').textContent = formatNumber(comments.length);

    const avgSentiment = comments.reduce((acc, curr) => 
        acc + curr.sentiment.normalizedScore, 0) / comments.length;
    document.getElementById('avg-sentiment').textContent = 
        avgSentiment.toFixed(2);

    // Calculate sentiment distribution
    const distribution = [
        comments.filter(c => c.sentiment.normalizedScore > 0).length,
        comments.filter(c => c.sentiment.normalizedScore === 0).length,
        comments.filter(c => c.sentiment.normalizedScore < 0).length
    ];

    initializeChart(distribution);
    displayComments(comments);
}

// Display comments in the list
function displayComments(comments) {
    const container = document.getElementById('comments-list');
    container.innerHTML = '';

    comments.forEach(comment => {
        const div = document.createElement('div');
        div.className = `comment-item ${getSentimentClass(comment.sentiment.normalizedScore)}`;

        const timestamp = comment.timestamp ? `<span class="timestamp">${comment.timestamp}</span>` : '';
        const likes = comment.likes ? `<span class="likes">👍 ${formatNumber(comment.likes)}</span>` : '';

        div.innerHTML = `
            <p class="comment-text">${truncateText(comment.text)}</p>
            <div class="comment-meta">
                <span class="author">${comment.author}</span>
                <div class="meta-right">
                    ${timestamp}
                    ${likes}
                    <span class="sentiment-score">Sentiment: ${comment.sentiment.normalizedScore.toFixed(2)}</span>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

// Filter comments by sentiment
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const sentiment = e.target.dataset.sentiment;
        let filtered = currentComments;

        switch(sentiment) {
            case 'positive':
                filtered = currentComments.filter(c => c.sentiment.normalizedScore > 0);
                break;
            case 'neutral':
                filtered = currentComments.filter(c => c.sentiment.normalizedScore === 0);
                break;
            case 'negative':
                filtered = currentComments.filter(c => c.sentiment.normalizedScore < 0);
                break;
        }

        // Update active button state
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        displayComments(filtered);
    });
});

// Load initial data and handle errors
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['analyzedComments', 'error'], (result) => {
        if (result.error) {
            document.getElementById('comments-list').innerHTML = 
                `<p class="error-message">Error: ${result.error}</p>`;
            return;
        }

        if (result.analyzedComments && result.analyzedComments.length > 0) {
            updateUI(result.analyzedComments);
        } else {
            updateUI([]); // Show empty state
        }
    });
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.analyzedComments) {
        updateUI(changes.analyzedComments.newValue);
    }
});

function formatNumber(num) {
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
}


function truncateText(text, maxLength = 100) {
    return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
}

function getSentimentClass(score) {
    if (score > 0) {
        return 'positive';
    } else if (score < 0) {
        return 'negative';
    } else {
        return 'neutral';
    }
}