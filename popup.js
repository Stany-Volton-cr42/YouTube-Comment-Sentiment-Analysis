// Initialize charts and comments array
let chart;
let trendChart;
let currentComments = [];

// Initialize Chart.js visualizations
function initializeCharts(distributionData, trendData) {
    const distributionCtx = document.getElementById('sentimentChart').getContext('2d');
    const trendCtx = document.getElementById('trendChart').getContext('2d');

    try {
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            throw new Error('Chart.js library not loaded');
        }

        // Destroy existing charts if they exist
        if (chart) chart.destroy();
        if (trendChart) trendChart.destroy();

        // Initialize distribution chart
        chart = new Chart(distributionCtx, {
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

        // Initialize trend chart
        trendChart = new Chart(trendCtx, {
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

    } catch (error) {
        console.error('Error initializing charts:', error);
        document.querySelector('.chart-container').innerHTML = `
            <p class="error-message">Error loading charts: ${error.message}</p>
            <p>Please reload the extension</p>
        `;
    }
}

// Process comments for trend data
function processTrendData(comments) {
    if (!comments || !Array.isArray(comments) || comments.length === 0) {
        return { labels: [], values: [] };
    }

    // Sort comments by timestamp
    const sortedComments = [...comments].sort((a, b) => {
        return new Date(a.timestamp) - new Date(b.timestamp);
    });

    // Group comments by timestamp and calculate average sentiment
    const trendData = sortedComments.reduce((acc, comment) => {
        const timestamp = new Date(comment.timestamp).toLocaleDateString();
        if (!acc[timestamp]) {
            acc[timestamp] = {
                sum: 0,
                count: 0
            };
        }
        acc[timestamp].sum += comment.sentiment.normalizedScore;
        acc[timestamp].count += 1;
        return acc;
    }, {});

    // Calculate averages and prepare chart data
    const labels = Object.keys(trendData);
    const values = labels.map(date =>
        trendData[date].sum / trendData[date].count
    );

    return { labels, values };
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

// Update UI with comment data
function updateUI(comments) {
    try {
        currentComments = comments || [];

        // Update total comments count
        document.getElementById('total-comments').textContent = formatNumber(currentComments.length);

        if (!currentComments.length) {
            document.getElementById('avg-sentiment').textContent = '0.00';
            document.getElementById('comments-list').innerHTML =
                '<p class="no-comments">No comments found. Try scrolling through the YouTube comments section to load more.</p>';
            initializeCharts([0, 0, 0], { labels: [], values: [] });
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
            validComments.filter(c => c.sentiment.normalizedScore > 0.1).length,
            validComments.filter(c => Math.abs(c.sentiment.normalizedScore) <= 0.1).length,
            validComments.filter(c => c.sentiment.normalizedScore < -0.1).length
        ];

        // Process trend data
        const trendData = processTrendData(validComments);

        // Initialize charts with distribution and trend data
        initializeCharts(distribution, trendData);

        // Generate word cloud
        generateWordCloud(validComments);

        // Display comments
        displayComments(currentComments);
    } catch (error) {
        console.error('Error updating UI:', error);
        document.getElementById('comments-list').innerHTML =
            `<p class="error-message">Error updating display: ${error.message}</p>`;
    }
}

// Helper functions for sentiment classification
function getSentimentClass(score) {
    if (!score && score !== 0) return 'neutral';
    if (score > 0.1) return 'positive';
    if (score < -0.1) return 'negative';
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
                filtered = filtered.filter(c => c.sentiment.normalizedScore > 0.1);
            } else if (sentiment === 'neutral') {
                filtered = filtered.filter(c => Math.abs(c.sentiment.normalizedScore) <= 0.1);
            } else if (sentiment === 'negative') {
                filtered = filtered.filter(c => c.sentiment.normalizedScore < -0.1);
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
                    `<p class="error-message">Error: ${result.error}</p>
                     <p>Try refreshing the YouTube page and reopening the extension.</p>`;
                return;
            }

            if (!result.analyzedComments || !Array.isArray(result.analyzedComments)) {
                document.getElementById('comments-list').innerHTML =
                    '<p class="no-comments">No comments analyzed yet. Try scrolling through the YouTube comments section.</p>';
                return;
            }

            updateUI(result.analyzedComments || []);
        } catch (error) {
            console.error('Error loading initial data:', error);
            document.getElementById('comments-list').innerHTML =
                `<p class="error-message">Error loading data: ${error.message}</p>
                 <p>Please try reopening the extension.</p>`;
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