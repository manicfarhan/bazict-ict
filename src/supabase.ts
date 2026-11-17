import { createClient } from '@supabase/supabase-js'

/**
 * Konfigurasi Supabase Project MAN IC Tala
 */
const SUPABASE_URL = 'https://tgsktxmaghlcvpfcjens.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_6t8wTfeHI7LViKJWUIlu9g_xvTPtCOm'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ==========================================
// DB MODEL TYPES & MAPPINGS
// ==========================================

export interface DbOrder {
  id: string
  customer_name: string
  customer_kelas?: string
  customer_kamar?: string
  customer_angkatan?: string
  phone?: string
  items: any
  subtotal: number
  delivery_fee: number
  total: number
  payment_method: string
  payment_status: 'UNPAID' | 'PAID'
  order_status: 'DITERIMA' | 'DIMASAK' | 'DIANTAR_KE_KAMAR' | 'SELESAI' | 'DIBATALKAN'
  created_at: string
}

export interface DbReview {
  id: string
  menu_id: string
  customer_name: string
  customer_kelas?: string
  customer_kamar?: string
  customer_angkatan?: string
  rating: number
  comment: string
  created_at: string
}

export interface DbAdminConfig {
  id: string
  menus?: any
  categories?: any
  food_posters?: any
  showcase_widgets?: any
  hero_badges?: any
  store_identity?: any
  about_data?: any
  canva_design?: any
  carousel_slides?: any
  carousel_interval_sec?: number
  updated_at?: string
}

// ==========================================
// ORDERS API
// ==========================================

export async function fetchOrdersFromDb() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('⚠️ Gagal mengambil pesanan dari Supabase:', error.message)
      return null
    }
    return data as DbOrder[]
  } catch (err) {
    console.warn('⚠️ Error jaringan Supabase (orders):', err)
    return null
  }
}

export async function insertOrderToDb(order: {
  id: string
  customerName: string
  customerKelas: string
  customerKamar: string
  customerAngkatan: string
  phone: string
  items: any[]
  subtotal: number
  deliveryFee: number
  total: number
  paymentMethod: string
  paymentStatus: 'UNPAID' | 'PAID'
  orderStatus: 'DITERIMA' | 'DIMASAK' | 'DIANTAR_KE_KAMAR' | 'SELESAI' | 'DIBATALKAN'
  createdAt: string
}) {
  try {
    const payload: DbOrder = {
      id: order.id,
      customer_name: order.customerName,
      customer_kelas: order.customerKelas,
      customer_kamar: order.customerKamar,
      customer_angkatan: order.customerAngkatan,
      phone: order.phone,
      items: order.items,
      subtotal: order.subtotal,
      delivery_fee: order.deliveryFee,
      total: order.total,
      payment_method: order.paymentMethod,
      payment_status: order.paymentStatus,
      order_status: order.orderStatus,
      created_at: order.createdAt
    }
    const { error } = await supabase.from('orders').insert([payload])
    if (error) {
      console.error('❌ Gagal menyimpan pesanan ke Supabase:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('❌ Error koneksi Supabase insert order:', err)
    return false
  }
}

export async function updateOrderStatusInDb(orderId: string, status: string) {
  try {
    const { error } = await supabase
      .from('orders')
      .update({ order_status: status })
      .eq('id', orderId)
    if (error) console.warn('⚠️ Gagal update status pesanan:', error.message)
  } catch (err) {
    console.warn('⚠️ Error update status pesanan:', err)
  }
}

export async function updateOrderPaymentInDb(orderId: string, paymentStatus: 'UNPAID' | 'PAID') {
  try {
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: paymentStatus })
      .eq('id', orderId)
    if (error) console.warn('⚠️ Gagal update pembayaran pesanan:', error.message)
  } catch (err) {
    console.warn('⚠️ Error update pembayaran pesanan:', err)
  }
}

// ==========================================
// REVIEWS API
// ==========================================

export async function fetchReviewsFromDb() {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('⚠️ Gagal mengambil ulasan dari Supabase:', error.message)
      return null
    }
    return data as DbReview[]
  } catch (err) {
    console.warn('⚠️ Error jaringan Supabase (reviews):', err)
    return null
  }
}

export async function insertReviewToDb(review: {
  id: string
  menuId: string
  customerName: string
  customerKelas: string
  customerKamar: string
  customerAngkatan: string
  rating: number
  comment: string
  createdAt: string
}) {
  try {
    const payload: DbReview = {
      id: review.id,
      menu_id: review.menuId,
      customer_name: review.customerName,
      customer_kelas: review.customerKelas,
      customer_kamar: review.customerKamar,
      customer_angkatan: review.customerAngkatan,
      rating: review.rating,
      comment: review.comment,
      created_at: review.createdAt
    }
    const { error } = await supabase.from('reviews').insert([payload])
    if (error) console.warn('⚠️ Gagal insert review ke Supabase:', error.message)
  } catch (err) {
    console.warn('⚠️ Error insert review ke Supabase:', err)
  }
}

// ==========================================
// ADMIN CONFIG API (MENUS, CATEGORIES, POSTERS, DESIGN)
// ==========================================

export async function fetchAdminConfigFromDb() {
  try {
    const { data, error } = await supabase
      .from('admin_config')
      .select('*')
      .eq('id', 'config')
      .maybeSingle()

    if (error) {
      console.warn('⚠️ Gagal mengambil admin_config:', error.message)
      return null
    }
    // Mendukung baik format objek config (jsonb) maupun kolom langsung
    const cfg = (data as any)?.config || data
    return cfg as DbAdminConfig | null
  } catch (err) {
    console.warn('⚠️ Error jaringan admin_config:', err)
    return null
  }
}

export async function saveAdminConfigToDb(configData: Partial<DbAdminConfig>) {
  try {
    // Ambil data konfigurasi yang sudah ada agar tidak saling menimpa
    const { data: existing } = await supabase
      .from('admin_config')
      .select('*')
      .eq('id', 'config')
      .maybeSingle()

    const currentConfigObj = (existing as any)?.config || (existing as any) || {}
    const newConfigObj = {
      ...currentConfigObj,
      ...configData,
      updated_at: new Date().toISOString()
    }

    const payload = {
      id: 'config',
      config: newConfigObj
    }

    const { error } = await supabase.from('admin_config').upsert(payload)
    if (error) {
      console.warn('⚠️ Gagal menyimpan admin_config ke Supabase:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('⚠️ Error upsert admin_config:', err)
    return false
  }
}
