-- ============================================================
-- SQL Script cho Supabase: Tạo 4 bảng + RLS + Dữ liệu mẫu
-- Chạy script này trong Supabase → SQL Editor → New Query → Run
-- ============================================================

-- 1. BẢNG DANH MỤC (categories)
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Thu', 'Chi')),
    icon TEXT DEFAULT '📁',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. BẢNG TÀI KHOẢN (accounts)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Tiền mặt',
    balance DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. BẢNG GIAO DỊCH (transactions)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('Thu', 'Chi')),
    amount DOUBLE PRECISION NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    note TEXT DEFAULT '',
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. BẢNG MỤC TIÊU TIẾT KIỆM (savings_goals)
CREATE TABLE IF NOT EXISTS savings_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount DOUBLE PRECISION NOT NULL,
    current_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    deadline DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- BẬT ROW LEVEL SECURITY (RLS) - Mỗi user chỉ thấy dữ liệu mình
-- ============================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

-- Policy cho categories
CREATE POLICY "Users can view own categories" ON categories
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON categories
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON categories
    FOR DELETE USING (auth.uid() = user_id);

-- Policy cho accounts
CREATE POLICY "Users can view own accounts" ON accounts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON accounts
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON accounts
    FOR DELETE USING (auth.uid() = user_id);

-- Policy cho transactions
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions
    FOR DELETE USING (auth.uid() = user_id);

-- Policy cho savings_goals
CREATE POLICY "Users can view own savings_goals" ON savings_goals
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own savings_goals" ON savings_goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own savings_goals" ON savings_goals
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own savings_goals" ON savings_goals
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- HÀM TỰ ĐỘNG TẠO DỮ LIỆU MẪU KHI USER MỚI ĐĂNG KÝ
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Tạo danh mục Chi mặc định
    INSERT INTO public.categories (user_id, name, type, icon) VALUES
        (NEW.id, 'Ăn uống', 'Chi', '🍜'),
        (NEW.id, 'Di chuyển', 'Chi', '🚗'),
        (NEW.id, 'Mua sắm', 'Chi', '🛒'),
        (NEW.id, 'Hoá đơn', 'Chi', '📄'),
        (NEW.id, 'Giải trí', 'Chi', '🎮'),
        (NEW.id, 'Sức khoẻ', 'Chi', '💊'),
        (NEW.id, 'Giáo dục', 'Chi', '📚'),
        (NEW.id, 'Khác', 'Chi', '📦');

    -- Tạo danh mục Thu mặc định
    INSERT INTO public.categories (user_id, name, type, icon) VALUES
        (NEW.id, 'Lương', 'Thu', '💰'),
        (NEW.id, 'Thưởng', 'Thu', '🎁'),
        (NEW.id, 'Đầu tư', 'Thu', '📈'),
        (NEW.id, 'Thu nhập phụ', 'Thu', '💵'),
        (NEW.id, 'Khác', 'Thu', '📦');

    -- Tạo tài khoản mặc định
    INSERT INTO public.accounts (user_id, name, type, balance) VALUES
        (NEW.id, 'Tiền mặt', 'Tiền mặt', 0),
        (NEW.id, 'Ngân hàng', 'Ngân hàng', 0);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: khi user mới đăng ký → tự tạo dữ liệu mẫu
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
