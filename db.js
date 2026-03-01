/**
 * db.js - Supabase Client + CRUD operations
 * ⚠️ QUAN TRỌNG: Thay SUPABASE_URL và SUPABASE_KEY bằng giá trị của bạn
 */

// ============================================================
//  CẤU HÌNH SUPABASE - THAY GIÁ TRỊ CỦA BẠN VÀO ĐÂY
// ============================================================
const SUPABASE_URL = 'https://lapgqwznjveuqhizvstc.supabase.co';      // VD: https://xxxxx.supabase.co
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhcGdxd3puanZldXFoaXp2c3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTQzMTAsImV4cCI6MjA4Nzg5MDMxMH0.m6dwSe4NKVeEf8Bk4PoxqgJ9RktzW_SBnOlWbEnrD6g';

let _sb = null;

function initSupabase() {
    if (!_sb) {
        _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return _sb;
}

// ============================================================
//  AUTH (Xác thực)
// ============================================================

async function signUp(email, password) {
    const { data, error } = await initSupabase().auth.signUp({ email, password });
    if (error) throw error;
    return data;
}

async function signIn(email, password) {
    const { data, error } = await initSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

async function signOut() {
    const { error } = await initSupabase().auth.signOut();
    if (error) throw error;
}

async function getUser() {
    const { data: { user } } = await initSupabase().auth.getUser();
    return user;
}

function onAuthStateChange(callback) {
    initSupabase().auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}

// ============================================================
//  CATEGORIES (Danh mục)
// ============================================================

async function getCategories(typeFilter = null) {
    let query = initSupabase().from('categories').select('*').order('name');
    if (typeFilter) {
        query = query.eq('type', typeFilter);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

async function addCategory(name, type, icon = '📁') {
    const user = await getUser();
    const { data, error } = await initSupabase().from('categories').insert({
        user_id: user.id, name, type, icon
    }).select();
    if (error) throw error;
    return data;
}

async function deleteCategory(id) {
    const { error } = await initSupabase().from('categories').delete().eq('id', id);
    if (error) throw error;
}

// ============================================================
//  ACCOUNTS (Tài khoản / Ví)
// ============================================================

async function getAccounts() {
    const { data, error } = await initSupabase().from('accounts').select('*').order('name');
    if (error) throw error;
    return data || [];
}

async function addAccount(name, type = 'Tiền mặt', balance = 0) {
    const user = await getUser();
    const { data, error } = await initSupabase().from('accounts').insert({
        user_id: user.id, name, type, balance
    }).select();
    if (error) throw error;
    return data;
}

async function updateAccountBalance(accountId, delta) {
    // Lấy balance hiện tại
    const { data: acc, error: fetchErr } = await initSupabase()
        .from('accounts').select('balance').eq('id', accountId).single();
    if (fetchErr) throw fetchErr;

    const { error } = await initSupabase()
        .from('accounts').update({ balance: acc.balance + delta }).eq('id', accountId);
    if (error) throw error;
}

async function deleteAccount(id) {
    const { error } = await initSupabase().from('accounts').delete().eq('id', id);
    if (error) throw error;
}

// ============================================================
//  TRANSACTIONS (Giao dịch)
// ============================================================

async function addTransaction(type, amount, categoryId, accountId, note = '', date = null) {
    const user = await getUser();
    const txDate = date || new Date().toISOString();

    const { data, error } = await initSupabase().from('transactions').insert({
        user_id: user.id, type, amount, category_id: categoryId,
        account_id: accountId, note, date: txDate
    }).select();
    if (error) throw error;

    // Cập nhật số dư tài khoản
    const delta = type === 'Thu' ? amount : -amount;
    await updateAccountBalance(accountId, delta);

    return data;
}

async function getTransactions(limit = null, month = null, year = null) {
    let query = initSupabase()
        .from('transactions')
        .select('*, categories(name, icon), accounts(name)')
        .order('date', { ascending: false });

    if (month && year) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endMonth = month === 12 ? 1 : month + 1;
        const endYear = month === 12 ? year + 1 : year;
        const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
        query = query.gte('date', startDate).lt('date', endDate);
    } else if (year) {
        query = query.gte('date', `${year}-01-01`).lt('date', `${year + 1}-01-01`);
    }

    if (limit) {
        query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

async function deleteTransaction(id) {
    // Lấy thông tin giao dịch trước khi xoá để hoàn số dư
    const { data: tx, error: fetchErr } = await initSupabase()
        .from('transactions').select('type, amount, account_id').eq('id', id).single();
    if (fetchErr) throw fetchErr;

    if (tx) {
        const delta = tx.type === 'Thu' ? -tx.amount : tx.amount;
        await updateAccountBalance(tx.account_id, delta);
    }

    const { error } = await initSupabase().from('transactions').delete().eq('id', id);
    if (error) throw error;
}

async function getSummary(month = null, year = null) {
    const transactions = await getTransactions(null, month, year);

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(t => {
        if (t.type === 'Thu') totalIncome += t.amount;
        else totalExpense += t.amount;
    });

    return { income: totalIncome, expense: totalExpense, balance: totalIncome - totalExpense };
}

async function getExpenseByCategory(month = null, year = null) {
    const transactions = await getTransactions(null, month, year);
    const expenseMap = {};

    transactions.filter(t => t.type === 'Chi').forEach(t => {
        const catName = t.categories?.name || 'Khác';
        const catIcon = t.categories?.icon || '📦';
        const key = `${catIcon} ${catName}`;
        expenseMap[key] = (expenseMap[key] || 0) + t.amount;
    });

    return Object.entries(expenseMap)
        .map(([label, amount]) => ({ label, amount }))
        .sort((a, b) => b.amount - a.amount);
}

async function getMonthlySummary(year = null) {
    if (!year) year = new Date().getFullYear();
    const transactions = await getTransactions(null, null, year);

    const result = [];
    for (let m = 1; m <= 12; m++) {
        let income = 0, expense = 0;
        transactions.forEach(t => {
            const txMonth = new Date(t.date).getMonth() + 1;
            if (txMonth === m) {
                if (t.type === 'Thu') income += t.amount;
                else expense += t.amount;
            }
        });
        result.push({ month: m, income, expense });
    }
    return result;
}

// ============================================================
//  SAVINGS GOALS (Mục tiêu tiết kiệm)
// ============================================================

async function addSavingsGoal(name, targetAmount, deadline = null) {
    const user = await getUser();
    const { data, error } = await initSupabase().from('savings_goals').insert({
        user_id: user.id, name, target_amount: targetAmount, current_amount: 0, deadline
    }).select();
    if (error) throw error;
    return data;
}

async function getSavingsGoals() {
    const { data, error } = await initSupabase()
        .from('savings_goals').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function depositToGoal(goalId, amount) {
    const { data: goal, error: fetchErr } = await initSupabase()
        .from('savings_goals').select('current_amount').eq('id', goalId).single();
    if (fetchErr) throw fetchErr;

    const { error } = await initSupabase()
        .from('savings_goals')
        .update({ current_amount: goal.current_amount + amount })
        .eq('id', goalId);
    if (error) throw error;
}

async function deleteSavingsGoal(goalId) {
    const { error } = await initSupabase().from('savings_goals').delete().eq('id', goalId);
    if (error) throw error;
}

// ============================================================
//  OBLIGATIONS (Khoản cho vay / Nợ)
// ============================================================

async function addObligation(type, personName, amount, dateStart, dateDeadline = null, note = '') {
    const user = await getUser();
    const { data, error } = await initSupabase().from('obligations').insert({
        user_id: user.id, type, person_name: personName, amount,
        date_start: dateStart || new Date().toISOString().slice(0, 10),
        date_deadline: dateDeadline, note
    }).select();
    if (error) throw error;
    return data;
}

async function getObligations(typeFilter = null, statusFilter = null) {
    let query = initSupabase().from('obligations').select('*')
        .order('date_deadline', { ascending: true, nullsFirst: false });
    if (typeFilter) query = query.eq('type', typeFilter);
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

async function updateObligationStatus(id, status) {
    const { error } = await initSupabase().from('obligations').update({ status }).eq('id', id);
    if (error) throw error;
}

async function deleteObligation(id) {
    const { error } = await initSupabase().from('obligations').delete().eq('id', id);
    if (error) throw error;
}

async function getObligationSummary() {
    const obligations = await getObligations(null, 'pending');
    let totalLoans = 0, totalDebts = 0;
    obligations.forEach(o => {
        if (o.type === 'ChoVay') totalLoans += o.amount;
        else totalDebts += o.amount;
    });
    return { totalLoans, totalDebts, items: obligations };
}

// ============================================================
//  BUDGETS (Ngân sách theo danh mục)
// ============================================================

async function getBudgets() {
    const { data, error } = await initSupabase()
        .from('budgets').select('*, categories(name, icon, type)')
        .order('created_at');
    if (error) throw error;
    return data || [];
}

async function setBudget(categoryId, monthlyLimit) {
    const user = await getUser();
    const { data, error } = await initSupabase().from('budgets').upsert({
        user_id: user.id, category_id: categoryId, monthly_limit: monthlyLimit
    }, { onConflict: 'user_id,category_id' }).select();
    if (error) throw error;
    return data;
}

async function deleteBudget(id) {
    const { error } = await initSupabase().from('budgets').delete().eq('id', id);
    if (error) throw error;
}

async function getBudgetStatus(month, year) {
    const budgets = await getBudgets();
    const expenses = await getExpenseByCategory(month, year);

    const expenseMap = {};
    expenses.forEach(e => { expenseMap[e.label] = e.amount; });

    return budgets.filter(b => b.categories?.type === 'Chi').map(b => {
        const label = `${b.categories?.icon} ${b.categories?.name}`;
        const spent = expenseMap[label] || 0;
        const percent = b.monthly_limit > 0 ? Math.round((spent / b.monthly_limit) * 100) : 0;
        return {
            id: b.id,
            categoryName: b.categories?.name || 'Không rõ',
            icon: b.categories?.icon || '📁',
            limit: b.monthly_limit,
            spent,
            percent,
            isWarning: percent >= 80 && percent < 100,
            isOver: percent >= 100
        };
    });
}

// ============================================================
//  ANOMALY DETECTION (Phát hiện chi bất thường)
// ============================================================

async function getSpendingAnomalies(month, year) {
    const currentExpenses = await getExpenseByCategory(month, year);
    let prevMonth = month - 1, prevYear = year;
    if (prevMonth === 0) { prevMonth = 12; prevYear = year - 1; }
    const previousExpenses = await getExpenseByCategory(prevMonth, prevYear);

    const prevMap = {};
    previousExpenses.forEach(e => { prevMap[e.label] = e.amount; });

    const anomalies = [];
    currentExpenses.forEach(curr => {
        const prev = prevMap[curr.label] || 0;
        if (prev > 0) {
            const changePercent = ((curr.amount - prev) / prev) * 100;
            if (changePercent > 30) {
                anomalies.push({
                    label: curr.label, currentAmount: curr.amount,
                    previousAmount: prev, changePercent: Math.round(changePercent)
                });
            }
        } else if (curr.amount > 0) {
            anomalies.push({
                label: curr.label, currentAmount: curr.amount,
                previousAmount: 0, changePercent: null
            });
        }
    });

    return anomalies.sort((a, b) => (b.changePercent || 999) - (a.changePercent || 999));
}

// ============================================================
//  FINANCIAL HEALTH SCORE (Điểm sức khỏe tài chính)
// ============================================================

async function calculateHealthScore(month, year) {
    // 1. Tỷ lệ tiết kiệm (30 điểm)
    const summary = await getSummary(month, year);
    let savingsScore = 0;
    if (summary.income > 0) {
        const savingsRate = (summary.income - summary.expense) / summary.income;
        savingsScore = Math.max(0, Math.min(30, Math.round(savingsRate * 30)));
    }

    // 2. Ngân sách (25 điểm)
    let budgetScore = 25; // default full if no budgets set
    try {
        const budgetStatus = await getBudgetStatus(month, year);
        if (budgetStatus.length > 0) {
            const withinBudget = budgetStatus.filter(b => !b.isOver).length;
            budgetScore = Math.round((withinBudget / budgetStatus.length) * 25);
        }
    } catch (e) { /* ignore */ }

    // 3. Nợ / Cho vay (25 điểm)
    let debtScore = 25; // default full if no obligations
    try {
        const oblSummary = await getObligationSummary();
        const totalPending = oblSummary.totalLoans + oblSummary.totalDebts;
        if (totalPending > 0) {
            // Nợ ít hơn cho vay = điểm cao
            const debtRatio = oblSummary.totalDebts / totalPending;
            debtScore = Math.round((1 - debtRatio) * 25);
        }
    } catch (e) { /* ignore */ }

    // 4. Tiến độ mục tiêu tiết kiệm (20 điểm)
    let goalsScore = 0;
    try {
        const goals = await getSavingsGoals();
        if (goals.length > 0) {
            const totalProgress = goals.reduce((sum, g) => {
                return sum + Math.min(g.current_amount / g.target_amount, 1);
            }, 0);
            goalsScore = Math.round((totalProgress / goals.length) * 20);
        }
    } catch (e) { /* ignore */ }

    const score = savingsScore + budgetScore + debtScore + goalsScore;
    let grade = 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 75) grade = 'B';
    else if (score >= 60) grade = 'C';
    else if (score >= 40) grade = 'D';

    return {
        score, grade,
        details: {
            savings: { score: savingsScore, max: 30 },
            budget: { score: budgetScore, max: 25 },
            debt: { score: debtScore, max: 25 },
            goals: { score: goalsScore, max: 20 }
        }
    };
}

// ============================================================
//  UTILS
// ============================================================

function formatCurrency(amount) {
    if (amount == null) return '0 đ';
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' đ';
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function exportCSV(transactions) {
    const header = 'Loại,Số tiền,Danh mục,Tài khoản,Ghi chú,Ngày\n';
    const rows = transactions.map(t =>
        `${t.type},${t.amount},${t.categories?.name || ''},${t.accounts?.name || ''},${t.note || ''},${formatDateShort(t.date)}`
    ).join('\n');

    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `giao_dich_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
