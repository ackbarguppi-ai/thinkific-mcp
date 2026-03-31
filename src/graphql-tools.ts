/**
 * MCP tool definitions for the Thinkific GraphQL API.
 *
 * All operations are named (Thinkific requires named operations).
 * Tools are prefixed with "gql_" to distinguish from REST tools.
 *
 * @module graphql-tools
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ThinkificClient } from "./client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function handleTool(fn: () => Promise<string>): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    const text = await fn();
    return { content: [{ type: "text" as const, text }] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `Error: ${message}` }] };
  }
}

function fmt(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

// ---------------------------------------------------------------------------
// GraphQL fragments (reusable field sets)
// ---------------------------------------------------------------------------

const POST_FIELDS = `
  id
  title
  content
  type
  depth
  createdAt
  updatedAt
  editedAt
  pinnedAt
  replyCount
  author { id firstName lastName email }
`;

const USER_FIELDS = `
  gid
  id
  email
  firstName
  lastName
  hasAdminRole
  hasAffiliateRole
  createdAt
`;

const COMMUNITY_FIELDS = `
  id
  name
  description
  slug
  published
  accessType
  primaryColor
`;

const COMMUNITY_USER_FIELDS = `
  id
  activatedAt
  expiresAt
  user { ${USER_FIELDS} }
`;

const SPACE_FIELDS = `
  id
  name
  description
  iconName
  isPrivate
  readOnly
`;

const BUNDLE_FIELDS = `
  id
  name
  slug
`;

const CATEGORY_FIELDS = `
  id
  name
  slug
  imageUrl
  default
  position
  createdAt
  updatedAt
`;

const CHAPTER_FIELDS = `
  id
  title
  position
`;

const COURSE_FIELDS = `
  id
  name
  title
  slug
  description
`;

const GROUP_FIELDS = `
  id
  name
  createdAt
`;

const LESSON_FIELDS = `
  id
  title
  lessonType
  draft
  takeUrl
`;

const PRODUCT_FIELDS = `
  id
  name
  slug
  description
  status
  hidden
  private
  productableId
  productableType
  createdAt
  updatedAt
  publishedAt
`;

const SITE_FIELDS = `
  id
  name
  subdomain
  url
  currency
  supportEmail
`;

// ---------------------------------------------------------------------------
// Register all GraphQL tools
// ---------------------------------------------------------------------------

export function registerGraphQLTools(server: McpServer, client: ThinkificClient): void {

  // ── QUERIES ──────────────────────────────────────────────────────────

  server.tool(
    "gql_community",
    "Find a community by ID (GraphQL).",
    {
      id: z.string().describe("The community ID"),
    },
    async ({ id }) =>
      handleTool(async () => {
        const query = `query GetCommunity($id: ID!) { community(id: $id) { ${COMMUNITY_FIELDS} } }`;
        const data = await client.gql<{ community: unknown }>("GetCommunity", query, { id });
        return fmt(data.community);
      }),
  );

  server.tool(
    "gql_community_user",
    "Find a community user by ID (GraphQL). Optionally filter by communityId or userId.",
    {
      id: z.string().optional().describe("The community user ID"),
      communityId: z.string().optional().describe("Filter by community ID"),
      userId: z.string().optional().describe("Filter by user ID"),
    },
    async ({ id, communityId, userId }) =>
      handleTool(async () => {
        const query = `query GetCommunityUser($id: ID, $communityId: ID, $userId: ID) { communityUser(id: $id, communityId: $communityId, userId: $userId) { ${COMMUNITY_USER_FIELDS} } }`;
        const data = await client.gql<{ communityUser: unknown }>("GetCommunityUser", query, { id, communityId, userId });
        return fmt(data.communityUser);
      }),
  );

  server.tool(
    "gql_post",
    "Find a post or reply by ID (GraphQL).",
    {
      id: z.string().describe("The post ID"),
    },
    async ({ id }) =>
      handleTool(async () => {
        const query = `query GetPost($id: ID!) { post(id: $id) { ${POST_FIELDS} } }`;
        const data = await client.gql<{ post: unknown }>("GetPost", query, { id });
        return fmt(data.post);
      }),
  );

  server.tool(
    "gql_space",
    "Find a space by ID (GraphQL).",
    {
      id: z.string().describe("The space ID"),
    },
    async ({ id }) =>
      handleTool(async () => {
        const query = `query GetSpace($id: ID!) { space(id: $id) { ${SPACE_FIELDS} } }`;
        const data = await client.gql<{ space: unknown }>("GetSpace", query, { id });
        return fmt(data.space);
      }),
  );

  server.tool(
    "gql_bundle",
    "Returns a Bundle by ID (GraphQL).",
    {
      id: z.string().describe("The bundle ID"),
    },
    async ({ id }) =>
      handleTool(async () => {
        const query = `query GetBundle($id: ID!) { bundle(id: $id) { ${BUNDLE_FIELDS} } }`;
        const data = await client.gql<{ bundle: unknown }>("GetBundle", query, { id });
        return fmt(data.bundle);
      }),
  );

  server.tool(
    "gql_category",
    "Returns a Category by ID (GraphQL).",
    {
      id: z.string().describe("The category ID"),
    },
    async ({ id }) =>
      handleTool(async () => {
        const query = `query GetCategory($id: ID!) { category(id: $id) { ${CATEGORY_FIELDS} } }`;
        const data = await client.gql<{ category: unknown }>("GetCategory", query, { id });
        return fmt(data.category);
      }),
  );

  server.tool(
    "gql_chapter",
    "Returns a Chapter by ID (GraphQL).",
    {
      id: z.string().describe("The chapter ID"),
    },
    async ({ id }) =>
      handleTool(async () => {
        const query = `query GetChapter($id: ID!) { chapter(id: $id) { ${CHAPTER_FIELDS} } }`;
        const data = await client.gql<{ chapter: unknown }>("GetChapter", query, { id });
        return fmt(data.chapter);
      }),
  );

  server.tool(
    "gql_course",
    "Returns a Course by ID (GraphQL).",
    {
      id: z.string().describe("The course ID"),
    },
    async ({ id }) =>
      handleTool(async () => {
        const query = `query GetCourse($id: ID!) { course(id: $id) { ${COURSE_FIELDS} } }`;
        const data = await client.gql<{ course: unknown }>("GetCourse", query, { id });
        return fmt(data.course);
      }),
  );

  server.tool(
    "gql_course_by_slug",
    "Returns a Course by slug (GraphQL).",
    {
      slug: z.string().describe("The course slug"),
    },
    async ({ slug }) =>
      handleTool(async () => {
        const query = `query GetCourseBySlug($slug: String!) { courseBySlug(slug: $slug) { ${COURSE_FIELDS} } }`;
        const data = await client.gql<{ courseBySlug: unknown }>("GetCourseBySlug", query, { slug });
        return fmt(data.courseBySlug);
      }),
  );

  server.tool(
    "gql_group",
    "Returns a Group by ID (GraphQL).",
    {
      id: z.string().describe("The group ID"),
    },
    async ({ id }) =>
      handleTool(async () => {
        const query = `query GetGroup($id: ID!) { group(id: $id) { ${GROUP_FIELDS} } }`;
        const data = await client.gql<{ group: unknown }>("GetGroup", query, { id });
        return fmt(data.group);
      }),
  );

  server.tool(
    "gql_lesson",
    "Returns a Lesson by ID (GraphQL).",
    {
      id: z.string().describe("The lesson ID"),
    },
    async ({ id }) =>
      handleTool(async () => {
        const query = `query GetLesson($id: ID!) { lesson(id: $id) { ${LESSON_FIELDS} } }`;
        const data = await client.gql<{ lesson: unknown }>("GetLesson", query, { id });
        return fmt(data.lesson);
      }),
  );

  server.tool(
    "gql_me",
    "Returns the current authenticated user (GraphQL).",
    {},
    async () =>
      handleTool(async () => {
        const query = `query GetMe { me { ${USER_FIELDS} } }`;
        const data = await client.gql<{ me: unknown }>("GetMe", query);
        return fmt(data.me);
      }),
  );

  server.tool(
    "gql_product",
    "Returns a Product by ID (GraphQL).",
    {
      id: z.string().describe("The product ID"),
    },
    async ({ id }) =>
      handleTool(async () => {
        const query = `query GetProduct($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`;
        const data = await client.gql<{ product: unknown }>("GetProduct", query, { id });
        return fmt(data.product);
      }),
  );

  server.tool(
    "gql_site",
    "Returns site information for the connected Thinkific site (GraphQL).",
    {},
    async () =>
      handleTool(async () => {
        const query = `query GetSite { site { ${SITE_FIELDS} } }`;
        const data = await client.gql<{ site: unknown }>("GetSite", query);
        return fmt(data.site);
      }),
  );

  server.tool(
    "gql_user",
    "Returns a User by their global ID (gid) (GraphQL).",
    {
      id: z.string().describe("The user's global ID (gid)"),
    },
    async ({ id }) =>
      handleTool(async () => {
        const query = `query GetUser($gid: ID!) { user(gid: $gid) { ${USER_FIELDS} } }`;
        const data = await client.gql<{ user: unknown }>("GetUser", query, { gid: id });
        return fmt(data.user);
      }),
  );

  server.tool(
    "gql_user_by_email",
    "Returns a User by email address (GraphQL).",
    {
      email: z.string().email().describe("The user's email address"),
    },
    async ({ email }) =>
      handleTool(async () => {
        const query = `query GetUserByEmail($email: EmailAddress!) { userByEmail(email: $email) { ${USER_FIELDS} } }`;
        const data = await client.gql<{ userByEmail: unknown }>("GetUserByEmail", query, { email });
        return fmt(data.userByEmail);
      }),
  );

  // ── MUTATIONS ────────────────────────────────────────────────────────

  server.tool(
    "gql_create_post",
    "Create a community post in a space (GraphQL). Note: CreatePostInput uses 'content' for the body.",
    {
      spaceId: z.string().describe("The space ID to post in"),
      title: z.string().describe("Post title"),
      body: z.string().optional().describe("Post body/content"),
    },
    async ({ spaceId, title, body }) =>
      handleTool(async () => {
        const query = `mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { post { ${POST_FIELDS} } userErrors { message } } }`;
        const input: Record<string, unknown> = { spaceId, title };
        if (body !== undefined) input.content = body;
        const data = await client.gql<{ createPost: { post: unknown; userErrors: Array<{ message: string }> } }>(
          "CreatePost", query, { input }
        );
        if (data.createPost.userErrors?.length) {
          return `User errors: ${data.createPost.userErrors.map((e) => e.message).join("; ")}`;
        }
        return fmt(data.createPost.post);
      }),
  );

  server.tool(
    "gql_follow_post",
    "Follow a post to receive notifications (GraphQL).",
    {
      postId: z.string().describe("The post ID to follow"),
    },
    async ({ postId }) =>
      handleTool(async () => {
        const query = `mutation FollowPost($input: FollowPostInput!) { followPost(input: $input) { post { id title } userErrors { message } } }`;
        const data = await client.gql<{ followPost: { post: unknown; userErrors: Array<{ message: string }> } }>(
          "FollowPost", query, { input: { postId } }
        );
        if (data.followPost.userErrors?.length) {
          return `User errors: ${data.followPost.userErrors.map((e) => e.message).join("; ")}`;
        }
        return `Successfully followed post.\n${fmt(data.followPost.post)}`;
      }),
  );

  server.tool(
    "gql_move_post",
    "Move a post to a different space (GraphQL).",
    {
      postId: z.string().describe("The post ID to move"),
      spaceId: z.string().describe("The destination space ID"),
    },
    async ({ postId, spaceId }) =>
      handleTool(async () => {
        const query = `mutation MovePost($input: MovePostToSpaceInput!) { movePost(input: $input) { post { ${POST_FIELDS} } userErrors { message } } }`;
        const data = await client.gql<{ movePost: { post: unknown; userErrors: Array<{ message: string }> } }>(
          "MovePost", query, { input: { id: postId, spaceId } }
        );
        if (data.movePost.userErrors?.length) {
          return `User errors: ${data.movePost.userErrors.map((e) => e.message).join("; ")}`;
        }
        return fmt(data.movePost.post);
      }),
  );

  server.tool(
    "gql_pin_post",
    "Pin a post in its space (GraphQL).",
    {
      postId: z.string().describe("The post ID to pin"),
    },
    async ({ postId }) =>
      handleTool(async () => {
        const query = `mutation PinPost($input: PinPostInput!) { pinPost(input: $input) { post { id title pinnedAt } userErrors { message } } }`;
        const data = await client.gql<{ pinPost: { post: unknown; userErrors: Array<{ message: string }> } }>(
          "PinPost", query, { input: { postId } }
        );
        if (data.pinPost.userErrors?.length) {
          return `User errors: ${data.pinPost.userErrors.map((e) => e.message).join("; ")}`;
        }
        return fmt(data.pinPost.post);
      }),
  );

  server.tool(
    "gql_react_to_post",
    "React to a post with an emoji reaction (GraphQL). Valid reactions: EYES, HEART_EYES, JOY, LIKE, OPEN_MOUTH, PENSIVE, TADA, WAVE.",
    {
      postId: z.string().describe("The post ID to react to"),
      reaction: z.enum(["EYES", "HEART_EYES", "JOY", "LIKE", "OPEN_MOUTH", "PENSIVE", "TADA", "WAVE"])
        .describe("The reaction type"),
    },
    async ({ postId, reaction }) =>
      handleTool(async () => {
        const query = `mutation ReactToPost($input: ReactToPostInput!) { reactToPost(input: $input) { post { id title } userErrors { message } } }`;
        const data = await client.gql<{ reactToPost: { post: unknown; userErrors: Array<{ message: string }> } }>(
          "ReactToPost", query, { input: { postId, reactionType: reaction } }
        );
        if (data.reactToPost.userErrors?.length) {
          return `User errors: ${data.reactToPost.userErrors.map((e) => e.message).join("; ")}`;
        }
        return `Reaction added.\n${fmt(data.reactToPost.post)}`;
      }),
  );

  server.tool(
    "gql_reply_to_post",
    "Reply to a post (GraphQL). Note: uses 'content' for the body and 'parentId' for the post ID.",
    {
      postId: z.string().describe("The parent post ID to reply to"),
      body: z.string().describe("Reply body/content"),
    },
    async ({ postId, body }) =>
      handleTool(async () => {
        const query = `mutation ReplyToPost($input: ReplyToPostInput!) { replyToPost(input: $input) { reply { ${POST_FIELDS} } userErrors { message } } }`;
        const data = await client.gql<{ replyToPost: { reply: unknown; userErrors: Array<{ message: string }> } }>(
          "ReplyToPost", query, { input: { parentId: postId, content: body } }
        );
        if (data.replyToPost.userErrors?.length) {
          return `User errors: ${data.replyToPost.userErrors.map((e) => e.message).join("; ")}`;
        }
        return fmt(data.replyToPost.reply);
      }),
  );

  server.tool(
    "gql_unfollow_post",
    "Unfollow a post (GraphQL).",
    {
      postId: z.string().describe("The post ID to unfollow"),
    },
    async ({ postId }) =>
      handleTool(async () => {
        const query = `mutation UnfollowPost($input: UnfollowPostInput!) { unfollowPost(input: $input) { post { id title } userErrors { message } } }`;
        const data = await client.gql<{ unfollowPost: { post: unknown; userErrors: Array<{ message: string }> } }>(
          "UnfollowPost", query, { input: { postId } }
        );
        if (data.unfollowPost.userErrors?.length) {
          return `User errors: ${data.unfollowPost.userErrors.map((e) => e.message).join("; ")}`;
        }
        return `Successfully unfollowed post.\n${fmt(data.unfollowPost.post)}`;
      }),
  );

  server.tool(
    "gql_unpin_post",
    "Unpin a post (GraphQL).",
    {
      postId: z.string().describe("The post ID to unpin"),
    },
    async ({ postId }) =>
      handleTool(async () => {
        const query = `mutation UnpinPost($input: UnpinPostInput!) { unpinPost(input: $input) { post { id title pinnedAt } userErrors { message } } }`;
        const data = await client.gql<{ unpinPost: { post: unknown; userErrors: Array<{ message: string }> } }>(
          "UnpinPost", query, { input: { postId } }
        );
        if (data.unpinPost.userErrors?.length) {
          return `User errors: ${data.unpinPost.userErrors.map((e) => e.message).join("; ")}`;
        }
        return fmt(data.unpinPost.post);
      }),
  );

  server.tool(
    "gql_update_post",
    "Update a post's title and/or content (GraphQL).",
    {
      postId: z.string().describe("The post ID to update"),
      title: z.string().optional().describe("New title (optional)"),
      body: z.string().optional().describe("New content/body (optional)"),
    },
    async ({ postId, title, body }) =>
      handleTool(async () => {
        const query = `mutation UpdatePost($input: UpdatePostInput!) { updatePost(input: $input) { post { ${POST_FIELDS} } userErrors { message } } }`;
        const input: Record<string, unknown> = { id: postId };
        if (title !== undefined) input.title = title;
        if (body !== undefined) input.content = body;
        const data = await client.gql<{ updatePost: { post: unknown; userErrors: Array<{ message: string }> } }>(
          "UpdatePost", query, { input }
        );
        if (data.updatePost.userErrors?.length) {
          return `User errors: ${data.updatePost.userErrors.map((e) => e.message).join("; ")}`;
        }
        return fmt(data.updatePost.post);
      }),
  );

  server.tool(
    "gql_bulk_add_users_to_groups",
    "Bulk add multiple users to multiple groups (GraphQL).",
    {
      userIds: z.array(z.string()).describe("Array of user IDs to add"),
      groupIds: z.array(z.string()).describe("Array of group IDs to add users to"),
    },
    async ({ userIds, groupIds }) =>
      handleTool(async () => {
        const query = `mutation BulkAddUsersToGroups($input: BulkAddUsersToGroupsInput!) { bulkAddUsersToGroups(input: $input) { message userErrors { message } } }`;
        const data = await client.gql<{ bulkAddUsersToGroups: { message: string; userErrors: Array<{ message: string }> } }>(
          "BulkAddUsersToGroups", query, { input: { userIds, groupIds } }
        );
        if (data.bulkAddUsersToGroups.userErrors?.length) {
          return `User errors: ${data.bulkAddUsersToGroups.userErrors.map((e) => e.message).join("; ")}`;
        }
        return data.bulkAddUsersToGroups.message ?? `Successfully added ${userIds.length} user(s) to ${groupIds.length} group(s).`;
      }),
  );

  server.tool(
    "gql_bulk_remove_users_from_groups",
    "Bulk remove multiple users from multiple groups (GraphQL).",
    {
      userIds: z.array(z.string()).describe("Array of user IDs to remove"),
      groupIds: z.array(z.string()).describe("Array of group IDs to remove users from"),
    },
    async ({ userIds, groupIds }) =>
      handleTool(async () => {
        const query = `mutation BulkRemoveUsersFromGroups($input: BulkRemoveUsersFromGroupsInput!) { bulkRemoveUsersFromGroups(input: $input) { message userErrors { message } } }`;
        const data = await client.gql<{ bulkRemoveUsersFromGroups: { message: string; userErrors: Array<{ message: string }> } }>(
          "BulkRemoveUsersFromGroups", query, { input: { userIds, groupIds } }
        );
        if (data.bulkRemoveUsersFromGroups.userErrors?.length) {
          return `User errors: ${data.bulkRemoveUsersFromGroups.userErrors.map((e) => e.message).join("; ")}`;
        }
        return data.bulkRemoveUsersFromGroups.message ?? `Successfully removed ${userIds.length} user(s) from ${groupIds.length} group(s).`;
      }),
  );

  server.tool(
    "gql_mark_lesson_incomplete",
    "Mark a lesson as incomplete for a user (GraphQL).",
    {
      lessonId: z.string().describe("The lesson ID to mark incomplete"),
    },
    async ({ lessonId }) =>
      handleTool(async () => {
        const query = `mutation MarkLessonIncomplete($input: MarkLessonIncompleteInput!) { markLessonIncomplete(input: $input) { lesson { ${LESSON_FIELDS} } course { id name slug } userErrors { message } } }`;
        const data = await client.gql<{ markLessonIncomplete: { lesson: unknown; course: unknown; userErrors: Array<{ message: string }> } }>(
          "MarkLessonIncomplete", query, { input: { lessonId } }
        );
        if (data.markLessonIncomplete.userErrors?.length) {
          return `User errors: ${data.markLessonIncomplete.userErrors.map((e) => e.message).join("; ")}`;
        }
        return `Lesson marked incomplete.\nLesson: ${fmt(data.markLessonIncomplete.lesson)}\nCourse: ${fmt(data.markLessonIncomplete.course)}`;
      }),
  );

  server.tool(
    "gql_update_assignment_submission",
    "Update the status of an assignment submission (GraphQL). Valid statuses: APPROVED, PENDING, REJECTED.",
    {
      submissionId: z.string().describe("The assignment submission ID"),
      status: z.enum(["APPROVED", "PENDING", "REJECTED"]).describe("New status"),
      message: z.string().optional().describe("Optional feedback message"),
    },
    async ({ submissionId, status, message }) =>
      handleTool(async () => {
        const query = `mutation UpdateAssignmentSubmission($input: UpdateAssignmentSubmissionStatusInput!) { updateAssignmentSubmissionStatus(input: $input) { submission { id status createdAt reviewedAt updatedAt } userErrors { message } } }`;
        const input: Record<string, unknown> = { submissionId, status };
        if (message !== undefined) input.message = message;
        const data = await client.gql<{ updateAssignmentSubmissionStatus: { submission: unknown; userErrors: Array<{ message: string }> } }>(
          "UpdateAssignmentSubmission", query, { input }
        );
        if (data.updateAssignmentSubmissionStatus.userErrors?.length) {
          return `User errors: ${data.updateAssignmentSubmissionStatus.userErrors.map((e) => e.message).join("; ")}`;
        }
        return fmt(data.updateAssignmentSubmissionStatus.submission);
      }),
  );

  server.tool(
    "gql_update_product",
    "Update product attributes (GraphQL). Valid statuses: DRAFT, PENDING_APPROVAL, PRESELL, PUBLISHED.",
    {
      productId: z.string().describe("The product ID to update"),
      name: z.string().optional().describe("New product name"),
      description: z.string().optional().describe("New description"),
      slug: z.string().optional().describe("New URL slug"),
      status: z.enum(["DRAFT", "PENDING_APPROVAL", "PRESELL", "PUBLISHED"]).optional().describe("New status"),
      hidden: z.boolean().optional().describe("Hide the product"),
      private: z.boolean().optional().describe("Make the product private"),
      cardImageUrl: z.string().optional().describe("New card image URL"),
    },
    async ({ productId, ...fields }) =>
      handleTool(async () => {
        const query = `mutation UpdateProduct($input: UpdateProductInput!) { updateProduct(input: $input) { product { ${PRODUCT_FIELDS} } userErrors { message } } }`;
        const input: Record<string, unknown> = { productId };
        if (fields.name !== undefined) input.name = fields.name;
        if (fields.description !== undefined) input.description = fields.description;
        if (fields.slug !== undefined) input.slug = fields.slug;
        if (fields.status !== undefined) input.status = fields.status;
        if (fields.hidden !== undefined) input.hidden = fields.hidden;
        if (fields.private !== undefined) input.private = fields.private;
        if (fields.cardImageUrl !== undefined) input.cardImageUrl = fields.cardImageUrl;
        const data = await client.gql<{ updateProduct: { product: unknown; userErrors: Array<{ message: string }> } }>(
          "UpdateProduct", query, { input }
        );
        if (data.updateProduct.userErrors?.length) {
          return `User errors: ${data.updateProduct.userErrors.map((e) => e.message).join("; ")}`;
        }
        return fmt(data.updateProduct.product);
      }),
  );

  server.tool(
    "gql_view_lesson",
    "Record a lesson view for a user (GraphQL).",
    {
      lessonId: z.string().describe("The lesson ID to record a view for"),
    },
    async ({ lessonId }) =>
      handleTool(async () => {
        const query = `mutation ViewLesson($input: ViewLessonInput!) { viewLesson(input: $input) { lesson { ${LESSON_FIELDS} } userErrors { message } } }`;
        const data = await client.gql<{ viewLesson: { lesson: unknown; userErrors: Array<{ message: string }> } }>(
          "ViewLesson", query, { input: { lessonId } }
        );
        if (data.viewLesson.userErrors?.length) {
          return `User errors: ${data.viewLesson.userErrors.map((e) => e.message).join("; ")}`;
        }
        return `Lesson view recorded.\n${fmt(data.viewLesson.lesson)}`;
      }),
  );
}
