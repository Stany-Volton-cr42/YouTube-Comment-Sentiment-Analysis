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
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Update UI with comment data
function updateUI(comments) {
    currentComments = comments;
    
    // Update statistics
    document.getElementById('total-comments').textContent = comments.length;
    
    const avgSentiment = comments.reduce((acc, curr) => 
        acc + curr.sentiment.score, 0) / comments.length;
    document.getElementById('avg-sentiment').textContent = 
        avgSentiment.toFixed(2);

    // Calculate sentiment distribution
    const distribution = [
        comments.filter(c => c.sentiment.score > 0).length,
        comments.filter(c => c.sentiment.score === 0).length,
        comments.filter(c => c.sentiment.score < 0).length
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
        div.className = `comment-item ${getSentimentClass(comment.sentiment.score)}`;
        div.innerHTML = `
            <p class="comment-text">${comment.text}</p>
            <div class="comment-meta">
                <span class="author">${comment.author}</span>
                <span class="sentiment-score">Sentiment: ${comment.sentiment.score}</span>
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
                filtered = currentComments.filter(c => c.sentiment.score > 0);
                break;
            case 'neutral':
                filtered = currentComments.filter(c => c.sentiment.score === 0);
                break;
            case 'negative':
                filtered = currentComments.filter(c => c.sentiment.score < 0);
                break;
        }

        displayComments(filtered);
    });
});

// Load initial data
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['analyzedComments'], (result) => {
        if (result.analyzedComments && result.analyzedComments.length > 0) {
            updateUI(result.analyzedComments);
        }
    });
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.analyzedComments) {
        updateUI(changes.analyzedComments.newValue);
    }
});
