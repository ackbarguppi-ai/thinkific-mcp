/**
 * MCP resource definitions for the Thinkific API.
 *
 * Resources provide read-only snapshots of Thinkific data that AI
 * assistants can reference without explicit tool calls.
 *
 * @module resources
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ThinkificClient } from "./client.js";
import type { Course, User, Enrollment, Product } from "./types.js";

/**
 * Register all Thinkific resources on the given MCP server instance.
 *
 * @param server - The MCP server to register resources on.
 * @param client - Authenticated Thinkific API client.
 */
export function registerResources(server: McpServer, client: ThinkificClient): void {
  // ── thinkific://courses ────────────────────────────────────────────

  server.resource(
    "courses",
    "thinkific://courses",
    {
      description: "List of all courses on the Thinkific site (first 100).",
      mimeType: "application/json",
    },
    async () => {
      const data = await client.list<Course>("/courses", 1, 100);
      const summary = data.items.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        chapters: c.chapter_ids?.length ?? 0,
        instructor_id: c.instructor_id,
        created_at: c.created_at,
      }));
      return {
        contents: [
          {
            uri: "thinkific://courses",
            mimeType: "application/json" as const,
            text: JSON.stringify(
              {
                total: data.meta.pagination.total_items,
                courses: summary,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── thinkific://users ──────────────────────────────────────────────

  server.resource(
    "users",
    "thinkific://users",
    {
      description: "List of users/students on the Thinkific site (first 100).",
      mimeType: "application/json",
    },
    async () => {
      const data = await client.list<User>("/users", 1, 100);
      const summary = data.items.map((u) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        roles: u.roles,
        created_at: u.created_at,
      }));
      return {
        contents: [
          {
            uri: "thinkific://users",
            mimeType: "application/json" as const,
            text: JSON.stringify(
              {
                total: data.meta.pagination.total_items,
                users: summary,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── thinkific://site ───────────────────────────────────────────────

  server.resource(
    "site",
    "thinkific://site",
    {
      description: "Overview of the Thinkific site: course, user, enrollment, and product counts.",
      mimeType: "application/json",
    },
    async () => {
      const [courses, users, enrollments, products] = await Promise.all([
        client.list<Course>("/courses", 1, 1),
        client.list<User>("/users", 1, 1),
        client.list<Enrollment>("/enrollments", 1, 1),
        client.list<Product>("/products", 1, 1),
      ]);

      return {
        contents: [
          {
            uri: "thinkific://site",
            mimeType: "application/json" as const,
            text: JSON.stringify(
              {
                total_courses: courses.meta.pagination.total_items,
                total_users: users.meta.pagination.total_items,
                total_enrollments: enrollments.meta.pagination.total_items,
                total_products: products.meta.pagination.total_items,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
