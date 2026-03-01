/**
 * db.js - Supabase Client + CRUD operations
 * ⚠️ QUAN TRỌNG: Thay SUPABASE_URL và SUPABASE_KEY bằng giá trị của bạn
 */

// ============================================================
//  CẤU HÌNH SUPABASE - THAY GIÁ TRỊ CỦA BẠN VÀO ĐÂY
// ============================================================
const SUPABASE_URL = 'https://lapgqwznjveuqhizvstc.supabase.co';      // VD: https://xxxxx.supabase.co
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhcGdxd3puanZldXFoaXp2c3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTQzMTAsImV4cCI6MjA4Nzg5MDMxMH0.m6dwSe4NKVeEf8Bk4PoxqgJ9RktzW_SBnOlWbEnrD6g';

let supabase = null;

function initSupabase() {
    if (!supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return supabase;
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
