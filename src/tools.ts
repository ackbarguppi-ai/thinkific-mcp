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
