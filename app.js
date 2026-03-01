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
        errorEl.textContent = err.message === 'Invalid login credentials'
            ? 'Email hoặc mật khẩu không đúng!'
            : err.message;
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
        case 'savings': refreshSavings(); break;
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
