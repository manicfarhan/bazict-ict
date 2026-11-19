import React, { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import {
  supabase,
  fetchOrdersFromDb,
  insertOrderToDb,
  updateOrderStatusInDb,
  updateOrderPaymentInDb,
  fetchReviewsFromDb,
  insertReviewToDb,
  fetchAdminConfigFromDb,
  saveAdminConfigToDb
} from './supabase'

// Helper format Rupiah
const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

// Function to mask name for public reviews (Google Maps style)
const maskName = (name: string): string => {
  if (!name) return 'Murid IC Tala'
  const parts = name.trim().split(' ')
  return parts.map(part => {
    if (part.length <= 1) return part
    return part[0] + '*'.repeat(Math.max(1, part.length - 1))
  }).join(' ')
}

// Helper membaca file komputer lokal ke Base64 Data URL
const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.readAsDataURL(file)
  })
}

export const THEMES = [
  { id: 'midnight', name: '🌙 Dark (Default)', color: '#0f172a' },
  { id: 'kiosk-light', name: '🍟  Clean (Terang)', color: 'var(--text-primary)' },
  { id: 'pink', name: '🌸 Pink ', color: '#ec4899' },
  { id: 'blue', name: '🌊 Ocean', color: '#0284c7' },
  { id: 'emerald', name: '🌲 Emerald', color: '#059669' },
]

// ==========================================
// INTERFACES & DATA MODELS
// ==========================================

export interface MenuVariant {
  name: string
  price: number
}

export interface Review {
  id: string
  menuId: string
  customerName: string
  customerKelas: string
  customerKamar: string
  customerAngkatan: string
  rating: number // 0.0 - 5.0
  comment: string
  createdAt: string
}

export interface MenuItem {
  id: string
  name: string
  price: number
  category: string
  icon: string
  imageUrl?: string
  description?: string
  stock: number
  rating: number
  reviewCount: number
  variants?: MenuVariant[]
}

export interface CartItem {
  id: string
  menuItem: MenuItem
  quantity: number
  selectedVariants: MenuVariant[]
  notes: string
  itemTotal: number
}

export interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  variants?: MenuVariant[]
  notes?: string
}

export interface Order {
  id: string
  customerName: string
  customerKelas: string
  customerKamar: string
  customerAngkatan: string
  phone: string
  items: OrderItem[]
  subtotal: number
  deliveryFee: number
  total: number
  paymentMethod: string
  paymentStatus: 'UNPAID' | 'PAID'
  orderStatus: 'DITERIMA' | 'DIMASAK' | 'DIANTAR_KE_KAMAR' | 'SELESAI' | 'DIBATALKAN'
  createdAt: string
}

export interface CustomerUser {
  username: string
  password: string
  name: string
  kelas: string
  kamar: string
  angkatan: string
  phone: string
  avatar: string
  createdAt?: string
  lastLoginAt?: string
  lastActiveAt?: string
}

// Model Tim Pengembang (Identitas, Foto, Role, Kelas)
export interface DevTeamMember {
  id: string
  name: string
  kelas: string
  role: string
  bio?: string
  avatarUrl?: string
}

// Model Media Sosial Dinamis
export interface SocialPlatform {
  id: string
  platformName: string
  handle: string
  url: string
  iconEmoji: string
  badgeColor: string
}

// Model Tentang Kami Lengkap
export interface ComprehensiveAbout {
  title: string
  history: string
  visionMission: string
  galleryImages: string[]
  videoUrl: string
  team: DevTeamMember[]
  socials: SocialPlatform[]
}

// Model Hero Badge / Bubble Sticker
export interface HeroBadge {
  id: string
  text: string
  bg: string
  textColor: string
}

// Model Kotak Gambar Showcase (Bentuk Dinamis Ala Canva)
export interface ShowcaseWidget {
  id: string
  title: string
  priceTag?: string
  imageUrl: string
  shape: 'rounded' | 'squircle' | 'circle' | 'pill' | 'tilt-left' | 'tilt-right' | 'polaroid' | 'badge'
  caption?: string
  position: 'left' | 'right' | 'grid'
}

// Model Banner Poster Makanan Sisi Kiri & Kanan (Maximalisme - Bisa Diedit Admin)
export interface FoodPoster {
  id: string
  title: string
  subtitle: string
  badgeText: string
  badgeColor?: string
  priceTag?: string
  imageUrl: string
  position: 'left' | 'right'
  targetMenuName?: string
  accentColor?: string
  isActive: boolean
}

// Model Identitas Toko & Teks Hero (Semua Bisa Diedit Admin)
export interface StoreIdentity {
  topBarLeft: string
  topBarRight: string
  brandName: string
  brandSuffix: string
  brandSubtitle: string
  logoEmoji: string
  heroTitle: string
  heroDescription: string
  heroFeatures: string[]
  noticeTitle: string
  noticeDescription: string
  noticeEmoji: string
}

// Model Desain Ala Canva (Warna, Font, Border Radius, Background)
export interface CanvaDesignConfig {
  bgType: 'color' | 'gradient' | 'image'
  bgColor: string
  bgGradient: string
  bgImage: string
  surfaceColor: string
  surfaceCard: string
  surfaceBorder: string
  primaryColor: string
  textPrimary: string
  textSecondary: string
  fontFamily: 'sans' | 'outfit' | 'poppins' | 'serif' | 'mono'
  cardRadius: 'sharp' | 'normal' | 'rounded' | 'pill'
  bgPattern: 'none' | 'dots' | 'mesh-gradient' | 'aurora' | 'grid'
  showCustomAnnouncement: boolean
  customAnnouncementText: string
  announcementBg: string
}

export const THEME_PRESETS: Record<string, Partial<CanvaDesignConfig>> = {
  midnight: {
    bgType: 'color',
    bgColor: '#0f172a',
    surfaceColor: '#1e293b',
    surfaceCard: '#334155',
    surfaceBorder: '#475569',
    primaryColor: '#f43f5e',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    fontFamily: 'outfit'
  },
  'kiosk-light': {
    bgType: 'color',
    bgColor: '#f8fafc',
    surfaceColor: '#ffffff',
    surfaceCard: '#ffffff',
    surfaceBorder: '#e2e8f0',
    primaryColor: '#f43f5e',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    fontFamily: 'sans'
  },
  pink: {
    bgType: 'color',
    bgColor: '#fdf2f8',
    surfaceColor: '#ffffff',
    surfaceCard: '#fff1f2',
    surfaceBorder: '#fbcfe8',
    primaryColor: '#ec4899',
    textPrimary: '#831843',
    textSecondary: '#9d174d',
    fontFamily: 'poppins'
  },
  blue: {
    bgType: 'color',
    bgColor: '#f0f9ff',
    surfaceColor: '#ffffff',
    surfaceCard: '#e0f2fe',
    surfaceBorder: '#bae6fd',
    primaryColor: '#0284c7',
    textPrimary: '#0c4a6e',
    textSecondary: '#0369a1',
    fontFamily: 'sans'
  },
  emerald: {
    bgType: 'color',
    bgColor: '#f0fdf4',
    surfaceColor: '#ffffff',
    surfaceCard: '#dcfce7',
    surfaceBorder: '#bbf7d0',
    primaryColor: '#059669',
    textPrimary: '#064e3b',
    textSecondary: '#065f46',
    fontFamily: 'outfit'
  }
}

// ==========================================
// DEFAULT INITIAL DATA (PURE KOSONG - ADMIN MENGISI DARI AWAL)
// ==========================================

// Helper membersihkan data cache lama dari browser agar web pure kosong
const getCleanStorage = <T,>(key: string, defaultVal: T): T => {
  const saved = localStorage.getItem(key)
  if (!saved) return defaultVal
  try {
    const parsed = JSON.parse(saved)
    if (Array.isArray(parsed)) {
      const hasDummy = parsed.some((item: any) =>
        item?.id && typeof item.id === 'string' && /^(m[0-9]+|fp-[0-9]+|sc[0-9]+|b[0-9]+|r[0-9]+|t[0-9]+|s[0-9]+)$/.test(item.id)
      )
      if (hasDummy) {
        localStorage.setItem(key, JSON.stringify(defaultVal))
        return defaultVal
      }
    }
    return parsed
  } catch {
    return defaultVal
  }
}

const INITIAL_USERS: CustomerUser[] = [
  {
    username: 'murid1',
    password: '123',
    name: 'Ahmad Zaki Farhan',
    kelas: 'XI MIPA 1',
    kamar: 'Asrama Ibnu Sina Kamar 204',
    angkatan: 'Angkatan 7',
    phone: '081234567890',
    avatar: '🎓'
  },
  {
    username: 'murid2',
    password: '123',
    name: 'Aisyah Nabila Putri',
    kelas: 'X-2',
    kamar: 'Asrama Fatimah Kamar 102',
    angkatan: 'Angkatan 8',
    phone: '085711223344',
    avatar: '👩‍🎓'
  }
]

const INITIAL_CATEGORIES: string[] = ['Makanan Berat', 'Camilan', 'Minuman']

// Identitas Toko & Teks Hero Default
const INITIAL_STORE_IDENTITY: StoreIdentity = {
  topBarLeft: '🏫 MAN Insan Cendekia Tanah Laut',
  topBarRight: '🍱 Kantin Asrama & Pengantaran Kamar',
  brandName: 'ICT-Go',
  brandSuffix: 'Tala',
  brandSubtitle: 'Kantin Asrama MAN IC Tanah Laut',
  logoEmoji: '🍟',
  heroTitle: 'Lapar Setelah Aktivitas & Belajar? Pesan Sekarang di ICT-Go! 🍱',
  heroDescription: 'Layanan resmi pemesanan makanan & minuman higienis kantin asrama MAN Insan Cendekia Tanah Laut. Diantar langsung ke lobi asrama putra dan asrama putri.',
  heroFeatures: [
    '⚡ Antar Langsung ke Kamar Asrama',
    '💵 Bayar Offline (Ketemuan Langsung / COD)',
    '⭐ Rating Transparan ala Google Maps'
  ],
  noticeTitle: 'Sistem Pembayaran Offline / Ketemuan Langsung:',
  noticeDescription: 'Tidak perlu transfer atau e-wallet! Bayar tunai secara langsung saat pesanan diserahterimakan di asrama atau lobi.',
  noticeEmoji: '💡'
}

// Bubble / Sticker Tags Default (Kosong)
const INITIAL_HERO_BADGES: HeroBadge[] = []

// Showcase Kotak Gambar Default (Kosong)
const INITIAL_SHOWCASE_WIDGETS: ShowcaseWidget[] = []

// Banner Poster Makanan Default (Kosong)
const INITIAL_FOOD_POSTERS: FoodPoster[] = []

// Tim Pengembang Default (Kosong)
const INITIAL_DEV_TEAM: DevTeamMember[] = []

// Medsos Platform Dinamis Default (Kosong)
const INITIAL_SOCIALS: SocialPlatform[] = []

// Tentang Kami Default
const INITIAL_ABOUT_DATA: ComprehensiveAbout = {
  title: 'Tentang ICT-Go MAN Insan Cendekia Tanah Laut',
  history: 'ICT-Go Tala adalah platform pemesanan makanan mandiri yang diinisiasi dan dikembangkan oleh murid MAN Insan Cendekia Tanah Laut. Terinspirasi dari kehidupan asrama yang dinamis dan padat kegiatan belajar, sistem ini menghubungkan dapur kantin dengan asrama putra dan putri secara rapi, cepat, dan transparan.',
  visionMission: 'Visi kami adalah menciptakan layanan kantin asrama berbasis digital yang higienis, terjangkau, dan memudahkan seluruh murid tanpa harus keluar area kampus.',
  galleryImages: [],
  videoUrl: '',
  team: INITIAL_DEV_TEAM,
  socials: INITIAL_SOCIALS
}

// Konfigurasi Desain Ala Canva Default (Sleek Cyber Dark Mode & Maximalism)
const INITIAL_CANVA_DESIGN: CanvaDesignConfig = {
  bgType: 'color',
  bgColor: '#0b0f19',
  bgGradient: 'linear-gradient(135deg, #0b0f19 0%, #111827 50%, #0f172a 100%)',
  bgImage: '',
  surfaceColor: '#131b2e',
  surfaceCard: '#1e293b',
  surfaceBorder: '#2a3756',
  primaryColor: '#f43f5e',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  fontFamily: 'outfit',
  cardRadius: 'rounded',
  bgPattern: 'none',
  showCustomAnnouncement: false,
  customAnnouncementText: '📢 Pengumuman: Kantin buka setiap hari jam 06.00 - 21.30 WITA untuk melayani asrama!',
  announcementBg: 'linear-gradient(90deg, #f43f5e, #7c3aed)'
}

// Menu Makanan Default (Kosong)
const INITIAL_MENUS: MenuItem[] = []

// Ulasan Default (Kosong)
const INITIAL_REVIEWS: Review[] = []

export default function App() {
  // ==========================================
  // STATE MANAGEMENT WITH LOCALSTORAGE
  // ==========================================

  // Role: 'customer' | 'admin'
  const [viewRole, setViewRole] = useState<'customer' | 'admin'>(() => {
    return (localStorage.getItem('ic_view_role') as any) || 'customer'
  })

  // Customer Navigation: 'menu' | 'history' | 'about' | 'cart' | 'reviews'
  const [customerTab, setCustomerTab] = useState<'menu' | 'history' | 'about' | 'cart' | 'reviews'>('menu')

  // Admin Navigation Tabs (9 Tabs Komprehensif)
  const [adminTab, setAdminTab] = useState<string>('Dashboard')
  const [nowTick, setNowTick] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNowTick(Date.now()), 1000); return () => clearInterval(t); }, [])
  const [userSearch, setUserSearch] = useState('')
  const [userFilter, setUserFilter] = useState<'semua' | 'kelas' | 'kamar' | 'angkatan'>('semua')

  // Theme Preset (Default: Sleek Cyber Dark Slate)
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    const saved = localStorage.getItem('ic_theme')
    if (!saved || saved === 'kiosk-light' || saved === 'white') return 'midnight'
    return saved
  })

  // Admin Password
  const [adminPassword, setAdminPassword] = useState<string>(() => {
    return localStorage.getItem('adminPassword') || 'admin123'
  })

  // Logged-in Customer User (null saat awal masuk jika belum memilih akun)
  const [currentUser, setCurrentUser] = useState<CustomerUser | null>(() => {
    const saved = localStorage.getItem('ic_current_user')
    return saved ? JSON.parse(saved) : null
  })

  // Portal Pemilihan Akses Masuk (Welcome Gateway Modal saat pertama kali masuk web)
  const [isWelcomeGatewayOpen, setIsWelcomeGatewayOpen] = useState<boolean>(() => {
    return !sessionStorage.getItem('ic_gateway_chosen')
  })

  // Banner Poster Makanan (Sisi Kiri & Kanan - Mengisi Ruang Hitam Kosong / Maximalisme)
  const [foodPosters, setFoodPosters] = useState<FoodPoster[]>(() => {
    return getCleanStorage('ic_food_posters', INITIAL_FOOD_POSTERS)
  })

  // State Animasi Kotak Bergerak di Admin saat dipilih/diklik
  const [selectedAdminBoxId, setSelectedAdminBoxId] = useState<string | null>(null)

  // Multi-Device Sync Modal State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false)
  const [syncCodeInput, setSyncCodeInput] = useState<string>('')
  const [syncCodeOutput, setSyncCodeOutput] = useState<string>('')
  const [syncTab, setSyncTab] = useState<'export' | 'import'>('export')

  // Food Poster Admin Modal State
  const [isPosterModalOpen, setIsPosterModalOpen] = useState<boolean>(false)
  const [editingPosterId, setEditingPosterId] = useState<string | null>(null)
  const [posterForm, setPosterForm] = useState<FoodPoster>({
    id: '',
    title: '',
    subtitle: '',
    badgeText: 'HOT PROMO 🔥',
    badgeColor: '#f43f5e',
    priceTag: '',
    imageUrl: '',
    position: 'left',
    targetMenuName: '',
    accentColor: '#f43f5e',
    isActive: true
  })

  // Registered Customer Users
  const [users, setUsers] = useState<CustomerUser[]>(() => {
    return getCleanStorage('ic_users', INITIAL_USERS)
  })

  // Ref: timestamp edit lokal terakhir untuk mencegah polling menimpa perubahan user
  const lastLocalEditRef = useRef<number>(0)

  // Categories
  const [categories, setCategories] = useState<string[]>(() => {
    return getCleanStorage('ic_categories', INITIAL_CATEGORIES)
  })

  // Menus
  const [menus, setMenus] = useState<MenuItem[]>(() => {
    return getCleanStorage('ic_menus', INITIAL_MENUS)
  })

  // Orders
  const [orders, setOrders] = useState<Order[]>(() => {
    return getCleanStorage('ic_orders', [])
  })

  // Reviews
  const [reviews, setReviews] = useState<Review[]>(() => {
    return getCleanStorage('ic_reviews', INITIAL_REVIEWS)
  })

  // Store Identity & Header Info (Semua bisa diedit admin)
  const [storeIdentity, setStoreIdentity] = useState<StoreIdentity>(() => {
    const saved = localStorage.getItem('ic_store_identity')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.brandName === 'IC-Bites') parsed.brandName = 'ICT-Go'
        if (parsed.heroTitle && parsed.heroTitle.includes('IC-Bites')) {
          parsed.heroTitle = parsed.heroTitle.replace(/IC-Bites/g, 'ICT-Go')
        }
        return { ...INITIAL_STORE_IDENTITY, ...parsed }
      } catch { }
    }
    return INITIAL_STORE_IDENTITY
  })

  // Hero Badges / Bubble Stickers (Bisa ditambah & diedit admin)
  const [heroBadges, setHeroBadges] = useState<HeroBadge[]>(() => {
    return getCleanStorage('ic_hero_badges', INITIAL_HERO_BADGES)
  })

  // Showcase Kotak Gambar (Kiri dan Kanan yang kosong)
  const [showcaseWidgets, setShowcaseWidgets] = useState<ShowcaseWidget[]>(() => {
    return getCleanStorage('ic_showcase_widgets', INITIAL_SHOWCASE_WIDGETS)
  })

  // Tentang Kami Komprehensif
  const [aboutData, setAboutData] = useState<ComprehensiveAbout>(() => {
    const val = getCleanStorage('ic_about_comprehensive', INITIAL_ABOUT_DATA)
    if (val) {
      if (val.title && val.title.includes('IC-Bites')) val.title = val.title.replace(/IC-Bites/g, 'ICT-Go')
      if (val.history && val.history.includes('IC-Bites')) val.history = val.history.replace(/IC-Bites/g, 'ICT-Go')
    }
    return val
  })

  // Status Koneksi Cloud Supabase Realtime
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false)

  // Customer Canva Design (Tersimpan HANYA di perangkat pembeli / localStorage, TIDAK mengubah perangkat lain)
  const [customerCanvaDesign, setCustomerCanvaDesign] = useState<CanvaDesignConfig>(() => {
    const saved = localStorage.getItem('ic_customer_canva')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return { ...INITIAL_CANVA_DESIGN, ...parsed }
      } catch { }
    }
    return INITIAL_CANVA_DESIGN
  })

  // Modal Studio Desain Ala Canva untuk Pembeli (Per-device saja)
  const [isCustomerCanvaModalOpen, setIsCustomerCanvaModalOpen] = useState<boolean>(false)

  // Canva-style Design Studio Config (Untuk Admin / Default Cloud)
  const [canvaDesign, setCanvaDesign] = useState<CanvaDesignConfig>(() => {
    const saved = localStorage.getItem('ic_canva_design')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Jika masih tersimpan data tema terang lama (#f8fafc), perbarui ke Dark Mode
        if (parsed.bgColor === '#f8fafc' || parsed.surfaceColor === '#ffffff' || !parsed.bgType) {
          return INITIAL_CANVA_DESIGN
        }
        return { ...INITIAL_CANVA_DESIGN, ...parsed }
      } catch {
        return INITIAL_CANVA_DESIGN
      }
    }
    return INITIAL_CANVA_DESIGN
  })

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Semua')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'unpaid' | 'active' | 'completed'>('all')

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isAdminPasswordModalOpen, setIsAdminPasswordModalOpen] = useState(false)
  const [adminPasswordInput, setAdminPasswordInput] = useState('')
  const [adminPasswordError, setAdminPasswordError] = useState('')

  // Menu Detail Modal
  const [selectedMenuForDetail, setSelectedMenuForDetail] = useState<MenuItem | null>(null)
  const [detailQty, setDetailQty] = useState(1)
  const [detailSelectedVariants, setDetailSelectedVariants] = useState<MenuVariant[]>([])
  const [detailNotes, setDetailNotes] = useState('')

  // Admin Add/Edit Menu Modal
  const [isAdminAddModalOpen, setIsAdminAddModalOpen] = useState(false)
  const [adminEditingId, setAdminEditingId] = useState<string | null>(null)
  const [adminMenuForm, setAdminMenuForm] = useState({
    name: '',
    price: '',
    category: 'Makanan Berat',
    icon: '🍲',
    imageUrl: '',
    description: '',
    stock: '40'
  })
  const [adminFormVariants, setAdminFormVariants] = useState<MenuVariant[]>([])
  const [variantInput, setVariantInput] = useState({ name: '', price: '' })

  // Admin Showcase Widget Modal
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false)
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null)
  const [widgetForm, setWidgetForm] = useState<ShowcaseWidget>({
    id: '',
    title: '',
    priceTag: '',
    imageUrl: '',
    shape: 'rounded',
    caption: '',
    position: 'left'
  })

  // Admin Team Member Modal
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [teamForm, setTeamForm] = useState<DevTeamMember>({
    id: '',
    name: '',
    kelas: '',
    role: '',
    bio: '',
    avatarUrl: ''
  })

  // Admin Social Platform Modal
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false)
  const [editingSocialId, setEditingSocialId] = useState<string | null>(null)
  const [socialForm, setSocialForm] = useState<SocialPlatform>({
    id: '',
    platformName: '',
    handle: '',
    url: '',
    iconEmoji: '💬',
    badgeColor: '#25d366'
  })

  // Admin Badge Sticker Modal
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false)
  const [badgeForm, setBadgeForm] = useState<HeroBadge>({
    id: '',
    text: '',
    bg: '#f43f5e',
    textColor: '#ffffff'
  })

  // Change Password Form
  const [changePassForm, setChangePassForm] = useState({ oldPass: '', newPass: '', confirmPass: '' })

  // Customer Login/Register Form
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [registerForm, setRegisterForm] = useState({
    username: '',
    password: '',
    name: '',
    kelas: '',
    kamar: '',
    angkatan: '',
    phone: ''
  })

  // Review Form Modal
  const [reviewMenuTarget, setReviewMenuTarget] = useState<MenuItem | null>(null)
  const [reviewRatingInput, setReviewRatingInput] = useState<number>(5.0)
  const [reviewCommentInput, setReviewCommentInput] = useState<string>('')

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // ==========================================
  // SYNC STATE TO LOCALSTORAGE
  // ==========================================
  useEffect(() => {
    localStorage.setItem('ic_view_role', viewRole)
  }, [viewRole])

  useEffect(() => {
    localStorage.setItem('ic_theme', currentTheme)
    document.body.setAttribute('data-theme', currentTheme)
  }, [currentTheme])

  useEffect(() => {
    localStorage.setItem('adminPassword', adminPassword)
  }, [adminPassword])

  useEffect(() => {
    localStorage.setItem('ic_store_identity', JSON.stringify(storeIdentity))
  }, [storeIdentity])

  useEffect(() => {
    localStorage.setItem('ic_hero_badges', JSON.stringify(heroBadges))
  }, [heroBadges])

  useEffect(() => {
    localStorage.setItem('ic_showcase_widgets', JSON.stringify(showcaseWidgets))
  }, [showcaseWidgets])

  useEffect(() => {
    localStorage.setItem('ic_about_comprehensive', JSON.stringify(aboutData))
  }, [aboutData])

  useEffect(() => {
    localStorage.setItem('ic_canva_design', JSON.stringify(canvaDesign))
  }, [canvaDesign])

  useEffect(() => {
    localStorage.setItem('ic_categories', JSON.stringify(categories))
  }, [categories])

  useEffect(() => {
    localStorage.setItem('ic_menus', JSON.stringify(menus))
  }, [menus])

  useEffect(() => {
    localStorage.setItem('ic_orders', JSON.stringify(orders))
  }, [orders])

  useEffect(() => {
    localStorage.setItem('ic_reviews', JSON.stringify(reviews))
  }, [reviews])

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('ic_current_user', JSON.stringify(currentUser))
    } else {
      localStorage.removeItem('ic_current_user')
    }
  }, [currentUser])

  useEffect(() => {
    localStorage.setItem('ic_users', JSON.stringify(users))
  }, [users])

  useEffect(() => {
    localStorage.setItem('ic_food_posters', JSON.stringify(foodPosters))
  }, [foodPosters])

  // Sinkronisasi otomatis antar tab/jendela browser di perangkat yang sama
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ic_menus' && e.newValue) {
        try { setMenus(JSON.parse(e.newValue)) } catch { }
      }
      if (e.key === 'ic_categories' && e.newValue) {
        try { setCategories(JSON.parse(e.newValue)) } catch { }
      }
      if (e.key === 'ic_food_posters' && e.newValue) {
        try { setFoodPosters(JSON.parse(e.newValue)) } catch { }
      }
      if (e.key === 'ic_showcase_widgets' && e.newValue) {
        try { setShowcaseWidgets(JSON.parse(e.newValue)) } catch { }
      }
      if (e.key === 'ic_orders' && e.newValue) {
        try { setOrders(JSON.parse(e.newValue)) } catch { }
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // ==========================================
  // SYNC DENGAN SUPABASE REALTIME CLOUD
  // ==========================================
  // 1. Sync Pesanan Masuk (Realtime)
  const syncOrdersFromCloud = useCallback(async () => {
    // Anti-overwrite guard: avoid overwriting recent local edits (within 20s)
    if (Date.now() - lastLocalEditRef.current < 25000) return;
    const dbOrders = await fetchOrdersFromDb()
    if (dbOrders) {
      setIsCloudConnected(true)
      const mapped: Order[] = dbOrders.map(row => ({
        id: row.id,
        customerName: row.customer_name,
        customerKelas: row.customer_kelas || '',
        customerKamar: row.customer_kamar || '',
        customerAngkatan: row.customer_angkatan || '',
        phone: row.phone || '',
        items: Array.isArray(row.items)
          ? row.items.map(item => ({
            ...item,
            buyerName: item.buyerName ?? '',
            isPickedUp: item.isPickedUp ?? false
          }))
          : [],
        subtotal: Number(row.subtotal) || 0,
        deliveryFee: Number(row.delivery_fee) || 0,
        total: Number(row.total) || 0,
        paymentMethod: row.payment_method || 'Ketemuan Langsung (COD Offline)',
        paymentStatus: row.payment_status || 'UNPAID',
        orderStatus: row.order_status || 'DITERIMA',
        createdAt: row.created_at || new Date().toISOString()
      }))
      setOrders(mapped)
      localStorage.setItem('ic_orders', JSON.stringify(mapped))
    }
  }, [])

  // 2. Sync Ulasan Murid (Realtime)
  const syncReviewsFromCloud = useCallback(async () => {
    const dbReviews = await fetchReviewsFromDb()
    if (dbReviews) {
      setIsCloudConnected(true)
      const mapped: Review[] = dbReviews.map(r => ({
        id: r.id,
        menuId: r.menu_id,
        customerName: r.customer_name,
        customerKelas: r.customer_kelas || '',
        customerKamar: r.customer_kamar || '',
        customerAngkatan: r.customer_angkatan || '',
        rating: Number(r.rating) || 5.0,
        comment: r.comment || '',
        createdAt: r.created_at
      }))
      setReviews(mapped)
      localStorage.setItem('ic_reviews', JSON.stringify(mapped))
    }
  }, [])

  // 3. Sync Pengaturan Admin & Menu dari Supabase
  const syncConfigFromCloud = useCallback(async () => {
    // Hindari menimpa state saat admin sedang membuka modal tambah/edit
    if (isAdminAddModalOpen || isWidgetModalOpen || isPosterModalOpen || isTeamModalOpen || isSocialModalOpen || isBadgeModalOpen) return
    // Hindari menimpa perubahan lokal yang baru saja dibuat (dalam 10 detik terakhir)
    if ((Date.now() - lastLocalEditRef.current < 20000 || Date.now() - ((window as any).__lastAdminSave || 0) < 20000)) return
    const config = await fetchAdminConfigFromDb()
    if (config) {
      setIsCloudConnected(true)
      if (Array.isArray(config.menus)) {
        setMenus(config.menus)
        localStorage.setItem('ic_menus', JSON.stringify(config.menus))
      }
      if (Array.isArray(config.categories)) {
        setCategories(config.categories)
        localStorage.setItem('ic_categories', JSON.stringify(config.categories))
      }
      if (Array.isArray(config.food_posters)) {
        setFoodPosters(config.food_posters)
        localStorage.setItem('ic_food_posters', JSON.stringify(config.food_posters))
      }
      if (Array.isArray(config.showcase_widgets)) {
        setShowcaseWidgets(config.showcase_widgets)
        localStorage.setItem('ic_showcase_widgets', JSON.stringify(config.showcase_widgets))
      }
      if (Array.isArray(config.hero_badges)) {
        setHeroBadges(config.hero_badges)
        localStorage.setItem('ic_hero_badges', JSON.stringify(config.hero_badges))
      }
      if (config.store_identity && typeof config.store_identity === 'object' && Object.keys(config.store_identity).length > 0) {
        const iden = { ...config.store_identity }
        if (iden.brandName === 'IC-Bites') iden.brandName = 'ICT-Go'
        if (iden.heroTitle && iden.heroTitle.includes('IC-Bites')) {
          iden.heroTitle = iden.heroTitle.replace(/IC-Bites/g, 'ICT-Go')
        }
        setStoreIdentity(prev => ({ ...prev, ...iden }))
        localStorage.setItem('ic_store_identity', JSON.stringify(iden))
      }
      if (config.about_data && typeof config.about_data === 'object' && Object.keys(config.about_data).length > 0) {
        const abt = { ...config.about_data }
        if (abt.title && abt.title.includes('IC-Bites')) {
          abt.title = abt.title.replace(/IC-Bites/g, 'ICT-Go')
        }
        if (abt.history && abt.history.includes('IC-Bites')) {
          abt.history = abt.history.replace(/IC-Bites/g, 'ICT-Go')
        }
        setAboutData(prev => ({ ...prev, ...abt }))
        localStorage.setItem('ic_about_comprehensive', JSON.stringify(abt))
      }
      if (config.canva_design && typeof config.canva_design === 'object' && Object.keys(config.canva_design).length > 0) {
        setCanvaDesign(prev => ({ ...prev, ...config.canva_design }))
        localStorage.setItem('ic_canva_design', JSON.stringify(config.canva_design))
      }
      if (Array.isArray(config.users) && config.users.length > 0) {
        setUsers(config.users)
        localStorage.setItem('ic_users', JSON.stringify(config.users))
      }
    }
  }, [isAdminAddModalOpen, isWidgetModalOpen, isPosterModalOpen, isTeamModalOpen, isSocialModalOpen, isBadgeModalOpen])

  // Effect: Sambungkan ke Supabase (Realtime Channel + Interval Polling 4 Detik)
  useEffect(() => {
    syncOrdersFromCloud()
    syncConfigFromCloud()
    syncReviewsFromCloud()

    const ordersSub = supabase
      .channel('realtime:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        syncOrdersFromCloud()
      })
      .subscribe()

    const configSub = supabase
      .channel('realtime:admin_config')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_config' }, () => {
        syncConfigFromCloud()
      })
      .subscribe()

    const reviewsSub = supabase
      .channel('realtime:reviews')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => {
        syncReviewsFromCloud()
      })
      .subscribe()

    const pollTimer = setInterval(() => {
      syncOrdersFromCloud()
      syncConfigFromCloud()
      syncReviewsFromCloud()
    }, 4000)

    return () => {
      supabase.removeChannel(ordersSub)
      supabase.removeChannel(configSub)
      supabase.removeChannel(reviewsSub)
      clearInterval(pollTimer)
    }
  }, [syncOrdersFromCloud, syncConfigFromCloud, syncReviewsFromCloud])
  // Auto-sync ke Supabase saat admin mengedit tampilan/identitas/kategori/tentang
  useEffect(() => {
    if (!isCloudConnected) return
    const timer = setTimeout(() => {
      lastLocalEditRef.current = Date.now()
      // Persist collections to localStorage before syncing to Supabase
      localStorage.setItem('ic_menus', JSON.stringify(menus))
      localStorage.setItem('ic_categories', JSON.stringify(categories))
      localStorage.setItem('ic_showcase_widgets', JSON.stringify(showcaseWidgets))
      localStorage.setItem('ic_food_posters', JSON.stringify(foodPosters))
      localStorage.setItem('ic_hero_badges', JSON.stringify(heroBadges))
      localStorage.setItem('ic_store_identity', JSON.stringify(storeIdentity))
      localStorage.setItem('ic_about_comprehensive', JSON.stringify(aboutData))
      localStorage.setItem('ic_users', JSON.stringify(users))
      saveAdminConfigToDb({
        store_identity: storeIdentity,
        canva_design: canvaDesign,
        menus,
        categories,
        showcase_widgets: showcaseWidgets,
        food_posters: foodPosters,
        hero_badges: heroBadges,
        about_data: aboutData,
        users
      })
    }, 800)
    return () => clearTimeout(timer)
  }, [menus, storeIdentity, canvaDesign, categories, showcaseWidgets, foodPosters, heroBadges, aboutData, users, isCloudConnected])



  // ==========================================
  // CART CALCULATIONS
  // ==========================================
  const cartSubtotal = cart.reduce((acc, it) => acc + it.itemTotal, 0)
  const cartItemCount = cart.reduce((acc, it) => acc + it.quantity, 0)
  const cartTotalPrice = cartSubtotal

  // Filtered Menus
  const filteredMenus = menus.filter(m => {
    const matchesCat = selectedCategory === 'Semua' || m.category === selectedCategory
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesSearch
  })

  // Filtered Orders for Customer
  const customerOrders = orders.filter(o => {
    if (!currentUser) return true
    return o.customerName === currentUser.name || o.phone === currentUser.phone
  })

  const filteredOrders = customerOrders.filter(o => {
    if (historyFilter === 'unpaid') return o.paymentStatus === 'UNPAID' && o.orderStatus !== 'DIBATALKAN'
    if (historyFilter === 'active') return ['DITERIMA', 'DIMASAK', 'DIANTAR_KE_KAMAR'].includes(o.orderStatus)
    if (historyFilter === 'completed') return o.orderStatus === 'SELESAI'
    return true
  })

  const unpaidCount = customerOrders.filter(o => o.paymentStatus === 'UNPAID' && o.orderStatus !== 'DIBATALKAN').length
  const activeOrdersCount = customerOrders.filter(o => ['DITERIMA', 'DIMASAK', 'DIANTAR_KE_KAMAR'].includes(o.orderStatus)).length

  // ==========================================
  // ACTIONS: AUTHENTICATION
  // ==========================================
  const handleLoginCustomer = () => {
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      alert('Silakan masukkan username dan password')
      return
    }
    const found = users.find(u => u.username === loginForm.username.trim() && u.password === loginForm.password)
    if (!found) {
      alert('Username atau password tidak sesuai! Silakan daftar jika belum punya akun.')
      return
    }
    const now = new Date().toISOString()
    const updatedUsers = users.map(u =>
      u.username === found.username ? { ...u, lastLoginAt: now, lastActiveAt: now } : u
    )
    lastLocalEditRef.current = Date.now()
    setUsers(updatedUsers)
    localStorage.setItem('ic_users', JSON.stringify(updatedUsers))
    saveAdminConfigToDb({ users: updatedUsers } as any)
    setCurrentUser({ ...found, lastLoginAt: now, lastActiveAt: now })
    setIsAuthModalOpen(false)
    showToast(`👋 Selamat datang kembali, ${found.name.split(' ')[0]}!`)
  }

  const handleRegisterCustomer = () => {
    if (!registerForm.username.trim() || !registerForm.password.trim() || !registerForm.name.trim() ||
      !registerForm.kelas.trim() || !registerForm.kamar.trim() || !registerForm.angkatan.trim()) {
      alert('Harap isi semua kolom wajib (*) untuk data identitas murid!')
      return
    }
    if (users.some(u => u.username.toLowerCase() === registerForm.username.trim().toLowerCase())) {
      alert('Username tersebut sudah dipakai murid lain. Silakan pilih username lain.')
      return
    }

    const newUser: CustomerUser = {
      username: registerForm.username.trim(),
      password: registerForm.password,
      name: registerForm.name.trim(),
      kelas: registerForm.kelas.trim(),
      kamar: registerForm.kamar.trim(),
      angkatan: registerForm.angkatan.trim(),
      phone: registerForm.phone.trim() || '-',
      avatar: '🎓',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    }

    const updatedUsers = [...users, newUser]
    lastLocalEditRef.current = Date.now()
    setUsers(updatedUsers)
    localStorage.setItem('ic_users', JSON.stringify(updatedUsers))
    saveAdminConfigToDb({ users: updatedUsers } as any)
    setCurrentUser(newUser)
    setIsAuthModalOpen(false)
    setRegisterForm({ username: '', password: '', name: '', kelas: '', kamar: '', angkatan: '', phone: '' })
    showToast(`🎉 Pendaftaran berhasil! Selamat datang, ${newUser.name}!`)
  }

  const handleVerifyAdminPassword = () => {
    if (adminPasswordInput === adminPassword) {
      setIsAdminPasswordModalOpen(false)
      setAdminPasswordInput('')
      setAdminPasswordError('')
      setViewRole('admin')
      showToast('🔓 Berhasil masuk ke Portal Admin Kantin!')
    } else {
      setAdminPasswordError('Password salah! Silakan coba lagi.')
    }
  }

  const handleAdminLogout = () => {
    setViewRole('customer')
    showToast('🔒 Portal Admin telah dikunci.')
  }

  const handleChangeAdminPassword = () => {
    if (!changePassForm.oldPass || !changePassForm.newPass || !changePassForm.confirmPass) {
      alert('Lengkapi semua kolom password.')
      return
    }
    if (changePassForm.oldPass !== adminPassword) {
      alert('Password lama salah!')
      return
    }
    if (changePassForm.newPass.length < 4) {
      alert('Password baru minimal 4 karakter!')
      return
    }
    if (changePassForm.newPass !== changePassForm.confirmPass) {
      alert('Konfirmasi password baru tidak cocok!')
      return
    }
    setAdminPassword(changePassForm.newPass)
    setChangePassForm({ oldPass: '', newPass: '', confirmPass: '' })
    showToast('🔑 Password Admin berhasil diubah!')
  }

  // ==========================================
  // ACTIONS: CART & ORDER
  // ==========================================
  const handleAddToCart = () => {
    if (!selectedMenuForDetail) return

    const varTotal = detailSelectedVariants.reduce((s, v) => s + v.price, 0)
    const itemTotal = (selectedMenuForDetail.price + varTotal) * detailQty

    const newCartItem: CartItem = {
      id: 'cart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      menuItem: selectedMenuForDetail,
      quantity: detailQty,
      selectedVariants: detailSelectedVariants,
      notes: detailNotes.trim(),
      itemTotal
    }

    setCart([...cart, newCartItem])
    setSelectedMenuForDetail(null)
    showToast(`🛒 Ditambahkan ke keranjang: ${newCartItem.menuItem.name}`)
  }

  const handleConfirmOrder = () => {
    if (cart.length === 0) return
    if (!currentUser) {
      setIsAuthModalOpen(true)
      showToast('⚠️ Silakan login akun murid terlebih dahulu untuk memesan!')
      return
    }

    const orderItems: OrderItem[] = cart.map(c => ({
      id: c.menuItem.id,
      name: c.menuItem.name,
      price: c.menuItem.price,
      quantity: c.quantity,
      variants: c.selectedVariants,
      notes: c.notes
    }))

    const newOrder: Order = {
      id: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
      customerName: currentUser.name,
      customerKelas: currentUser.kelas,
      customerKamar: currentUser.kamar,
      customerAngkatan: currentUser.angkatan,
      phone: currentUser.phone,
      items: orderItems,
      subtotal: cartSubtotal,
      deliveryFee: 0,
      total: cartTotalPrice,
      paymentMethod: 'Ketemuan Langsung (COD Offline)',
      paymentStatus: 'UNPAID',
      orderStatus: 'DITERIMA',
      createdAt: new Date().toISOString()
    }

    // Kurangi stok menu
    const updatedMenus = menus.map(m => {
      const match = cart.find(c => c.menuItem.id === m.id)
      if (match) {
        return { ...m, stock: Math.max(0, m.stock - match.quantity) }
      }
      return m
    })

    setMenus(updatedMenus)
    setOrders([newOrder, ...orders])
    localStorage.setItem('ic_last_order_id', newOrder.id)
    setCart([])
    setCustomerTab('history')
    showToast(`🚀 Pesanan #${newOrder.id} berhasil dikirim ke dapur kantin!`)

    // Simpan pesanan & kurangi stok langsung di Cloud Supabase
    insertOrderToDb(newOrder)
    saveAdminConfigToDb({ menus: updatedMenus })
  }

  const handleCancelOrder = (orderId: string) => {
    if (!window.confirm('Yakin ingin membatalkan pesanan ini?')) return

    const targetOrder = orders.find(o => o.id === orderId)
    if (!targetOrder) return

    // Kembalikan stok
    const updatedMenus = menus.map(m => {
      const itemOrdered = targetOrder.items.find(it => it.id === m.id)
      if (itemOrdered) {
        return { ...m, stock: m.stock + itemOrdered.quantity }
      }
      return m
    })

    setMenus(updatedMenus)
    setOrders(orders.map(o => o.id === orderId ? { ...o, orderStatus: 'DIBATALKAN' } : o))
    showToast(`❌ Pesanan #${orderId} telah dibatalkan. Stok telah dikembalikan.`)

    // Update status di Supabase Cloud
    updateOrderStatusInDb(orderId, 'DIBATALKAN')
    saveAdminConfigToDb({ menus: updatedMenus })
  }

  const handleAdminUpdateOrderStatus = (orderId: string, status: Order['orderStatus']) => {
    setOrders(orders.map(o => o.id === orderId ? { ...o, orderStatus: status } : o))
    showToast(`📦 Status pesanan #${orderId} diperbarui ke: ${status}`)
    updateOrderStatusInDb(orderId, status)
  }

  const handleTogglePaymentStatus = (orderId: string, current: 'UNPAID' | 'PAID') => {
    const nextStatus = current === 'UNPAID' ? 'PAID' : 'UNPAID'
    setOrders(orders.map(o => o.id === orderId ? { ...o, paymentStatus: nextStatus } : o))
    showToast(`💵 Status pembayaran pesanan #${orderId}: ${nextStatus === 'PAID' ? 'LUNAS ✅' : 'BELUM BAYAR ⚠️'}`)
    updateOrderPaymentInDb(orderId, nextStatus)
  }

  // ==========================================
  // ACTIONS: MENU MANAGEMENT & FOTO UPLOAD
  // ==========================================
  const handleSaveMenu = async () => {

    if (!adminMenuForm.name.trim() || !adminMenuForm.price) {
      alert('Nama dan harga menu wajib diisi!')
      return
    }

    let updated: MenuItem[]
    if (adminEditingId) {
      // Edit Menu
      updated = menus.map(m => {
        if (m.id === adminEditingId) {
          return {
            ...m,
            name: adminMenuForm.name.trim(),
            price: Number(adminMenuForm.price) || 0,
            category: adminMenuForm.category,
            icon: adminMenuForm.icon || '🍲',
            imageUrl: adminMenuForm.imageUrl.trim(),
            description: adminMenuForm.description.trim(),
            stock: Number(adminMenuForm.stock) || 0,
            variants: adminFormVariants
          }
        }
        return m
      })
      showToast('✅ Menu berhasil diperbarui!')
    } else {
      // Tambah Menu Baru
      const newMenu: MenuItem = {
        id: 'm_' + Date.now(),
        name: adminMenuForm.name.trim(),
        price: Number(adminMenuForm.price) || 0,
        category: adminMenuForm.category,
        icon: adminMenuForm.icon || '🍲',
        imageUrl: adminMenuForm.imageUrl.trim(),
        description: adminMenuForm.description.trim(),
        stock: Number(adminMenuForm.stock) || 40,
        rating: 5.0,
        reviewCount: 0,
        variants: adminFormVariants
      }
      updated = [...menus, newMenu]
      showToast('➕ Menu baru berhasil ditambahkan!')
    }

    setMenus(updated)
    const ok = await saveAdminConfigToDb({ menus: updated })
    if (ok) {
      showToast('✅ Menu & keterangan tersimpan permanen ke Cloud!')
    } else {
      alert('⚠️ Gagal menyimpan ke Supabase! Cek ukuran foto atau izin tabel admin_config.')
    }

    setIsAdminAddModalOpen(false)
    setAdminEditingId(null)
  }

  const handleDeleteMenu = (id: string) => {
    if (window.confirm('Hapus menu ini dari daftar kantin?')) {
      const updated = menus.filter(m => m.id !== id)
      setMenus(updated)
      saveAdminConfigToDb({ menus: updated })
      showToast('🗑️ Menu berhasil dihapus.')
    }
  }

  // ==========================================
  // ACTIONS: SHOWCASE WIDGETS (KOTAK GAMBAR)
  // ==========================================
  const handleSaveShowcaseWidget = () => {
    if (!widgetForm.title.trim() || !widgetForm.imageUrl.trim()) {
      alert('Judul dan gambar wajib diisi!')
      return
    }

    let updatedWidgets: ShowcaseWidget[]
    if (editingWidgetId) {
      updatedWidgets = showcaseWidgets.map(w => w.id === editingWidgetId ? { ...widgetForm } : w)
      showToast('✅ Kotak showcase diperbarui!')
    } else {
      const newW: ShowcaseWidget = {
        ...widgetForm,
        id: 'sc_' + Date.now()
      }
      updatedWidgets = [...showcaseWidgets, newW]
      showToast('➕ Kotak gambar baru berhasil ditambahkan!')
    }
    setShowcaseWidgets(updatedWidgets)
    saveAdminConfigToDb({ showcase_widgets: updatedWidgets })
    setIsWidgetModalOpen(false)
    setEditingWidgetId(null)
  }

  const handleDeleteWidget = (id: string) => {
    if (window.confirm('Hapus kotak gambar ini?')) {
      const updated = showcaseWidgets.filter(w => w.id !== id)
      setShowcaseWidgets(updated)
      saveAdminConfigToDb({ showcase_widgets: updated })
      showToast('🗑️ Kotak gambar dihapus.')
    }
  }

  // ==========================================
  // ACTIONS: TIM PENGEMBANG & MEDSOS
  // ==========================================
  const handleSaveTeamMember = () => {
    if (!teamForm.name.trim() || !teamForm.kelas.trim() || !teamForm.role.trim()) {
      alert('Nama, kelas, dan peran wajib diisi!')
      return
    }

    let updatedAbout: ComprehensiveAbout
    if (editingTeamId) {
      updatedAbout = {
        ...aboutData,
        team: aboutData.team.map(t => t.id === editingTeamId ? { ...teamForm } : t)
      }
      showToast('✅ Data pengembang diperbarui!')
    } else {
      const newMember: DevTeamMember = {
        ...teamForm,
        id: 'team_' + Date.now()
      }
      updatedAbout = {
        ...aboutData,
        team: [...aboutData.team, newMember]
      }
      showToast('➕ Anggota tim baru ditambahkan!')
    }
    setAboutData(updatedAbout)
    saveAdminConfigToDb({ about_data: updatedAbout })
    setIsTeamModalOpen(false)
    setEditingTeamId(null)
  }

  const handleDeleteTeamMember = (id: string) => {
    if (window.confirm('Hapus anggota tim ini?')) {
      const updatedAbout = {
        ...aboutData,
        team: aboutData.team.filter(t => t.id !== id)
      }
      setAboutData(updatedAbout)
      saveAdminConfigToDb({ about_data: updatedAbout })
      showToast('🗑️ Anggota tim dihapus.')
    }
  }

  const handleSaveSocialPlatform = () => {
    if (!socialForm.platformName.trim() || !socialForm.handle.trim() || !socialForm.url.trim()) {
      alert('Nama platform, nama akun, dan link tujuan wajib diisi!')
      return
    }

    let updatedAbout: ComprehensiveAbout
    if (editingSocialId) {
      updatedAbout = {
        ...aboutData,
        socials: aboutData.socials.map(s => s.id === editingSocialId ? { ...socialForm } : s)
      }
      showToast('✅ Platform media sosial diperbarui!')
    } else {
      const newSoc: SocialPlatform = {
        ...socialForm,
        id: 'soc_' + Date.now()
      }
      updatedAbout = {
        ...aboutData,
        socials: [...aboutData.socials, newSoc]
      }
      showToast('➕ Media sosial baru ditambahkan!')
    }
    setAboutData(updatedAbout)
    saveAdminConfigToDb({ about_data: updatedAbout })
    setIsSocialModalOpen(false)
    setEditingSocialId(null)
  }

  const handleDeleteSocial = (id: string) => {
    if (window.confirm('Hapus platform media sosial ini?')) {
      const updatedAbout = {
        ...aboutData,
        socials: aboutData.socials.filter(s => s.id !== id)
      }
      setAboutData(updatedAbout)
      saveAdminConfigToDb({ about_data: updatedAbout })
      showToast('🗑️ Media sosial dihapus.')
    }
  }

  // ==========================================
  // ACTIONS: REVIEWS (GOOGLE MAPS STYLE)
  // ==========================================
  const handleSubmitReview = async () => {
    if (!reviewMenuTarget || !currentUser) return
    if (!reviewCommentInput.trim()) {
      alert('Tuliskan komentar atau ulasan rasa makanan.')
      return
    }

    const newRev: Review = {
      id: 'rev_' + Date.now(),
      menuId: reviewMenuTarget.id,
      customerName: currentUser.name,
      customerKelas: currentUser.kelas,
      customerKamar: currentUser.kamar,
      customerAngkatan: currentUser.angkatan,
      rating: reviewRatingInput,
      comment: reviewCommentInput.trim(),
      createdAt: new Date().toISOString()
    }

    const updatedReviews = [newRev, ...reviews]
    setReviews(updatedReviews)
    const saved = await insertReviewToDb(newRev)

    const menuReviews = updatedReviews.filter(r => r.menuId === reviewMenuTarget.id)
    const avgRating = menuReviews.reduce((s, r) => s + r.rating, 0) / menuReviews.length

    const updatedMenus = menus.map(m =>
      m.id === reviewMenuTarget.id
        ? { ...m, rating: Number(avgRating.toFixed(1)), reviewCount: menuReviews.length }
        : m
    )
    setMenus(updatedMenus)
    await saveAdminConfigToDb({ menus: updatedMenus })

    if (saved) {
      await syncReviewsFromCloud()
      showToast('⭐ Ulasan berhasil dikirim & tersimpan ke Cloud!')
    } else {
      showToast('⚠️ Ulasan tersimpan lokal (cek izin RLS tabel reviews di Supabase).')
    }

    setReviewMenuTarget(null)
    setReviewCommentInput('')
  }


  // Left and Right widgets
  const leftWidgets = showcaseWidgets.filter(w => w.position === 'left')
  const rightWidgets = showcaseWidgets.filter(w => w.position === 'right')

  // Left and Right food banner posters (Maximalisme Sisi Kiri & Kanan)
  const leftPosters = foodPosters.filter(p => p.position === 'left' && p.isActive)
  const rightPosters = foodPosters.filter(p => p.position === 'right' && p.isActive)

  const handlePosterClick = (poster: FoodPoster) => {
    if (poster.targetMenuName) {
      const found = menus.find(m => m.name.toLowerCase().includes(poster.targetMenuName!.toLowerCase()))
      if (found) {
        setSelectedMenuForDetail(found)
        setDetailQty(1)
        setDetailSelectedVariants([])
        setDetailNotes(`Promo Poster: ${poster.title}`)
        return
      }
    }
    showToast(`🔥 Promo Terpilih: ${poster.title}! Silakan pilih menu di bawah.`)
  }

  // Multi-Device Sync Handlers

  const buildFullBackupPayload = () => ({
    version: '2.0-full',
    menus,
    categories,
    foodPosters,
    showcaseWidgets,
    heroBadges,
    storeIdentity,
    aboutData,
    canvaDesign,
    currentTheme,
    orders,
    reviews,
    timestamp: new Date().toISOString()
  })

  const handleExportSyncData = () => {
    const exportData = buildFullBackupPayload()
    const jsonStr = JSON.stringify(exportData, null, 2)
    navigator.clipboard.writeText(jsonStr).then(() => {
      showToast('📋 Seluruh data web (Menu, Desain, Tentang, Pesanan & Ulasan) berhasil disalin!')
    }).catch(() => {
      showToast('ℹ️ Silakan salin teks kode lengkap di bawah secara manual.')
    })
    setSyncCodeOutput(jsonStr)
  }

  const handleDownloadBackupFile = () => {
    const exportData = buildFullBackupPayload()
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `foodgo_full_backup_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('💾 File backup LENGKAP semua editan & data berhasil diunduh!')
  }

  const handleImportSyncData = async (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString)
      let importedCount = 0
      const cloudUpdates: Record<string, any> = {}

      if (Array.isArray(data.menus)) {
        setMenus(data.menus)
        cloudUpdates.menus = data.menus
        importedCount += data.menus.length
      }
      if (Array.isArray(data.categories)) {
        setCategories(data.categories)
        cloudUpdates.categories = data.categories
      }
      if (Array.isArray(data.foodPosters)) {
        setFoodPosters(data.foodPosters)
        cloudUpdates.food_posters = data.foodPosters
      }
      if (Array.isArray(data.showcaseWidgets)) {
        setShowcaseWidgets(data.showcaseWidgets)
        cloudUpdates.showcase_widgets = data.showcaseWidgets
      }
      if (Array.isArray(data.heroBadges)) {
        setHeroBadges(data.heroBadges)
        cloudUpdates.hero_badges = data.heroBadges
      }
      if (data.storeIdentity && typeof data.storeIdentity === 'object') {
        setStoreIdentity(prev => {
          const merged = { ...prev, ...data.storeIdentity }
          cloudUpdates.store_identity = merged
          return merged
        })
      }
      if (data.aboutData && typeof data.aboutData === 'object') {
        setAboutData(prev => {
          const merged = { ...prev, ...data.aboutData }
          cloudUpdates.about_data = merged
          return merged
        })
      }
      if (data.canvaDesign && typeof data.canvaDesign === 'object') {
        setCanvaDesign(prev => {
          const merged = { ...prev, ...data.canvaDesign }
          cloudUpdates.canva_design = merged
          return merged
        })
      }
      if (typeof data.currentTheme === 'string') {
        setCurrentTheme(data.currentTheme)
      }
      if (Array.isArray(data.orders)) {
        setOrders(data.orders)
        for (const ord of data.orders) {
          await insertOrderToDb(ord)
        }
      }
      if (Array.isArray(data.reviews)) {
        setReviews(data.reviews)
        for (const rev of data.reviews) {
          await insertReviewToDb(rev)
        }
      }

      if (Object.keys(cloudUpdates).length > 0) {
        await saveAdminConfigToDb(cloudUpdates)
      }

      setIsSyncModalOpen(false)
      setSyncCodeInput('')
      showToast(`🎉 Berhasil sinkronisasi penuh! ${importedCount} menu & seluruh editan tersimpan ke Cloud!`)
    } catch {
      alert('Format kode tidak valid! Pastikan kamu menyalin seluruh teks kode atau file JSON dengan benar.')
    }
  }


  // Food Poster Save Handler
  const handleSavePoster = () => {
    if (!posterForm.title.trim()) {
      alert('Judul poster promo wajib diisi!')
      return
    }
    let updatedPosters: FoodPoster[]
    if (editingPosterId) {
      updatedPosters = foodPosters.map(p => p.id === editingPosterId ? { ...posterForm } : p)
      showToast('✅ Poster promo makanan berhasil diperbarui!')
    } else {
      const newPoster: FoodPoster = {
        ...posterForm,
        id: 'fp_' + Date.now()
      }
      updatedPosters = [...foodPosters, newPoster]
      showToast('➕ Poster promo baru berhasil ditambahkan!')
    }
    setFoodPosters(updatedPosters)
    saveAdminConfigToDb({ food_posters: updatedPosters })
    setIsPosterModalOpen(false)
    setEditingPosterId(null)
  }

  // Helper ganti tema cepat (Preset)
  const handleApplyTheme = (themeId: string) => {
    setCurrentTheme(themeId)
    const preset = THEME_PRESETS[themeId]
    if (!preset) return

    if (viewRole === 'customer') {
      const updated: CanvaDesignConfig = {
        ...customerCanvaDesign,
        ...preset
      }
      setCustomerCanvaDesign(updated)
      localStorage.setItem('ic_customer_canva', JSON.stringify(updated))
      showToast(`🎨 Tema berganti ke: ${themeId} (Khusus perangkatmu)!`)
    } else {
      const updated: CanvaDesignConfig = {
        ...canvaDesign,
        ...preset
      }
      setCanvaDesign(updated)
      localStorage.setItem('ic_canva_design', JSON.stringify(updated))
      saveAdminConfigToDb({ canva_design: updated })
      showToast(`🎨 Tema Admin diperbarui ke: ${themeId} & tersimpan ke Cloud!`)
    }
  }

  // Inline dynamic CSS Variables based on Canva Studio configuration (Isolasi Customer vs Admin)
  const activeDesign = viewRole === 'customer' ? customerCanvaDesign : canvaDesign
  const dynamicCssVariables = {
    '--bg-color': activeDesign.bgColor,
    '--surface-color': activeDesign.surfaceColor,
    '--surface-card': activeDesign.surfaceCard,
    '--surface-border': activeDesign.surfaceBorder,
    '--primary-color': activeDesign.primaryColor,
    '--text-primary': activeDesign.textPrimary,
    '--text-secondary': activeDesign.textSecondary,
    backgroundColor: activeDesign.bgType === 'color' ? activeDesign.bgColor : undefined,
    backgroundImage: activeDesign.bgType === 'gradient' ? activeDesign.bgGradient :
      activeDesign.bgType === 'image' && activeDesign.bgImage ? `url(${activeDesign.bgImage})` : undefined,
    backgroundSize: activeDesign.bgType === 'image' ? 'cover' : undefined,
    backgroundAttachment: activeDesign.bgType === 'image' ? 'fixed' : undefined,
    backgroundPosition: activeDesign.bgType === 'image' ? 'center' : undefined,
    minHeight: '100vh',
    fontFamily: activeDesign.fontFamily === 'outfit' ? "'Outfit', sans-serif" :
      activeDesign.fontFamily === 'poppins' ? "'Poppins', sans-serif" :
        activeDesign.fontFamily === 'serif' ? "'Playfair Display', Georgia, serif" :
          activeDesign.fontFamily === 'mono' ? "monospace" : "inherit"
  } as React.CSSProperties

  return (
    <div style={dynamicCssVariables} className={`app-root theme-${currentTheme}`}>
      {/* Toast Notification */}
      {toastMessage && <div className="toast-success">{toastMessage}</div>}

      {/* Custom Announcement Bar (Ala Canva Studio) */}
      {canvaDesign.showCustomAnnouncement && (
        <div className="custom-announcement-bar" style={{ background: canvaDesign.announcementBg, color: 'var(--text-primary)' }}>
          <span>📢</span>
          <span>{canvaDesign.customAnnouncementText}</span>
        </div>
      )}

      {/* Top Banner Sekolah & Tema Switcher */}
      <div className="ic-top-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, flexWrap: 'wrap' }}>
          <span>{storeIdentity.topBarLeft}</span>
          <span style={{ opacity: 0.5 }}>|</span>
          <span style={{ opacity: 0.9 }}>{storeIdentity.topBarRight}</span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.72rem',
            background: isCloudConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
            color: isCloudConnected ? '#34d399' : '#fbbf24',
            padding: '0.15rem 0.55rem',
            borderRadius: '999px',
            border: `1px solid ${isCloudConnected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
            marginLeft: '0.4rem'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isCloudConnected ? '#34d399' : '#fbbf24',
              boxShadow: isCloudConnected ? '0 0 6px #34d399' : 'none'
            }} />
            <span>{isCloudConnected ? '🟢 Cloud Supabase Realtime' : '🟡 Menghubungkan Cloud...'}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Tombol Pilihan Akses Masuk / Ganti Akun */}
          <button
            className="nav-tool-btn"
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', background: 'rgba(255, 255, 255, 0.12)', color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.25)' }}
            onClick={() => setIsWelcomeGatewayOpen(true)}
            title="Buka pilihan masuk akun murid, tamu, atau admin"
          >
            🚪 Ganti Akses / Masuk
          </button>

          {/* Quick Theme Dots */}
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.8, marginRight: '0.2rem' }}>Tema:</span>
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => handleApplyTheme(t.id)}
                title={t.name}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: t.color,
                  border: currentTheme === t.id ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  transform: currentTheme === t.id ? 'scale(1.2)' : 'scale(1)',
                  transition: 'all 0.2s'
                }}
              />
            ))}
            {/* Tombol Canva Studio untuk Pembeli (Perangkat Lokal) */}
            {viewRole === 'customer' && (
              <button
                className="nav-tool-btn"
                style={{
                  fontSize: '0.72rem',
                  padding: '0.22rem 0.55rem',
                  marginLeft: '0.35rem',
                  background: 'linear-gradient(135deg, rgba(244,63,94,0.35), rgba(124,58,237,0.35))',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'var(--text-primary)'
                }}
                onClick={() => setIsCustomerCanvaModalOpen(true)}
                title="Buka Canva Studio untuk ganti background, warna kartu & font di perangkat ini"
              >
                🎨 Studio Desain
              </button>
            )}
          </div>

          {/* Admin Switcher Button */}
          {viewRole === 'customer' ? (
            <button
              className="nav-tool-btn admin-lock-btn"
              onClick={() => setIsAdminPasswordModalOpen(true)}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
            >
              🔒 Portal Admin Resto
            </button>
          ) : (
            <button
              className="nav-tool-btn"
              onClick={() => setViewRole('customer')}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', background: 'var(--primary-color)', color: 'white' }}
            >
              🛍️ Pratinjau Murid
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          VIEW 1: CUSTOMER VIEW (MURID MAN IC TANAH LAUT)
          ========================================================================= */}
      {viewRole === 'customer' && (
        <div>
          {/* Main App Header */}
          <header className="main-app-header">
            <div className="brand-section" onClick={() => setCustomerTab('menu')}>
              <div className="brand-logo-alt">{storeIdentity.logoEmoji || '🍟'}</div>
              <div className="brand-text">
                <h1>{storeIdentity.brandName} <span>{storeIdentity.brandSuffix}</span></h1>
                <div className="brand-sub">{storeIdentity.brandSubtitle}</div>
              </div>
            </div>

            <div className="header-right-tools">
              {/* User Profile / Login Murid */}
              {currentUser ? (
                <div className="user-profile-badge" onClick={() => setIsAuthModalOpen(true)} title="Klik untuk lihat data akun / ganti akun">
                  <div className="user-profile-avatar">{currentUser.avatar || '🎓'}</div>
                  <div className="user-profile-text">
                    <div>{currentUser.name.split(' ')[0]}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{currentUser.kamar.split(' ')[0]}..</div>
                  </div>
                </div>
              ) : (
                <button className="nav-tool-btn" style={{ background: 'var(--primary-color)', color: 'white' }} onClick={() => setIsAuthModalOpen(true)}>
                  Masuk Akun Murid
                </button>
              )}

              {/* Navigation Tabs */}
              <button
                className={`nav-tool-btn ${customerTab === 'menu' ? 'active' : ''}`}
                onClick={() => setCustomerTab('menu')}
              >
                🍽️ Menu
              </button>

              <button
                className={`nav-tool-btn ${customerTab === 'history' ? 'active' : ''}`}
                onClick={() => setCustomerTab('history')}
              >
                📋 Riwayat
                {unpaidCount > 0 ? (
                  <span className="badge-counter" style={{ background: '#f59e0b' }}>{unpaidCount} Belum Bayar</span>
                ) : activeOrdersCount > 0 ? (
                  <span className="badge-counter">{activeOrdersCount}</span>
                ) : null}
              </button>

              <button
                className={`nav-tool-btn ${customerTab === 'reviews' ? 'active' : ''}`}
                onClick={() => setCustomerTab('reviews')}
              >
                ⭐ Ulasan ({reviews.length})
              </button>

              <button
                className={`nav-tool-btn ${customerTab === 'about' ? 'active' : ''}`}
                onClick={() => setCustomerTab('about')}
              >
                ℹ️ Tentang Kami
              </button>

              <button
                className={`nav-tool-btn ${customerTab === 'cart' ? 'active' : ''}`}
                onClick={() => setCustomerTab('cart')}
              >
                🛒 Keranjang
                {cartItemCount > 0 && <span className="badge-counter">{cartItemCount}</span>}
              </button>
            </div>
          </header>

          <div className="maximalist-outer-frame">
            {/* WING POSTER KIRI (Sisi Kiri Banner Poster Makanan - Mengisi Ruang Hitam) */}
            {customerTab === 'menu' && leftPosters.length > 0 && (
              <aside className="maximalist-side-wing wing-left">
                <div className="wing-header">
                  <span className="wing-pill-tag">🔥 PROMO POSTER</span>
                  <span className="wing-sub-title">Spesial Murid Asrama</span>
                </div>
                <div className="wing-posters-stack">
                  {leftPosters.map(poster => (
                    <div
                      key={poster.id}
                      className="food-poster-card"
                      onClick={() => handlePosterClick(poster)}
                      title={`Klik untuk lihat promo: ${poster.title}`}
                    >
                      <div className="poster-img-container">
                        <img src={poster.imageUrl} alt={poster.title} onError={e => { (e.target as any).style.display = 'none' }} />
                        <div className="poster-overlay-gradient"></div>
                        {poster.badgeText && (
                          <span className="poster-badge" style={{ backgroundColor: poster.badgeColor || '#f43f5e' }}>
                            {poster.badgeText}
                          </span>
                        )}
                        {poster.priceTag && (
                          <span className="poster-price-chip">{poster.priceTag}</span>
                        )}
                      </div>
                      <div className="poster-content">
                        <h4 className="poster-title">{poster.title}</h4>
                        <p className="poster-subtitle">{poster.subtitle}</p>
                        <button className="poster-action-btn">
                          + Pesan Promo
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
            )}

            {/* AREA UTAMA / CENTER BODY */}
            <div className="maximalist-center-body">
              {/* TAB 1: MENU MAKANAN */}
              {customerTab === 'menu' && (
                <div>
                  {/* HERO CONTAINER DENGAN KOTAK GAMBAR MAKANAN DI KIRI DAN KANAN (DIPERINTAHKAN USER) */}
                  <div className="hero-showcase-container">
                    {/* Kolom Kotak Gambar Kiri (Yang sebelumnya kosong) */}
                    {leftWidgets.length > 0 && (
                      <div className="hero-side-column float-anim-left">
                        {leftWidgets.map(widget => (
                          <div
                            key={widget.id}
                            className={`showcase-widget-card shape-${widget.shape}`}
                            onClick={() => {
                              const found = menus.find(m => m.name.toLowerCase().includes(widget.title.toLowerCase()))
                              if (found) {
                                setSelectedMenuForDetail(found)
                                setDetailQty(1)
                                setDetailSelectedVariants([])
                                setDetailNotes('')
                              }
                            }}
                          >
                            <div className="showcase-img-box">
                              <img src={widget.imageUrl} alt={widget.title} onError={e => { (e.target as any).style.display = 'none' }} />
                              {widget.priceTag && <span className="showcase-badge-pill">{widget.priceTag}</span>}
                            </div>
                            <div className="showcase-info-bar">
                              <div className="showcase-title-text">{widget.title}</div>
                              {widget.caption && <div className="showcase-sub-text">{widget.caption}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Alt Hero Banner Tengah (Bubble Ungu & Biru yang bisa diedit admin) */}
                    <div className="hero-center-main">
                      <div className="alt-hero-banner">
                        {/* Bubble / Sticker Tags (Bisa diedit & ditambah admin) */}
                        <div className="alt-hero-stickers">
                          {heroBadges.map(badge => (
                            <span
                              key={badge.id}
                              className="sticker-tag"
                              style={{ background: badge.bg, color: badge.textColor }}
                            >
                              {badge.text}
                            </span>
                          ))}
                        </div>

                        {/* Teks Judul & Deskripsi Hero (Bisa diedit admin) */}
                        <div className="alt-hero-content">
                          <h2>{storeIdentity.heroTitle}</h2>
                          <p>{storeIdentity.heroDescription}</p>
                        </div>

                        {/* 3 Keunggulan Asrama (Bisa diedit admin) */}
                        <div className="dormitory-callout">
                          {storeIdentity.heroFeatures.map((feat, idx) => (
                            <span key={idx}>{feat}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Kolom Kotak Gambar Kanan (Yang sebelumnya kosong) */}
                    {rightWidgets.length > 0 && (
                      <div className="hero-side-column float-anim-right">
                        {rightWidgets.map(widget => (
                          <div
                            key={widget.id}
                            className={`showcase-widget-card shape-${widget.shape}`}
                            onClick={() => {
                              const found = menus.find(m => m.name.toLowerCase().includes(widget.title.toLowerCase()))
                              if (found) {
                                setSelectedMenuForDetail(found)
                                setDetailQty(1)
                                setDetailSelectedVariants([])
                                setDetailNotes('')
                              }
                            }}
                          >
                            <div className="showcase-img-box">
                              <img src={widget.imageUrl} alt={widget.title} onError={e => { (e.target as any).style.display = 'none' }} />
                              {widget.priceTag && <span className="showcase-badge-pill">{widget.priceTag}</span>}
                            </div>
                            <div className="showcase-info-bar">
                              <div className="showcase-title-text">{widget.title}</div>
                              {widget.caption && <div className="showcase-sub-text">{widget.caption}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Live Order Tracker Bar untuk Pembeli */}
                  {(() => {
                    const activeOrder = orders.find(o => {
                      const isOwner = currentUser
                        ? o.customerName === currentUser.name
                        : o.id === localStorage.getItem('ic_last_order_id')
                      return isOwner && ['DITERIMA', 'DIMASAK', 'DIANTAR_KE_KAMAR'].includes(o.orderStatus)
                    })
                    if (!activeOrder) return null

                    const steps = [
                      { key: 'DITERIMA', label: 'Diterima Dapur', icon: '📝' },
                      { key: 'DIMASAK', label: 'Dimasak / Diracik', icon: '🍳' },
                      { key: 'DIANTAR_KE_KAMAR', label: 'Diantar ke Kamar', icon: '🛵' },
                      { key: 'SELESAI', label: 'Tiba / Selesai', icon: '✅' }
                    ]
                    const stepIndexMap: Record<string, number> = {
                      DITERIMA: 0,
                      DIMASAK: 1,
                      DIANTAR_KE_KAMAR: 2,
                      SELESAI: 3
                    }
                    const currentIdx = stepIndexMap[activeOrder.orderStatus] ?? 0

                    return (
                      <div
                        style={{
                          background: 'var(--surface-color)',
                          border: '2px solid var(--primary-color)',
                          borderRadius: '20px',
                          padding: '1.25rem 1.5rem',
                          marginBottom: '1.5rem',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ fontSize: '1.4rem' }}>⏳</span>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                                Live Tracking: Pesanan #{activeOrder.id}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {activeOrder.items.map(it => `${it.name} (${it.quantity}x)`).join(', ')} • Total Rp {activeOrder.total.toLocaleString('id-ID')}
                              </div>
                            </div>
                          </div>
                          <button
                            className="nav-tool-btn"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.8rem', background: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}
                            onClick={() => setCustomerTab('history')}
                          >
                            Lihat di Riwayat ➔
                          </button>
                        </div>

                        {/* Progress Stepper Bar */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', position: 'relative' }}>
                          {steps.map((st, idx) => {
                            const isPassed = idx <= currentIdx
                            const isCurrent = idx === currentIdx
                            return (
                              <div
                                key={st.key}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  textAlign: 'center',
                                  gap: '0.4rem',
                                  position: 'relative'
                                }}
                              >
                                <div
                                  style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.1rem',
                                    background: isCurrent
                                      ? 'var(--primary-color)'
                                      : isPassed
                                        ? 'rgba(16, 185, 129, 0.25)'
                                        : 'var(--surface-card)',
                                    color: isCurrent ? 'var(--text-primary)' : isPassed ? '#10b981' : 'var(--text-muted)',
                                    border: isCurrent
                                      ? '2px solid #ffffff'
                                      : isPassed
                                        ? '2px solid #10b981'
                                        : '2px dashed var(--surface-border)',
                                    boxShadow: isCurrent ? '0 0 12px var(--primary-color)' : 'none',
                                    transition: 'all 0.3s'
                                  }}
                                >
                                  {isPassed && !isCurrent ? '✓' : st.icon}
                                </div>
                                <div style={{
                                  fontSize: '0.78rem',
                                  fontWeight: isCurrent ? 800 : 600,
                                  color: isCurrent ? 'var(--primary-color)' : isPassed ? 'var(--text-primary)' : 'var(--text-muted)'
                                }}>
                                  {st.label}
                                </div>
                                {isCurrent && (
                                  <span style={{
                                    fontSize: '0.68rem',
                                    background: 'var(--primary-color)',
                                    color: 'var(--text-primary)',
                                    padding: '0.1rem 0.45rem',
                                    borderRadius: '999px',
                                    fontWeight: 700
                                  }}>
                                    Sedang Proses
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Banner Pengingat Bayar Offline (Kotak Kuning/Oranye yang bisa diedit admin) */}
                  <div className="offline-notice-box">
                    <span style={{ fontSize: '1.4rem' }}>{storeIdentity.noticeEmoji || '💡'}</span>
                    <div>
                      <strong>{storeIdentity.noticeTitle}</strong>
                      <div>{storeIdentity.noticeDescription}</div>
                    </div>
                  </div>

                  {/* Toolbar Search & Kategori */}
                  <div className="catalog-toolbar">
                    <div className="search-field-box">
                      <span className="search-field-icon">🔍</span>
                      <input
                        type="text"
                        placeholder="Cari makanan & minuman favorit murid (cth: Mie Nyemek, Nasi Goreng, Kopi Susu)..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                    </div>

                    <div className="category-chips-list">
                      {['Semua', ...categories].map(cat => (
                        <button
                          key={cat}
                          className={`cat-chip ${selectedCategory === cat ? 'active' : ''}`}
                          onClick={() => setSelectedCategory(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grid Menu Makanan */}
                  {filteredMenus.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: 'var(--surface-color)', borderRadius: '24px', border: '1px solid var(--surface-border)', margin: '1rem 0' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '0.8rem' }}>🍽️</div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Belum Ada Menu yang Ditambahkan</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '480px', margin: '0.5rem auto 1.5rem', lineHeight: 1.5 }}>
                        Kantin saat ini masih bersih & kosong. Admin dapat menambahkan hidangan makanan, foto, dan harga melalui Portal Admin.
                      </p>
                      <button className="item-order-btn" style={{ margin: '0 auto' }} onClick={() => setIsAdminPasswordModalOpen(true)}>
                        🔒 Buka Portal Admin untuk Tambah Menu
                      </button>
                    </div>
                  ) : (
                    <div className="menu-grid-alt">
                      {filteredMenus.map(item => (
                        <div
                          key={item.id}
                          className="menu-card-item"
                          onClick={() => {
                            setSelectedMenuForDetail(item)
                            setDetailQty(1)
                            setDetailSelectedVariants([])
                            setDetailNotes('')
                          }}
                        >
                          <div className="card-img-wrapper">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} onError={(e) => { (e.target as any).style.display = 'none' }} />
                            ) : (
                              <span className="card-img-fallback-emoji">{item.icon}</span>
                            )}
                            <span className="card-cat-badge">{item.category}</span>
                            <span className="card-rating-badge">
                              ⭐ {item.rating.toFixed(1)} <small style={{ opacity: 0.8 }}>({item.reviewCount})</small>
                            </span>
                          </div>

                          <div className="card-body-content">
                            <div className="menu-item-title">{item.name}</div>
                            <div className="menu-item-desc">{item.description}</div>

                            <div className="card-footer-action">
                              <div className="item-price-text">{formatRupiah(item.price)}</div>
                              <button
                                className="item-order-btn"
                                disabled={item.stock <= 0}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedMenuForDetail(item)
                                  setDetailQty(1)
                                  setDetailSelectedVariants([])
                                  setDetailNotes('')
                                }}
                              >
                                + Pesan
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: RIWAYAT PEMESANAN & STATUS TRACKER */}
              {customerTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.6rem', fontWeight: 900 }}>📋 Riwayat Pesanan Murid</h2>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                        Pantau proses makanan & status pembayaran langsung (COD di Asrama).
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface-color)', padding: '0.35rem', borderRadius: '12px' }}>
                      <button
                        className={`cat-chip ${historyFilter === 'all' ? 'active' : ''}`}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => setHistoryFilter('all')}
                      >
                        Semua ({customerOrders.length})
                      </button>
                      <button
                        className={`cat-chip ${historyFilter === 'unpaid' ? 'active' : ''}`}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: unpaidCount > 0 ? '#f59e0b' : 'inherit' }}
                        onClick={() => setHistoryFilter('unpaid')}
                      >
                        ⚠️ Belum Bayar ({unpaidCount})
                      </button>
                      <button
                        className={`cat-chip ${historyFilter === 'active' ? 'active' : ''}`}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => setHistoryFilter('active')}
                      >
                        Sedang Diantar ({activeOrdersCount})
                      </button>
                      <button
                        className={`cat-chip ${historyFilter === 'completed' ? 'active' : ''}`}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => setHistoryFilter('completed')}
                      >
                        Selesai
                      </button>
                    </div>
                  </div>

                  {filteredOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'var(--surface-color)', borderRadius: '24px' }}>
                      <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📦</div>
                      <h3>Belum ada pesanan dalam kategori ini</h3>
                      <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>Yuk lihat menu makanan asrama dan pesan ke kamarmu!</p>
                      <button className="item-order-btn" style={{ margin: '0 auto' }} onClick={() => setCustomerTab('menu')}>
                        Buka Menu Makanan
                      </button>
                    </div>
                  ) : (
                    filteredOrders.map(order => {
                      let stepIndex = 1
                      if (order.orderStatus === 'DIMASAK') stepIndex = 2
                      if (order.orderStatus === 'DIANTAR_KE_KAMAR') stepIndex = 3
                      if (order.orderStatus === 'SELESAI') stepIndex = 4

                      return (
                        <div key={order.id} className="order-history-card">
                          <div className="order-history-top">
                            <div className="order-id-group">
                              <h4>Pesanan #{order.id}</h4><div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--primary-color)", marginTop: "0.2rem" }}>{order.customerName}</div><div className="order-date">📅 {new Date(order.createdAt).toLocaleString("id-ID", { weekday: "long", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>{(() => { const startMs = new Date(order.createdAt).getTime(); const endMs = (order as any).completedAt ? new Date((order as any).completedAt).getTime() : (order.orderStatus === "SELESAI" ? startMs : nowTick); const diffSec = Math.max(0, Math.floor((endMs - startMs) / 1000)); const mins = String(Math.floor(diffSec / 60)).padStart(2, "0"); const secs = String(diffSec % 60).padStart(2, "0"); return (<div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginTop: "0.45rem" }}><span style={{ padding: "0.25rem 0.65rem", borderRadius: "999px", fontSize: "0.76rem", fontWeight: 800, background: order.orderStatus === "SELESAI" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)", color: order.orderStatus === "SELESAI" ? "#10b981" : "#f59e0b" }}>{order.orderStatus === "SELESAI" ? `✅ Selesai dalam ${mins} mnt ${secs} dtk` : `⏱️ Berjalan: ${mins} mnt ${secs} dtk`}</span>{order.orderStatus !== "SELESAI" && order.orderStatus !== "DIBATALKAN" && (<button onClick={() => { const updated = orders.map(o => o.id === order.id ? { ...o, orderStatus: "SELESAI" as const, completedAt: new Date().toISOString() } : o); setOrders(updated); localStorage.setItem("ic_orders", JSON.stringify(updated)); updateOrderStatusInDb(order.id, "SELESAI"); }} style={{ padding: "0.25rem 0.7rem", borderRadius: "999px", border: "none", background: "#10b981", color: "#fff", fontSize: "0.75rem", fontWeight: 800, cursor: "pointer" }}>✓ Pesanan Selesai</button>)}</div>); })()}
                            </div>

                            {/* Payment & Status Badges */}
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              {order.orderStatus === 'DIBATALKAN' ? (
                                <span className="status-pill status-cancelled">
                                  ❌ PESANAN DIBATALKAN
                                </span>
                              ) : (
                                <>
                                  {order.paymentStatus === 'UNPAID' ? (
                                    <span className="payment-badge-unpaid">
                                      ⚠️ BELUM BAYAR (Ketemuan Langsung)
                                    </span>
                                  ) : (
                                    <span className="payment-badge-paid">
                                      ✅ LUNAS (Uang Diterima)
                                    </span>
                                  )}

                                  <span className={`status-pill ${order.orderStatus === 'DIMASAK' ? 'status-preparing' :
                                    order.orderStatus === 'DIANTAR_KE_KAMAR' ? 'status-delivering' :
                                      order.orderStatus === 'SELESAI' ? 'status-completed' : 'status-pending'
                                    }`}>
                                    {order.orderStatus === 'DIMASAK' ? '🍳 Sedang Dimasak' :
                                      order.orderStatus === 'DIANTAR_KE_KAMAR' ? '🛵 Menuju Asrama' :
                                        order.orderStatus === 'SELESAI' ? '✅ Selesai Diterima' : '🕒 Diterima Kantin'}
                                  </span>
                                </>
                              )}

                              {/* Tombol Batal Pesanan bagi Murid (jika status masih Diterima atau Belum Bayar) */}
                              {order.orderStatus === 'DITERIMA' && order.paymentStatus === 'UNPAID' && (
                                <button
                                  className="btn-danger"
                                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                  onClick={() => handleCancelOrder(order.id)}
                                >
                                  ✕ Batal Pesanan
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Order Tracker Step Bar */}
                          {order.orderStatus !== 'DIBATALKAN' && (
                            <div className="order-tracker-bar">
                              <div className={`tracker-node ${stepIndex >= 1 ? 'done' : ''} ${stepIndex === 1 ? 'active' : ''}`}>
                                <div className="node-circle">1</div>
                                <span className="node-label">Diterima</span>
                              </div>
                              <div className={`tracker-node ${stepIndex >= 2 ? 'done' : ''} ${stepIndex === 2 ? 'active' : ''}`}>
                                <div className="node-circle">2</div>
                                <span className="node-label">Dimasak</span>
                              </div>
                              <div className={`tracker-node ${stepIndex >= 3 ? 'done' : ''} ${stepIndex === 3 ? 'active' : ''}`}>
                                <div className="node-circle">3</div>
                                <span className="node-label">Diantar ke Kamar</span>
                              </div>
                              <div className={`tracker-node ${stepIndex >= 4 ? 'done' : ''} ${stepIndex === 4 ? 'active' : ''}`}>
                                <div className="node-circle">4</div>
                                <span className="node-label">Selesai / Tiba</span>
                              </div>
                            </div>
                          )}

                          {/* Notifikasi Tagihan Belum Bayar */}
                          {order.paymentStatus === 'UNPAID' && order.orderStatus !== 'DIBATALKAN' && (
                            <div className="cod-alert-banner">
                              <span style={{ fontSize: '1.2rem' }}>💵</span>
                              <div>
                                <strong>Tagihan Belum Dibayar:</strong> Siapkan uang pas sebesar <strong>{formatRupiah(order.total)}</strong> saat kurir/teman tiba di <strong>{order.customerKamar}</strong>.
                              </div>
                            </div>
                          )}

                          {/* Items */}
                          <div className="history-items-list">
                            {order.items.map((it, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <strong>{it.quantity}x {it.name}</strong>
                                  {it.variants && it.variants.length > 0 && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      + {it.variants.map(v => v.name).join(', ')}
                                    </div>
                                  )}
                                  {it.notes && (
                                    <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                      Catatan: "{it.notes}"
                                    </div>
                                  )}
                                </div>
                                <span style={{ fontWeight: 700 }}>{formatRupiah(it.price * it.quantity)}</span>
                              </div>
                            ))}
                          </div>

                          {/* Footer Meta */}
                          <div className="history-bottom-meta">
                            <div style={{ fontSize: '0.85rem' }}>
                              <div>📍 <strong>Tujuan:</strong> {order.customerKamar} ({order.customerName} - {order.customerKelas})</div>
                              <div>💳 <strong>Metode:</strong> {order.paymentMethod}</div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Tagihan:</span>
                              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--primary-color)' }}>
                                {formatRupiah(order.total)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* TAB 3: TENTANG KAMI LENGKAP & TIM PENGEMBANG */}
              {customerTab === 'about' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {/* Hero Card Tentang Kami */}
                  <div style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '24px', padding: '2.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🏫</div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.75rem' }}>{aboutData.title}</h1>
                    <p style={{ maxWidth: '820px', margin: '0 auto', fontSize: '1.05rem', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
                      {aboutData.history}
                    </p>
                    {aboutData.visionMission && (
                      <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'var(--surface-card)', borderRadius: '16px', maxWidth: '780px', margin: '1.5rem auto 0', border: '1px solid var(--surface-border)' }}>
                        <div style={{ fontWeight: 800, color: 'var(--primary-color)', marginBottom: '0.35rem' }}>🎯 Visi & Misi Kami:</div>
                        <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{aboutData.visionMission}</div>
                      </div>
                    )}
                  </div>

                  {/* Video & Galeri Suasana */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {/* Video Embed */}
                    <div style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '20px', padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem' }}>🎥 Video Profil & Suasana Asrama</h3>
                      <div style={{ width: '100%', height: '220px', borderRadius: '14px', overflow: 'hidden', background: '#000000' }}>
                        {aboutData.videoUrl.startsWith('data:video') ? (
                          <video src={aboutData.videoUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <iframe
                            src={aboutData.videoUrl}
                            title="Video Profil"
                            style={{ width: '100%', height: '100%', border: 'none' }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        )}
                      </div>
                    </div>

                    {/* Galeri Foto */}
                    <div style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '20px', padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem' }}>📸 Galeri Kebersamaan Asrama</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                        {aboutData.galleryImages.map((imgUrl, i) => (
                          <div key={i} style={{ height: '105px', borderRadius: '12px', overflow: 'hidden', background: 'var(--surface-card)' }}>
                            <img src={imgUrl} alt={`Galeri ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Tim Pengembang Aplikasi (Identitas, Foto, Role, Kelas) */}
                  <div style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '24px', padding: '2rem' }}>
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>👥 Tim Pengembang Murid IC Tala</h2>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Aplikasi ini dirancang dan dikembangkan secara mandiri oleh murid MAN Insan Cendekia Tanah Laut
                      </p>
                    </div>

                    <div className="team-members-grid">
                      {aboutData.team.map(member => (
                        <div key={member.id} className="team-member-card">
                          <div className="team-avatar-frame">
                            {member.avatarUrl ? (
                              <img src={member.avatarUrl} alt={member.name} onError={e => { (e.target as any).style.display = 'none' }} />
                            ) : (
                              '🎓'
                            )}
                          </div>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.2rem' }}>{member.name}</h4>
                          <div style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 700 }}>{member.kelas}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.2rem' }}>{member.role}</div>
                          {member.bio && (
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.6rem', lineHeight: '1.4' }}>
                              "{member.bio}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hubungi Kami Dinamis (Semua Platform Medsos yang Ditambah Admin) */}
                  <div style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '24px', padding: '2rem', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '0.5rem' }}>📞 Hubungi Kami & Media Sosial</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      Punya pertanyaan seputar pesanan atau ingin memberi saran? Hubungi kontak kami di bawah:
                    </p>

                    <div className="social-chips-grid" style={{ justifyContent: 'center' }}>
                      {aboutData.socials.map(soc => (
                        <a
                          key={soc.id}
                          href={soc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="social-chip-item"
                          style={{ backgroundColor: soc.badgeColor }}
                        >
                          <span style={{ fontSize: '1.2rem' }}>{soc.iconEmoji}</span>
                          <span>{soc.platformName}: {soc.handle}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB KHUSUS: ULASAN & REVIEW MAKANAN DARI MURID */}
              {customerTab === 'reviews' && (
                <div>
                  <div style={{ background: 'var(--surface-color)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--surface-border)', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <h2 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0 }}>⭐ Ulasan & Kepuasan Murid</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0.35rem 0 0 0' }}>
                          Rating dan komentar transparan ala Google Maps dari santri/santriwati asrama MAN Insan Cendekia Tanah Laut.
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-card)', padding: '0.75rem 1.25rem', borderRadius: '18px', border: '1px solid var(--surface-border)' }}>
                        <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>
                          {reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '5.0'}
                        </div>
                        <div>
                          <div style={{ color: '#f59e0b', fontSize: '1rem', letterSpacing: '1px' }}>
                            {'★'.repeat(5)}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {reviews.length} Ulasan Terverifikasi
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {reviews.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 1.5rem', background: 'var(--surface-color)', borderRadius: '24px', border: '1px solid var(--surface-border)' }}>
                      <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>💬</div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Belum Ada Ulasan</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '450px', margin: '0.5rem auto 1.5rem' }}>
                        Jadilah yang pertama mencoba makanan kantin dan berikan rating bintang 5 setelah pesananmu selesai!
                      </p>
                      <button className="btn-primary" onClick={() => setCustomerTab('menu')}>
                        🍱 Lihat Menu & Pesan Sekarang
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                      {reviews.map(rev => {
                        const targetMenu = menus.find(m => m.id === rev.menuId)
                        return (
                          <div
                            key={rev.id}
                            style={{
                              background: 'var(--surface-color)',
                              border: '1px solid var(--surface-border)',
                              borderRadius: '20px',
                              padding: '1.25rem',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
                            }}
                          >
                            <div>
                              {/* Header Pengulas & Target Menu */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                  <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    background: 'var(--surface-card)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.1rem',
                                    border: '1px solid var(--surface-border)'
                                  }}>
                                    🎓
                                  </div>
                                  <div>
                                    <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)', display: 'block' }}>{rev.customerName}</strong>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                      {rev.customerKelas ? `${rev.customerKelas} • ` : ''}{rev.customerKamar || 'Asrama'}
                                    </span>
                                  </div>
                                </div>

                                <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <span>⭐</span>
                                  <span>{rev.rating.toFixed(1)}</span>
                                </div>
                              </div>

                              {/* Target Menu Badge */}
                              {targetMenu && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--surface-card)', padding: '0.25rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-primary)', marginBottom: '0.75rem', border: '1px solid var(--surface-border)' }}>
                                  <span>{targetMenu.icon || '🍲'}</span>
                                  <span style={{ fontWeight: 700 }}>{targetMenu.name}</span>
                                </div>
                              )}

                              {/* Isi Komentar */}
                              <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: '0 0 0.75rem 0' }}>
                                "{rev.comment}"
                              </p>
                            </div>

                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid var(--surface-border)', paddingTop: '0.6rem' }}>
                              🕒 {new Date(rev.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WITA
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: KERANJANG BELANJA */}
              {customerTab === 'cart' && (
                <div>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '1.25rem' }}>🛒 Keranjang Pesanan Asrama</h2>

                  {cart.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'var(--surface-color)', borderRadius: '24px' }}>
                      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛒</div>
                      <h3>Keranjang masih kosong</h3>
                      <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>Pilih makanan lezat favoritmu sekarang!</p>
                      <button className="item-order-btn" style={{ margin: '0 auto' }} onClick={() => setCustomerTab('menu')}>
                        Lihat Daftar Menu
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {cart.map(c => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '16px' }}>
                            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                              <div style={{ fontSize: '2rem' }}>{c.menuItem.icon}</div>
                              <div>
                                <strong style={{ fontSize: '1rem' }}>{c.menuItem.name}</strong>
                                {c.selectedVariants.length > 0 && (
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    + {c.selectedVariants.map(v => v.name).join(', ')}
                                  </div>
                                )}
                                {c.notes && (
                                  <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                    Catatan: "{c.notes}"
                                  </div>
                                )}
                                <div style={{ color: 'var(--primary-color)', fontWeight: 800, marginTop: '0.2rem' }}>
                                  {formatRupiah(c.itemTotal)}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-card)', borderRadius: '10px' }}>
                                <button
                                  style={{ background: 'transparent', border: 'none', color: 'inherit', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '1rem' }}
                                  onClick={() => {
                                    setCart(cart.map(it => it.id === c.id ? { ...it, quantity: Math.max(1, it.quantity - 1), itemTotal: (it.itemTotal / it.quantity) * Math.max(1, it.quantity - 1) } : it))
                                  }}
                                >
                                  -
                                </button>
                                <span style={{ fontWeight: 800, minWidth: '24px', textAlign: 'center' }}>{c.quantity}</span>
                                <button
                                  style={{ background: 'transparent', border: 'none', color: 'inherit', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '1rem' }}
                                  onClick={() => {
                                    setCart(cart.map(it => it.id === c.id ? { ...it, quantity: it.quantity + 1, itemTotal: (it.itemTotal / it.quantity) * (it.quantity + 1) } : it))
                                  }}
                                >
                                  +
                                </button>
                              </div>
                              <button
                                className="btn-danger"
                                onClick={() => setCart(cart.filter(it => it.id !== c.id))}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Ringkasan Checkout Murid */}
                      <div style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '20px', padding: '1.5rem', height: 'fit-content' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem' }}>Ringkasan Pesanan Antar Asrama</h3>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                          <span>Subtotal ({cartItemCount} item)</span>
                          <strong>{formatRupiah(cartSubtotal)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                          <span>Antar ke Kamar Asrama</span>
                          <strong style={{ color: 'var(--accent-green)' }}>GRATIS (Murid IC Tala)</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                          <span>Metode Pembayaran</span>
                          <strong style={{ color: 'var(--accent-yellow)' }}>💵 Ketemuan Langsung (COD)</strong>
                        </div>

                        <div style={{ height: '1px', background: 'var(--surface-border)', margin: '1rem 0' }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>Total Pembayaran:</span>
                          <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary-color)' }}>
                            {formatRupiah(cartTotalPrice)}
                          </span>
                        </div>

                        {currentUser ? (
                          <div style={{ background: 'var(--surface-card)', padding: '0.85rem 1rem', borderRadius: '12px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                            <div>📍 <strong>Tujuan Antar:</strong> {currentUser.kamar}</div>
                            <div>👤 <strong>Pemesan:</strong> {currentUser.name} ({currentUser.kelas} - {currentUser.angkatan})</div>
                            <div>📞 <strong>Kontak:</strong> {currentUser.phone}</div>
                          </div>
                        ) : (
                          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.85rem 1rem', borderRadius: '12px', marginBottom: '1.25rem', color: '#f87171' }}>
                            ⚠️ Anda belum login! Harap masuk dengan akun murid untuk memesan.
                          </div>
                        )}

                        <button
                          className="item-order-btn"
                          style={{ width: '100%', padding: '1rem', justifyContent: 'center', fontSize: '1.05rem' }}
                          onClick={handleConfirmOrder}
                        >
                          🚀 Pesan Sekarang (Bayar Offline Saat Ketemuan)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* WING POSTER KANAN (Sisi Kanan Banner Poster Makanan - Mengisi Ruang Hitam) */}
            {customerTab === 'menu' && rightPosters.length > 0 && (
              <aside className="maximalist-side-wing wing-right">
                <div className="wing-header">
                  <span className="wing-pill-tag" style={{ background: 'linear-gradient(90deg, #7c3aed, #a855f7)' }}>⚡ DESSERT & FLASH DEAL</span>
                  <span className="wing-sub-title">Menu Favorit Belajar</span>
                </div>
                <div className="wing-posters-stack">
                  {rightPosters.map(poster => (
                    <div
                      key={poster.id}
                      className="food-poster-card"
                      onClick={() => handlePosterClick(poster)}
                      title={`Klik untuk lihat promo: ${poster.title}`}
                    >
                      <div className="poster-img-container">
                        <img src={poster.imageUrl} alt={poster.title} onError={e => { (e.target as any).style.display = 'none' }} />
                        <div className="poster-overlay-gradient"></div>
                        {poster.badgeText && (
                          <span className="poster-badge" style={{ backgroundColor: poster.badgeColor || '#7c3aed' }}>
                            {poster.badgeText}
                          </span>
                        )}
                        {poster.priceTag && (
                          <span className="poster-price-chip">{poster.priceTag}</span>
                        )}
                      </div>
                      <div className="poster-content">
                        <h4 className="poster-title">{poster.title}</h4>
                        <p className="poster-subtitle">{poster.subtitle}</p>
                        <button className="poster-action-btn" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                          + Pesan Promo
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
            )}
          </div>

          {/* Bottom Mobile Navigation */}
          <nav className="alt-mobile-nav">
            <button className={`alt-nav-item ${customerTab === 'menu' ? 'active' : ''}`} onClick={() => setCustomerTab('menu')}>
              <span style={{ fontSize: '1.3rem' }}>🍽️</span>
              <span>Menu</span>
            </button>
            <button className={`alt-nav-item ${customerTab === 'history' ? 'active' : ''}`} onClick={() => setCustomerTab('history')}>
              <span style={{ fontSize: '1.3rem' }}>📋</span>
              <span>Riwayat</span>
              {unpaidCount > 0 && <span className="badge-counter" style={{ position: 'absolute', top: '4px', right: '20%' }}>{unpaidCount}</span>}
            </button>
            <button className={`alt-nav-item ${customerTab === 'reviews' ? 'active' : ''}`} onClick={() => setCustomerTab('reviews')}>
              <span style={{ fontSize: '1.3rem' }}>⭐</span>
              <span>Ulasan</span>
            </button>
            <button className={`alt-nav-item ${customerTab === 'about' ? 'active' : ''}`} onClick={() => setCustomerTab('about')}>
              <span style={{ fontSize: '1.3rem' }}>ℹ️</span>
              <span>Tentang</span>
            </button>
            <button className={`alt-nav-item ${customerTab === 'cart' ? 'active' : ''}`} onClick={() => setCustomerTab('cart')}>
              <span style={{ fontSize: '1.3rem' }}>🛒</span>
              <span>Keranjang</span>
              {cartItemCount > 0 && <span className="badge-counter" style={{ position: 'absolute', top: '4px', right: '20%' }}>{cartItemCount}</span>}
            </button>
          </nav>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: ADMIN RESTO & CMS STUDIO (PASSWORD PROTECTED & CONTROL EVERYTHING)
          ========================================================================= */}
      {viewRole === 'admin' && (
        <div className="dashboard-layout">
          {/* Sidebar Admin */}
          <aside className="sidebar">
            <div className="brand">
              <span className="brand-icon">{storeIdentity.logoEmoji || '🏫'}</span>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>Admin {storeIdentity.brandName}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>MAN IC Tanah Laut</div>
              </div>
            </div>

            <ul className="nav-links">
              {[
                { name: 'Dashboard', icon: '📊' },
                { name: 'Orders', icon: '📦' },
                { name: 'Menu Items', icon: '🍽️' },
                { name: 'Kelola Kategori', icon: '🏷️' },
                { name: 'Kotak Gambar & Showcase', icon: '🖼️' },
                { name: 'Banner Poster Samping (Maximalism)', icon: '🎨' },
                { name: 'Ulasan Murid', icon: '⭐' },
                { name: 'Daftar Pengguna', icon: '👥' },
                { name: 'Kelola Tentang Kami & Tim', icon: 'ℹ️' },
                { name: 'Studio Desain (Ala Canva)', icon: '✨' },
                { name: 'Pengaturan Toko & Teks Hero', icon: '⚙️' }
              ].map(tab => (
                <li
                  key={tab.name}
                  className={`nav-item admin-interactive-box ${adminTab === tab.name ? 'active is-selected' : ''}`}
                  onClick={() => {
                    setAdminTab(tab.name)
                    setSelectedAdminBoxId('tab_' + tab.name)
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                  {tab.name === 'Orders' && unpaidCount > 0 && (
                    <span className="badge-counter" style={{ marginLeft: 'auto', background: '#f59e0b' }}>{unpaidCount}</span>
                  )}
                </li>
              ))}
            </ul>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button className="nav-tool-btn admin-interactive-box" style={{ width: '100%' }} onClick={() => setViewRole('customer')}>
                🛍️ Pratinjau Murid
              </button>
              <button className="nav-tool-btn admin-interactive-box" style={{ width: '100%', background: '#ef4444', color: 'white' }} onClick={handleAdminLogout}>
                🔒 Kunci & Keluar Admin
              </button>
            </div>
          </aside>

          {/* Main Content Admin */}
          <main className="main-content">
            <div className="header">
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900 }}>{adminTab}</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Kontrol penuh seluruh aspek, tampilan, identitas, dan data kantin asrama MAN IC Tanah Laut.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="nav-tool-btn admin-interactive-box"
                  style={{ background: 'linear-gradient(135deg, #0284c7, #2563eb)', color: 'white', fontWeight: 800 }}
                  onClick={() => {
                    handleExportSyncData()
                    setIsSyncModalOpen(true)
                  }}
                  title="Sinkronkan data menu & poster dengan laptop teman"
                >
                  🌐 Sinkronisasi & Berbagi Menu
                </button>

                {adminTab === 'Menu Items' && (
                  <button
                    className="item-order-btn admin-interactive-box"
                    onClick={() => {
                      setAdminEditingId(null)
                      setAdminMenuForm({ name: '', price: '', category: categories[0] || 'Makanan Berat', icon: '🍲', imageUrl: '', description: '', stock: '40' })
                      setAdminFormVariants([])
                      setIsAdminAddModalOpen(true)
                    }}
                  >
                    + Tambah Menu & Upload Foto
                  </button>
                )}

                {adminTab === 'Kotak Gambar & Showcase' && (
                  <button
                    className="item-order-btn admin-interactive-box"
                    onClick={() => {
                      setEditingWidgetId(null)
                      setWidgetForm({
                        id: '',
                        title: '',
                        priceTag: '',
                        imageUrl: '',
                        shape: 'rounded',
                        caption: '',
                        position: 'left'
                      })
                      setIsWidgetModalOpen(true)
                    }}
                  >
                    + Tambah Kotak Gambar Baru
                  </button>
                )}

                {adminTab === 'Banner Poster Samping (Maximalism)' && (
                  <button
                    className="item-order-btn admin-interactive-box"
                    onClick={() => {
                      setEditingPosterId(null)
                      setPosterForm({
                        id: '',
                        title: '',
                        subtitle: '',
                        badgeText: 'HOT PROMO 🔥',
                        badgeColor: '#f43f5e',
                        priceTag: 'Rp 20.000',
                        imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
                        position: 'left',
                        targetMenuName: menus[0]?.name || '',
                        accentColor: '#f43f5e',
                        isActive: true
                      })
                      setIsPosterModalOpen(true)
                    }}
                  >
                    + Tambah Banner Poster Baru
                  </button>
                )}
              </div>
            </div>

            {/* TAB ADMIN 1: DASHBOARD */}
            {adminTab === 'Dashboard' && (
              <div>
                <div className="stats-grid">
                  <div
                    className={`stat-card admin-interactive-box ${selectedAdminBoxId === 'stat-unpaid' ? 'is-selected' : ''}`}
                    onClick={() => setSelectedAdminBoxId('stat-unpaid')}
                  >
                    <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>⚠️</div>
                    <div className="stat-info">
                      <h3>Pesanan Belum Bayar</h3>
                      <div className="stat-value" style={{ color: '#f59e0b' }}>{unpaidCount} Murid</div>
                    </div>
                  </div>

                  <div
                    className={`stat-card admin-interactive-box ${selectedAdminBoxId === 'stat-sales' ? 'is-selected' : ''}`}
                    onClick={() => setSelectedAdminBoxId('stat-sales')}
                  >
                    <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>💰</div>
                    <div className="stat-info">
                      <h3>Total Penjualan</h3><button onClick={() => { const rows = [["ID Pesanan","Waktu","Pemesan","Kelas/Kamar","Detail Menu","Total","Metode","Status Bayar","Status Pesanan"], ...(orders || []).map((o: any) => [o.id, `"${new Date(o.createdAt).toLocaleString("id-ID")}"`, `"${(o.customerName || "").replace(/"/g, "'")}"`, `"${o.customerKelas || ""} ${o.customerKamar || ""}"`, `"${(o.items || []).map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}"`, o.total || 0, `"${o.paymentMethod || ""}"`, o.paymentStatus || "", o.orderStatus || ""])]; const blob = new Blob(["\uFEFF" + rows.map(r => r.join(",")).join("\n")], { type: "text/csv;charset=utf-8;" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "laporan-omzet-bazar.csv"; a.click(); }} style={{ marginTop: "0.5rem", marginBottom: "0.35rem", padding: "0.45rem 0.85rem", borderRadius: "8px", border: "1px solid var(--surface-border)", background: "var(--primary-color)", color: "#fff", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}>📥 Unduh Laporan Omzet (.csv)</button>
                      <div className="stat-value">{formatRupiah(orders.filter(o => o.orderStatus !== 'DIBATALKAN').reduce((s, o) => s + o.total, 0))}</div>
                    </div>
                  </div>

                  <div
                    className={`stat-card admin-interactive-box ${selectedAdminBoxId === 'stat-delivery' ? 'is-selected' : ''}`}
                    onClick={() => setSelectedAdminBoxId('stat-delivery')}
                  >
                    <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>🛵</div>
                    <div className="stat-info">
                      <h3>Pesanan Diantar</h3>
                      <div className="stat-value">{activeOrdersCount} Kamar</div>
                    </div>
                  </div>

                  <div
                    className={`stat-card admin-interactive-box ${selectedAdminBoxId === 'stat-reviews' ? 'is-selected' : ''}`}
                    onClick={() => setSelectedAdminBoxId('stat-reviews')}
                  >
                    <div className="stat-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>⭐</div>
                    <div className="stat-info">
                      <h3>Total Ulasan</h3>
                      <div className="stat-value">{reviews.length} Ulasan</div>
                    </div>
                  </div>
                </div>

                {/* Pesanan Terbaru */}
                <div className="table-card">
                  <div className="table-header-row">
                    <h3>⚡ Pesanan Antar Asrama Terbaru</h3>
                  </div>

                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Murid & Kamar</th>
                        <th>Menu</th>
                        <th>Total</th>
                        <th>Status Bayar (COD)</th>
                        <th>Status Antar</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id}>
                          <td><strong>#{o.id}</strong></td>
                          <td>
                            <strong>{o.customerName}</strong> ({o.customerKelas})
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>📍 {o.customerKamar}</div>
                          </td>
                          <td>{o.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}</td>
                          <td><strong>{formatRupiah(o.total)}</strong></td>
                          <td>
                            {o.paymentStatus === 'UNPAID' ? (
                              <button
                                className="payment-badge-unpaid"
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleTogglePaymentStatus(o.id, o.paymentStatus)}
                                title="Klik untuk tandai sudah lunas"
                              >
                                ⚠️ BELUM BAYAR (Klik Lunas)
                              </button>
                            ) : (
                              <button
                                className="payment-badge-paid"
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleTogglePaymentStatus(o.id, o.paymentStatus)}
                                title="Klik untuk batalkan lunas"
                              >
                                ✅ SUDAH LUNAS
                              </button>
                            )}
                          </td>
                          <td>
                            <span className={`status-pill ${o.orderStatus === 'DIMASAK' ? 'status-preparing' :
                              o.orderStatus === 'DIANTAR_KE_KAMAR' ? 'status-delivering' :
                                o.orderStatus === 'SELESAI' ? 'status-completed' :
                                  o.orderStatus === 'DIBATALKAN' ? 'status-cancelled' : 'status-pending'
                              }`}>
                              {o.orderStatus}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <select
                                style={{ background: 'var(--surface-card)', color: 'inherit', border: '1px solid var(--surface-border)', borderRadius: '6px', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                                value={o.orderStatus}
                                onChange={e => handleAdminUpdateOrderStatus(o.id, e.target.value as any)}
                              >
                                <option value="DITERIMA">Diterima</option>
                                <option value="DIMASAK">Dimasak</option>
                                <option value="DIANTAR_KE_KAMAR">Diantar ke Kamar</option>
                                <option value="SELESAI">Selesai</option>
                                <option value="DIBATALKAN">Batalkan Pesanan</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB ADMIN 2: ORDERS (KELOLA PESANAN & BATALKAN) */}
            {adminTab === 'Orders' && (
              <div className="table-card">
                <div className="table-header-row">
                  {(() => { const activeOrders = (orders || []).filter(o => o.orderStatus !== "SELESAI" && o.orderStatus !== "DIBATALKAN"); const kMap: Record<string, number> = {}; activeOrders.forEach(o => (o.items || []).forEach((it: any) => { kMap[it.name] = (kMap[it.name] || 0) + (it.quantity || 1); })); const entries = Object.entries(kMap); return (<div style={{ marginBottom: "1.25rem", padding: "1rem 1.25rem", borderRadius: "16px", background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}><div style={{ fontWeight: 800, fontSize: "0.92rem", color: "var(--text-primary)", marginBottom: "0.45rem" }}>🍳 Rekap Masak Dapur (Pesanan Aktif: {activeOrders.length})</div>{entries.length === 0 ? <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Belum ada antrean masakan aktif.</div> : <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>{entries.map(([m, q]) => <span key={m} style={{ padding: "0.35rem 0.75rem", borderRadius: "999px", background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontWeight: 800, fontSize: "0.82rem" }}>{q}x {m}</span>)}</div>}</div>); })()}<h3>📦 Kelola Seluruh Pesanan Asrama</h3>
                </div>

                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID Pesanan</th>
                      <th>Pemesan & Lokasi</th>
                      <th>Detail Menu</th>
                      <th>Total</th>
                      <th>Bayar (COD)</th>
                      <th>Proses Pesanan</th>
                      <th>Tindakan Batalkan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.id}>
                        <td><strong>#{o.id}</strong></td>
                        <td>
                          <strong>{o.customerName}</strong>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{o.customerKelas} • {o.customerKamar}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--primary-color)' }}>📞 {o.phone}</div>
                        </td>
                        <td>
                          {o.items.map((it, idx) => (
                            <div key={idx} style={{ fontSize: '0.85rem' }}>
                              {it.quantity}x {it.name}
                              {it.notes && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}> ("{it.notes}")</span>}
                            </div>
                          ))}
                        </td>
                        <td><strong>{formatRupiah(o.total)}</strong></td>
                        <td>
                          <button
                            className={o.paymentStatus === 'PAID' ? 'payment-badge-paid' : 'payment-badge-unpaid'}
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleTogglePaymentStatus(o.id, o.paymentStatus)}
                          >
                            {o.paymentStatus === 'PAID' ? '✅ Lunas' : '⚠️ Belum Bayar'}
                          </button>
                        </td>
                        <td>
                          <select
                            style={{ background: 'var(--surface-card)', color: 'inherit', border: '1px solid var(--surface-border)', borderRadius: '6px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                            value={o.orderStatus}
                            onChange={e => handleAdminUpdateOrderStatus(o.id, e.target.value as any)}
                          >
                            <option value="DITERIMA">1. Diterima Kantin</option>
                            <option value="DIMASAK">2. Dimasak / Disiapkan</option>
                            <option value="DIANTAR_KE_KAMAR">3. Menuju Kamar Asrama</option>
                            <option value="SELESAI">4. Selesai</option>
                            <option value="DIBATALKAN">❌ Dibatalkan</option>
                          </select>
                        </td>
                        <td>
                          {o.orderStatus !== 'DIBATALKAN' ? (
                            <button
                              className="btn-danger"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                              onClick={() => handleCancelOrder(o.id)}
                            >
                              ✕ Batalkan & Balikkan Stok
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#f87171' }}>Telah Dibatalkan</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB ADMIN 3: MENU ITEMS */}
            {adminTab === 'Menu Items' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
                {menus.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3.5rem 1.5rem', background: 'var(--surface-color)', borderRadius: '24px', border: '1px solid var(--surface-border)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.8rem' }}>🍽️</div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Daftar Menu Masih Kosong</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0.4rem 0 1.25rem' }}>
                      Kantin saat ini masih bersih & kosong. Klik tombol di bawah untuk menambahkan menu pertama dan mengunggah foto makanan!
                    </p>
                    <button
                      className="item-order-btn"
                      style={{ margin: '0 auto' }}
                      onClick={() => {
                        setAdminEditingId(null)
                        setAdminMenuForm({ name: '', price: '', category: categories[0] || 'Makanan Berat', icon: '🍲', imageUrl: '', description: '', stock: '40' })
                        setAdminFormVariants([])
                        setIsAdminAddModalOpen(true)
                      }}
                    >
                      + Tambah Menu & Upload Foto
                    </button>
                  </div>
                ) : (
                  menus.map(item => (
                    <div
                      key={item.id}
                      className={`menu-card-item admin-interactive-box ${selectedAdminBoxId === item.id ? 'is-selected' : ''}`}
                      onClick={() => setSelectedAdminBoxId(item.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="card-img-wrapper">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} onError={e => { (e.target as any).style.display = 'none' }} />
                        ) : (
                          <span className="card-img-fallback-emoji">{item.icon}</span>
                        )}
                        <span className="card-cat-badge">{item.category}</span>
                        <span className="card-rating-badge">⭐ {item.rating.toFixed(1)}</span>
                      </div>

                      <div className="card-body-content">
                        <div className="menu-item-title">{item.name}</div>
                        <div className="menu-item-desc">{item.description}</div>
                        <div style={{ fontSize: '0.85rem', margin: '0.4rem 0', color: 'var(--text-muted)' }}>Stok: <strong>{item.stock} porsi</strong></div>

                        <div className="card-footer-action">
                          <div className="item-price-text">{formatRupiah(item.price)}</div>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              className="nav-tool-btn"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                              onClick={() => {
                                setAdminEditingId(item.id)
                                setAdminMenuForm({
                                  name: item.name,
                                  price: item.price.toString(),
                                  category: item.category,
                                  icon: item.icon,
                                  imageUrl: item.imageUrl || '',
                                  description: item.description || '',
                                  stock: item.stock.toString()
                                })
                                setAdminFormVariants(item.variants || [])
                                setIsAdminAddModalOpen(true)
                              }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btn-danger"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                              onClick={() => handleDeleteMenu(item.id)}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB ADMIN 4: KELOLA KATEGORI */}
            {adminTab === 'Kelola Kategori' && (
              <div style={{ maxWidth: '600px', background: 'var(--surface-color)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--surface-border)' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1.25rem' }}>🏷️ Tambah & Kelola Kategori Menu</h3>

                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <input
                    type="text"
                    id="newCatInput"
                    placeholder="Nama kategori baru (cth: Paket Hemat, Roti, Kopi)..."
                    style={{ flex: 1, padding: '0.75rem 1rem', background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: '12px', color: 'inherit' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim()
                        if (val && !categories.includes(val)) {
                          const updated = [...categories, val]
                          setCategories(updated)
                          saveAdminConfigToDb({ categories: updated })
                            ; (e.target as HTMLInputElement).value = ''
                          showToast(`✅ Kategori "${val}" ditambahkan!`)
                        }
                      }
                    }}
                  />
                  <button
                    className="item-order-btn"
                    onClick={() => {
                      const input = document.getElementById('newCatInput') as HTMLInputElement
                      if (input && input.value.trim()) {
                        const val = input.value.trim()
                        if (!categories.includes(val)) {
                          const updated = [...categories, val]
                          setCategories(updated)
                          saveAdminConfigToDb({ categories: updated })
                          input.value = ''
                          showToast(`✅ Kategori "${val}" ditambahkan!`)
                        }
                      }
                    }}
                  >
                    + Tambah
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {categories.map((c, idx) => (
                    <div
                      key={idx}
                      className={`admin-interactive-box ${selectedAdminBoxId === c ? 'is-selected' : ''}`}
                      onClick={() => setSelectedAdminBoxId(c)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--surface-card)', borderRadius: '12px' }}
                    >
                      <span style={{ fontWeight: 700 }}>{c}</span>
                      <button
                        className="btn-danger"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                        onClick={() => {
                          if (categories.length <= 1) {
                            alert('Minimal harus ada 1 kategori!')
                            return
                          }
                          const updated = categories.filter(x => x !== c)
                          setCategories(updated)
                          saveAdminConfigToDb({ categories: updated })
                          showToast(`🗑️ Kategori "${c}" dihapus.`)
                        }}
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB ADMIN 5: KOTAK GAMBAR & SHOWCASE WIDGETS (FITUR BARU YANG DIMINTA USER) */}
            {adminTab === 'Kotak Gambar & Showcase' && (
              <div>
                <div style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '20px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.4rem' }}>🖼️ Kotak Gambar Makanan di Sisi Kiri & Kanan</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Kotak-kotak ini mengisi area kosong di sebelah kiri dan kanan banner utama. Anda bisa memilih bentuk unik ala Canva (Rounded, Squircle, Circle, Polaroid, Tilt, Pill, Badge) dan mengunggah gambar langsung dari komputer!
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
                  {showcaseWidgets.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1.5rem', background: 'var(--surface-color)', borderRadius: '20px', border: '1px solid var(--surface-border)' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>🖼️</div>
                      <h4>Kotak Gambar Showcase Masih Kosong</h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.4rem 0 1rem' }}>
                        Tambahkan kotak gambar makanan pilihan untuk menghiasi sisi kiri & kanan banner.
                      </p>
                    </div>
                  ) : (
                    showcaseWidgets.map(widget => (
                      <div
                        key={widget.id}
                        className={`admin-interactive-box ${selectedAdminBoxId === widget.id ? 'is-selected' : ''}`}
                        onClick={() => setSelectedAdminBoxId(widget.id)}
                        style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '20px', padding: '1.25rem' }}
                      >
                        <div className={`showcase-widget-card shape-${widget.shape}`} style={{ marginBottom: '1rem' }}>
                          <div className="showcase-img-box">
                            <img src={widget.imageUrl} alt={widget.title} />
                            {widget.priceTag && <span className="showcase-badge-pill">{widget.priceTag}</span>}
                          </div>
                          <div className="showcase-info-bar">
                            <div className="showcase-title-text">{widget.title}</div>
                            {widget.caption && <div className="showcase-sub-text">{widget.caption}</div>}
                          </div>
                        </div>

                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                          <div>Bentuk: <strong>{widget.shape}</strong></div>
                          <div>Posisi: <strong>{widget.position === 'left' ? 'Kiri Banner' : 'Kanan Banner'}</strong></div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="nav-tool-btn"
                            style={{ flex: 1, padding: '0.4rem', justifyContent: 'center' }}
                            onClick={() => {
                              setEditingWidgetId(widget.id)
                              setWidgetForm({ ...widget })
                              setIsWidgetModalOpen(true)
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn-danger"
                            style={{ padding: '0.4rem 0.8rem' }}
                            onClick={() => handleDeleteWidget(widget.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB ADMIN 5B: BANNER POSTER SAMPING (MAXIMALISME SISI KIRI & KANAN) */}
            {adminTab === 'Banner Poster Samping (Maximalism)' && (
              <div>
                <div style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '20px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.4rem' }}>🎨 Banner Poster Makanan (Sisi Kiri & Kanan Menu)</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Poster-poster ini mengisi ruang hitam kosong di sebelah kiri dan kanan menu serta showcase gambar. Anda dapat mengedit judul promo, diskon, harga, foto makanan, posisi, serta menautkannya langsung ke menu pesanan!
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                  {foodPosters.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1.5rem', background: 'var(--surface-color)', borderRadius: '20px', border: '1px solid var(--surface-border)' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>🎨</div>
                      <h4>Banner Poster Samping Masih Kosong</h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.4rem 0 1rem' }}>
                        Tambahkan banner promo makanan untuk mengisi ruang samping menu.
                      </p>
                    </div>
                  ) : (
                    foodPosters.map(poster => (
                      <div
                        key={poster.id}
                        className={`admin-interactive-box ${selectedAdminBoxId === poster.id ? 'is-selected' : ''}`}
                        onClick={() => setSelectedAdminBoxId(poster.id)}
                        style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '20px', padding: '1.25rem' }}
                      >
                        <div style={{ position: 'relative', height: '160px', borderRadius: '16px', overflow: 'hidden', marginBottom: '1rem', background: '#0b0f19' }}>
                          <img src={poster.imageUrl} alt={poster.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as any).style.display = 'none' }} />
                          <span style={{ position: 'absolute', top: '10px', left: '10px', background: poster.badgeColor || '#f43f5e', color: 'white', padding: '0.25rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 900 }}>
                            {poster.badgeText}
                          </span>
                          <span style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.85)', color: '#38bdf8', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
                            {poster.position === 'left' ? '⬅️ Sisi Kiri' : '➡️ Sisi Kanan'}
                          </span>
                        </div>

                        <h4 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>{poster.title}</h4>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.6rem', lineHeight: 1.4 }}>{poster.subtitle}</p>

                        <div style={{ fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                          <span>Harga/Tag: <strong>{poster.priceTag || '-'}</strong></span>
                          <span style={{ color: poster.isActive ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                            {poster.isActive ? '✅ Ditampilkan' : '⏸️ Disembunyikan'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="nav-tool-btn"
                            style={{ flex: 1, padding: '0.45rem', justifyContent: 'center' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingPosterId(poster.id)
                              setPosterForm({ ...poster })
                              setIsPosterModalOpen(true)
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="nav-tool-btn"
                            style={{ padding: '0.45rem 0.75rem', background: poster.isActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: poster.isActive ? '#ef4444' : '#10b981' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              const updated = foodPosters.map(p => p.id === poster.id ? { ...p, isActive: !p.isActive } : p)
                              setFoodPosters(updated)
                              saveAdminConfigToDb({ food_posters: updated })
                              showToast(poster.isActive ? '⏸️ Poster dinonaktifkan dari tampilan' : '✅ Poster diaktifkan kembali!')
                            }}
                            title={poster.isActive ? 'Sembunyikan' : 'Tampilkan'}
                          >
                            {poster.isActive ? 'Sembunyikan' : 'Tampilkan'}
                          </button>
                          <button
                            className="btn-danger"
                            style={{ padding: '0.45rem 0.75rem' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (window.confirm('Hapus poster ini?')) {
                                const updated = foodPosters.filter(p => p.id !== poster.id)
                                setFoodPosters(updated)
                                saveAdminConfigToDb({ food_posters: updated })
                                showToast('🗑️ Poster promo berhasil dihapus.')
                              }
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB ADMIN 6: ULASAN MURID */}
            {adminTab === 'Ulasan Murid' && (
              <div style={{ background: 'var(--surface-color)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--surface-border)' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>⭐ Ulasan Murid Asrama (Google Maps Style)</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  Di sini admin dapat melihat identitas asli murid (kamar & kelas) untuk memastikan transparansi dan kualitas menu makanan.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {reviews.map(r => {
                    const menuItem = menus.find(m => m.id === r.menuId)
                    return (
                      <div key={r.id} style={{ background: 'var(--surface-card)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--surface-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>👤 {r.customerName}</strong>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              ({r.customerKelas} • {r.customerKamar} • {r.customerAngkatan})
                            </span>
                          </div>
                          <span style={{ color: '#fbbf24', fontWeight: 800 }}>⭐ {r.rating.toFixed(1)} / 5.0</span>
                        </div>

                        <div style={{ fontSize: '0.82rem', color: 'var(--primary-color)', fontWeight: 700, marginBottom: '0.3rem' }}>
                          Menu: {menuItem?.name || 'Menu Pilihan'}
                        </div>

                        <div className="review-comment">"{r.comment}"</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* TAB ADMIN 7: KELOLA TENTANG KAMI & TIM PENGEMBANG (FOTO, VIDEO, TIM, MEDSOS) */}
            {adminTab === 'Daftar Pengguna' && (() => {
              const filtered = users.filter(u => {
                const q = userSearch.toLowerCase()
                const matchSearch = !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
                return matchSearch
              })
              const handleDeleteUser = (username: string) => {
                if (!window.confirm(`Hapus akun "${username}"?`)) return
                lastLocalEditRef.current = Date.now()
                const updated = users.filter(u => u.username !== username)
                setUsers(updated)
                localStorage.setItem('ic_users', JSON.stringify(updated))
                saveAdminConfigToDb({ users: updated } as any)
              }
              const fmt = (ts?: string) => ts ? new Date(ts).toLocaleString('id-ID') : '—'
              return (
                <div style={{ background: 'var(--surface-color)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--surface-border)' }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>👥 Daftar Pengguna Terdaftar</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                    Total {users.length} akun murid terdaftar.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Cari nama / username..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      style={{ flex: 1, minWidth: '180px', padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid var(--surface-border)', background: 'var(--surface-card)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                    />
                    {(['semua', 'kelas', 'kamar', 'angkatan'] as const).map(f => (
                      <button key={f} onClick={() => setUserFilter(f)} style={{ padding: '0.5rem 1rem', borderRadius: '999px', border: '1px solid var(--surface-border)', background: userFilter === f ? 'var(--primary-color)' : 'var(--surface-card)', color: userFilter === f ? 'var(--text-primary)' : 'var(--text-primary)', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                        {f === 'semua' ? 'Semua' : f === 'kelas' ? 'Per Kelas' : f === 'kamar' ? 'Per Kamar' : 'Per Angkatan'}
                      </button>
                    ))}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-card)', color: 'var(--text-secondary)' }}>
                          {['Nama Lengkap', 'Username', 'Password', 'Kelas & Kamar', 'Kapan Dibuat', 'Terakhir Login', 'Terakhir Aktif', 'Aksi'].map(h => (
                            <th key={h} style={{ padding: '0.65rem 0.85rem', textAlign: 'left', borderBottom: '1px solid var(--surface-border)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 && (
                          <tr><td colSpan={8} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Tidak ada pengguna ditemukan.</td></tr>
                        )}
                        {filtered
                          .filter(() => {
                            if (userFilter === 'semua') return true
                            return true // placeholder – filter by kelas/kamar/angkatan via search for now
                          })
                          .map((u, i) => (
                            <tr key={u.username} style={{ background: i % 2 === 0 ? 'var(--surface-card)' : 'transparent' }}>
                              <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-primary)', fontWeight: 700 }}>{u.name || '—'}</td>
                              <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)' }}>{u.username}</td>
                              <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{u.password}</td>
                              <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)' }}>{u.kelas} · {u.kamar}</td>
                              <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmt(u.createdAt) || 'Akun Bawaan'}</td>
                              <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmt(u.lastLoginAt)}</td>
                              <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmt(u.lastActiveAt)}</td>
                              <td style={{ padding: '0.65rem 0.85rem' }}>
                                <button onClick={() => handleDeleteUser(u.username)} style={{ background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>Hapus</button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}

            {/* TAB ADMIN 7: KELOLA TENTANG KAMI & TIM PENGEMBANG (FOTO, VIDEO, TIM, MEDSOS) */}
            {adminTab === 'Kelola Tentang Kami & Tim' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* 1. Teks Pokok & Video */}
                <div style={{ background: 'var(--surface-color)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--surface-border)' }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1rem' }}>ℹ️ Edit Informasi Pokok & Video Profil</h3>

                  <div className="form-group">
                    <label>Judul Halaman Tentang Kami</label>
                    <input
                      type="text"
                      value={aboutData.title}
                      onChange={e => setAboutData({ ...aboutData, title: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Sejarah & Latar Belakang</label>
                    <textarea
                      rows={4}
                      value={aboutData.history}
                      onChange={e => setAboutData({ ...aboutData, history: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Visi & Misi Kantin Asrama</label>
                    <textarea
                      rows={2}
                      value={aboutData.visionMission}
                      onChange={e => setAboutData({ ...aboutData, visionMission: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Link Video YouTube Embed ATAU Upload Video File</label>
                    <input
                      type="text"
                      placeholder="cth: https://www.youtube.com/embed/..."
                      value={aboutData.videoUrl.startsWith('data:video') ? '(Video Lokal Terunggah)' : aboutData.videoUrl}
                      onChange={e => setAboutData({ ...aboutData, videoUrl: e.target.value })}
                    />
                    <div className="file-upload-box" style={{ marginTop: '0.5rem' }}>
                      <span>📁 Klik atau Tarik File Video dari Komputer/HP</span>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={async e => {
                          const file = e.target.files?.[0]
                          if (file) {
                            try {
                              const base64 = await readFileAsDataUrl(file)
                              setAboutData({ ...aboutData, videoUrl: base64 })
                              showToast('🎥 Video lokal berhasil diunggah!')
                            } catch (err) {
                              alert('Gagal mengunggah video!')
                            }
                          }
                        }}
                      />
                    </div>
                  </div>

                  <button className="item-order-btn" onClick={() => showToast('💾 Informasi Pokok disimpan!')}>
                    💾 Simpan Perubahan Teks Pokok
                  </button>
                </div>

                {/* 2. Galeri Foto Suasana (Upload File Komputer) */}
                <div style={{ background: 'var(--surface-color)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--surface-border)' }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>📸 Galeri Foto Suasana Asrama</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                    Unggah foto langsung dari laptop atau masukkan link gambar:
                  </p>

                  <div className="file-upload-box" style={{ marginBottom: '1.25rem' }}>
                    <span>📁 + Upload Foto Baru dari Komputer / HP</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (file) {
                          try {
                            const b64 = await readFileAsDataUrl(file)
                            const updated = { ...aboutData, galleryImages: [...aboutData.galleryImages, b64] }
                            setAboutData(updated)
                            await saveAdminConfigToDb({ about_data: updated })
                            showToast('📸 Foto berhasil ditambahkan ke galeri & Cloud!')
                          } catch (err) {
                            alert('Gagal mengunggah gambar.')
                          }
                        }
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
                    {aboutData.galleryImages.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', height: '110px' }}>
                        <img src={img} alt={`Galeri ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer' }}
                          onClick={async () => {
                            const updated = {
                              ...aboutData,
                              galleryImages: aboutData.galleryImages.filter((_, i) => i !== idx)
                            }
                            setAboutData(updated)
                            await saveAdminConfigToDb({ about_data: updated })
                            showToast('🗑️ Foto dihapus dari galeri & Cloud.')
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Kelola Tim Pengembang (Identitas, Foto, Role, Kelas) */}
                <div style={{ background: 'var(--surface-color)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--surface-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>👥 Kelola Nama & Identitas Pengembang</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Edit nama, kelas, peran, bio, dan foto anggota tim pengembang.</p>
                    </div>
                    <button
                      className="item-order-btn"
                      onClick={() => {
                        setEditingTeamId(null)
                        setTeamForm({ id: '', name: '', kelas: '', role: '', bio: '', avatarUrl: '' })
                        setIsTeamModalOpen(true)
                      }}
                    >
                      + Tambah Anggota Tim
                    </button>
                  </div>

                  <div className="team-members-grid">
                    {aboutData.team.map(member => (
                      <div key={member.id} className="team-member-card">
                        <div className="team-avatar-frame">
                          {member.avatarUrl ? (
                            <img src={member.avatarUrl} alt={member.name} />
                          ) : (
                            '🎓'
                          )}
                        </div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{member.name}</h4>
                        <div style={{ fontSize: '0.82rem', color: 'var(--primary-color)', fontWeight: 700 }}>{member.kelas}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{member.role}</div>

                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '1rem', justifyContent: 'center' }}>
                          <button
                            className="nav-tool-btn"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                            onClick={() => {
                              setEditingTeamId(member.id)
                              setTeamForm({ ...member })
                              setIsTeamModalOpen(true)
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn-danger"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                            onClick={() => handleDeleteTeamMember(member.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Kelola Media Sosial & Hubungi Kami Dinamis */}
                <div style={{ background: 'var(--surface-color)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--surface-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>📞 Kelola Media Sosial & Hubungi Kami</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Tambah platform medsos baru (TikTok, YouTube, Discord, dll), ganti link dan warna.</p>
                    </div>
                    <button
                      className="item-order-btn"
                      onClick={() => {
                        setEditingSocialId(null)
                        setSocialForm({ id: '', platformName: '', handle: '', url: '', iconEmoji: '💬', badgeColor: '#25d366' })
                        setIsSocialModalOpen(true)
                      }}
                    >
                      + Tambah Platform Medsos
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {aboutData.socials.map(soc => (
                      <div key={soc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', background: 'var(--surface-card)', borderRadius: '14px', border: '1px solid var(--surface-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <span style={{ fontSize: '1.5rem', width: '38px', height: '38px', borderRadius: '50%', backgroundColor: soc.badgeColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {soc.iconEmoji}
                          </span>
                          <div>
                            <strong style={{ fontSize: '1rem' }}>{soc.platformName}</strong>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Akun: {soc.handle} • Link: {soc.url}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            className="nav-tool-btn"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                            onClick={() => {
                              setEditingSocialId(soc.id)
                              setSocialForm({ ...soc })
                              setIsSocialModalOpen(true)
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn-danger"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                            onClick={() => handleDeleteSocial(soc.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB ADMIN 8: STUDIO DESAIN (ALA CANVA) - KONTROL WARNA & LAYOUT SEUTUHNYA */}
            {adminTab === 'Studio Desain (Ala Canva)' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                <div style={{ background: 'var(--surface-color)', padding: '1.75rem', borderRadius: '24px', border: '1px solid var(--surface-border)' }}>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 900, marginBottom: '0.35rem' }}>🎨 Canva-Style Design & Background Studio</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Kontrol penuh visual website: atur background (warna, gradient, atau upload gambar wallpaper dari komputer), palet warna kartu, teks, aksen, dan tipografi secara real-time!
                  </p>
                </div>

                {/* Preset Cepat 1-Klik Ala Gemini & McD UI */}
                <div style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--surface-border)' }}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.85rem' }}>⚡ Preset Skema Desain 1-Klik (Rekomendasi)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    <button
                      className="nav-tool-btn"
                      style={{ padding: '0.85rem', flexDirection: 'column', alignItems: 'flex-start', border: canvaDesign.bgColor === '#f8fafc' && canvaDesign.bgType === 'color' ? '2px solid var(--primary-color)' : '1px solid var(--surface-border)' }}
                      onClick={() => {
                        setCanvaDesign({
                          ...canvaDesign,
                          bgType: 'color',
                          bgColor: '#f8fafc',
                          surfaceColor: '#ffffff',
                          surfaceCard: '#ffffff',
                          surfaceBorder: '#e2e8f0',
                          primaryColor: '#f43f5e',
                          textPrimary: '#0f172a',
                          textSecondary: '#475569'
                        })
                        setCurrentTheme('kiosk-light')
                        showToast('🍟 Desain Kiosk Clean Terang Aktif!')
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>🍟 Kiosk Clean (Ala Gemini)</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Slate Light + Putih Bersih + Coral</div>
                    </button>

                    <button
                      className="nav-tool-btn"
                      style={{ padding: '0.85rem', flexDirection: 'column', alignItems: 'flex-start' }}
                      onClick={() => {
                        setCanvaDesign({
                          ...canvaDesign,
                          bgType: 'color',
                          bgColor: '#f1f5f9',
                          surfaceColor: '#ffffff',
                          surfaceCard: '#f8fafc',
                          surfaceBorder: '#cbd5e1',
                          primaryColor: '#2563eb',
                          textPrimary: '#0f172a',
                          textSecondary: '#334155'
                        })
                        setCurrentTheme('blue')
                        showToast('⚡ Desain Electric Modern Aktif!')
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>⚡ Electric Modern Slate</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Slate Light + Electric Blue #2563EB</div>
                    </button>

                    <button
                      className="nav-tool-btn"
                      style={{ padding: '0.85rem', flexDirection: 'column', alignItems: 'flex-start' }}
                      onClick={() => {
                        setCanvaDesign({
                          ...canvaDesign,
                          bgType: 'color',
                          bgColor: '#0f172a',
                          surfaceColor: '#1e293b',
                          surfaceCard: '#334155',
                          surfaceBorder: '#475569',
                          primaryColor: '#f43f5e',
                          textPrimary: '#f8fafc',
                          textSecondary: '#cbd5e1'
                        })
                        setCurrentTheme('midnight')
                        showToast('🌙 Desain Sleek Cyber Dark Aktif!')
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>🌙 Sleek Cyber Dark Slate</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Mode Gelap Elegan & Bersih</div>
                    </button>

                    <button
                      className="nav-tool-btn"
                      style={{ padding: '0.85rem', flexDirection: 'column', alignItems: 'flex-start' }}
                      onClick={() => {
                        setCanvaDesign({
                          ...canvaDesign,
                          bgType: 'color',
                          bgColor: '#fdf2f8',
                          surfaceColor: '#ffffff',
                          surfaceCard: '#fff1f2',
                          surfaceBorder: '#fbcfe8',
                          primaryColor: '#ec4899',
                          textPrimary: '#831843',
                          textSecondary: '#9d174d'
                        })
                        setCurrentTheme('pink')
                        showToast('🌸 Desain Sakura Modern Aktif!')
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>🌸 Soft Sakura Aesthetic</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Nuansa Pink Bersih & Menawan</div>
                    </button>

                    <button
                      className="nav-tool-btn"
                      style={{ padding: '0.85rem', flexDirection: 'column', alignItems: 'flex-start' }}
                      onClick={() => {
                        setCanvaDesign({
                          ...canvaDesign,
                          bgType: 'color',
                          bgColor: '#f0fdf4',
                          surfaceColor: '#ffffff',
                          surfaceCard: '#dcfce7',
                          surfaceBorder: '#bbf7d0',
                          primaryColor: '#059669',
                          textPrimary: '#064e3b',
                          textSecondary: '#065f46'
                        })
                        setCurrentTheme('emerald')
                        showToast('🌲 Desain Emerald Clean Aktif!')
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>🌲 Emerald Cendikia Clean</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Nuansa Hijau Kampus Bersih</div>
                    </button>
                  </div>
                </div>

                <div className="canva-studio-grid">
                  {/* Panel 1: Kustomisasi Latar Belakang (Background Paling Lengkap) */}
                  <div className="canva-panel-card" style={{ gridColumn: '1 / -1' }}>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.75rem' }}>🖼️ Pengaturan Latar Belakang (Background)</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                      Pilih apakah Anda ingin background warna solid, gradient futuristik, atau wallpaper foto sendiri:
                    </p>

                    <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                      <button
                        className={`cat-chip ${canvaDesign.bgType === 'color' ? 'active' : ''}`}
                        onClick={() => setCanvaDesign({ ...canvaDesign, bgType: 'color' })}
                      >
                        🎨 Warna Solid (Bersih)
                      </button>
                      <button
                        className={`cat-chip ${canvaDesign.bgType === 'gradient' ? 'active' : ''}`}
                        onClick={() => setCanvaDesign({ ...canvaDesign, bgType: 'gradient' })}
                      >
                        🌈 Gradient Futuristik
                      </button>
                      <button
                        className={`cat-chip ${canvaDesign.bgType === 'image' ? 'active' : ''}`}
                        onClick={() => setCanvaDesign({ ...canvaDesign, bgType: 'image' })}
                      >
                        📷 Wallpaper Foto / Gambar Kustom
                      </button>
                    </div>

                    {canvaDesign.bgType === 'color' && (
                      <div className="color-input-row">
                        <label style={{ fontSize: '0.88rem', fontWeight: 700 }}>Pilih Warna Background Utama</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{canvaDesign.bgColor}</span>
                          <input
                            type="color"
                            value={canvaDesign.bgColor}
                            onChange={e => setCanvaDesign({ ...canvaDesign, bgColor: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    {canvaDesign.bgType === 'gradient' && (
                      <div className="form-group">
                        <label>CSS Gradient Futuristik</label>
                        <input
                          type="text"
                          value={canvaDesign.bgGradient}
                          onChange={e => setCanvaDesign({ ...canvaDesign, bgGradient: e.target.value })}
                          placeholder="linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)"
                        />
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                          {[
                            'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                            'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                            'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
                            'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                            'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)'
                          ].map((g, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className="nav-tool-btn"
                              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                              onClick={() => setCanvaDesign({ ...canvaDesign, bgGradient: g })}
                            >
                              Preset Gradient #{idx + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {canvaDesign.bgType === 'image' && (
                      <div className="form-group">
                        <label>Upload Wallpaper Gambar dari Komputer / Masukkan URL</label>
                        <input
                          type="text"
                          value={canvaDesign.bgImage.startsWith('data:image') ? '(Gambar Lokal Terunggah)' : canvaDesign.bgImage}
                          onChange={e => setCanvaDesign({ ...canvaDesign, bgImage: e.target.value })}
                          placeholder="https://... atau upload file komputer"
                        />
                        <div className="file-upload-box" style={{ marginTop: '0.5rem' }}>
                          <span>📁 Klik atau Tarik Gambar Wallpaper dari Laptop/HP</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async e => {
                              const file = e.target.files?.[0]
                              if (file) {
                                try {
                                  const b64 = await readFileAsDataUrl(file)
                                  setCanvaDesign({ ...canvaDesign, bgType: 'image', bgImage: b64 })
                                  showToast('🖼️ Wallpaper background berhasil dipasang!')
                                } catch (err) {
                                  alert('Gagal mengunggah wallpaper.')
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Panel 2: Palet Warna Panel & Kartu */}
                  <div className="canva-panel-card">
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem' }}>🎨 Palet Warna Kartu & Aksen</h4>

                    <div className="color-input-row">
                      <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Warna Kartu & Panel (Surface)</label>
                      <input
                        type="color"
                        value={canvaDesign.surfaceColor}
                        onChange={e => setCanvaDesign({ ...canvaDesign, surfaceColor: e.target.value })}
                      />
                    </div>

                    <div className="color-input-row">
                      <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Warna Item / Sub-Card</label>
                      <input
                        type="color"
                        value={canvaDesign.surfaceCard}
                        onChange={e => setCanvaDesign({ ...canvaDesign, surfaceCard: e.target.value })}
                      />
                    </div>

                    <div className="color-input-row">
                      <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Warna Aksen Tombol (Primary)</label>
                      <input
                        type="color"
                        value={canvaDesign.primaryColor}
                        onChange={e => setCanvaDesign({ ...canvaDesign, primaryColor: e.target.value })}
                      />
                    </div>

                    <div className="color-input-row">
                      <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Warna Garis Tepi (Border)</label>
                      <input
                        type="color"
                        value={canvaDesign.surfaceBorder}
                        onChange={e => setCanvaDesign({ ...canvaDesign, surfaceBorder: e.target.value })}
                      />
                    </div>

                    <div className="color-input-row">
                      <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Warna Teks Judul Utama</label>
                      <input
                        type="color"
                        value={canvaDesign.textPrimary}
                        onChange={e => setCanvaDesign({ ...canvaDesign, textPrimary: e.target.value })}
                      />
                    </div>

                    <div className="color-input-row">
                      <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Warna Teks Sekunder / Deskripsi</label>
                      <input
                        type="color"
                        value={canvaDesign.textSecondary}
                        onChange={e => setCanvaDesign({ ...canvaDesign, textSecondary: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Panel 3: Tipografi & Font Teks */}
                  <div className="canva-panel-card">
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem' }}>✍️ Pilihan Tipografi & Huruf</h4>

                    {[
                      { id: 'sans', label: 'Plus Jakarta / Modern Sans (Standar Kiosk)' },
                      { id: 'outfit', label: 'Outfit (Modern Display & Bold)' },
                      { id: 'poppins', label: 'Poppins (Playful & Friendly)' },
                      { id: 'serif', label: 'Playfair / Serif (Elegan Klasik)' },
                      { id: 'mono', label: 'Tech Monospace (Cyber Alt)' }
                    ].map(f => (
                      <button
                        key={f.id}
                        className={`font-preview-button ${canvaDesign.fontFamily === f.id ? 'active' : ''}`}
                        onClick={() => {
                          setCanvaDesign({ ...canvaDesign, fontFamily: f.id as any })
                          showToast(`Font diubah ke: ${f.label}`)
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Panel 4: Banner Pengumuman Kustom */}
                  <div className="canva-panel-card">
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem' }}>📢 Banner Pengumuman Kustom</h4>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                      <input
                        type="checkbox"
                        id="showAnnounceCheck"
                        checked={canvaDesign.showCustomAnnouncement}
                        onChange={e => setCanvaDesign({ ...canvaDesign, showCustomAnnouncement: e.target.checked })}
                      />
                      <label htmlFor="showAnnounceCheck" style={{ fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>
                        Tampilkan Banner Pengumuman di Atas
                      </label>
                    </div>

                    <div className="form-group">
                      <label>Isi Teks Pengumuman</label>
                      <textarea
                        rows={2}
                        value={canvaDesign.customAnnouncementText}
                        onChange={e => setCanvaDesign({ ...canvaDesign, customAnnouncementText: e.target.value })}
                      />
                    </div>

                    <div className="color-input-row">
                      <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Warna Background Banner</label>
                      <input
                        type="color"
                        value={canvaDesign.announcementBg.startsWith('#') ? canvaDesign.announcementBg : '#0f172a'}
                        onChange={e => setCanvaDesign({ ...canvaDesign, announcementBg: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button
                    className="nav-tool-btn"
                    onClick={() => {
                      setCanvaDesign(INITIAL_CANVA_DESIGN)
                      setCurrentTheme('midnight')
                      showToast('🔄 Desain dikembalikan ke default Cyber Dark Mode!')
                    }}
                  >
                    🔄 Reset Desain Default
                  </button>
                  <button
                    className="item-order-btn"
                    onClick={() => showToast('💾 Desain kustom Anda telah disimpan!')}
                  >
                    💾 Simpan Semua Pengaturan Desain
                  </button>
                </div>
              </div>
            )}

            {/* TAB ADMIN 9: PENGATURAN TOKO & TEKS HERO (SEMUA BUBBLE & TEKS BISA DIEDIT) */}
            {adminTab === 'Pengaturan Toko & Teks Hero' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px' }}>
                {/* 1. Identitas Branding & Nama Toko */}
                <div style={{ background: 'var(--surface-color)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--surface-border)' }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1.25rem' }}>🏷️ Identitas Branding Toko</h3>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Logo / Icon Emoji</label>
                      <input
                        type="text"
                        value={storeIdentity.logoEmoji}
                        onChange={e => setStoreIdentity({ ...storeIdentity, logoEmoji: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Nama Depan Brand</label>
                      <input
                        type="text"
                        value={storeIdentity.brandName}
                        onChange={e => setStoreIdentity({ ...storeIdentity, brandName: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Suffix / Kata Belakang (Warna Merah)</label>
                      <input
                        type="text"
                        value={storeIdentity.brandSuffix}
                        onChange={e => setStoreIdentity({ ...storeIdentity, brandSuffix: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Subtitle / Keterangan Toko</label>
                    <input
                      type="text"
                      value={storeIdentity.brandSubtitle}
                      onChange={e => setStoreIdentity({ ...storeIdentity, brandSubtitle: e.target.value })}
                    />
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Teks Bar Atas Kiri</label>
                      <input
                        type="text"
                        value={storeIdentity.topBarLeft}
                        onChange={e => setStoreIdentity({ ...storeIdentity, topBarLeft: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Teks Bar Atas Kanan</label>
                      <input
                        type="text"
                        value={storeIdentity.topBarRight}
                        onChange={e => setStoreIdentity({ ...storeIdentity, topBarRight: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Teks Hero Banner & Stiker Bubble Biru/Ungu */}
                <div style={{ background: 'var(--surface-color)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--surface-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>✨ Stiker Bubble Hero (Biru, Ungu, Kuning)</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Semua tag stiker di atas judul banner dapat diedit, ditambah, atau diubah warnanya.</p>
                    </div>
                    <button
                      className="item-order-btn"
                      onClick={() => {
                        setBadgeForm({ id: '', text: '', bg: '#f43f5e', textColor: '#ffffff' })
                        setIsBadgeModalOpen(true)
                      }}
                    >
                      + Tambah Stiker Baru
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1.5rem' }}>
                    {heroBadges.map(badge => (
                      <div
                        key={badge.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          background: badge.bg,
                          color: badge.textColor,
                          padding: '0.4rem 0.8rem',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '0.85rem'
                        }}
                      >
                        <span>{badge.text}</span>
                        <button
                          style={{ background: 'transparent', border: 'none', color: badge.textColor, cursor: 'pointer', fontWeight: 900 }}
                          onClick={() => {
                            setHeroBadges(heroBadges.filter(b => b.id !== badge.id))
                            showToast(`🗑️ Stiker "${badge.text}" dihapus.`)
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="form-group">
                    <label>Judul Besar Hero Banner</label>
                    <input
                      type="text"
                      value={storeIdentity.heroTitle}
                      onChange={e => setStoreIdentity({ ...storeIdentity, heroTitle: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Deskripsi Hero Banner</label>
                    <textarea
                      rows={3}
                      value={storeIdentity.heroDescription}
                      onChange={e => setStoreIdentity({ ...storeIdentity, heroDescription: e.target.value })}
                    />
                  </div>
                </div>

                {/* 3. Kotak Informasi Kuning / Bayar Offline */}
                <div style={{ background: 'var(--surface-color)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--surface-border)' }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1.25rem' }}>💡 Kotak Pengingat Pembayaran Offline</h3>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Icon Emoji</label>
                      <input
                        type="text"
                        value={storeIdentity.noticeEmoji}
                        onChange={e => setStoreIdentity({ ...storeIdentity, noticeEmoji: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label>Judul Pengingat</label>
                      <input
                        type="text"
                        value={storeIdentity.noticeTitle}
                        onChange={e => setStoreIdentity({ ...storeIdentity, noticeTitle: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Penjelasan Pembayaran Offline</label>
                    <textarea
                      rows={2}
                      value={storeIdentity.noticeDescription}
                      onChange={e => setStoreIdentity({ ...storeIdentity, noticeDescription: e.target.value })}
                    />
                  </div>

                  <button className="item-order-btn" onClick={() => showToast('💾 Pengaturan Toko & Hero berhasil disimpan!')}>
                    💾 Simpan Semua Pengaturan Toko
                  </button>
                </div>

                {/* 4. Ganti Password Admin */}
                <div style={{ background: 'var(--surface-color)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--surface-border)' }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>🔑 Ganti Password Admin</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                    Password default saat ini: <strong>{adminPassword}</strong>
                  </p>

                  <div className="form-group">
                    <label>Password Lama</label>
                    <input
                      type="password"
                      placeholder="Masukkan password saat ini"
                      value={changePassForm.oldPass}
                      onChange={e => setChangePassForm({ ...changePassForm, oldPass: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Password Baru</label>
                    <input
                      type="password"
                      placeholder="Minimal 4 karakter"
                      value={changePassForm.newPass}
                      onChange={e => setChangePassForm({ ...changePassForm, newPass: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Konfirmasi Password Baru</label>
                    <input
                      type="password"
                      placeholder="Ketik ulang password baru"
                      value={changePassForm.confirmPass}
                      onChange={e => setChangePassForm({ ...changePassForm, confirmPass: e.target.value })}
                    />
                  </div>

                  <button className="item-order-btn" onClick={handleChangeAdminPassword}>
                    💾 Simpan Password Baru
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* =========================================================================
          MODAL KHUSUS: STUDIO DESAIN ALA CANVA UNTUK PEMBELI (ISOLASI PER DEVICE)
          ========================================================================= */}
      {isCustomerCanvaModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCustomerCanvaModalOpen(false)}>
          <div
            className="modal-box"
            style={{ maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, margin: 0 }}>🎨 Studio Desain Pribadi</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0.25rem 0 0 0' }}>
                  Kustomisasi tema tampilan sesukamu! Perubahan hanya berlaku di perangkatmu (tidak mengubah pengguna lain).
                </p>
              </div>
              <button className="modal-close-x" onClick={() => setIsCustomerCanvaModalOpen(false)}>✕</button>
            </div>

            {/* 1. Preset Tema 1-Klik */}
            <div style={{ marginBottom: '1.5rem', background: 'var(--surface-card)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '0.65rem' }}>⚡ Preset Skema Desain 1-Klik</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    className="nav-tool-btn"
                    style={{
                      padding: '0.6rem 0.4rem',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.35rem',
                      background: currentTheme === t.id ? 'var(--surface-color)' : 'transparent',
                      border: currentTheme === t.id ? '2px solid var(--primary-color)' : '1px solid var(--surface-border)'
                    }}
                    onClick={() => handleApplyTheme(t.id)}
                  >
                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: t.color, display: 'inline-block' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Tipe & Warna Latar Belakang */}
            <div style={{ marginBottom: '1.5rem', background: 'var(--surface-card)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '0.65rem' }}>🖼️ Mode Latar Belakang (Background)</div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  className={`cat-chip ${customerCanvaDesign.bgType === 'color' ? 'active' : ''}`}
                  onClick={() => {
                    const upd = { ...customerCanvaDesign, bgType: 'color' as const }
                    setCustomerCanvaDesign(upd)
                    localStorage.setItem('ic_customer_canva', JSON.stringify(upd))
                  }}
                >
                  Warna Solid
                </button>
                <button
                  className={`cat-chip ${customerCanvaDesign.bgType === 'gradient' ? 'active' : ''}`}
                  onClick={() => {
                    const upd = { ...customerCanvaDesign, bgType: 'gradient' as const }
                    setCustomerCanvaDesign(upd)
                    localStorage.setItem('ic_customer_canva', JSON.stringify(upd))
                  }}
                >
                  Gradient Futuristik
                </button>
                <button
                  className={`cat-chip ${customerCanvaDesign.bgType === 'image' ? 'active' : ''}`}
                  onClick={() => {
                    const upd = { ...customerCanvaDesign, bgType: 'image' as const }
                    setCustomerCanvaDesign(upd)
                    localStorage.setItem('ic_customer_canva', JSON.stringify(upd))
                  }}
                >
                  Wallpaper Foto
                </button>
              </div>

              {customerCanvaDesign.bgType === 'color' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label style={{ fontSize: '0.85rem', flex: 1 }}>Warna Background:</label>
                  <input
                    type="color"
                    value={customerCanvaDesign.bgColor}
                    onChange={e => {
                      const upd = { ...customerCanvaDesign, bgColor: e.target.value }
                      setCustomerCanvaDesign(upd)
                      localStorage.setItem('ic_customer_canva', JSON.stringify(upd))
                    }}
                    style={{ width: '48px', height: '34px', borderRadius: '8px', cursor: 'pointer', border: 'none' }}
                  />
                  <span style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>{customerCanvaDesign.bgColor}</span>
                </div>
              )}

              {customerCanvaDesign.bgType === 'gradient' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.82rem' }}>Pilih Preset Gradient:</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
                    {[
                      { name: 'Dark Nebula', val: 'linear-gradient(135deg, #0b0f19 0%, #111827 50%, #0f172a 100%)' },
                      { name: 'Sunset Glow', val: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #701a75 100%)' },
                      { name: 'Emerald Night', val: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #0f172a 100%)' },
                      { name: 'Aurora Borealis', val: 'linear-gradient(135deg, #0f172a 0%, #0369a1 50%, #0d9488 100%)' }
                    ].map(g => (
                      <button
                        key={g.name}
                        onClick={() => {
                          const upd = { ...customerCanvaDesign, bgGradient: g.val }
                          setCustomerCanvaDesign(upd)
                          localStorage.setItem('ic_customer_canva', JSON.stringify(upd))
                        }}
                        style={{
                          background: g.val,
                          color: 'var(--text-primary)',
                          padding: '0.55rem',
                          borderRadius: '10px',
                          border: customerCanvaDesign.bgGradient === g.val ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {customerCanvaDesign.bgType === 'image' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.82rem' }}>URL Wallpaper atau Upload Foto:</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={customerCanvaDesign.bgImage}
                    onChange={e => {
                      const upd = { ...customerCanvaDesign, bgImage: e.target.value }
                      setCustomerCanvaDesign(upd)
                      localStorage.setItem('ic_customer_canva', JSON.stringify(upd))
                    }}
                  />
                  <div className="file-upload-box" style={{ padding: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem' }}>📁 Pilih Foto Wallpaper dari HP / Komputer</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (file) {
                          try {
                            const b64 = await readFileAsDataUrl(file)
                            const upd = { ...customerCanvaDesign, bgImage: b64 }
                            setCustomerCanvaDesign(upd)
                            localStorage.setItem('ic_customer_canva', JSON.stringify(upd))
                            showToast('📸 Wallpaper perangkatmu berhasil diterapkan!')
                          } catch {
                            alert('Gagal membaca gambar.')
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Warna Kartu, Border & Aksen */}
            <div style={{ marginBottom: '1.5rem', background: 'var(--surface-card)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '0.65rem' }}>🎨 Palet Warna Kartu & Aksen</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-color)', padding: '0.5rem 0.75rem', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.8rem' }}>Warna Kartu Menu</span>
                  <input
                    type="color"
                    value={customerCanvaDesign.surfaceCard}
                    onChange={e => {
                      const upd = { ...customerCanvaDesign, surfaceCard: e.target.value }
                      setCustomerCanvaDesign(upd)
                      localStorage.setItem('ic_customer_canva', JSON.stringify(upd))
                    }}
                    style={{ width: '34px', height: '26px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-color)', padding: '0.5rem 0.75rem', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.8rem' }}>Warna Tombol / Aksen</span>
                  <input
                    type="color"
                    value={customerCanvaDesign.primaryColor}
                    onChange={e => {
                      const upd = { ...customerCanvaDesign, primaryColor: e.target.value }
                      setCustomerCanvaDesign(upd)
                      localStorage.setItem('ic_customer_canva', JSON.stringify(upd))
                    }}
                    style={{ width: '34px', height: '26px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>

            {/* 4. Tipografi Font */}
            <div style={{ marginBottom: '1.5rem', background: 'var(--surface-card)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '0.65rem' }}>🔤 Gaya Huruf (Font)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
                {[
                  { id: 'outfit', label: 'Outfit (Modern)' },
                  { id: 'poppins', label: 'Poppins (Bulat)' },
                  { id: 'serif', label: 'Playfair (Klasik)' },
                  { id: 'mono', label: 'Monospace (Cyber)' }
                ].map(f => (
                  <button
                    key={f.id}
                    className="nav-tool-btn"
                    style={{
                      padding: '0.45rem',
                      justifyContent: 'center',
                      fontSize: '0.78rem',
                      fontWeight: customerCanvaDesign.fontFamily === f.id ? 800 : 500,
                      border: customerCanvaDesign.fontFamily === f.id ? '2px solid var(--primary-color)' : '1px solid var(--surface-border)'
                    }}
                    onClick={() => {
                      const upd = { ...customerCanvaDesign, fontFamily: f.id as any }
                      setCustomerCanvaDesign(upd)
                      localStorage.setItem('ic_customer_canva', JSON.stringify(upd))
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', borderTop: '1px solid var(--surface-border)', paddingTop: '1rem' }}>
              <button
                className="nav-tool-btn"
                style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
                onClick={() => {
                  setCustomerCanvaDesign(INITIAL_CANVA_DESIGN)
                  localStorage.removeItem('ic_customer_canva')
                  showToast('🔄 Desain dikembalikan ke tema default!')
                }}
              >
                🔄 Reset Default
              </button>
              <button
                className="btn-primary"
                style={{ fontSize: '0.88rem', padding: '0.5rem 1.5rem' }}
                onClick={() => {
                  setIsCustomerCanvaModalOpen(false)
                  showToast('✨ Desain pribadi aktif di perangkatmu!')
                }}
              >
                ✓ Selesai & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: INSTAGRAM-STYLE LOGIN / REGISTER MURID
          ========================================================================= */}
      {isAuthModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAuthModalOpen(false)}>
          <div className="ig-auth-wrapper" onClick={e => e.stopPropagation()}>
            <button className="modal-close-x" onClick={() => setIsAuthModalOpen(false)}>✕</button>
            <div className="ig-brand-logo">{storeIdentity.logoEmoji || '🍟'}</div>
            <div className="ig-title">{storeIdentity.brandName} {storeIdentity.brandSuffix}</div>
            <div className="ig-sub">{storeIdentity.brandSubtitle}</div>

            {currentUser ? (
              <div>
                <div style={{ background: 'var(--surface-card)', padding: '1.25rem', borderRadius: '18px', marginBottom: '1.25rem', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '2rem' }}>{currentUser.avatar}</div>
                    <div>
                      <strong style={{ fontSize: '1.1rem' }}>{currentUser.name}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{currentUser.username}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    <div>🏫 <strong>Kelas:</strong> {currentUser.kelas}</div>
                    <div>📍 <strong>Kamar:</strong> {currentUser.kamar}</div>
                    <div>🎓 <strong>Angkatan:</strong> {currentUser.angkatan}</div>
                    <div>📞 <strong>No. WA:</strong> {currentUser.phone}</div>
                  </div>
                </div>

                <button
                  className="btn-danger"
                  style={{ width: '100%', padding: '0.85rem', justifyContent: 'center' }}
                  onClick={() => {
                    setCurrentUser(null)
                    showToast('👋 Anda telah keluar dari akun.')
                  }}
                >
                  Keluar Akun (Logout)
                </button>
              </div>
            ) : (
              <div>
                <div className="ig-auth-tabs">
                  <button
                    className={`ig-tab-btn ${authTab === 'login' ? 'active' : ''}`}
                    onClick={() => setAuthTab('login')}
                  >
                    Masuk (Login)
                  </button>
                  <button
                    className={`ig-tab-btn ${authTab === 'register' ? 'active' : ''}`}
                    onClick={() => setAuthTab('register')}
                  >
                    Daftar Akun Baru
                  </button>
                </div>

                {authTab === 'login' ? (
                  <div style={{ textAlign: 'left' }}>
                    <div className="form-group">
                      <label>Username</label>
                      <input
                        type="text"
                        placeholder="cth: murid1"
                        value={loginForm.username}
                        onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Password</label>
                      <input
                        type="password"
                        placeholder="cth: 123"
                        value={loginForm.password}
                        onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && handleLoginCustomer()}
                      />
                    </div>
                    <button className="ig-btn-primary" onClick={handleLoginCustomer}>
                      Masuk ke {storeIdentity.brandName} ➔
                    </button>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '1rem' }}>
                      Akun demo: username <strong>murid1</strong> | password <strong>123</strong>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'left' }}>
                    <div className="form-group">
                      <label>Username Murid *</label>
                      <input
                        type="text"
                        placeholder="cth: zaki_ic"
                        value={registerForm.username}
                        onChange={e => setRegisterForm({ ...registerForm, username: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Password *</label>
                      <input
                        type="password"
                        placeholder="Minimal 3 karakter"
                        value={registerForm.password}
                        onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Nama Lengkap Murid *</label>
                      <input
                        type="text"
                        placeholder="cth: Ahmad Zaki Farhan"
                        value={registerForm.name}
                        onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })}
                      />
                    </div>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Kelas *</label>
                        <input
                          type="text"
                          placeholder="cth: XI MIPA 1"
                          value={registerForm.kelas}
                          onChange={e => setRegisterForm({ ...registerForm, kelas: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Angkatan *</label>
                        <input
                          type="text"
                          placeholder="cth: Angkatan 7"
                          value={registerForm.angkatan}
                          onChange={e => setRegisterForm({ ...registerForm, angkatan: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Nama Asrama & Nomor Kamar *</label>
                      <input
                        type="text"
                        placeholder="cth: Asrama Ibnu Sina Kamar 204"
                        value={registerForm.kamar}
                        onChange={e => setRegisterForm({ ...registerForm, kamar: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>No. WhatsApp / HP</label>
                      <input
                        type="tel"
                        placeholder="cth: 081234567890"
                        value={registerForm.phone}
                        onChange={e => setRegisterForm({ ...registerForm, phone: e.target.value })}
                      />
                    </div>
                    <button className="ig-btn-primary" onClick={handleRegisterCustomer}>
                      Daftar & Masuk Sekarang ➔
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: DETAIL MENU & ULASAN GOOGLE MAPS STYLE
          ========================================================================= */}
      {selectedMenuForDetail && (
        <div className="modal-overlay" onClick={() => setSelectedMenuForDetail(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close-x" onClick={() => setSelectedMenuForDetail(null)}>✕</button>

            <div style={{ width: '100%', height: '180px', borderRadius: '18px', overflow: 'hidden', marginBottom: '1.25rem', background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {selectedMenuForDetail.imageUrl ? (
                <img src={selectedMenuForDetail.imageUrl} alt={selectedMenuForDetail.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '5rem' }}>{selectedMenuForDetail.icon}</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="card-cat-badge" style={{ position: 'static' }}>{selectedMenuForDetail.category}</span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginTop: '0.35rem' }}>{selectedMenuForDetail.name}</h2>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary-color)' }}>
                {formatRupiah(selectedMenuForDetail.price)}
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', margin: '0.85rem 0' }}>
              {selectedMenuForDetail.description}
            </p>

            {/* Varian */}
            {selectedMenuForDetail.variants && selectedMenuForDetail.variants.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: '0.5rem', display: 'block' }}>
                  Pilihan Varian / Topping:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {selectedMenuForDetail.variants.map((v, i) => {
                    const isChecked = detailSelectedVariants.some(x => x.name === v.name)
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          if (isChecked) {
                            setDetailSelectedVariants(detailSelectedVariants.filter(x => x.name !== v.name))
                          } else {
                            setDetailSelectedVariants([...detailSelectedVariants, v])
                          }
                        }}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0.85rem',
                          background: isChecked ? 'var(--primary-light)' : 'var(--bg-color)',
                          border: `1px solid ${isChecked ? 'var(--primary-color)' : 'var(--surface-border)'}`,
                          borderRadius: '10px',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{v.name}</span>
                        <span style={{ color: 'var(--primary-color)', fontWeight: 700, fontSize: '0.88rem' }}>
                          {v.price > 0 ? `+${formatRupiah(v.price)}` : 'Gratis'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Catatan Khusus untuk Dapur</label>
              <textarea
                rows={2}
                placeholder="cth: Sambal dipisah, jangan pakai daun bawang..."
                value={detailNotes}
                onChange={e => setDetailNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '1rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-card)', borderRadius: '12px' }}>
                <button
                  style={{ background: 'transparent', border: 'none', color: 'inherit', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '1.2rem' }}
                  onClick={() => setDetailQty(Math.max(1, detailQty - 1))}
                >
                  -
                </button>
                <span style={{ fontWeight: 900, minWidth: '32px', textAlign: 'center' }}>{detailQty}</span>
                <button
                  style={{ background: 'transparent', border: 'none', color: 'inherit', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '1.2rem' }}
                  onClick={() => setDetailQty(detailQty + 1)}
                >
                  +
                </button>
              </div>

              <button className="item-order-btn" style={{ padding: '0.85rem 1.25rem' }} onClick={handleAddToCart}>
                🛒 Masukkan Keranjang • {formatRupiah((selectedMenuForDetail.price + detailSelectedVariants.reduce((s, v) => s + v.price, 0)) * detailQty)}
              </button>
            </div>

            {/* Google Maps Style Reviews */}
            <div className="reviews-modal-block">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>⭐ Ulasan Murid (Google Maps Style)</h3>
                <button
                  className="nav-tool-btn"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                  onClick={() => {
                    setReviewMenuTarget(selectedMenuForDetail)
                    setReviewRatingInput(5.0)
                    setReviewCommentInput('')
                  }}
                >
                  ✍️ Tulis Ulasan
                </button>
              </div>

              {/* Form Tulis Ulasan */}
              {reviewMenuTarget?.id === selectedMenuForDetail.id && (
                <div style={{ background: 'var(--surface-card)', padding: '1rem', borderRadius: '14px', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.4rem' }}>Beri Rating Bintang:</div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          fontSize: '1.5rem',
                          cursor: 'pointer',
                          color: star <= reviewRatingInput ? '#fbbf24' : '#4b5563'
                        }}
                        onClick={() => setReviewRatingInput(star)}
                      >
                        ★
                      </button>
                    ))}
                    <span style={{ marginLeft: '0.5rem', fontWeight: 800, alignSelf: 'center' }}>{reviewRatingInput}.0</span>
                  </div>

                  <textarea
                    rows={2}
                    placeholder="Ceritakan rasa makanan dan kepuasanmu..."
                    value={reviewCommentInput}
                    onChange={e => setReviewCommentInput(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-color)', border: '1px solid var(--surface-border)', borderRadius: '10px', padding: '0.6rem', color: 'inherit', fontSize: '0.85rem' }}
                  />

                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.6rem' }}>
                    <button className="nav-tool-btn" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => setReviewMenuTarget(null)}>
                      Batal
                    </button>
                    <button className="item-order-btn" style={{ fontSize: '0.75rem', padding: '0.3rem 0.8rem' }} onClick={handleSubmitReview}>
                      Kirim Ulasan
                    </button>
                  </div>
                </div>
              )}

              {/* List Ulasan */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {reviews.filter(r => r.menuId === selectedMenuForDetail.id).length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                    Belum ada ulasan untuk menu ini. Jadilah yang pertama memberikan ulasan!
                  </div>
                ) : (
                  reviews.filter(r => r.menuId === selectedMenuForDetail.id).map(r => (
                    <div key={r.id} style={{ background: 'var(--bg-color)', padding: '0.85rem', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '0.88rem' }}>{maskName(r.customerName)}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                            ({r.customerKamar.split(' ')[0]}..)
                          </span>
                        </div>
                        <span style={{ color: '#fbbf24', fontSize: '0.85rem' }}>{'★'.repeat(Math.round(r.rating))} ({r.rating.toFixed(1)})</span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.35rem', lineHeight: '1.4' }}>
                        "{r.comment}"
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: PASSWORD GATE PORTAL ADMIN
          ========================================================================= */}
      {isAdminPasswordModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAdminPasswordModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '380px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close-x" onClick={() => setIsAdminPasswordModalOpen(false)}>✕</button>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔒</div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900 }}>Portal Khusus Pengelola</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.4rem 0 1.25rem' }}>
              Masukkan password pengelola kantin untuk mengakses pengaturan & pesanan.
            </p>

            <div className="form-group" style={{ textAlign: 'left' }}>
              <label>Password Pengelola</label>
              <input
                type="password"
                placeholder="Masukkan password admin"
                value={adminPasswordInput}
                onChange={e => setAdminPasswordInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerifyAdminPassword()}
                autoFocus
              />
              {adminPasswordError && (
                <div style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.4rem', fontWeight: 700 }}>
                  {adminPasswordError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button className="nav-tool-btn" style={{ flex: 1 }} onClick={() => setIsAdminPasswordModalOpen(false)}>
                Batal
              </button>
              <button className="item-order-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={handleVerifyAdminPassword}>
                Masuk Admin ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: ADMIN TAMBAH & EDIT MENU (UPLOAD FOTO DARI KOMPUTER/HP)
          ========================================================================= */}
      {isAdminAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAdminAddModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close-x" onClick={() => setIsAdminAddModalOpen(false)}>✕</button>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '1.25rem' }}>
              {adminEditingId ? '✏️ Edit Menu & Foto' : '➕ Tambah Menu Baru & Foto'}
            </h2>

            <div className="form-group">
              <label>Nama Menu Makanan/Minuman *</label>
              <input
                type="text"
                value={adminMenuForm.name}
                onChange={e => setAdminMenuForm({ ...adminMenuForm, name: e.target.value })}
                placeholder="cth: Mie Nyemek Telur Sosis"
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Kategori *</label>
                <select
                  value={adminMenuForm.category}
                  onChange={e => setAdminMenuForm({ ...adminMenuForm, category: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: '12px', color: 'inherit' }}
                >
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Harga (Rupiah) *</label>
                <input
                  type="number"
                  value={adminMenuForm.price}
                  onChange={e => setAdminMenuForm({ ...adminMenuForm, price: e.target.value })}
                  placeholder="15000"
                />
              </div>
            </div>

            {/* Upload Foto Komputer atau URL */}
            <div className="form-group">
              <label>Foto Menu (Upload dari Komputer ATAU Tulis URL Gambar)</label>
              <input
                type="text"
                placeholder="https://... atau upload file di bawah"
                value={adminMenuForm.imageUrl.startsWith('data:image') ? '(Gambar File Lokal Terunggah)' : adminMenuForm.imageUrl}
                onChange={e => setAdminMenuForm({ ...adminMenuForm, imageUrl: e.target.value })}
              />

              <div className="file-upload-box" style={{ marginTop: '0.5rem' }}>
                <span>📁 Klik atau Tarik File Foto dari Komputer/Laptop</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    if (file) {
                      try {
                        const b64 = await readFileAsDataUrl(file)
                        setAdminMenuForm({ ...adminMenuForm, imageUrl: b64 })
                        showToast('🖼️ Foto berhasil diunggah dari komputer!')
                      } catch (err) {
                        alert('Gagal mengunggah foto.')
                      }
                    }
                  }}
                />
              </div>

              {adminMenuForm.imageUrl && (
                <img src={adminMenuForm.imageUrl} alt="Preview" className="file-upload-preview" />
              )}
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Ikon Emoji</label>
                <input
                  type="text"
                  value={adminMenuForm.icon}
                  onChange={e => setAdminMenuForm({ ...adminMenuForm, icon: e.target.value })}
                  placeholder="🍲"
                />
              </div>

              <div className="form-group">
                <label>Stok Awal</label>
                <input
                  type="number"
                  value={adminMenuForm.stock}
                  onChange={e => setAdminMenuForm({ ...adminMenuForm, stock: e.target.value })}
                  placeholder="40"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Deskripsi Menu</label>
              <textarea
                rows={2}
                value={adminMenuForm.description}
                onChange={e => setAdminMenuForm({ ...adminMenuForm, description: e.target.value })}
                placeholder="Deskripsi kelezatan hidangan..."
              />
            </div>

            {/* Varian */}
            <div className="form-group" style={{ background: 'var(--surface-card)', padding: '1rem', borderRadius: '14px' }}>
              <label>➕ Varian / Topping Tambahan (Opsional)</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                <input
                  type="text"
                  placeholder="Nama varian (cth: Ekstra Telur)"
                  value={variantInput.name}
                  onChange={e => setVariantInput({ ...variantInput, name: e.target.value })}
                  style={{ flex: 2 }}
                />
                <input
                  type="number"
                  placeholder="Harga (0 jika gratis)"
                  value={variantInput.price}
                  onChange={e => setVariantInput({ ...variantInput, price: e.target.value })}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="item-order-btn"
                  onClick={() => {
                    if (variantInput.name.trim()) {
                      setAdminFormVariants([...adminFormVariants, { name: variantInput.name.trim(), price: Number(variantInput.price) || 0 }])
                      setVariantInput({ name: '', price: '' })
                    }
                  }}
                >
                  + Tambah
                </button>
              </div>

              {adminFormVariants.length > 0 && (
                <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {adminFormVariants.map((v, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.6rem', background: 'var(--bg-color)', borderRadius: '8px', fontSize: '0.85rem' }}>
                      <span>{v.name} ({formatRupiah(v.price)})</span>
                      <button
                        type="button"
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        onClick={() => setAdminFormVariants(adminFormVariants.filter((_, idx) => idx !== i))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="nav-tool-btn" onClick={() => setIsAdminAddModalOpen(false)}>Batal</button>
              <button className="item-order-btn" onClick={handleSaveMenu}>💾 Simpan Menu</button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: KOTAK GAMBAR SHOWCASE (BENTUK ALA CANVA & UPLOAD FOTO)
          ========================================================================= */}
      {isWidgetModalOpen && (
        <div className="modal-overlay" onClick={() => setIsWidgetModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close-x" onClick={() => setIsWidgetModalOpen(false)}>✕</button>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '1.25rem' }}>
              {editingWidgetId ? '✏️ Edit Kotak Gambar Showcase' : '➕ Tambah Kotak Gambar Baru'}
            </h2>

            <div className="form-group">
              <label>Judul Menu / Makanan *</label>
              <input
                type="text"
                placeholder="cth: Roti Bakar Keju Lumer"
                value={widgetForm.title}
                onChange={e => setWidgetForm({ ...widgetForm, title: e.target.value })}
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Badge Harga / Keterangan</label>
                <input
                  type="text"
                  placeholder="cth: Rp 15.000 atau Favorit!"
                  value={widgetForm.priceTag || ''}
                  onChange={e => setWidgetForm({ ...widgetForm, priceTag: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Posisi Kotak</label>
                <select
                  value={widgetForm.position}
                  onChange={e => setWidgetForm({ ...widgetForm, position: e.target.value as any })}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: '12px', color: 'inherit' }}
                >
                  <option value="left">Sisi Kiri Banner</option>
                  <option value="right">Sisi Kanan Banner</option>
                </select>
              </div>
            </div>

            {/* Bentuk Bentuk Ala Canva */}
            <div className="form-group">
              <label>Bentuk Kotak (Pilih Gaya Unik Ala Canva) *</label>
              <select
                value={widgetForm.shape}
                onChange={e => setWidgetForm({ ...widgetForm, shape: e.target.value as any })}
                style={{ width: '100%', padding: '0.75rem', background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: '12px', color: 'inherit' }}
              >
                <option value="rounded">Rounded Box (Sudut Membulat Rapi)</option>
                <option value="squircle">Squircle (Sudut Tumpul Modern)</option>
                <option value="tilt-left">Tilt Left (Miring Kiri Stiker)</option>
                <option value="tilt-right">Tilt Right (Miring Kanan)</option>
                <option value="polaroid">Polaroid Photo (Gaya Foto Cetak Putih)</option>
                <option value="pill">Pill Oval (Kapsul Melingkar)</option>
                <option value="circle">Circle Bubble (Lingkaran Penuh)</option>
                <option value="badge">Badge Ribbon (Bentuk Pita Penghargaan)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Upload Gambar dari Komputer / Masukkan Link URL *</label>
              <input
                type="text"
                placeholder="https://... atau upload file komputer"
                value={widgetForm.imageUrl.startsWith('data:image') ? '(Gambar File Komputer Terunggah)' : widgetForm.imageUrl}
                onChange={e => setWidgetForm({ ...widgetForm, imageUrl: e.target.value })}
              />

              <div className="file-upload-box" style={{ marginTop: '0.5rem' }}>
                <span>📁 Upload Gambar Makanan dari Komputer</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    if (file) {
                      try {
                        const b64 = await readFileAsDataUrl(file)
                        setWidgetForm({ ...widgetForm, imageUrl: b64 })
                        showToast('🖼️ Gambar kotak berhasil diunggah!')
                      } catch (err) {
                        alert('Gagal mengunggah gambar.')
                      }
                    }
                  }}
                />
              </div>

              {widgetForm.imageUrl && (
                <img src={widgetForm.imageUrl} alt="Preview" className="file-upload-preview" />
              )}
            </div>

            <div className="form-group">
              <label>Caption / Catatan Singkat</label>
              <input
                type="text"
                placeholder="cth: Kuah kental pedas nikmat"
                value={widgetForm.caption || ''}
                onChange={e => setWidgetForm({ ...widgetForm, caption: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="nav-tool-btn" onClick={() => setIsWidgetModalOpen(false)}>Batal</button>
              <button className="item-order-btn" onClick={handleSaveShowcaseWidget}>💾 Simpan Kotak Gambar</button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 6: ANGGOTA TIM PENGEMBANG
          ========================================================================= */}
      {isTeamModalOpen && (
        <div className="modal-overlay" onClick={() => setIsTeamModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close-x" onClick={() => setIsTeamModalOpen(false)}>✕</button>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '1.25rem' }}>
              {editingTeamId ? '✏️ Edit Identitas Pengembang' : '➕ Tambah Anggota Tim'}
            </h2>

            <div className="form-group">
              <label>Nama Lengkap Murid *</label>
              <input
                type="text"
                placeholder="cth: Ahmad Zaki Farhan"
                value={teamForm.name}
                onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Kelas *</label>
                <input
                  type="text"
                  placeholder="cth: XI MIPA 1"
                  value={teamForm.kelas}
                  onChange={e => setTeamForm({ ...teamForm, kelas: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Peran / Jabatan *</label>
                <input
                  type="text"
                  placeholder="cth: Frontend & UI Lead"
                  value={teamForm.role}
                  onChange={e => setTeamForm({ ...teamForm, role: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Upload Foto Avatar Murid / Masukkan Link</label>
              <input
                type="text"
                placeholder="https://... atau upload foto"
                value={teamForm.avatarUrl?.startsWith('data:image') ? '(Foto Terunggah)' : teamForm.avatarUrl || ''}
                onChange={e => setTeamForm({ ...teamForm, avatarUrl: e.target.value })}
              />
              <div className="file-upload-box" style={{ marginTop: '0.4rem' }}>
                <span>📁 Upload Foto Anggota dari Komputer</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    if (file) {
                      try {
                        const b64 = await readFileAsDataUrl(file)
                        setTeamForm({ ...teamForm, avatarUrl: b64 })
                        showToast('📸 Foto anggota berhasil diunggah!')
                      } catch (err) {
                        alert('Gagal mengunggah foto.')
                      }
                    }
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Keterangan / Bio Singkat</label>
              <textarea
                rows={2}
                placeholder="Keterangan kontribusi atau profil singkat..."
                value={teamForm.bio || ''}
                onChange={e => setTeamForm({ ...teamForm, bio: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="nav-tool-btn" onClick={() => setIsTeamModalOpen(false)}>Batal</button>
              <button className="item-order-btn" onClick={handleSaveTeamMember}>💾 Simpan Anggota</button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 7: PLATFORM MEDIA SOSIAL DINAMIS
          ========================================================================= */}
      {isSocialModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSocialModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close-x" onClick={() => setIsSocialModalOpen(false)}>✕</button>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '1.25rem' }}>
              {editingSocialId ? '✏️ Edit Media Sosial' : '➕ Tambah Platform Medsos Baru'}
            </h2>

            <div className="form-grid">
              <div className="form-group">
                <label>Nama Platform *</label>
                <input
                  type="text"
                  placeholder="cth: TikTok, Discord, YouTube, Telegram"
                  value={socialForm.platformName}
                  onChange={e => setSocialForm({ ...socialForm, platformName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Emoji Icon *</label>
                <input
                  type="text"
                  placeholder="cth: 🎵, 📸, 💬, 🎮"
                  value={socialForm.iconEmoji}
                  onChange={e => setSocialForm({ ...socialForm, iconEmoji: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Nama Akun / Kontak *</label>
              <input
                type="text"
                placeholder="cth: @manic_tala atau 0812345678"
                value={socialForm.handle}
                onChange={e => setSocialForm({ ...socialForm, handle: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Link URL Tujuan *</label>
              <input
                type="text"
                placeholder="cth: https://tiktok.com/@... atau https://wa.me/..."
                value={socialForm.url}
                onChange={e => setSocialForm({ ...socialForm, url: e.target.value })}
              />
            </div>

            <div className="color-input-row" style={{ marginTop: '0.85rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Warna Tombol / Badge</label>
              <input
                type="color"
                value={socialForm.badgeColor}
                onChange={e => setSocialForm({ ...socialForm, badgeColor: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="nav-tool-btn" onClick={() => setIsSocialModalOpen(false)}>Batal</button>
              <button className="item-order-btn" onClick={handleSaveSocialPlatform}>💾 Simpan Medsos</button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 8: TAMBAH STIKER BUBBLE HERO (BIRU/UNGU/KUNING)
          ========================================================================= */}
      {isBadgeModalOpen && (
        <div className="modal-overlay" onClick={() => setIsBadgeModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close-x" onClick={() => setIsBadgeModalOpen(false)}>✕</button>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '1.25rem' }}>
              ➕ Tambah Stiker Bubble Hero Baru
            </h2>

            <div className="form-group">
              <label>Teks Stiker Bubble *</label>
              <input
                type="text"
                placeholder="cth: 🥗 Menu Sehat Bebas MSG"
                value={badgeForm.text}
                onChange={e => setBadgeForm({ ...badgeForm, text: e.target.value })}
              />
            </div>

            <div className="form-grid">
              <div className="color-input-row">
                <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Warna Background</label>
                <input
                  type="color"
                  value={badgeForm.bg}
                  onChange={e => setBadgeForm({ ...badgeForm, bg: e.target.value })}
                />
              </div>

              <div className="color-input-row">
                <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Warna Teks</label>
                <input
                  type="color"
                  value={badgeForm.textColor}
                  onChange={e => setBadgeForm({ ...badgeForm, textColor: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="nav-tool-btn" onClick={() => setIsBadgeModalOpen(false)}>Batal</button>
              <button
                className="item-order-btn"
                onClick={() => {
                  if (!badgeForm.text.trim()) {
                    alert('Teks stiker wajib diisi!')
                    return
                  }
                  setHeroBadges([...heroBadges, { ...badgeForm, id: 'b_' + Date.now() }])
                  setIsBadgeModalOpen(false)
                  showToast('✨ Stiker bubble baru berhasil ditambahkan!')
                }}
              >
                💾 Simpan Stiker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: GATEWAY WELCOME ACCESS PORTAL (PILIH MASUK AKUN / TAMU / ADMIN)
          ========================================================================= */}
      {isWelcomeGatewayOpen && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="gateway-modal-box">
            <div className="gateway-badge-glow">✨ SISTEM KANTIN ASRAMA MAN IC TALA</div>
            <div className="gateway-logo">{storeIdentity.logoEmoji || '🍟'}</div>
            <h2 className="gateway-title">{storeIdentity.brandName} <span style={{ color: 'var(--primary-color)' }}>{storeIdentity.brandSuffix}</span></h2>
            <p className="gateway-subtitle">
              Selamat datang! Silakan pilih akses masuk Anda untuk mulai menggunakan sistem:
            </p>

            <div className="gateway-options-grid">
              {/* Opsi 1: Akun Murid */}
              <div
                className="gateway-card-btn"
                onClick={() => {
                  sessionStorage.setItem('ic_gateway_chosen', 'true')
                  setIsWelcomeGatewayOpen(false)
                  setViewRole('customer')
                  setIsAuthModalOpen(true)
                }}
              >
                <div className="gateway-card-icon" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>🎓</div>
                <div className="gateway-card-content">
                  <h3>Masuk ke Akun Murid</h3>
                  <p>Login atau daftar akun murid MAN IC Tala. Simpan kamar asrama & lacak status pengantaran.</p>
                </div>
                <span className="gateway-arrow-pill">Masuk ➔</span>
              </div>

              {/* Opsi 2: Admin Kantin */}
              <div
                className="gateway-card-btn"
                onClick={() => {
                  sessionStorage.setItem('ic_gateway_chosen', 'true')
                  setIsWelcomeGatewayOpen(false)
                  setIsAdminPasswordModalOpen(true)
                }}
              >
                <div className="gateway-card-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>👑</div>
                <div className="gateway-card-content">
                  <h3>Masuk sebagai Admin</h3>
                  <p>Khusus pengelola & staf kantin. Tambah menu, edit poster makanan & kelola pesanan.</p>
                </div>
                <span className="gateway-arrow-pill" style={{ background: '#7c3aed' }}>Admin ➔</span>
              </div>

              {/* Opsi 3: Masuk sebagai Tamu */}
              <div
                className="gateway-card-btn"
                onClick={() => {
                  sessionStorage.setItem('ic_gateway_chosen', 'true')
                  setIsWelcomeGatewayOpen(false)
                  setViewRole('customer')
                  showToast('👋 Selamat datang! Anda masuk sebagai Tamu. Silakan pilih menu.')
                }}
              >
                <div className="gateway-card-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>🚀</div>
                <div className="gateway-card-content">
                  <h3>Jelajahi Menu Langsung (Tamu)</h3>
                  <p>Lihat daftar menu, harga, promo poster & pesan langsung tanpa login akun.</p>
                </div>
                <span className="gateway-arrow-pill" style={{ background: '#10b981' }}>Lihat Menu ➔</span>
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              💡 Anda dapat mengganti peran kapan saja melalui tombol "Ganti Akses" di bagian atas layar.
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: SINKRONISASI & TRANSFER DATA MENU ANTAR TEMAN / LAPTOP LAIN
          ========================================================================= */}
      {isSyncModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSyncModalOpen(false)}>
          <div className="sync-modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close-x" onClick={() => setIsSyncModalOpen(false)}>✕</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '2rem' }}>🌐</span>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 900 }}>Sinkronisasi Data Menu Antar Teman</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Kirim & terima data menu baru yang ditambahkan teman di perangkat berbeda.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface-card)', padding: '0.35rem', borderRadius: '14px', margin: '1rem 0' }}>
              <button
                className={`cat-chip ${syncTab === 'export' ? 'active' : ''}`}
                style={{ flex: 1, padding: '0.5rem' }}
                onClick={() => {
                  setSyncTab('export')
                  handleExportSyncData()
                }}
              >
                📤 Salin / Ekspor Data
              </button>
              <button
                className={`cat-chip ${syncTab === 'import' ? 'active' : ''}`}
                style={{ flex: 1, padding: '0.5rem' }}
                onClick={() => setSyncTab('import')}
              >
                📥 Tempel / Impor dari Teman
              </button>
            </div>

            {syncTab === 'export' ? (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                  Salin kode sinkronisasi ini lalu kirimkan ke temanmu via WhatsApp atau Chat. Temanmu cukup membuka menu ini lalu menempelkannya di tab <strong>"Tempel / Impor"</strong>.
                </p>
                <textarea
                  className="sync-textarea"
                  value={syncCodeOutput}
                  readOnly
                  onClick={e => (e.target as HTMLTextAreaElement).select()}
                />
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    className="item-order-btn"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={handleExportSyncData}
                  >
                    📋 Salin Kode Sinkronisasi
                  </button>
                  <button
                    className="nav-tool-btn"
                    onClick={handleDownloadBackupFile}
                  >
                    💾 Unduh File .json
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                  Tempelkan teks kode sinkronisasi yang dikirim oleh temanmu ke dalam kotak di bawah ini, lalu klik <strong>"Muat Data Teman"</strong>:
                </p>
                <textarea
                  className="sync-textarea"
                  placeholder="Tempel kode sinkronisasi dari teman di sini..."
                  value={syncCodeInput}
                  onChange={e => setSyncCodeInput(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    className="item-order-btn"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => handleImportSyncData(syncCodeInput)}
                    disabled={!syncCodeInput.trim()}
                  >
                    ⚡ Muat Data Teman & Terapkan Sekarang
                  </button>
                  <label className="nav-tool-btn" style={{ cursor: 'pointer' }}>
                    📁 Pilih File .json
                    <input
                      type="file"
                      accept=".json"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = ev => {
                            if (ev.target?.result) {
                              handleImportSyncData(ev.target.result as string)
                            }
                          }
                          reader.readAsText(file)
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADMIN TAMBAH & EDIT BANNER POSTER MAKANAN (MAXIMALISME)
          ========================================================================= */}
      {isPosterModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPosterModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close-x" onClick={() => setIsPosterModalOpen(false)}>✕</button>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '1.25rem' }}>
              {editingPosterId ? '✏️ Edit Banner Poster Makanan' : '➕ Tambah Banner Poster Makanan'}
            </h2>

            <div className="form-group">
              <label>Judul Poster Promo *</label>
              <input
                type="text"
                placeholder="cth: 🔥 SUPER GEPREK CRISPY COMBO"
                value={posterForm.title}
                onChange={e => setPosterForm({ ...posterForm, title: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Deskripsi Singkat / Tagline *</label>
              <input
                type="text"
                placeholder="cth: Ayam Krispi Sambal Korek Asli + Nasi Pulen + Es Teh Manis Jumbo"
                value={posterForm.subtitle}
                onChange={e => setPosterForm({ ...posterForm, subtitle: e.target.value })}
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Label Stiker Promo / Badge</label>
                <input
                  type="text"
                  placeholder="cth: DISKON 35% 🔥 atau BEST SELLER"
                  value={posterForm.badgeText}
                  onChange={e => setPosterForm({ ...posterForm, badgeText: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Label Harga / Promo Tag</label>
                <input
                  type="text"
                  placeholder="cth: Rp 22.000 atau Mulai Rp 15rb"
                  value={posterForm.priceTag || ''}
                  onChange={e => setPosterForm({ ...posterForm, priceTag: e.target.value })}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Posisi Sisi Halaman</label>
                <select
                  value={posterForm.position}
                  onChange={e => setPosterForm({ ...posterForm, position: e.target.value as any })}
                >
                  <option value="left">⬅️ Sisi Kiri (Left Wing)</option>
                  <option value="right">➡️ Sisi Kanan (Right Wing)</option>
                </select>
              </div>

              <div className="color-input-row" style={{ marginTop: '1.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Warna Stiker</label>
                <input
                  type="color"
                  value={posterForm.badgeColor || '#07152aff'}
                  onChange={e => setPosterForm({ ...posterForm, badgeColor: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Tautkan ke Menu Makanan (Saat Diklik Otomatis Buka Pesanan)</label>
              <select
                value={posterForm.targetMenuName || ''}
                onChange={e => setPosterForm({ ...posterForm, targetMenuName: e.target.value })}
              >
                <option value="">-- Tanpa Tautan Langsung --</option>
                {menus.map(m => (
                  <option key={m.id} value={m.name}>{m.name} ({formatRupiah(m.price)})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Unggah Gambar dari File Komputer / HP</label>
              <input
                type="file"
                accept="image/*"
                onChange={async e => {
                  const file = e.target.files?.[0]
                  if (file) {
                    try {
                      const dataUrl = await readFileAsDataUrl(file)
                      setPosterForm({ ...posterForm, imageUrl: dataUrl })
                      showToast('📸 Foto poster berhasil dimuat!')
                    } catch (err) {
                      alert('Gagal membaca file gambar.')
                    }
                  }
                }}
              />
            </div>

            <div className="form-group">
              <label>Atau Gunakan URL Gambar Online</label>
              <input
                type="text"
                placeholder="https://..."
                value={posterForm.imageUrl}
                onChange={e => setPosterForm({ ...posterForm, imageUrl: e.target.value })}
              />
            </div>

            {posterForm.imageUrl && (
              <div style={{ marginBottom: '1.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Pratinjau Gambar Poster:</div>
                <img
                  src={posterForm.imageUrl}
                  alt="Preview"
                  style={{ maxHeight: '140px', borderRadius: '14px', objectFit: 'cover', border: '1px solid var(--surface-border)' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="nav-tool-btn" onClick={() => setIsPosterModalOpen(false)}>Batal</button>
              <button className="item-order-btn" onClick={handleSavePoster}>
                💾 Simpan Poster
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
