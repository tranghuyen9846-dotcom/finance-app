/**
 * charts.js - Biểu đồ Chart.js cho PWA Tài Chính
 */

let pieChart = null;
let barChart = null;

const CHART_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F0B27A', '#AED6F1',
];

/**
 * Vẽ biểu đồ tròn chi tiêu theo danh mục
 */
async function renderPieChart(month, year) {
    const ctx = document.getElementById('pie-chart');
    const emptyMsg = document.getElementById('pie-empty');

    const data = await getExpenseByCategory(month, year);

    if (pieChart) {
        pieChart.destroy();
        pieChart = null;
    }

    if (!data || data.length === 0) {
        ctx.style.display = 'none';
        emptyMsg.style.display = 'block';
        return;
    }

    ctx.style.display = 'block';
    emptyMsg.style.display = 'none';

    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.label),
            datasets: [{
                data: data.map(d => d.amount),
                backgroundColor: CHART_COLORS.slice(0, data.length),
                borderWidth: 0,
                hoverOffset: 8,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '55%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#a0a0c0',
                        font: { family: 'Inter', size: 12 },
                        padding: 12,
                        usePointStyle: true,
                        pointStyleWidth: 10,
                    },
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)}`,
                    },
                },
            },
        },
    });
}

/**
 * Vẽ biểu đồ cột Thu vs Chi theo tháng
 */
async function renderBarChart(year) {
    const ctx = document.getElementById('bar-chart');

    const data = await getMonthlySummary(year);

    if (barChart) {
        barChart.destroy();
        barChart = null;
    }

    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => `T${d.month}`),
            datasets: [
                {
                    label: 'Thu',
                    data: data.map(d => d.income),
                    backgroundColor: 'rgba(0, 214, 143, 0.7)',
                    borderRadius: 6,
                    borderSkipped: false,
                },
                {
                    label: 'Chi',
                    data: data.map(d => d.expense),
                    backgroundColor: 'rgba(255, 107, 107, 0.7)',
                    borderRadius: 6,
                    borderSkipped: false,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#a0a0c0',
                        font: { family: 'Inter', size: 12 },
                        usePointStyle: true,
                        pointStyleWidth: 10,
                    },
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
                    },
                },
            },
            scales: {
                x: {
                    ticks: { color: '#6b6b8d', font: { size: 11 } },
                    grid: { display: false },
                },
                y: {
                    ticks: {
                        color: '#6b6b8d',
                        font: { size: 11 },
                        callback: (val) => val >= 1000000 ? (val / 1000000).toFixed(1) + 'M' : val >= 1000 ? (val / 1000).toFixed(0) + 'K' : val,
                    },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                },
            },
        },
    });
}
