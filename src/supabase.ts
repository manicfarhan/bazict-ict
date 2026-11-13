import { createClient } from '@supabase/supabase-js'

/**
 * Ganti nilai berikut dengan URL & anon key project Supabase Anda.
 * Anda dapat menemukannya di Supabase Dashboard → Settings → API.
 */
const SUPABASE_URL = 'https://tgsktxmaghlcvpfcjens.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_6t8wTfeHI7LViKJWUIlu9g_xvTPtCOm'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Struktur data yang akan disimpan di Supabase.
 * Anda dapat menambah properti lain (mis. carouselSlides, interval, dsb.).
 */
export type AdminConfig = {
  id: string // selalu 'config' – dipakai sebagai primary key
  // contoh properti – sesuaikan dengan kebutuhan aplikasi Anda
  carouselSlides?: any[]
  carouselIntervalSec?: number
  // ...tambah properti lain bila diperlukan
}

/**
 * Simpan konfigurasi admin ke tabel `admin_config`.
 * Tabel harus memiliki kolom:
 *   - id (text primary key)
 *   - config (jsonb)   <-- menyimpan seluruh objek AdminConfig
 */
export const saveAdminConfig = async (config: Omit<AdminConfig, 'id'>) => {
  const payload = { ...config, id: 'config' } as AdminConfig
  const { error } = await supabase.from('admin_config').upsert(payload)
  if (error) {
    console.error('❌ Gagal menyimpan config admin ke Supabase:', error)
  } else {
    console.log('✅ Config admin tersimpan ke Supabase')
  }
}

/**
 * Muat konfigurasi admin dari Supabase.
 * Jika belum ada, mengembalikan `null`.
 */
export const loadAdminConfig = async (): Promise<AdminConfig | null> => {
  const { data, error } = await supabase.from('admin_config').select('*').eq('id', 'config').single()
  if (error) {
    console.error('❌ Gagal memuat config admin dari Supabase:', error)
    return null
  }
  return data as AdminConfig
}

