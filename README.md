# Thinkific MCP Server

A production-quality [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for the [Thinkific](https://www.thinkific.com/) REST Admin API. Lets AI assistants (Claude, GPT, etc.) interact with your Thinkific site directly — manage courses, students, enrollments, orders, coupons, and more.

## Features

- **24 MCP tools** covering courses, users, enrollments, orders, products, bundles, coupons, groups, instructors, reviews, promotions, and categories
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

## Tool Reference

### Courses

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_courses` | List all courses with pagination | `page`, `limit` |
| `get_course` | Get a single course by ID | `course_id` |

### Chapters & Contents

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_chapters` | List chapters in a course | `course_id`, `page`, `limit` |
| `list_contents` | List lessons in a chapter | `chapter_id`, `page`, `limit` |

### Users

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_users` | List all users/students | `page`, `limit` |
| `get_user` | Get user details by ID | `user_id` |
| `create_user` | Create a new user | `first_name`, `last_name`, `email`, `password?`, `roles?`, `company?`, `send_welcome_email?` |
| `search_users` | Search users by email/name | `query`, `page`, `limit` |

### Enrollments

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_enrollments` | List enrollments (filterable) | `page`, `limit`, `query_user_id?`, `query_course_id?`, `query_email?` |
| `create_enrollment` | Enroll a user in a course | `course_id`, `user_id`, `activated_at?`, `expiry_date?` |

### Orders

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_orders` | List orders (filterable) | `page`, `limit`, `query_user_id?`, `query_email?` |
| `get_order` | Get order details by ID | `order_id` |

### Products & Bundles

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_products` | List all products | `page`, `limit` |
| `get_product` | Get product details by ID | `product_id` |
| `list_bundles` | List course bundles | `page`, `limit` |

### Coupons

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_coupons` | List all coupons | `page`, `limit` |
| `create_coupon` | Create a discount code | `code`, `discount_type`, `discount_amount`, `note?`, `quantity?`, `product_ids?`, `expires_at?` |

### Groups

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_groups` | List all groups | `page`, `limit` |
| `get_group` | Get group details by ID | `group_id` |

### Other

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_instructors` | List instructors | `page`, `limit` |
| `list_course_reviews` | List reviews (filterable) | `course_id?`, `page`, `limit` |
| `list_promotions` | List promotions | `page`, `limit` |
| `list_categories` | List categories | `page`, `limit` |
| `get_site_info` | Site overview (counts) | _(none)_ |

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
│   ├── tools.ts       # MCP tool definitions and handlers
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
- [API Key Authorization](https://support.thinkific.dev/hc/en-us/articles/4422657425431)
- [OAuth Authorization](https://support.thinkific.dev/hc/en-us/articles/4422658129175)
- [Rate Limits](https://support.thinkific.dev/hc/en-us/articles/4422684774935)

## License

MIT — see [LICENSE](./LICENSE).
