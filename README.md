# Thinkific MCP Server

A production-quality [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for the [Thinkific](https://www.thinkific.com/) REST Admin API and GraphQL API. Lets AI assistants (Claude, GPT, etc.) interact with your Thinkific site directly — manage courses, students, enrollments, orders, coupons, communities, and more.

## Features

- **108 MCP tools** covering the full Thinkific API surface — 77 REST tools and 31 GraphQL tools
- **Full REST coverage** — courses, users, enrollments, orders, products, bundles, coupons, groups, instructors, reviews, promotions, categories, site scripts, external orders, publish requests, and more
- **GraphQL support** — queries and mutations for communities, posts, lessons, assignments, and advanced data access via `https://api.thinkific.com/stable/graphql`
- **3 MCP resources** for quick site overview data
- **Dual authentication** — API Key or OAuth Bearer token
- **Pagination** on every list endpoint (page + limit params)
- **Rate-limit awareness** — automatic retry with exponential back-off on 429 responses
- **Structured error handling** — human-readable errors, never crashes the server
- **TypeScript** — fully typed, strict mode, JSDoc throughout

## Quick Start

### 1. Install

```bash
# Clone or copy the project
cd ~/Documents/thinkific-mcp

# Install dependencies
npm install

# Build
npm run build
```

### 2. Configure Authentication

You need **one** of the two auth methods:

#### Option A: API Key (single site)

Find your API key in your Thinkific admin: **Settings → Code & Analytics → API**.

```bash
export THINKIFIC_API_KEY="your-api-key"
export THINKIFIC_SUBDOMAIN="your-site-subdomain"
```

#### Option B: OAuth Token (multi-site apps)

```bash
export THINKIFIC_OAUTH_TOKEN="your-oauth-bearer-token"
```

### 3. Run

```bash
# Direct
node dist/index.js

# Or via npm
npm start
```

## Usage with Claude Desktop

Add to your Claude Desktop MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "thinkific": {
      "command": "node",
      "args": ["/path/to/thinkific-mcp/dist/index.js"],
      "env": {
        "THINKIFIC_API_KEY": "your-api-key",
        "THINKIFIC_SUBDOMAIN": "your-subdomain"
      }
    }
  }
}
```

## Usage with OpenClaw / mcporter

```bash
# Register the server
mcporter add thinkific -- node /path/to/thinkific-mcp/dist/index.js

# Set env vars
mcporter env thinkific THINKIFIC_API_KEY=your-api-key
mcporter env thinkific THINKIFIC_SUBDOMAIN=your-subdomain

# Verify tools are visible
mcporter tools thinkific
```

## REST Tool Reference

### Users

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_users` | List all users/students | `page`, `limit` |
| `get_user` | Get user details by ID | `user_id` |
| `create_user` | Create a new user | `first_name`, `last_name`, `email`, `password?`, `roles?`, `company?`, `send_welcome_email?` |
| `search_users` | Search users by email/name | `query`, `page`, `limit` |
| `update_user` | Update user details | `user_id`, fields to update |
| `delete_user` | Delete a user | `user_id` |

### Enrollments

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_enrollments` | List enrollments (filterable) | `page`, `limit`, `query_user_id?`, `query_course_id?`, `query_email?` |
| `create_enrollment` | Enroll a user in a course | `course_id`, `user_id`, `activated_at?`, `expiry_date?` |
| `get_enrollment` | Get enrollment details by ID | `enrollment_id` |
| `update_enrollment` | Update an enrollment | `enrollment_id`, fields to update |

### Courses

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_courses` | List all courses with pagination | `page`, `limit` |
| `get_course` | Get a single course by ID | `course_id` |

### Chapters

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_chapters` | List chapters in a course | `course_id`, `page`, `limit` |
| `get_chapter` | Get chapter details by ID | `chapter_id` |

### Contents

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_contents` | List lessons in a chapter | `chapter_id`, `page`, `limit` |
| `get_content` | Get content/lesson details by ID | `content_id` |

### Orders

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_orders` | List orders (filterable) | `page`, `limit`, `query_user_id?`, `query_email?` |
| `get_order` | Get order details by ID | `order_id` |

### Products

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_products` | List all products | `page`, `limit` |
| `get_product` | Get product details by ID | `product_id` |
| `list_related_products` | List related products | `product_id`, `page`, `limit` |

### Bundles

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_bundles` | List course bundles | `page`, `limit` |
| `get_bundle` | Get bundle details by ID | `bundle_id` |
| `list_bundle_courses` | List courses in a bundle | `bundle_id`, `page`, `limit` |
| `list_bundle_enrollments` | List bundle enrollments | `bundle_id`, `page`, `limit` |
| `create_bundle_enrollment` | Enroll a user in a bundle | `bundle_id`, `user_id` |
| `update_bundle_enrollment` | Update a bundle enrollment | `bundle_id`, `enrollment_id`, fields to update |

### Groups

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_groups` | List all groups | `page`, `limit` |
| `get_group` | Get group details by ID | `group_id` |
| `create_group` | Create a new group | `name` |
| `delete_group` | Delete a group | `group_id` |

### Group Analysts

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_group_analysts` | List analysts for a group | `group_id`, `page`, `limit` |
| `add_group_analyst` | Add an analyst to a group | `group_id`, `user_id` |
| `remove_group_analyst` | Remove an analyst from a group | `group_id`, `user_id` |

### Group Users

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `add_user_to_group` | Add a user to a group | `group_id`, `user_id` |

### Coupons

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_coupons` | List all coupons | `page`, `limit` |
| `create_coupon` | Create a discount code | `code`, `discount_type`, `discount_amount`, `note?`, `quantity?`, `product_ids?`, `expires_at?` |
| `get_coupon` | Get coupon details by ID | `coupon_id` |
| `update_coupon` | Update a coupon | `coupon_id`, fields to update |
| `delete_coupon` | Delete a coupon | `coupon_id` |
| `bulk_create_coupons` | Bulk create coupons | `count`, coupon params |

### Promotions

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_promotions` | List promotions | `page`, `limit` |
| `create_promotion` | Create a promotion | `name`, `discount_type`, `discount_amount`, promotion params |
| `get_promotion` | Get promotion details by ID | `promotion_id` |
| `update_promotion` | Update a promotion | `promotion_id`, fields to update |
| `delete_promotion` | Delete a promotion | `promotion_id` |
| `get_promotion_by_coupon` | Get promotion for a coupon code | `coupon_code` |

### Categories

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_categories` | List categories | `page`, `limit` |
| `create_category` | Create a new category | `name` |
| `get_category` | Get category details by ID | `category_id` |
| `update_category` | Update a category | `category_id`, fields to update |
| `delete_category` | Delete a category | `category_id` |
| `list_category_products` | List products in a category | `category_id`, `page`, `limit` |
| `add_products_to_category` | Add products to a category | `category_id`, `product_ids` |
| `remove_products_from_category` | Remove products from a category | `category_id`, `product_ids` |

### Course Reviews

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_course_reviews` | List reviews (filterable) | `course_id?`, `page`, `limit` |
| `create_course_review` | Create a course review | `course_id`, `user_id`, `rating`, `title?`, `review?` |
| `get_course_review` | Get review details by ID | `review_id` |

### Instructors

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_instructors` | List instructors | `page`, `limit` |
| `create_instructor` | Create an instructor profile | `user_id`, instructor fields |
| `get_instructor` | Get instructor details by ID | `instructor_id` |
| `update_instructor` | Update an instructor profile | `instructor_id`, fields to update |
| `delete_instructor` | Delete an instructor profile | `instructor_id` |

### Custom Profile Fields

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_custom_profile_fields` | List all custom profile fields | _(none)_ |

### External Orders

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `create_external_order` | Create an external order | `user_id`, `product_id`, order params |
| `refund_external_order` | Refund an external order | `order_id` |
| `purchase_external_order` | Process an external order purchase | `order_id` |

### Product Publish Requests

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_publish_requests` | List product publish requests | `page`, `limit` |
| `get_publish_request` | Get a publish request by ID | `request_id` |
| `approve_publish_request` | Approve a publish request | `request_id` |
| `deny_publish_request` | Deny a publish request | `request_id` |

### Site Scripts

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_site_scripts` | List all site scripts | `page`, `limit` |
| `create_site_script` | Create a site script | `name`, `src`, `load_method?`, `location?` |
| `get_site_script` | Get site script details by ID | `script_id` |
| `update_site_script` | Update a site script | `script_id`, fields to update |
| `delete_site_script` | Delete a site script | `script_id` |

### Site

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_site_info` | Site overview (counts and settings) | _(none)_ |

## GraphQL Tool Reference

GraphQL tools use the Thinkific GraphQL endpoint: `https://api.thinkific.com/stable/graphql`

### Queries

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `gql_site` | Fetch site details via GraphQL | _(none)_ |
| `gql_me` | Get current authenticated user | _(none)_ |
| `gql_course` | Get course details by ID | `id` |
| `gql_course_by_slug` | Get course details by slug | `slug` |
| `gql_user` | Get user details by ID | `id` |
| `gql_user_by_email` | Get user details by email | `email` |
| `gql_bundle` | Get bundle details by ID | `id` |
| `gql_category` | Get category details by ID | `id` |
| `gql_chapter` | Get chapter details by ID | `id` |
| `gql_lesson` | Get lesson details by ID | `id` |
| `gql_group` | Get group details by ID | `id` |
| `gql_product` | Get product details by ID | `id` |
| `gql_community` | Get community details by ID | `id` |
| `gql_community_user` | Get community user details | `community_id`, `user_id` |
| `gql_post` | Get a community post by ID | `id` |
| `gql_space` | Get a community space by ID | `id` |

### Mutations

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `gql_create_post` | Create a community post | `space_id`, `content`, `title?` |
| `gql_reply_to_post` | Reply to a community post | `post_id`, `content` |
| `gql_update_post` | Update a community post | `post_id`, `content?`, `title?` |
| `gql_follow_post` | Follow a community post | `post_id` |
| `gql_unfollow_post` | Unfollow a community post | `post_id` |
| `gql_pin_post` | Pin a community post | `post_id` |
| `gql_unpin_post` | Unpin a community post | `post_id` |
| `gql_move_post` | Move a post to another space | `post_id`, `space_id` |
| `gql_react_to_post` | React to a community post | `post_id`, `reaction` |
| `gql_bulk_add_users_to_groups` | Bulk add users to groups | `user_ids`, `group_ids` |
| `gql_bulk_remove_users_from_groups` | Bulk remove users from groups | `user_ids`, `group_ids` |
| `gql_mark_lesson_incomplete` | Mark a lesson as incomplete for a user | `lesson_id`, `user_id` |
| `gql_view_lesson` | Mark a lesson as viewed/complete for a user | `lesson_id`, `user_id` |
| `gql_update_assignment_submission` | Update an assignment submission | `submission_id`, fields to update |
| `gql_update_product` | Update a product via GraphQL | `id`, fields to update |

## Resources

| Resource URI | Description |
|-------------|-------------|
| `thinkific://courses` | JSON listing of all courses (first 100) |
| `thinkific://users` | JSON listing of all users (first 100) |
| `thinkific://site` | JSON overview with total counts |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `THINKIFIC_API_KEY` | Yes (API Key auth) | Your Thinkific API key from Settings → Code & Analytics → API |
| `THINKIFIC_SUBDOMAIN` | Yes (API Key auth) | Your Thinkific site subdomain (e.g. `my-school` from `my-school.thinkific.com`) |
| `THINKIFIC_OAUTH_TOKEN` | Yes (OAuth auth) | OAuth2 Bearer token (alternative to API Key auth) |

> **Note:** If `THINKIFIC_OAUTH_TOKEN` is set, it takes precedence over API Key auth.

## Project Structure

```
thinkific-mcp/
├── src/
│   ├── index.ts       # Entry point — server bootstrap
│   ├── client.ts      # Thinkific API client (auth, pagination, retry)
│   ├── tools.ts       # MCP tool definitions and handlers (REST)
│   ├── gql-tools.ts   # MCP tool definitions and handlers (GraphQL)
│   ├── resources.ts   # MCP resource definitions
│   ├── types.ts       # TypeScript interfaces for API responses
│   └── test.ts        # Validation test script
├── dist/              # Compiled JavaScript (after build)
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
└── .gitignore
```

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Type-check only
npm run lint

# Run tests (after build)
npm test
```

## Troubleshooting

### "Thinkific authentication not configured"

Set the required environment variables. You need either:
- `THINKIFIC_API_KEY` **and** `THINKIFIC_SUBDOMAIN`, or
- `THINKIFIC_OAUTH_TOKEN`

### 401 Authentication Error

- Verify your API key hasn't been rotated (keys are shown only once after reset)
- Confirm your Thinkific plan supports API access (Grow/Pro + Growth or above)
- Check the subdomain matches exactly (e.g. `my-school`, not `my-school.thinkific.com`)

### 429 Rate Limit

The server automatically retries with exponential back-off (up to 3 retries). If you're consistently hitting rate limits, reduce request frequency or add pagination with smaller page sizes.

### Empty Results

- Check that you're connecting to the correct site (verify subdomain)
- Some endpoints require data to exist first (e.g. no enrollments without courses and users)

### Server Won't Start

- Ensure Node.js 18+ is installed: `node --version`
- Run `npm run build` first — the server runs from `dist/`
- Check stderr for error messages (stdout is reserved for MCP protocol)

## API Documentation

- [Thinkific REST API Reference](https://developers.thinkific.com/api/api-documentation)
- [Thinkific GraphQL API](https://api.thinkific.com/stable/graphql)
- [API Key Authorization](https://support.thinkific.dev/hc/en-us/articles/4422657425431)
- [OAuth Authorization](https://support.thinkific.dev/hc/en-us/articles/4422658129175)
- [Rate Limits](https://support.thinkific.dev/hc/en-us/articles/4422684774935)

## License

MIT — see [LICENSE](./LICENSE).
