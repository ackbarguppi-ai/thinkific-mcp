/**
 * Thinkific API type definitions.
 *
 * These interfaces model the JSON responses returned by
 * the Thinkific REST Admin API v1.
 *
 * @see https://developers.thinkific.com/api/api-documentation
 */

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Standard pagination envelope returned by every list endpoint. */
export interface PaginationMeta {
  pagination: {
    current_page: number;
    next_page: number | null;
    prev_page: number | null;
    total_pages: number;
    total_items: number;
  };
}

/** Generic paginated response wrapper. */
export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export interface Course {
  id: number;
  name: string;
  slug: string;
  subtitle: string | null;
  product_id: number | null;
  description: string | null;
  intro_video_youtube: string | null;
  contact_information: string | null;
  course_card_image_url: string | null;
  course_card_text: string | null;
  instructor_id: number | null;
  chapter_ids: number[];
  reviews_enabled: boolean;
  keywords: string | null;
  user_id: number | null;
  administrator_user_ids: number[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

export interface Chapter {
  id: number;
  name: string;
  course_id: number;
  position: number;
  description: string | null;
  content_ids: number[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Contents (Lessons)
// ---------------------------------------------------------------------------

export interface Content {
  id: number;
  name: string;
  chapter_id: number;
  content_type: string;
  position: number;
  free: boolean;
  description: string | null;
  take_url: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface CustomProfileField {
  id: number;
  label: string;
  value: string | null;
  custom_profile_field_definition_id: number;
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  company: string | null;
  email: string;
  external_source: string | null;
  roles: string[];
  avatar_url: string | null;
  affiliate_code: string | null;
  affiliate_commission: number | null;
  affiliate_commission_type: string | null;
  custom_profile_fields: CustomProfileField[];
  created_at: string;
}

export interface CreateUserPayload {
  first_name: string;
  last_name: string;
  email: string;
  password?: string;
  roles?: string[];
  company?: string;
  external_source?: string;
  send_welcome_email?: boolean;
  custom_profile_field_definitions?: Array<{ id: number; value: string }>;
}

// ---------------------------------------------------------------------------
// Enrollments
// ---------------------------------------------------------------------------

export interface Enrollment {
  id: number;
  user_id: number;
  user_email: string;
  course_id: number;
  course_name: string;
  percentage_completed: number;
  completed: boolean;
  started_at: string | null;
  completed_at: string | null;
  activated_at: string | null;
  expires_at: string | null;
  is_free_trial: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEnrollmentPayload {
  course_id: number;
  user_id: number;
  activated_at?: string;
  expiry_date?: string;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface Order {
  id: number;
  user_id: number;
  user_email: string;
  product_id: number;
  product_name: string;
  amount_dollars: number;
  amount_cents: number;
  coupon_code: string | null;
  coupon_id: number | null;
  created_at: string;
  order_type: string | null;
  status: string | null;
  payment_type: string | null;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface Product {
  id: number;
  name: string;
  slug: string;
  product_type: string;
  price: string | null;
  position: number;
  status: string;
  description: string | null;
  card_image_url: string | null;
  course_ids: number[];
  related_course_ids: number[];
  created_at: string;
}

// ---------------------------------------------------------------------------
// Bundles
// ---------------------------------------------------------------------------

export interface Bundle {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  courses: number[];
  banner_image_url: string | null;
  bundle_card_image_url: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export interface Coupon {
  id: number;
  code: string;
  note: string | null;
  quantity: number | null;
  quantity_used: number;
  discount_type: string;
  discount_amount: number;
  product_ids: number[];
  expires_at: string | null;
  created_at: string;
}

export interface CreateCouponPayload {
  code: string;
  note?: string;
  quantity?: number;
  discount_type: "percentage" | "fixed";
  discount_amount: number;
  product_ids?: number[];
  course_ids?: number[];
  expires_at?: string;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export interface Group {
  id: number;
  name: string;
  token: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Instructors
// ---------------------------------------------------------------------------

export interface Instructor {
  id: number;
  first_name: string;
  last_name: string;
  title: string | null;
  slug: string;
  bio: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Course Reviews
// ---------------------------------------------------------------------------

export interface CourseReview {
  id: number;
  title: string | null;
  review_text: string | null;
  rating: number;
  user_id: number;
  course_id: number;
  approved: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Promotions
// ---------------------------------------------------------------------------

export interface Promotion {
  id: number;
  name: string;
  description: string | null;
  discount_type: string;
  discount_amount: number;
  starts_at: string | null;
  expires_at: string | null;
  coupon_ids: number[];
  product_ids: number[];
  created_at: string;
}

// ---------------------------------------------------------------------------
// Custom Profile Field Definitions
// ---------------------------------------------------------------------------

export interface CustomProfileFieldDefinition {
  id: number;
  label: string;
  field_type: string;
  required: boolean;
  position: number;
  choices: string[] | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// External Orders
// ---------------------------------------------------------------------------

export interface ExternalOrder {
  id: number;
  user_id: number;
  user_email: string;
  product_id: number;
  product_name: string;
  amount_cents: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Group Users
// ---------------------------------------------------------------------------

export interface GroupUser {
  id: number;
  group_id: number;
  user_id: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Group Analysts
// ---------------------------------------------------------------------------

export interface GroupAnalyst {
  id: number;
  user_id: number;
  group_id: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Product Publish Requests
// ---------------------------------------------------------------------------

export interface ProductPublishRequest {
  id: number;
  product_id: number;
  product_name: string;
  status: string;
  requester_id: number;
  reviewer_id: number | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Site Scripts
// ---------------------------------------------------------------------------

export interface SiteScript {
  id: number;
  name: string;
  content: string;
  location: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Bundle Enrollment
// ---------------------------------------------------------------------------

export interface BundleEnrollment {
  id: number;
  bundle_id: number;
  user_id: number;
  user_email: string;
  activated_at: string | null;
  expiry_date: string | null;
  is_free_trial: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Auth config
// ---------------------------------------------------------------------------

/** Resolved authentication configuration. */
export interface ThinkificAuthConfig {
  mode: "api_key" | "oauth";
  apiKey?: string;
  subdomain?: string;
  oauthToken?: string;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Structured error thrown by the Thinkific API client. */
export class ThinkificApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
    public readonly endpoint: string,
  ) {
    super(message);
    this.name = "ThinkificApiError";
  }
}
