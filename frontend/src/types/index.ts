export interface City {
  id: number;
  name: string;
  isActive: boolean;
  visitDates?: CityVisitDate[];
}

export interface CityVisitDate {
  id: number;
  cityId: number;
  date: string;
}

export interface Category {
  id: number;
  name: string;
  imageUrl?: string;
  cloudinaryPublicId?: string;
  _count?: { products: number };
}

export interface ProductImage {
  url: string;
  publicId: string;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  categoryId: number;
  category?: Category;
  stock: number;
  price: number;
  images: ProductImage[];
  mainImageIndex: number;
  isActive: boolean;
  createdAt: string;
}

export interface Client {
  id: number;
  localName: string;
  address: string;
  cityId?: number;
  city?: City;
  phone: string;
  email?: string;
  cashbackBalance: number;
  totalCashbackEarned: number;
  createdAt: string;
}

export type CashbackRuleType = 'GLOBAL' | 'MIN_AMOUNT' | 'DATE_RANGE' | 'SPECIFIC_DATE' | 'CATEGORY' | 'PRODUCT';

export interface CashbackRule {
  id: number;
  type: CashbackRuleType;
  percentage: number;
  minAmount?: number;
  startDate?: string;
  endDate?: string;
  specificDates?: string[];
  categoryId?: number;
  category?: Category;
  productId?: number;
  product?: Product;
  isActive: boolean;
  createdAt: string;
}

export interface GlobalCashbackConfig {
  id: number;
  stackRules: boolean;
  maxPercentage?: number;
  balanceExpiryDays?: number;
}

export interface CashbackTransaction {
  id: number;
  clientId: number;
  orderId?: number;
  amount: number;
  type: 'EARNED' | 'USED';
  ruleDescription?: string;
  createdAt: string;
  order?: { id: number; createdAt: string; totalAmount: number };
}

export type OrderStatus = 'PENDING' | 'PREPARING' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  product?: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: number;
  clientId: number;
  client?: Client;
  status: OrderStatus;
  deliveryDate: string;
  preferredTimeRange: string;
  notes?: string;
  totalAmount: number;
  cashbackUsed: number;
  cashbackEarned: number;
  createdAt: string;
  items?: OrderItem[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface GlobalConfig {
  id: number;
  lowStockThreshold: number;
  adminWhatsappNumber: string;
  emailFrom: string;
  bronzeThreshold: number;
  silverThreshold: number;
  goldThreshold: number;
  tierPeriodType: string;
  tierGracePeriodDays: number;
  tierGraceRetainPercent: number;
}

export type UserRole = 'admin' | 'client';

export interface AuthState {
  role: UserRole | null;
  client: Client | null;
  adminId: number | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
