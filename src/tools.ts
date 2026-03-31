/**
 * MCP tool definitions and handlers for the Thinkific API.
 *
 * Each tool maps to one or more Thinkific REST endpoints and includes
 * full input validation via JSON Schema, pagination support, and
 * structured error responses.
 *
 * @module tools
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ThinkificClient } from "./client.js";
import type {
  Course,
  Chapter,
  Content,
  User,
  Enrollment,
  Order,
  Product,
  Bundle,
  Coupon,
  Group,
  Instructor,
  CourseReview,
  Promotion,
  Category,
  PaginatedResponse,
  CreateUserPayload,
  CreateEnrollmentPayload,
  CreateCouponPayload,
  CustomProfileFieldDefinition,
  ExternalOrder,
  GroupUser,
  GroupAnalyst,
  ProductPublishRequest,
  SiteScript,
  BundleEnrollment,
} from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a paginated response into a readable text block for the LLM. */
function formatPaginated<T>(
  label: string,
  data: PaginatedResponse<T>,
  formatter: (item: T) => string,
): string {
  const { pagination } = data.meta;
  const header = `${label} (page ${pagination.current_page}/${pagination.total_pages}, ${pagination.total_items} total)`;
  if (data.items.length === 0) {
    return `${header}\n\nNo items found.`;
  }
  const lines = data.items.map(formatter);
  return `${header}\n\n${lines.join("\n\n")}`;
}

/** Safely format a single item response. */
function formatSingle<T>(label: string, item: T, formatter: (item: T) => string): string {
  return `${label}\n\n${formatter(item)}`;
}

/** Wrap handler logic with structured error handling. */
async function handleTool(fn: () => Promise<string>): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    const text = await fn();
    return { content: [{ type: "text" as const, text }] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `Error: ${message}` }] };
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtCourse(c: Course): string {
  return [
    `📚 [${c.id}] ${c.name}`,
    c.slug ? `   Slug: ${c.slug}` : null,
    c.subtitle ? `   Subtitle: ${c.subtitle}` : null,
    c.description ? `   Description: ${c.description.slice(0, 200)}${c.description.length > 200 ? "…" : ""}` : null,
    `   Chapters: ${c.chapter_ids?.length ?? 0}`,
    c.instructor_id ? `   Instructor ID: ${c.instructor_id}` : null,
    `   Created: ${c.created_at}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtChapter(ch: Chapter): string {
  return [
    `📖 [${ch.id}] ${ch.name}`,
    `   Course ID: ${ch.course_id}`,
    `   Position: ${ch.position}`,
    `   Lessons: ${ch.content_ids?.length ?? 0}`,
    ch.description ? `   Description: ${ch.description.slice(0, 150)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtContent(c: Content): string {
  return [
    `📄 [${c.id}] ${c.name}`,
    `   Type: ${c.content_type}`,
    `   Chapter ID: ${c.chapter_id}`,
    `   Position: ${c.position}`,
    `   Free: ${c.free}`,
    c.description ? `   Description: ${c.description.slice(0, 150)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtUser(u: User): string {
  return [
    `👤 [${u.id}] ${u.full_name}`,
    `   Email: ${u.email}`,
    u.company ? `   Company: ${u.company}` : null,
    `   Roles: ${u.roles?.join(", ") || "none"}`,
    `   Created: ${u.created_at}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtEnrollment(e: Enrollment): string {
  return [
    `🎓 [${e.id}] ${e.course_name}`,
    `   User: ${e.user_email} (ID: ${e.user_id})`,
    `   Progress: ${e.percentage_completed}%${e.completed ? " ✅ Completed" : ""}`,
    e.started_at ? `   Started: ${e.started_at}` : null,
    e.completed_at ? `   Completed: ${e.completed_at}` : null,
    e.expires_at ? `   Expires: ${e.expires_at}` : null,
    `   Created: ${e.created_at}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtOrder(o: Order): string {
  return [
    `🧾 [${o.id}] ${o.product_name}`,
    `   User: ${o.user_email} (ID: ${o.user_id})`,
    `   Amount: $${o.amount_dollars}`,
    o.status ? `   Status: ${o.status}` : null,
    o.payment_type ? `   Payment: ${o.payment_type}` : null,
    o.coupon_code ? `   Coupon: ${o.coupon_code}` : null,
    `   Created: ${o.created_at}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtProduct(p: Product): string {
  return [
    `📦 [${p.id}] ${p.name}`,
    `   Type: ${p.product_type}`,
    p.price ? `   Price: $${p.price}` : `   Price: Free`,
    `   Status: ${p.status}`,
    `   Slug: ${p.slug}`,
    `   Courses: ${p.course_ids?.length ?? 0}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtBundle(b: Bundle): string {
  return [
    `📦 [${b.id}] ${b.name}`,
    `   Slug: ${b.slug}`,
    b.description ? `   Description: ${b.description.slice(0, 150)}` : null,
    `   Courses: ${b.courses?.length ?? 0}`,
    `   Created: ${b.created_at}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtCoupon(c: Coupon): string {
  return [
    `🏷️ [${c.id}] ${c.code}`,
    `   Discount: ${c.discount_amount}${c.discount_type === "percentage" ? "%" : " (fixed)"}`,
    c.quantity != null ? `   Quantity: ${c.quantity_used}/${c.quantity}` : `   Quantity: unlimited (${c.quantity_used} used)`,
    c.note ? `   Note: ${c.note}` : null,
    c.expires_at ? `   Expires: ${c.expires_at}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtGroup(g: Group): string {
  return [
    `👥 [${g.id}] ${g.name}`,
    g.token ? `   Token: ${g.token}` : null,
    `   Created: ${g.created_at}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtInstructor(i: Instructor): string {
  return [
    `🧑‍🏫 [${i.id}] ${i.first_name} ${i.last_name}`,
    i.title ? `   Title: ${i.title}` : null,
    i.email ? `   Email: ${i.email}` : null,
    i.bio ? `   Bio: ${i.bio.slice(0, 150)}` : null,
    `   Slug: ${i.slug}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtReview(r: CourseReview): string {
  return [
    `⭐ [${r.id}] Rating: ${r.rating}/5`,
    r.title ? `   Title: ${r.title}` : null,
    r.review_text ? `   Review: ${r.review_text.slice(0, 200)}` : null,
    `   User ID: ${r.user_id} | Course ID: ${r.course_id}`,
    `   Approved: ${r.approved}`,
    `   Created: ${r.created_at}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtPromotion(p: Promotion): string {
  return [
    `🎉 [${p.id}] ${p.name}`,
    p.description ? `   Description: ${p.description.slice(0, 150)}` : null,
    `   Discount: ${p.discount_amount}${p.discount_type === "percentage" ? "%" : " (fixed)"}`,
    p.starts_at ? `   Starts: ${p.starts_at}` : null,
    p.expires_at ? `   Expires: ${p.expires_at}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtCategory(c: Category): string {
  return [
    `📂 [${c.id}] ${c.name}`,
    `   Slug: ${c.slug}`,
    c.description ? `   Description: ${c.description.slice(0, 150)}` : null,
    `   Created: ${c.created_at}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtCustomProfileFieldDef(f: CustomProfileFieldDefinition): string {
  return [
    `📋 [${f.id}] ${f.label}`,
    `   Type: ${f.field_type}`,
    `   Required: ${f.required}`,
    `   Position: ${f.position}`,
    f.choices?.length ? `   Choices: ${f.choices.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtExternalOrder(o: ExternalOrder): string {
  return [
    `🧾 [${o.id}] ${o.product_name}`,
    `   User: ${o.user_email} (ID: ${o.user_id})`,
    `   Amount: $${(o.amount_cents / 100).toFixed(2)}`,
    `   Created: ${o.created_at}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtProductPublishRequest(r: ProductPublishRequest): string {
  return [
    `📢 [${r.id}] ${r.product_name}`,
    `   Product ID: ${r.product_id}`,
    `   Status: ${r.status}`,
    `   Requester ID: ${r.requester_id}`,
    r.reviewer_id ? `   Reviewer ID: ${r.reviewer_id}` : null,
    `   Created: ${r.created_at}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtSiteScript(s: SiteScript): string {
  return [
    `📜 [${s.id}] ${s.name}`,
    `   Location: ${s.location}`,
    `   Enabled: ${s.enabled}`,
    `   Content preview: ${s.content.slice(0, 100)}${s.content.length > 100 ? "…" : ""}`,
    `   Created: ${s.created_at}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtBundleEnrollment(e: BundleEnrollment): string {
  return [
    `🎓 [${e.id}] Bundle Enrollment`,
    `   User: ${e.user_email} (ID: ${e.user_id})`,
    `   Bundle ID: ${e.bundle_id}`,
    e.activated_at ? `   Activated: ${e.activated_at}` : null,
    e.expiry_date ? `   Expires: ${e.expiry_date}` : null,
    `   Free Trial: ${e.is_free_trial}`,
    `   Created: ${e.created_at}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtGroupAnalyst(a: GroupAnalyst): string {
  return [
    `👤 [${a.id}] Analyst`,
    `   User ID: ${a.user_id}`,
    `   Group ID: ${a.group_id}`,
    `   Created: ${a.created_at}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register all Thinkific tools on the given MCP server instance.
 *
 * @param server - The MCP server to register tools on.
 * @param client - Authenticated Thinkific API client.
 */
export function registerTools(server: McpServer, client: ThinkificClient): void {
  // ── Courses ────────────────────────────────────────────────────────

  server.tool(
    "list_courses",
    "List courses on the Thinkific site with pagination.",
    {
      page: z.number().int().positive().optional().describe("Page number (1-based). Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page (1-250). Default: 25"),
    },
    async ({ page, limit }) =>
      handleTool(async () => {
        const data = await client.list<Course>("/courses", page ?? 1, limit ?? 25);
        return formatPaginated("Courses", data, fmtCourse);
      }),
  );

  server.tool(
    "get_course",
    "Get detailed information about a specific course by ID.",
    {
      course_id: z.number().int().positive().describe("The course ID"),
    },
    async ({ course_id }) =>
      handleTool(async () => {
        const course = await client.get<Course>(`/courses/${course_id}`);
        return formatSingle("Course Details", course, fmtCourse);
      }),
  );

  // ── Chapters ───────────────────────────────────────────────────────

  server.tool(
    "list_chapters",
    "List chapters (sections) within a course.",
    {
      course_id: z.number().int().positive().describe("The course ID to list chapters for"),
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ course_id, page, limit }) =>
      handleTool(async () => {
        const data = await client.list<Chapter>(
          "/chapters",
          page ?? 1,
          limit ?? 25,
          { "query[course_id]": course_id },
        );
        return formatPaginated(`Chapters for Course ${course_id}`, data, fmtChapter);
      }),
  );

  // ── Contents (Lessons) ─────────────────────────────────────────────

  server.tool(
    "list_contents",
    "List content/lessons within a chapter.",
    {
      chapter_id: z.number().int().positive().describe("The chapter ID to list contents for"),
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ chapter_id, page, limit }) =>
      handleTool(async () => {
        const data = await client.list<Content>(
          "/contents",
          page ?? 1,
          limit ?? 25,
          { "query[chapter_id]": chapter_id },
        );
        return formatPaginated(`Contents for Chapter ${chapter_id}`, data, fmtContent);
      }),
  );

  // ── Users ──────────────────────────────────────────────────────────

  server.tool(
    "list_users",
    "List all users/students on the Thinkific site.",
    {
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ page, limit }) =>
      handleTool(async () => {
        const data = await client.list<User>("/users", page ?? 1, limit ?? 25);
        return formatPaginated("Users", data, fmtUser);
      }),
  );

  server.tool(
    "get_user",
    "Get detailed information about a specific user by ID.",
    {
      user_id: z.number().int().positive().describe("The user ID"),
    },
    async ({ user_id }) =>
      handleTool(async () => {
        const user = await client.get<User>(`/users/${user_id}`);
        return formatSingle("User Details", user, fmtUser);
      }),
  );

  server.tool(
    "create_user",
    "Create a new user/student on the Thinkific site.",
    {
      first_name: z.string().min(1).describe("User's first name"),
      last_name: z.string().min(1).describe("User's last name"),
      email: z.string().email().describe("User's email address"),
      password: z.string().optional().describe("Password (optional — user will set via email if omitted)"),
      roles: z.array(z.string()).optional().describe('Roles (e.g. ["affiliate"]). Default: student'),
      company: z.string().optional().describe("Company name"),
      send_welcome_email: z.boolean().optional().describe("Send welcome email. Default: true"),
    },
    async (params) =>
      handleTool(async () => {
        const payload: CreateUserPayload = {
          first_name: params.first_name,
          last_name: params.last_name,
          email: params.email,
        };
        if (params.password) payload.password = params.password;
        if (params.roles) payload.roles = params.roles;
        if (params.company) payload.company = params.company;
        if (params.send_welcome_email !== undefined)
          payload.send_welcome_email = params.send_welcome_email;

        const user = await client.post<User>("/users", payload);
        return formatSingle("User Created", user, fmtUser);
      }),
  );

  server.tool(
    "search_users",
    "Search for users by email address. The Thinkific API filters users by exact or partial email match.",
    {
      query: z.string().min(1).describe("Email address (or partial email) to search for"),
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ query, page, limit }) =>
      handleTool(async () => {
        const extra: Record<string, string> = {
          "query[email]": query,
        };

        const data = await client.list<User>("/users", page ?? 1, limit ?? 25, extra);
        return formatPaginated(`User Search: "${query}"`, data, fmtUser);
      }),
  );

  // ── Enrollments ────────────────────────────────────────────────────

  server.tool(
    "list_enrollments",
    "List enrollments with optional filtering by user or course.",
    {
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
      query_user_id: z.number().int().positive().optional().describe("Filter by user ID"),
      query_course_id: z.number().int().positive().optional().describe("Filter by course ID"),
      query_email: z.string().optional().describe("Filter by user email"),
    },
    async ({ page, limit, query_user_id, query_course_id, query_email }) =>
      handleTool(async () => {
        const extra: Record<string, string | number> = {};
        if (query_user_id) extra["query[user_id]"] = query_user_id;
        if (query_course_id) extra["query[course_id]"] = query_course_id;
        if (query_email) extra["query[email]"] = query_email;

        const data = await client.list<Enrollment>("/enrollments", page ?? 1, limit ?? 25, extra);
        return formatPaginated("Enrollments", data, fmtEnrollment);
      }),
  );

  server.tool(
    "create_enrollment",
    "Enroll a user in a course.",
    {
      course_id: z.number().int().positive().describe("Course ID to enroll the user in"),
      user_id: z.number().int().positive().describe("User ID to enroll"),
      activated_at: z.string().optional().describe("Activation date (ISO 8601). Defaults to now."),
      expiry_date: z.string().optional().describe("Expiry date (ISO 8601). Optional."),
    },
    async (params) =>
      handleTool(async () => {
        const payload: CreateEnrollmentPayload = {
          course_id: params.course_id,
          user_id: params.user_id,
        };
        if (params.activated_at) payload.activated_at = params.activated_at;
        if (params.expiry_date) payload.expiry_date = params.expiry_date;

        const enrollment = await client.post<Enrollment>("/enrollments", payload);
        return formatSingle("Enrollment Created", enrollment, fmtEnrollment);
      }),
  );

  // ── Orders ─────────────────────────────────────────────────────────

  server.tool(
    "list_orders",
    "List orders with optional filtering.",
    {
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
      query_user_id: z.number().int().positive().optional().describe("Filter by user ID"),
      query_email: z.string().optional().describe("Filter by user email"),
    },
    async ({ page, limit, query_user_id, query_email }) =>
      handleTool(async () => {
        const extra: Record<string, string | number> = {};
        if (query_user_id) extra["query[user_id]"] = query_user_id;
        if (query_email) extra["query[email]"] = query_email;

        const data = await client.list<Order>("/orders", page ?? 1, limit ?? 25, extra);
        return formatPaginated("Orders", data, fmtOrder);
      }),
  );

  server.tool(
    "get_order",
    "Get detailed information about a specific order by ID.",
    {
      order_id: z.number().int().positive().describe("The order ID"),
    },
    async ({ order_id }) =>
      handleTool(async () => {
        const order = await client.get<Order>(`/orders/${order_id}`);
        return formatSingle("Order Details", order, fmtOrder);
      }),
  );

  // ── Products ───────────────────────────────────────────────────────

  server.tool(
    "list_products",
    "List products available on the Thinkific site.",
    {
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ page, limit }) =>
      handleTool(async () => {
        const data = await client.list<Product>("/products", page ?? 1, limit ?? 25);
        return formatPaginated("Products", data, fmtProduct);
      }),
  );

  server.tool(
    "get_product",
    "Get detailed information about a specific product by ID.",
    {
      product_id: z.number().int().positive().describe("The product ID"),
    },
    async ({ product_id }) =>
      handleTool(async () => {
        const product = await client.get<Product>(`/products/${product_id}`);
        return formatSingle("Product Details", product, fmtProduct);
      }),
  );

  // ── Bundles ────────────────────────────────────────────────────────

  server.tool(
    "list_bundles",
    "List course bundles on the Thinkific site.",
    {
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ page, limit }) =>
      handleTool(async () => {
        const data = await client.list<Bundle>("/bundles", page ?? 1, limit ?? 25);
        return formatPaginated("Bundles", data, fmtBundle);
      }),
  );

  // ── Categories ─────────────────────────────────────────────────────

  server.tool(
    "list_categories",
    "List course categories.",
    {
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ page, limit }) =>
      handleTool(async () => {
        const data = await client.list<Category>("/categories", page ?? 1, limit ?? 25);
        return formatPaginated("Categories", data, fmtCategory);
      }),
  );

  // ── Promotions (create) ──────────────────────────────────────────

  server.tool(
    "create_promotion",
    "Create a new promotion (discount). Promotions hold coupon codes. Create a promotion first, then create coupons under it.",
    {
      name: z.string().min(1).describe("Promotion name (e.g. 'Spring Sale', '25% Off Launch')"),
      discount_type: z.enum(["percentage", "fixed"]).describe("Discount type: percentage or fixed dollar amount"),
      amount: z.number().positive().describe("Discount amount (e.g. 25 for 25% off, or 10 for $10 off)"),
      product_ids: z.array(z.number().int().positive()).optional().describe("Product IDs this promotion applies to (omit for all products)"),
      description: z.string().optional().describe("Promotion description"),
      starts_at: z.string().optional().describe("Start date (ISO 8601)"),
      expires_at: z.string().optional().describe("Expiration date (ISO 8601)"),
    },
    async (params) =>
      handleTool(async () => {
        const payload: Record<string, unknown> = {
          name: params.name,
          discount_type: params.discount_type,
          amount: params.amount,
        };
        if (params.product_ids) payload.product_ids = params.product_ids;
        if (params.description) payload.description = params.description;
        if (params.starts_at) payload.starts_at = params.starts_at;
        if (params.expires_at) payload.expires_at = params.expires_at;

        const promo = await client.post<Record<string, unknown>>("/promotions", payload);
        return `Promotion Created\n\n🎉 [${promo.id}] ${promo.name}\n   Type: ${promo.discount_type}\n   Amount: ${promo.amount}\n   ID: ${promo.id} (use this ID to create coupon codes)`;
      }),
  );

  // ── Coupons ────────────────────────────────────────────────────────

  server.tool(
    "list_coupons",
    "List coupons for a promotion. Thinkific coupons belong to promotions.",
    {
      promotion_id: z.number().int().positive().describe("Promotion ID (use list_promotions to find IDs)"),
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ promotion_id, page, limit }) =>
      handleTool(async () => {
        const data = await client.list<Coupon>(`/promotions/${promotion_id}/coupons`, page ?? 1, limit ?? 25);
        return formatPaginated("Coupons", data, fmtCoupon);
      }),
  );

  server.tool(
    "create_coupon",
    "Create a new coupon/discount code. Requires a promotion_id — use list_promotions first to get one.",
    {
      promotion_id: z.number().int().positive().describe("Promotion ID this coupon belongs to (use list_promotions to find IDs)"),
      code: z.string().min(1).describe("Coupon code string"),
      note: z.string().optional().describe("Internal note about this coupon"),
      quantity: z.number().int().positive().optional().describe("Maximum uses (omit for unlimited)"),
    },
    async (params) =>
      handleTool(async () => {
        const payload: Record<string, unknown> = {
          code: params.code,
          promotion_id: params.promotion_id,
        };
        if (params.note) payload.note = params.note;
        if (params.quantity) payload.quantity = params.quantity;

        const coupon = await client.post<Coupon>("/coupons", payload);
        return formatSingle("Coupon Created", coupon, fmtCoupon);
      }),
  );

  // ── Groups ─────────────────────────────────────────────────────────

  server.tool(
    "list_groups",
    "List groups on the Thinkific site.",
    {
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ page, limit }) =>
      handleTool(async () => {
        const data = await client.list<Group>("/groups", page ?? 1, limit ?? 25);
        return formatPaginated("Groups", data, fmtGroup);
      }),
  );

  server.tool(
    "get_group",
    "Get detailed information about a specific group by ID.",
    {
      group_id: z.number().int().positive().describe("The group ID"),
    },
    async ({ group_id }) =>
      handleTool(async () => {
        const group = await client.get<Group>(`/groups/${group_id}`);
        return formatSingle("Group Details", group, fmtGroup);
      }),
  );

  // ── Instructors ────────────────────────────────────────────────────

  server.tool(
    "list_instructors",
    "List instructors on the Thinkific site.",
    {
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ page, limit }) =>
      handleTool(async () => {
        const data = await client.list<Instructor>("/instructors", page ?? 1, limit ?? 25);
        return formatPaginated("Instructors", data, fmtInstructor);
      }),
  );

  // ── Course Reviews ─────────────────────────────────────────────────

  server.tool(
    "list_course_reviews",
    "List course reviews, optionally filtered by course.",
    {
      course_id: z.number().int().positive().optional().describe("Filter by course ID"),
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ course_id, page, limit }) =>
      handleTool(async () => {
        const extra: Record<string, number> = {};
        if (course_id) extra["query[course_id]"] = course_id;

        const data = await client.list<CourseReview>("/course_reviews", page ?? 1, limit ?? 25, extra);
        return formatPaginated("Course Reviews", data, fmtReview);
      }),
  );

  // ── Promotions ─────────────────────────────────────────────────────

  server.tool(
    "list_promotions",
    "List promotions on the Thinkific site.",
    {
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ page, limit }) =>
      handleTool(async () => {
        const data = await client.list<Promotion>("/promotions", page ?? 1, limit ?? 25);
        return formatPaginated("Promotions", data, fmtPromotion);
      }),
  );

  // ── Users (missing: update, delete) ───────────────────────────────

  server.tool(
    "update_user",
    "Update an existing user's details.",
    {
      user_id: z.number().int().positive().describe("The user ID to update"),
      first_name: z.string().optional().describe("New first name"),
      last_name: z.string().optional().describe("New last name"),
      email: z.string().email().optional().describe("New email address"),
      company: z.string().optional().describe("Company name"),
      roles: z.array(z.string()).optional().describe("Roles array"),
      custom_profile_field_definitions: z
        .array(z.object({ id: z.number(), value: z.string() }))
        .optional()
        .describe("Custom profile field values"),
    },
    async ({ user_id, ...fields }) =>
      handleTool(async () => {
        const payload: Record<string, unknown> = {};
        if (fields.first_name !== undefined) payload.first_name = fields.first_name;
        if (fields.last_name !== undefined) payload.last_name = fields.last_name;
        if (fields.email !== undefined) payload.email = fields.email;
        if (fields.company !== undefined) payload.company = fields.company;
        if (fields.roles !== undefined) payload.roles = fields.roles;
        if (fields.custom_profile_field_definitions !== undefined)
          payload.custom_profile_field_definitions = fields.custom_profile_field_definitions;

        const user = await client.put<User>(`/users/${user_id}`, payload);
        return formatSingle("User Updated", user, fmtUser);
      }),
  );

  server.tool(
    "delete_user",
    "Delete a user from the Thinkific site.",
    {
      user_id: z.number().int().positive().describe("The user ID to delete"),
    },
    async ({ user_id }) =>
      handleTool(async () => {
        await client.delete(`/users/${user_id}`);
        return `User ${user_id} deleted successfully.`;
      }),
  );

  // ── Enrollments (missing: get, update) ────────────────────────────

  server.tool(
    "get_enrollment",
    "Get detailed information about a specific enrollment by ID.",
    {
      id: z.number().int().positive().describe("The enrollment ID"),
    },
    async ({ id }) =>
      handleTool(async () => {
        const enrollment = await client.get<Enrollment>(`/enrollments/${id}`);
        return formatSingle("Enrollment Details", enrollment, fmtEnrollment);
      }),
  );

  server.tool(
    "update_enrollment",
    "Update an enrollment (e.g. change expiry date, mark completed, set free trial).",
    {
      id: z.number().int().positive().describe("The enrollment ID to update"),
      activated_at: z.string().optional().describe("Activation date (ISO 8601)"),
      expiry_date: z.string().optional().describe("Expiry date (ISO 8601)"),
      is_free_trial: z.boolean().optional().describe("Whether this is a free trial enrollment"),
      completed: z.boolean().optional().describe("Mark the enrollment as completed"),
    },
    async ({ id, ...fields }) =>
      handleTool(async () => {
        const payload: Record<string, unknown> = {};
        if (fields.activated_at !== undefined) payload.activated_at = fields.activated_at;
        if (fields.expiry_date !== undefined) payload.expiry_date = fields.expiry_date;
        if (fields.is_free_trial !== undefined) payload.is_free_trial = fields.is_free_trial;
        if (fields.completed !== undefined) payload.completed = fields.completed;

        const enrollment = await client.put<Enrollment>(`/enrollments/${id}`, payload);
        return formatSingle("Enrollment Updated", enrollment, fmtEnrollment);
      }),
  );

  // ── Bundles (missing: get, courses, enrollments) ───────────────────

  server.tool(
    "get_bundle",
    "Get detailed information about a specific bundle by ID.",
    {
      bundle_id: z.number().int().positive().describe("The bundle ID"),
    },
    async ({ bundle_id }) =>
      handleTool(async () => {
        const bundle = await client.get<Bundle>(`/bundles/${bundle_id}`);
        return formatSingle("Bundle Details", bundle, fmtBundle);
      }),
  );

  server.tool(
    "list_bundle_courses",
    "List courses within a specific bundle.",
    {
      bundle_id: z.number().int().positive().describe("The bundle ID"),
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ bundle_id, page, limit }) =>
      handleTool(async () => {
        const data = await client.list<Course>(`/bundles/${bundle_id}/courses`, page ?? 1, limit ?? 25);
        return formatPaginated(`Courses in Bundle ${bundle_id}`, data, fmtCourse);
      }),
  );

  server.tool(
    "list_bundle_enrollments",
    "List enrollments for a specific bundle.",
    {
      bundle_id: z.number().int().positive().describe("The bundle ID"),
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ bundle_id, page, limit }) =>
      handleTool(async () => {
        const data = await client.list<BundleEnrollment>(`/bundles/${bundle_id}/enrollments`, page ?? 1, limit ?? 25);
        return formatPaginated(`Enrollments for Bundle ${bundle_id}`, data, fmtBundleEnrollment);
      }),
  );

  server.tool(
    "create_bundle_enrollment",
    "Enroll a user in a bundle.",
    {
      bundle_id: z.number().int().positive().describe("The bundle ID"),
      user_id: z.number().int().positive().describe("The user ID to enroll"),
      activated_at: z.string().optional().describe("Activation date (ISO 8601)"),
      expiry_date: z.string().optional().describe("Expiry date (ISO 8601)"),
    },
    async ({ bundle_id, user_id, activated_at, expiry_date }) =>
      handleTool(async () => {
        const payload: Record<string, unknown> = { user_id };
        if (activated_at) payload.activated_at = activated_at;
        if (expiry_date) payload.expiry_date = expiry_date;

        const enrollment = await client.post<BundleEnrollment>(`/bundles/${bundle_id}/enrollments`, payload);
        return formatSingle("Bundle Enrollment Created", enrollment, fmtBundleEnrollment);
      }),
  );

  server.tool(
    "update_bundle_enrollment",
    "Update a bundle enrollment (e.g. change expiry, free trial status).",
    {
      bundle_id: z.number().int().positive().describe("The bundle ID"),
      user_id: z.number().int().positive().describe("The user ID"),
      activated_at: z.string().optional().describe("New activation date (ISO 8601)"),
      expiry_date: z.string().optional().describe("New expiry date (ISO 8601)"),
      is_free_trial: z.boolean().optional().describe("Update free trial status"),
    },
    async ({ bundle_id, user_id, ...fields }) =>
      handleTool(async () => {
        const payload: Record<string, unknown> = { user_id };
        if (fields.activated_at !== undefined) payload.activated_at = fields.activated_at;
        if (fields.expiry_date !== undefined) payload.expiry_date = fields.expiry_date;
        if (fields.is_free_trial !== undefined) payload.is_free_trial = fields.is_free_trial;

        const enrollment = await client.put<BundleEnrollment>(`/bundles/${bundle_id}/enrollments`, payload);
        return formatSingle("Bundle Enrollment Updated", enrollment, fmtBundleEnrollment);
      }),
  );

  // ── Categories (missing: create, get, update, delete, products) ────

  server.tool(
    "create_category",
    "Create a new category (collection) for organizing products.",
    {
      name: z.string().min(1).describe("Category name"),
      description: z.string().optional().describe("Category description"),
    },
    async ({ name, description }) =>
      handleTool(async () => {
        const payload: Record<string, unknown> = { name };
        if (description) payload.description = description;

        const category = await client.post<Category>("/collections", payload);
        return formatSingle("Category Created", category, fmtCategory);
      }),
  );

  server.tool(
    "get_category",
    "Get detailed information about a specific category by ID.",
    {
      category_id: z.number().int().positive().describe("The category ID"),
    },
    async ({ category_id }) =>
      handleTool(async () => {
        const category = await client.get<Category>(`/collections/${category_id}`);
        return formatSingle("Category Details", category, fmtCategory);
      }),
  );

  server.tool(
    "update_category",
    "Update an existing category.",
    {
      category_id: z.number().int().positive().describe("The category ID to update"),
      name: z.string().optional().describe("New category name"),
      description: z.string().optional().describe("New description"),
    },
    async ({ category_id, name, description }) =>
      handleTool(async () => {
        const payload: Record<string, unknown> = {};
        if (name !== undefined) payload.name = name;
        if (description !== undefined) payload.description = description;

        const category = await client.put<Category>(`/collections/${category_id}`, payload);
        return formatSingle("Category Updated", category, fmtCategory);
      }),
  );

  server.tool(
    "delete_category",
    "Delete a category from the Thinkific site.",
    {
      category_id: z.number().int().positive().describe("The category ID to delete"),
    },
    async ({ category_id }) =>
      handleTool(async () => {
        await client.delete(`/collections/${category_id}`);
        return `Category ${category_id} deleted successfully.`;
      }),
  );

  server.tool(
    "list_category_products",
    "List products in a specific category.",
    {
      category_id: z.number().int().positive().describe("The category ID"),
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ category_id, page, limit }) =>
      handleTool(async () => {
        const data = await client.list<Product>(`/collections/${category_id}/products`, page ?? 1, limit ?? 25);
        return formatPaginated(`Products in Category ${category_id}`, data, fmtProduct);
      }),
  );

  // ── Category Memberships ────────────────────────────────────────────

  server.tool(
    "add_products_to_category",
    "Add products to a category (collection membership).",
    {
      category_id: z.number().int().positive().describe("The category ID"),
      product_ids: z.array(z.number().int().positive()).describe("Product IDs to add to this category"),
    },
    async ({ category_id, product_ids }) =>
      handleTool(async () => {
        await client.post(`/collection_memberships/${category_id}`, { product_ids });
        return `Added ${product_ids.length} product(s) to category ${category_id}.`;
      }),
  );

  server.tool(
    "remove_products_from_category",
    "Remove products from a category (collection membership).",
    {
      category_id: z.number().int().positive().describe("The category ID"),
      product_ids: z.array(z.number().int().positive()).describe("Product IDs to remove from this category"),
    },
    async ({ category_id, product_ids }) =>
      handleTool(async () => {
        await client.request("DELETE", `/collection_memberships/${category_id}`, { product_ids });
        return `Removed ${product_ids.length} product(s) from category ${category_id}.`;
      }),
  );

  // ── Chapters (missing: get) ─────────────────────────────────────────

  server.tool(
    "get_chapter",
    "Get detailed information about a specific chapter by ID.",
    {
      chapter_id: z.number().int().positive().describe("The chapter ID"),
    },
    async ({ chapter_id }) =>
      handleTool(async () => {
        const chapter = await client.get<Chapter>(`/chapters/${chapter_id}`);
        return formatSingle("Chapter Details", chapter, fmtChapter);
      }),
  );

  // ── Contents (missing: get) ─────────────────────────────────────────

  server.tool(
    "get_content",
    "Get detailed information about a specific content/lesson by ID.",
    {
      content_id: z.number().int().positive().describe("The content/lesson ID"),
    },
    async ({ content_id }) =>
      handleTool(async () => {
        const content = await client.get<Content>(`/contents/${content_id}`);
        return formatSingle("Content Details", content, fmtContent);
      }),
  );

  // ── Coupons (missing: get, update, delete, bulk_create) ─────────────

  server.tool(
    "get_coupon",
    "Get detailed information about a specific coupon by ID.",
    {
      coupon_id: z.number().int().positive().describe("The coupon ID"),
    },
    async ({ coupon_id }) =>
      handleTool(async () => {
        const coupon = await client.get<Coupon>(`/coupons/${coupon_id}`);
        return formatSingle("Coupon Details", coupon, fmtCoupon);
      }),
  );

  server.tool(
    "update_coupon",
    "Update an existing coupon.",
    {
      coupon_id: z.number().int().positive().describe("The coupon ID to update"),
      code: z.string().optional().describe("New coupon code"),
      note: z.string().optional().describe("Internal note"),
      quantity: z.number().int().positive().optional().describe("Maximum uses"),
      expires_at: z.string().optional().describe("New expiry date (ISO 8601)"),
    },
    async ({ coupon_id, ...fields }) =>
      handleTool(async () => {
        const payload: Record<string, unknown> = {};
        if (fields.code !== undefined) payload.code = fields.code;
        if (fields.note !== undefined) payload.note = fields.note;
        if (fields.quantity !== undefined) payload.quantity = fields.quantity;
        if (fields.expires_at !== undefined) payload.expires_at = fields.expires_at;

        const coupon = await client.put<Coupon>(`/coupons/${coupon_id}`, payload);
        return formatSingle("Coupon Updated", coupon, fmtCoupon);
      }),
  );

  server.tool(
    "delete_coupon",
    "Delete a coupon.",
    {
      coupon_id: z.number().int().positive().describe("The coupon ID to delete"),
    },
    async ({ coupon_id }) =>
      handleTool(async () => {
        await client.delete(`/coupons/${coupon_id}`);
        return `Coupon ${coupon_id} deleted successfully.`;
      }),
  );

  server.tool(
    "bulk_create_coupons",
    "Bulk-create multiple coupon codes at once under a promotion.",
    {
      promotion_id: z.number().int().positive().describe("Promotion ID these coupons belong to"),
      codes: z.array(z.string()).describe("Array of coupon code strings to create"),
      quantity: z.number().int().positive().optional().describe("Max uses per coupon (omit for unlimited)"),
      note: z.string().optional().describe("Note to attach to all coupons"),
    },
    async ({ promotion_id, codes, quantity, note }) =>
      handleTool(async () => {
        const payload: Record<string, unknown> = { promotion_id, codes };
        if (quantity !== undefined) payload.quantity = quantity;
        if (note !== undefined) payload.note = note;

        const result = await client.post<unknown>("/coupons/bulk_create", payload);
        return `Bulk coupon creation submitted. ${codes.length} codes requested.\n\n${JSON.stringify(result, null, 2)}`;
      }),
  );

  // ── Course Reviews (missing: create, get) ───────────────────────────

  server.tool(
    "create_course_review",
    "Create a course review.",
    {
      course_id: z.number().int().positive().describe("The course ID"),
      user_id: z.number().int().positive().describe("The user ID leaving the review"),
      rating: z.number().int().min(1).max(5).describe("Rating from 1 to 5"),
      title: z.string().optional().describe("Review title"),
      review_text: z.string().optional().describe("Review body text"),
    },
    async (params) =>
      handleTool(async () => {
        const review = await client.post<CourseReview>("/course_reviews", params);
        return formatSingle("Course Review Created", review, fmtReview);
      }),
  );

  server.tool(
    "get_course_review",
    "Get a specific course review by ID.",
    {
      review_id: z.number().int().positive().describe("The course review ID"),
    },
    async ({ review_id }) =>
      handleTool(async () => {
        const review = await client.get<CourseReview>(`/course_reviews/${review_id}`);
        return formatSingle("Course Review", review, fmtReview);
      }),
  );

  // ── Custom Profile Fields ────────────────────────────────────────────

  server.tool(
    "list_custom_profile_fields",
    "List custom profile field definitions for the site.",
    {
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ page, limit }) =>
      handleTool(async () => {
        const data = await client.list<CustomProfileFieldDefinition>(
          "/custom_profile_field_definitions",
          page ?? 1,
          limit ?? 25,
        );
        return formatPaginated("Custom Profile Field Definitions", data, fmtCustomProfileFieldDef);
      }),
  );

  // ── External Orders ──────────────────────────────────────────────────

  server.tool(
    "create_external_order",
    "Create an external order for a user (for purchases made outside Thinkific).",
    {
      user_id: z.number().int().positive().describe("The user ID"),
      product_id: z.number().int().positive().describe("The product ID"),
      amount_cents: z.number().int().min(0).describe("Amount in cents (e.g. 4999 for $49.99)"),
      coupon_code: z.string().optional().describe("Coupon code applied"),
    },
    async (params) =>
      handleTool(async () => {
        const order = await client.post<ExternalOrder>("/external_orders", params);
        return formatSingle("External Order Created", order, fmtExternalOrder);
      }),
  );

  server.tool(
    "refund_external_order",
    "Refund an external order.",
    {
      order_id: z.number().int().positive().describe("The external order ID to refund"),
      amount_cents: z.number().int().min(0).optional().describe("Amount to refund in cents (omit for full refund)"),
    },
    async ({ order_id, amount_cents }) =>
      handleTool(async () => {
        const payload: Record<string, unknown> = {};
        if (amount_cents !== undefined) payload.amount_cents = amount_cents;

        const result = await client.post<unknown>(`/external_orders/${order_id}/transactions/refund`, payload);
        return `Refund processed for order ${order_id}.\n\n${JSON.stringify(result, null, 2)}`;
      }),
  );

  server.tool(
    "purchase_external_order",
    "Record a purchase transaction for an external order.",
    {
      order_id: z.number().int().positive().describe("The external order ID"),
      amount_cents: z.number().int().min(0).describe("Amount in cents"),
    },
    async ({ order_id, amount_cents }) =>
      handleTool(async () => {
        const result = await client.post<unknown>(`/external_orders/${order_id}/transactions/purchase`, { amount_cents });
        return `Purchase transaction recorded for order ${order_id}.\n\n${JSON.stringify(result, null, 2)}`;
      }),
  );

  // ── Groups (missing: create, delete) ────────────────────────────────

  server.tool(
    "create_group",
    "Create a new group on the Thinkific site.",
    {
      name: z.string().min(1).describe("Group name"),
    },
    async ({ name }) =>
      handleTool(async () => {
        const group = await client.post<Group>("/groups", { name });
        return formatSingle("Group Created", group, fmtGroup);
      }),
  );

  server.tool(
    "delete_group",
    "Delete a group from the Thinkific site.",
    {
      group_id: z.number().int().positive().describe("The group ID to delete"),
    },
    async ({ group_id }) =>
      handleTool(async () => {
        await client.delete(`/groups/${group_id}`);
        return `Group ${group_id} deleted successfully.`;
      }),
  );

  // ── Group Analysts ───────────────────────────────────────────────────

  server.tool(
    "list_group_analysts",
    "List analysts (managers) for a group.",
    {
      group_id: z.number().int().positive().describe("The group ID"),
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ group_id, page, limit }) =>
      handleTool(async () => {
        const data = await client.list<GroupAnalyst>(`/groups/${group_id}/analysts`, page ?? 1, limit ?? 25);
        return formatPaginated(`Analysts for Group ${group_id}`, data, fmtGroupAnalyst);
      }),
  );

  server.tool(
    "add_group_analyst",
    "Add a user as an analyst (manager) for a group.",
    {
      group_id: z.number().int().positive().describe("The group ID"),
      user_id: z.number().int().positive().describe("The user ID to add as analyst"),
    },
    async ({ group_id, user_id }) =>
      handleTool(async () => {
        const analyst = await client.post<GroupAnalyst>(`/groups/${group_id}/analysts`, { user_id });
        return formatSingle("Group Analyst Added", analyst, fmtGroupAnalyst);
      }),
  );

  server.tool(
    "remove_group_analyst",
    "Remove a user as an analyst from a group.",
    {
      group_id: z.number().int().positive().describe("The group ID"),
      user_id: z.number().int().positive().describe("The user ID to remove"),
    },
    async ({ group_id, user_id }) =>
      handleTool(async () => {
        await client.delete(`/groups/${group_id}/analysts/${user_id}`);
        return `User ${user_id} removed as analyst from group ${group_id}.`;
      }),
  );

  // ── Group Users ──────────────────────────────────────────────────────

  server.tool(
    "add_user_to_group",
    "Add a user to a group.",
    {
      group_id: z.number().int().positive().describe("The group ID"),
      user_id: z.number().int().positive().describe("The user ID to add"),
    },
    async ({ group_id, user_id }) =>
      handleTool(async () => {
        const result = await client.post<GroupUser>("/group_users", { group_id, user_id });
        return `User ${user_id} added to group ${group_id}.\n\n${JSON.stringify(result, null, 2)}`;
      }),
  );

  // ── Instructors (missing: create, get, update, delete) ───────────────

  server.tool(
    "create_instructor",
    "Create a new instructor profile.",
    {
      first_name: z.string().min(1).describe("Instructor's first name"),
      last_name: z.string().min(1).describe("Instructor's last name"),
      email: z.string().email().optional().describe("Instructor's email"),
      title: z.string().optional().describe("Job title"),
      bio: z.string().optional().describe("Instructor bio"),
      slug: z.string().optional().describe("URL slug"),
    },
    async (params) =>
      handleTool(async () => {
        const instructor = await client.post<Instructor>("/instructors", params);
        return formatSingle("Instructor Created", instructor, fmtInstructor);
      }),
  );

  server.tool(
    "get_instructor",
    "Get detailed information about a specific instructor by ID.",
    {
      instructor_id: z.number().int().positive().describe("The instructor ID"),
    },
    async ({ instructor_id }) =>
      handleTool(async () => {
        const instructor = await client.get<Instructor>(`/instructors/${instructor_id}`);
        return formatSingle("Instructor Details", instructor, fmtInstructor);
      }),
  );

  server.tool(
    "update_instructor",
    "Update an instructor's profile.",
    {
      instructor_id: z.number().int().positive().describe("The instructor ID to update"),
      first_name: z.string().optional().describe("New first name"),
      last_name: z.string().optional().describe("New last name"),
      email: z.string().email().optional().describe("New email"),
      title: z.string().optional().describe("New title"),
      bio: z.string().optional().describe("New bio"),
      slug: z.string().optional().describe("New slug"),
    },
    async ({ instructor_id, ...fields }) =>
      handleTool(async () => {
        const payload: Record<string, unknown> = {};
        if (fields.first_name !== undefined) payload.first_name = fields.first_name;
        if (fields.last_name !== undefined) payload.last_name = fields.last_name;
        if (fields.email !== undefined) payload.email = fields.email;
        if (fields.title !== undefined) payload.title = fields.title;
        if (fields.bio !== undefined) payload.bio = fields.bio;
        if (fields.slug !== undefined) payload.slug = fields.slug;

        const instructor = await client.put<Instructor>(`/instructors/${instructor_id}`, payload);
        return formatSingle("Instructor Updated", instructor, fmtInstructor);
      }),
  );

  server.tool(
    "delete_instructor",
    "Delete an instructor profile.",
    {
      instructor_id: z.number().int().positive().describe("The instructor ID to delete"),
    },
    async ({ instructor_id }) =>
      handleTool(async () => {
        await client.delete(`/instructors/${instructor_id}`);
        return `Instructor ${instructor_id} deleted successfully.`;
      }),
  );

  // ── Product Publish Requests ─────────────────────────────────────────

  server.tool(
    "list_publish_requests",
    "List product publish requests.",
    {
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ page, limit }) =>
      handleTool(async () => {
        const data = await client.list<ProductPublishRequest>("/product_publish_requests", page ?? 1, limit ?? 25);
        return formatPaginated("Product Publish Requests", data, fmtProductPublishRequest);
      }),
  );

  server.tool(
    "get_publish_request",
    "Get a specific product publish request by ID.",
    {
      request_id: z.number().int().positive().describe("The publish request ID"),
    },
    async ({ request_id }) =>
      handleTool(async () => {
        const req = await client.get<ProductPublishRequest>(`/product_publish_requests/${request_id}`);
        return formatSingle("Publish Request Details", req, fmtProductPublishRequest);
      }),
  );

  server.tool(
    "approve_publish_request",
    "Approve a product publish request.",
    {
      request_id: z.number().int().positive().describe("The publish request ID to approve"),
    },
    async ({ request_id }) =>
      handleTool(async () => {
        const result = await client.post<unknown>(`/product_publish_requests/${request_id}/approve`, {});
        return `Publish request ${request_id} approved.\n\n${JSON.stringify(result, null, 2)}`;
      }),
  );

  server.tool(
    "deny_publish_request",
    "Deny a product publish request.",
    {
      request_id: z.number().int().positive().describe("The publish request ID to deny"),
      reason: z.string().optional().describe("Reason for denial"),
    },
    async ({ request_id, reason }) =>
      handleTool(async () => {
        const payload = reason ? { reason } : {};
        const result = await client.post<unknown>(`/product_publish_requests/${request_id}/deny`, payload);
        return `Publish request ${request_id} denied.\n\n${JSON.stringify(result, null, 2)}`;
      }),
  );

  // ── Products (missing: related) ──────────────────────────────────────

  server.tool(
    "list_related_products",
    "List related products for a given product.",
    {
      product_id: z.number().int().positive().describe("The product ID"),
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ product_id, page, limit }) =>
      handleTool(async () => {
        const data = await client.list<Product>(`/products/${product_id}/related`, page ?? 1, limit ?? 25);
        return formatPaginated(`Related Products for Product ${product_id}`, data, fmtProduct);
      }),
  );

  // ── Promotions (missing: get, update, delete, by_coupon) ─────────────

  server.tool(
    "get_promotion",
    "Get detailed information about a specific promotion by ID.",
    {
      promotion_id: z.number().int().positive().describe("The promotion ID"),
    },
    async ({ promotion_id }) =>
      handleTool(async () => {
        const promo = await client.get<Promotion>(`/promotions/${promotion_id}`);
        return formatSingle("Promotion Details", promo, fmtPromotion);
      }),
  );

  server.tool(
    "update_promotion",
    "Update an existing promotion.",
    {
      promotion_id: z.number().int().positive().describe("The promotion ID to update"),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      discount_type: z.enum(["percentage", "fixed"]).optional().describe("Discount type"),
      amount: z.number().positive().optional().describe("New discount amount"),
      starts_at: z.string().optional().describe("New start date (ISO 8601)"),
      expires_at: z.string().optional().describe("New expiry date (ISO 8601)"),
      product_ids: z.array(z.number().int().positive()).optional().describe("Product IDs"),
    },
    async ({ promotion_id, ...fields }) =>
      handleTool(async () => {
        const payload: Record<string, unknown> = {};
        if (fields.name !== undefined) payload.name = fields.name;
        if (fields.description !== undefined) payload.description = fields.description;
        if (fields.discount_type !== undefined) payload.discount_type = fields.discount_type;
        if (fields.amount !== undefined) payload.amount = fields.amount;
        if (fields.starts_at !== undefined) payload.starts_at = fields.starts_at;
        if (fields.expires_at !== undefined) payload.expires_at = fields.expires_at;
        if (fields.product_ids !== undefined) payload.product_ids = fields.product_ids;

        const promo = await client.put<Promotion>(`/promotions/${promotion_id}`, payload);
        return formatSingle("Promotion Updated", promo, fmtPromotion);
      }),
  );

  server.tool(
    "delete_promotion",
    "Delete a promotion.",
    {
      promotion_id: z.number().int().positive().describe("The promotion ID to delete"),
    },
    async ({ promotion_id }) =>
      handleTool(async () => {
        await client.delete(`/promotions/${promotion_id}`);
        return `Promotion ${promotion_id} deleted successfully.`;
      }),
  );

  server.tool(
    "get_promotion_by_coupon",
    "Look up a promotion by coupon code.",
    {
      coupon_code: z.string().min(1).describe("The coupon code to look up"),
    },
    async ({ coupon_code }) =>
      handleTool(async () => {
        const promo = await client.get<Promotion>("/promotions/by_coupon", { coupon_code });
        return formatSingle("Promotion by Coupon", promo, fmtPromotion);
      }),
  );

  // ── Site Scripts ─────────────────────────────────────────────────────

  server.tool(
    "list_site_scripts",
    "List all site scripts on the Thinkific site.",
    {
      page: z.number().int().positive().optional().describe("Page number. Default: 1"),
      limit: z.number().int().min(1).max(250).optional().describe("Items per page. Default: 25"),
    },
    async ({ page, limit }) =>
      handleTool(async () => {
        const data = await client.list<SiteScript>("/site_scripts", page ?? 1, limit ?? 25);
        return formatPaginated("Site Scripts", data, fmtSiteScript);
      }),
  );

  server.tool(
    "create_site_script",
    "Create a new site script (custom JS/CSS snippet).",
    {
      name: z.string().min(1).describe("Script name"),
      content: z.string().min(1).describe("Script content (JavaScript or CSS)"),
      location: z.enum(["head", "body"]).describe("Where to inject the script: head or body"),
      enabled: z.boolean().optional().describe("Whether the script is enabled. Default: true"),
    },
    async (params) =>
      handleTool(async () => {
        const script = await client.post<SiteScript>("/site_scripts", params);
        return formatSingle("Site Script Created", script, fmtSiteScript);
      }),
  );

  server.tool(
    "get_site_script",
    "Get a specific site script by ID.",
    {
      script_id: z.number().int().positive().describe("The site script ID"),
    },
    async ({ script_id }) =>
      handleTool(async () => {
        const script = await client.get<SiteScript>(`/site_scripts/${script_id}`);
        return formatSingle("Site Script Details", script, fmtSiteScript);
      }),
  );

  server.tool(
    "update_site_script",
    "Update an existing site script.",
    {
      script_id: z.number().int().positive().describe("The site script ID to update"),
      name: z.string().optional().describe("New name"),
      content: z.string().optional().describe("New script content"),
      location: z.enum(["head", "body"]).optional().describe("New injection location"),
      enabled: z.boolean().optional().describe("Enable or disable the script"),
    },
    async ({ script_id, ...fields }) =>
      handleTool(async () => {
        const payload: Record<string, unknown> = {};
        if (fields.name !== undefined) payload.name = fields.name;
        if (fields.content !== undefined) payload.content = fields.content;
        if (fields.location !== undefined) payload.location = fields.location;
        if (fields.enabled !== undefined) payload.enabled = fields.enabled;

        const script = await client.put<SiteScript>(`/site_scripts/${script_id}`, payload);
        return formatSingle("Site Script Updated", script, fmtSiteScript);
      }),
  );

  server.tool(
    "delete_site_script",
    "Delete a site script.",
    {
      script_id: z.number().int().positive().describe("The site script ID to delete"),
    },
    async ({ script_id }) =>
      handleTool(async () => {
        await client.delete(`/site_scripts/${script_id}`);
        return `Site script ${script_id} deleted successfully.`;
      }),
  );

  // ── Site Info ──────────────────────────────────────────────────────

  server.tool(
    "get_site_info",
    "Get overview information about the connected Thinkific site by fetching course and user counts.",
    {},
    async () =>
      handleTool(async () => {
        // Thinkific doesn't have a dedicated site-info endpoint,
        // so we aggregate from multiple list endpoints.
        const [courses, users, enrollments, products] = await Promise.all([
          client.list<Course>("/courses", 1, 1),
          client.list<User>("/users", 1, 1),
          client.list<Enrollment>("/enrollments", 1, 1),
          client.list<Product>("/products", 1, 1),
        ]);

        return [
          "🏫 Thinkific Site Overview",
          "",
          `Total Courses:     ${courses.meta.pagination.total_items}`,
          `Total Users:       ${users.meta.pagination.total_items}`,
          `Total Enrollments: ${enrollments.meta.pagination.total_items}`,
          `Total Products:    ${products.meta.pagination.total_items}`,
        ].join("\n");
      }),
  );
}
