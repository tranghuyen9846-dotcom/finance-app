/**
 * app.js - Logic chính cho PWA Tài Chính Cá Nhân
 */

// ============================================================
//  KHỞI TẠO APP
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    initMonthYearSelects();

    // Lắng nghe thay đổi auth
    onAuthStateChange((event, session) => {
        if (session?.user) {
            showAppScreen(session.user);
        } else {
            showAuthScreen();
        }
    });
});

function showLoading(show) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

// ============================================================
//  AUTH HANDLERS
// ============================================================

function showAuthScreen() {
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('app-screen').classList.remove('active');
}

function showAppScreen(user) {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    document.getElementById('user-email').textContent = user.email;

    // Tải dữ liệu ban đầu
    refreshDashboard();
}

async function handleSignIn() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');

    if (!email || !password) {
        errorEl.textContent = 'Vui lòng nhập email và mật khẩu!';
        return;
    }

    try {
        showLoading(true);
        errorEl.textContent = '';
        await signIn(email, password);
    } catch (err) {
        console.error('Login error:', err);
        errorEl.textContent = err.message === 'Invalid login credentials'
            ? 'Email hoặc mật khẩu không đúng!'
            : `Lỗi: ${err.message || err.status || JSON.stringify(err)}`;
    } finally {
        showLoading(false);
    }
}

async function handleSignUp() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');

    if (!email || !password) {
        errorEl.textContent = 'Vui lòng nhập email và mật khẩu!';
        return;
    }

    if (password.length < 6) {
        errorEl.textContent = 'Mật khẩu phải có ít nhất 6 ký tự!';
        return;
    }

    try {
        showLoading(true);
        errorEl.textContent = '';
        await signUp(email, password);
        errorEl.style.color = '#00d68f';
        errorEl.textContent = '✅ Đăng ký thành công! Kiểm tra email để xác nhận (nếu có), hoặc đăng nhập ngay.';
    } catch (err) {
        errorEl.style.color = '';
        errorEl.textContent = err.message;
    } finally {
        showLoading(false);
    }
}

async function handleSignOut() {
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
        showLoading(true);
        await signOut();
        showLoading(false);
    }
}

// ============================================================
//  TAB NAVIGATION
// ============================================================

function switchTab(tabId, btn) {
    // Ẩn tất cả tab content
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    // Bỏ active tất cả nav button
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // Hiện tab được chọn
    document.getElementById(`tab-${tabId}`).classList.add('active');
    btn.classList.add('active');

    // Refresh dữ liệu cho tab
    switch (tabId) {
        case 'dashboard': refreshDashboard(); break;
        case 'add': refreshAddForm(); break;
        case 'report': refreshReports(); break;
        case 'savings':
            const savSub = document.getElementById('savings-sub');
            if (savSub && savSub.style.display !== 'none') {
                refreshSavings();
            } else {
                refreshObligations();
            }
            break;
        case 'settings': refreshSettings(); break;
    }
}

// ============================================================
//  MONTH/YEAR SELECTS
// ============================================================

function initMonthYearSelects() {
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();

    const monthSelects = ['dash-month', 'rpt-month'];
    const yearSelects = ['dash-year', 'rpt-year'];

    monthSelects.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        for (let m = 1; m <= 12; m++) {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = `Tháng ${m}`;
            if (m === curMonth) opt.selected = true;
            sel.appendChild(opt);
        }
    });

    yearSelects.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        for (let y = 2024; y <= 2031; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === curYear) opt.selected = true;
            sel.appendChild(opt);
        }
    });
}

function getSelectedMonth(prefix) {
    return parseInt(document.getElementById(`${prefix}-month`).value);
}

function getSelectedYear(prefix) {
    return parseInt(document.getElementById(`${prefix}-year`).value);
}

// ============================================================
//  TAB 1: DASHBOARD
// ============================================================

async function refreshDashboard() {
    const month = getSelectedMonth('dash');
    const year = getSelectedYear('dash');

    try {
        const summary = await getSummary(month, year);
        document.getElementById('kpi-income').textContent = formatCurrency(summary.income);
        document.getElementById('kpi-expense').textContent = formatCurrency(summary.expense);
        document.getElementById('kpi-balance').textContent = formatCurrency(summary.balance);

        // Health Score
        await renderHealthScore(month, year);
        // Anomaly Detection
        await renderAnomalyAlerts(month, year);
        // Budget Status
        await renderBudgetStatus(month, year);

        const transactions = await getTransactions(15, month, year);
        renderTransactionList('recent-transactions', transactions);
    } catch (err) {
        console.error('Dashboard error:', err);
    }
}

function renderTransactionList(containerId, transactions) {
    const container = document.getElementById(containerId);

    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<p class="empty-state">Chưa có giao dịch nào trong khoảng thời gian này.</p>';
        return;
    }

    container.innerHTML = transactions.map(t => {
        const icon = t.categories?.icon || '📦';
        const catName = t.categories?.name || 'Không rõ';
        const accName = t.accounts?.name || '';
        const isIncome = t.type === 'Thu';
        const sign = isIncome ? '+' : '-';
        const amountClass = isIncome ? 'income' : 'expense';

        return `
            <div class="tx-row">
                <div class="tx-icon">${icon}</div>
                <div class="tx-info">
                    <div class="tx-category">${catName}</div>
                    <div class="tx-meta">${accName} • ${formatDateShort(t.date)}</div>
                </div>
                <div class="tx-amount ${amountClass}">${sign}${formatCurrency(t.amount)}</div>
            </div>
        `;
    }).join('');
}

// ============================================================
//  TAB 2: ADD TRANSACTION
// ============================================================

function setTransactionType(btn) {
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('add-type').value = btn.dataset.value;
    refreshAddForm();
}

async function refreshAddForm() {
    const type = document.getElementById('add-type').value;

    try {
        // Danh mục
        const cats = await getCategories(type);
        const catSelect = document.getElementById('add-category');
        catSelect.innerHTML = cats.map(c =>
            `<option value="${c.id}">${c.icon} ${c.name}</option>`
        ).join('');

        // Tài khoản
        const accs = await getAccounts();
        const accSelect = document.getElementById('add-account');
        accSelect.innerHTML = accs.map(a =>
            `<option value="${a.id}">${a.name} (${a.type})</option>`
        ).join('');

        // Set ngày mặc định = hôm nay
        const dateInput = document.getElementById('add-date');
        if (!dateInput.value) {
            dateInput.value = new Date().toISOString().slice(0, 10);
        }
    } catch (err) {
        console.error('Refresh add form error:', err);
    }
}

async function submitTransaction() {
    const type = document.getElementById('add-type').value;
    const amount = parseFloat(document.getElementById('add-amount').value);
    const categoryId = document.getElementById('add-category').value;
    const accountId = document.getElementById('add-account').value;
    const note = document.getElementById('add-note').value.trim();
    const dateVal = document.getElementById('add-date').value;
    const resultEl = document.getElementById('add-result');

    if (!amount || amount <= 0) {
        resultEl.className = 'result-msg error';
        resultEl.textContent = '❌ Số tiền không hợp lệ!';
        return;
    }

    if (!categoryId) {
        resultEl.className = 'result-msg error';
        resultEl.textContent = '❌ Vui lòng chọn danh mục!';
        return;
    }

    try {
        showLoading(true);
        const date = dateVal ? new Date(dateVal).toISOString() : null;
        await addTransaction(type, amount, categoryId, accountId, note, date);

        // Reset form
        document.getElementById('add-amount').value = '';
        document.getElementById('add-note').value = '';

        resultEl.className = 'result-msg success';
        resultEl.textContent = `✅ Đã thêm: ${type} ${formatCurrency(amount)}`;

        // Auto-clear message sau 3 giây
        setTimeout(() => { resultEl.textContent = ''; }, 3000);
    } catch (err) {
        resultEl.className = 'result-msg error';
        resultEl.textContent = `❌ Lỗi: ${err.message}`;
    } finally {
        showLoading(false);
    }
}

// ============================================================
//  TAB 3: REPORTS
// ============================================================

async function refreshReports() {
    const month = getSelectedMonth('rpt');
    const year = getSelectedYear('rpt');

    try {
        await renderPieChart(month, year);
        await renderBarChart(year);
        await renderAnomalyChart(month, year);
    } catch (err) {
        console.error('Reports error:', err);
    }
}

// ============================================================
//  TAB 4: SAVINGS
// ============================================================

async function addGoal() {
    const name = document.getElementById('goal-name').value.trim();
    const target = parseFloat(document.getElementById('goal-target').value);
    const deadline = document.getElementById('goal-deadline').value || null;

    if (!name || !target || target <= 0) {
        alert('Vui lòng nhập tên và số tiền mục tiêu!');
        return;
    }

    try {
        showLoading(true);
        await addSavingsGoal(name, target, deadline);
        document.getElementById('goal-name').value = '';
        document.getElementById('goal-target').value = '';
        document.getElementById('goal-deadline').value = '';
        await refreshSavings();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    } finally {
        showLoading(false);
    }
}

async function refreshSavings() {
    const container = document.getElementById('goals-list');

    try {
        const goals = await getSavingsGoals();

        if (!goals || goals.length === 0) {
            container.innerHTML = '<p class="empty-state">Chưa có mục tiêu nào. Hãy tạo mục tiêu đầu tiên!</p>';
            return;
        }

        container.innerHTML = goals.map(g => {
            const progress = g.target_amount > 0
                ? Math.min(g.current_amount / g.target_amount, 1)
                : 0;
            const percent = Math.round(progress * 100);
            const isComplete = progress >= 1;

            return `
                <div class="goal-card">
                    <div class="goal-header">
                        <span class="goal-name">🎯 ${g.name}</span>
                        ${g.deadline ? `<span class="goal-deadline">⏰ ${formatDateShort(g.deadline)}</span>` : ''}
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${isComplete ? 'complete' : ''}" style="width: ${percent}%"></div>
                    </div>
                    <div class="goal-info">
                        ${formatCurrency(g.current_amount)} / ${formatCurrency(g.target_amount)} (${percent}%)
                    </div>
                    <div class="goal-actions">
                        <input type="number" placeholder="Số tiền nạp" id="deposit-${g.id}" inputmode="numeric">
                        <button class="btn btn-small" onclick="depositGoal('${g.id}')">💵 Nạp</button>
                        <button class="btn-icon-danger" onclick="removeGoal('${g.id}')">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<p class="empty-state">Lỗi tải dữ liệu: ${err.message}</p>`;
    }
}

async function depositGoal(goalId) {
    const input = document.getElementById(`deposit-${goalId}`);
    const amount = parseFloat(input.value);

    if (!amount || amount <= 0) {
        alert('Số tiền nạp không hợp lệ!');
        return;
    }

    try {
        showLoading(true);
        await depositToGoal(goalId, amount);
        await refreshSavings();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    } finally {
        showLoading(false);
    }
}

async function removeGoal(goalId) {
    if (!confirm('Bạn có chắc muốn xoá mục tiêu này?')) return;

    try {
        showLoading(true);
        await deleteSavingsGoal(goalId);
        await refreshSavings();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    } finally {
        showLoading(false);
    }
}

// ============================================================
//  TAB 5: SETTINGS
// ============================================================

async function refreshSettings() {
    try {
        // Danh mục
        const cats = await getCategories();
        const catList = document.getElementById('cat-list');
        if (cats.length === 0) {
            catList.innerHTML = '<p class="empty-state">Chưa có danh mục</p>';
        } else {
            catList.innerHTML = cats.map(c => `
                <div class="item-row">
                    <span class="item-label">
                        ${c.icon} ${c.name}
                        <span class="tag ${c.type === 'Chi' ? 'chi' : 'thu'}">${c.type}</span>
                    </span>
                    <button class="btn-icon-danger" onclick="removeCat('${c.id}')">✕</button>
                </div>
            `).join('');
        }

        // Tài khoản
        const accs = await getAccounts();
        const accList = document.getElementById('acc-list');
        if (accs.length === 0) {
            accList.innerHTML = '<p class="empty-state">Chưa có tài khoản</p>';
        } else {
            accList.innerHTML = accs.map(a => `
                <div class="item-row">
                    <span class="item-label">🏦 ${a.name} (${a.type}) — ${formatCurrency(a.balance)}</span>
                    <button class="btn-icon-danger" onclick="removeAcc('${a.id}')">✕</button>
                </div>
            `).join('');
        }

        // Ngân sách
        await refreshBudgetSettings();
    } catch (err) {
        console.error('Settings error:', err);
    }
}

async function addCat() {
    const name = document.getElementById('new-cat-name').value.trim();
    const type = document.getElementById('new-cat-type').value;
    if (!name) { alert('Nhập tên danh mục!'); return; }

    try {
        await addCategory(name, type);
        document.getElementById('new-cat-name').value = '';
        await refreshSettings();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    }
}

async function removeCat(id) {
    if (!confirm('Xoá danh mục này?')) return;
    try {
        await deleteCategory(id);
        await refreshSettings();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    }
}

async function addAcc() {
    const name = document.getElementById('new-acc-name').value.trim();
    const type = document.getElementById('new-acc-type').value;
    if (!name) { alert('Nhập tên tài khoản!'); return; }

    try {
        await addAccount(name, type);
        document.getElementById('new-acc-name').value = '';
        await refreshSettings();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    }
}

async function removeAcc(id) {
    if (!confirm('Xoá tài khoản này?')) return;
    try {
        await deleteAccount(id);
        await refreshSettings();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    }
}

async function handleExportCSV() {
    try {
        showLoading(true);
        const transactions = await getTransactions();
        exportCSV(transactions);
    } catch (err) {
        alert('Lỗi xuất file: ' + err.message);
    } finally {
        showLoading(false);
    }
}

// ============================================================
//  SUB-TAB NAVIGATION
// ============================================================

function switchSubTab(subTabId, btn) {
    const parent = btn.closest('.tab-content');
    parent.querySelectorAll('.sub-content').forEach(el => el.style.display = 'none');
    parent.querySelectorAll('.sub-tabs .seg-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(subTabId).style.display = 'block';
    btn.classList.add('active');

    if (subTabId === 'savings-sub') refreshSavings();
    if (subTabId === 'obligations-sub') refreshObligations();
}

// ============================================================
//  OBLIGATIONS (Cho vay / Nợ)
// ============================================================

function setObligationType(btn) {
    const container = document.getElementById('obligations-sub');
    container.querySelectorAll('.segmented-control:not(.sub-tabs) .seg-btn')
        .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('obl-type').value = btn.dataset.value;
}

async function submitObligation() {
    const type = document.getElementById('obl-type').value;
    const person = document.getElementById('obl-person').value.trim();
    const amount = parseFloat(document.getElementById('obl-amount').value);
    const dateStart = document.getElementById('obl-date-start').value;
    const deadline = document.getElementById('obl-deadline').value || null;
    const note = document.getElementById('obl-note').value.trim();
    const resultEl = document.getElementById('obl-result');

    if (!person) {
        resultEl.className = 'result-msg error';
        resultEl.textContent = '❌ Vui lòng nhập tên người!';
        return;
    }
    if (!amount || amount <= 0) {
        resultEl.className = 'result-msg error';
        resultEl.textContent = '❌ Số tiền không hợp lệ!';
        return;
    }

    try {
        showLoading(true);
        await addObligation(type, person, amount, dateStart, deadline, note);
        document.getElementById('obl-person').value = '';
        document.getElementById('obl-amount').value = '';
        document.getElementById('obl-note').value = '';

        resultEl.className = 'result-msg success';
        const label = type === 'ChoVay' ? 'Cho vay' : 'Nợ';
        resultEl.textContent = `✅ Đã thêm: ${label} ${formatCurrency(amount)}`;
        setTimeout(() => { resultEl.textContent = ''; }, 3000);

        await refreshObligations();
    } catch (err) {
        resultEl.className = 'result-msg error';
        resultEl.textContent = `❌ Lỗi: ${err.message}`;
    } finally {
        showLoading(false);
    }
}

let currentObligationFilter = 'all';

function filterObligations(filter, btn) {
    document.querySelectorAll('.filter-group-inline .btn-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentObligationFilter = filter;
    refreshObligations();
}

async function refreshObligations() {
    try {
        const summary = await getObligationSummary();
        document.getElementById('kpi-loans').textContent = formatCurrency(summary.totalLoans);
        document.getElementById('kpi-debts').textContent = formatCurrency(summary.totalDebts);

        let obligations;
        if (currentObligationFilter === 'pending') {
            obligations = await getObligations(null, 'pending');
        } else if (currentObligationFilter === 'done') {
            const collected = await getObligations(null, 'collected');
            const repaid = await getObligations(null, 'repaid');
            obligations = [...collected, ...repaid];
        } else {
            obligations = await getObligations();
        }

        renderObligationList('obligations-list', obligations);
    } catch (err) {
        console.error('Obligations error:', err);
    }
}

function renderObligationList(containerId, obligations) {
    const container = document.getElementById(containerId);

    if (!obligations || obligations.length === 0) {
        container.innerHTML = '<p class="empty-state">Chưa có khoản nào.</p>';
        return;
    }

    const today = new Date().toISOString().slice(0, 10);

    container.innerHTML = obligations.map(o => {
        const isLoan = o.type === 'ChoVay';
        const icon = isLoan ? '💸' : '💳';
        const typeLabel = isLoan ? 'Cho vay' : 'Nợ';
        const isPending = o.status === 'pending';
        const statusLabel = isPending
            ? (isLoan ? 'Chưa thu' : 'Chưa trả')
            : (isLoan ? 'Đã thu' : 'Đã trả');
        const isOverdue = isPending && o.date_deadline && o.date_deadline < today;
        const overdueClass = isOverdue ? 'overdue' : '';
        const resolvedClass = !isPending ? 'resolved' : '';
        const actionBtnLabel = isLoan ? '✅ Đã thu' : '✅ Đã trả';
        const nextStatus = isLoan ? 'collected' : 'repaid';

        return `
            <div class="obl-card ${overdueClass} ${resolvedClass}">
                <div class="obl-header">
                    <span class="obl-person">${icon} ${o.person_name}</span>
                    <span class="obl-amount ${isLoan ? 'expense' : 'income'}">${formatCurrency(o.amount)}</span>
                </div>
                <div class="obl-meta">
                    <span class="tag ${isLoan ? 'chi' : 'thu'}">${typeLabel}</span>
                    <span>${formatDateShort(o.date_start)}</span>
                    ${o.date_deadline ? `<span>→ ${formatDateShort(o.date_deadline)}</span>` : ''}
                    ${isOverdue ? '<span class="overdue-badge">⚠️ Quá hạn!</span>' : ''}
                </div>
                ${o.note ? `<div class="obl-note">${o.note}</div>` : ''}
                <div class="obl-actions">
                    <span class="obl-status ${o.status}">${statusLabel}</span>
                    ${isPending ? `
                        <button class="btn btn-small" onclick="resolveObligation('${o.id}', '${nextStatus}')">
                            ${actionBtnLabel}
                        </button>
                    ` : ''}
                    <button class="btn-icon-danger" onclick="removeObligation('${o.id}')">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

async function resolveObligation(id, status) {
    const label = status === 'collected' ? 'đã thu' : 'đã trả';
    if (!confirm(`Xác nhận ${label} khoản này?`)) return;
    try {
        showLoading(true);
        await updateObligationStatus(id, status);
        await refreshObligations();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    } finally {
        showLoading(false);
    }
}

async function removeObligation(id) {
    if (!confirm('Xoá khoản này?')) return;
    try {
        showLoading(true);
        await deleteObligation(id);
        await refreshObligations();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    } finally {
        showLoading(false);
    }
}

// ============================================================
//  ANOMALY DETECTION (Dashboard)
// ============================================================

async function renderAnomalyAlerts(month, year) {
    const section = document.getElementById('anomaly-alerts');
    const list = document.getElementById('anomaly-list');

    try {
        const anomalies = await getSpendingAnomalies(month, year);
        if (!anomalies || anomalies.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        list.innerHTML = anomalies.map(a => {
            const changeText = a.changePercent !== null
                ? `+${a.changePercent}% so với tháng trước`
                : 'Mới phát sinh tháng này';
            return `
                <div class="anomaly-card">
                    <div class="anomaly-header">
                        <span class="anomaly-cat">${a.label}</span>
                        <span class="anomaly-change">↑ ${changeText}</span>
                    </div>
                    <div class="anomaly-amounts">
                        <span>Tháng này: <strong>${formatCurrency(a.currentAmount)}</strong></span>
                        ${a.previousAmount > 0 ? `<span>Tháng trước: ${formatCurrency(a.previousAmount)}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        section.style.display = 'none';
        console.error('Anomaly detection error:', err);
    }
}

// ============================================================
//  BUDGET STATUS (Dashboard)
// ============================================================

async function renderBudgetStatus(month, year) {
    const section = document.getElementById('budget-status');
    const list = document.getElementById('budget-list');

    try {
        const budgetItems = await getBudgetStatus(month, year);
        if (!budgetItems || budgetItems.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        list.innerHTML = budgetItems.map(b => {
            const barClass = b.isOver ? 'over' : b.isWarning ? 'warning' : 'ok';
            const displayPercent = Math.min(b.percent, 100);
            return `
                <div class="budget-item">
                    <div class="budget-info">
                        <span>${b.icon} ${b.categoryName}</span>
                        <span>${formatCurrency(b.spent)} / ${formatCurrency(b.limit)}</span>
                    </div>
                    <div class="budget-bar-track">
                        <div class="budget-bar-fill ${barClass}" style="width: ${displayPercent}%"></div>
                    </div>
                    ${b.isOver ? `<span class="budget-over-text">⚠️ Vượt ${b.percent - 100}%</span>` : ''}
                </div>
            `;
        }).join('');
    } catch (err) {
        section.style.display = 'none';
        console.error('Budget status error:', err);
    }
}

// ============================================================
//  HEALTH SCORE (Dashboard)
// ============================================================

async function renderHealthScore(month, year) {
    const section = document.getElementById('health-score-section');

    try {
        const health = await calculateHealthScore(month, year);

        section.style.display = 'block';

        // Update circle gradient
        const circle = document.getElementById('health-circle');
        const deg = (health.score / 100) * 360;
        let color = '#ff6b6b';
        if (health.score >= 75) color = '#00d68f';
        else if (health.score >= 60) color = '#45b7d1';
        else if (health.score >= 40) color = '#ffd93d';
        circle.style.background = `conic-gradient(${color} ${deg}deg, rgba(255,255,255,0.08) ${deg}deg)`;

        document.getElementById('health-score-num').textContent = health.score;
        document.getElementById('health-grade').textContent = health.grade;

        // Update breakdown
        const d = health.details;
        document.getElementById('hs-savings').textContent = `${d.savings.score}/${d.savings.max}`;
        document.getElementById('hs-budget').textContent = `${d.budget.score}/${d.budget.max}`;
        document.getElementById('hs-debt').textContent = `${d.debt.score}/${d.debt.max}`;
        document.getElementById('hs-goals').textContent = `${d.goals.score}/${d.goals.max}`;
    } catch (err) {
        section.style.display = 'none';
        console.error('Health score error:', err);
    }
}

// ============================================================
//  BUDGET SETTINGS (Cài đặt)
// ============================================================

async function refreshBudgetSettings() {
    try {
        // Load expense categories into dropdown
        const cats = await getCategories('Chi');
        const catSelect = document.getElementById('budget-cat');
        catSelect.innerHTML = cats.map(c =>
            `<option value="${c.id}">${c.icon} ${c.name}</option>`
        ).join('');

        // Load existing budgets
        const budgets = await getBudgets();
        const list = document.getElementById('budget-settings-list');
        if (budgets.length === 0) {
            list.innerHTML = '<p class="empty-state">Chưa đặt ngân sách</p>';
        } else {
            list.innerHTML = budgets.filter(b => b.categories).map(b => `
                <div class="item-row">
                    <span class="item-label">
                        ${b.categories.icon} ${b.categories.name}
                        <span class="tag chi">${formatCurrency(b.monthly_limit)}/tháng</span>
                    </span>
                    <button class="btn-icon-danger" onclick="removeBudget('${b.id}')">✕</button>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Budget settings error:', err);
    }
}

async function saveBudget() {
    const categoryId = document.getElementById('budget-cat').value;
    const limit = parseFloat(document.getElementById('budget-limit').value);
    if (!categoryId || !limit || limit <= 0) {
        alert('Vui lòng chọn danh mục và nhập giới hạn hợp lệ!');
        return;
    }

    try {
        showLoading(true);
        await setBudget(categoryId, limit);
        document.getElementById('budget-limit').value = '';
        await refreshBudgetSettings();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    } finally {
        showLoading(false);
    }
}

async function removeBudget(id) {
    if (!confirm('Xoá ngân sách này?')) return;
    try {
        await deleteBudget(id);
        await refreshBudgetSettings();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    }
}
