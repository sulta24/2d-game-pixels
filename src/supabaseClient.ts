// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Простая проверка, чтобы убедиться, что ключи существуют
// Если ключи не найдены, это выведет ошибку в консоль браузера
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL and/or Anon Key are missing in .env file!");
  // Можно также добавить: alert("Supabase credentials missing! Check .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);