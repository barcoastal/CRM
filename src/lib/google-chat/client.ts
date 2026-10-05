import { google } from "googleapis";

export type ChatPerson = { name?: string; displayName?: string; type?: string; domainId?: string; email?: string };
export type ChatSpace = { name: string; displayName?: string; spaceType?: string; spaceUri?: string; lastActiveTime?: string };
export type ChatMessage = { name: string; text?: string; createTime?: string; deleteTime?: string; sender?: ChatPerson; thread?: { name?: string }; attachment?: Array<{ name?: string; contentName?: string; downloadUri?: string }> };
export type ChatMember = { name?: string; member?: ChatPerson; state?: string; role?: string };

export class ChatError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function workspaceDomain() { return (process.env.GOOGLE_CHAT_DOMAIN || "coastaldebt.com").trim().toLowerCase(); }
export function spaceName(value: string) {
  if (!/^spaces\/[A-Za-z0-9_-]+$/.test(value)) throw new ChatError(400, "Choose a valid conversation.");
  return value;
}
export function threadName(space: string, value: string) {
  if (!value.startsWith(space + "/threads/") || !/^spaces\/[A-Za-z0-9_-]+\/threads\/[A-Za-z0-9_-]+$/.test(value)) throw new ChatError(400, "The reply must belong to this conversation.");
  return value;
}
export function googleChat(email: string) {
  if (!process.env.GOOGLE_SA_CLIENT_EMAIL || !process.env.GOOGLE_SA_PRIVATE_KEY) throw new ChatError(503, "Google Workspace is not connected. Ask an administrator to finish setup.");
  async function request<T>(scope: string, path: string, method: "GET" | "POST" = "GET", data?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const auth = new google.auth.JWT({ email: process.env.GOOGLE_SA_CLIENT_EMAIL, key: process.env.GOOGLE_SA_PRIVATE_KEY!.replace(/\\n/g, "\n"), scopes: [`https://www.googleapis.com/auth/${scope}`], subject: email });
    try {
      const response = await auth.request<T>({ url: `https://chat.googleapis.com/v1/${path}`, method, data, params, timeout: 20000, retry: method === "GET" });
      return response.data;
    } catch (error) {
      const e = error as { response?: { status?: number; data?: { error?: { message?: string } | string; error_description?: string } } };
      const status = e.response?.status;
      const raw = e.response?.data;
      const code = typeof raw?.error === "string" ? raw.error : "";
      if (code === "unauthorized_client" || code === "invalid_scope") throw new ChatError(503, `Google Workspace has not authorized ${scope}. Ask an administrator to check the Chat permissions.`);
      if (code === "invalid_grant") throw new ChatError(403, "Your CRM email must match an enabled Google Workspace account.");
      if (status === 403) throw new ChatError(403, "Google Chat denied access. Check that Chat API is enabled, your account has Chat access, and you belong to this conversation.");
      if (status === 404) throw new ChatError(404, "This conversation is no longer available to your Google account.");
      if (status === 429) throw new ChatError(429, "Google Chat is busy. Please wait a moment and try again.");
      if (status === 400) throw new ChatError(400, "Google Chat could not accept this request. Check the selected participants or message.");
      throw new ChatError(502, "Google Chat could not be reached. Please try again.");
    }
  }
  async function members(space: string, pageToken?: string) {
    const path = `${spaceName(space)}/members`;
    try { return await request<{ memberships?: ChatMember[]; nextPageToken?: string }>("chat.memberships.readonly", path, "GET", undefined, { pageSize: 100, pageToken }); }
    catch (error) {
      if (!(error instanceof ChatError) || error.status !== 503) throw error;
      return request<{ memberships?: ChatMember[]; nextPageToken?: string }>("chat.memberships", path, "GET", undefined, { pageSize: 100, pageToken });
    }
  }
  return {
    spaces: (pageToken?: string) => request<{ spaces?: ChatSpace[]; nextPageToken?: string }>("chat.spaces.readonly", "spaces", "GET", undefined, { pageSize: 25, pageToken }),
    members,
    messages: (space: string, pageToken?: string) => request<{ messages?: ChatMessage[]; nextPageToken?: string }>("chat.messages.readonly", `${spaceName(space)}/messages`, "GET", undefined, { pageSize: 50, pageToken, orderBy: "createTime desc", showDeleted: true }),
    send: (space: string, text: string, requestId: string, thread?: string) => request<ChatMessage>("chat.messages.create", `${spaceName(space)}/messages`, "POST", { text, ...(thread ? { thread: { name: threadName(space, thread) } } : {}) }, { requestId, messageId: `client-${requestId}`, ...(thread ? { messageReplyOption: "REPLY_MESSAGE_OR_FAIL" } : {}) }),
    start: (emails: string[], requestId: string) => request<ChatSpace>("chat.spaces.create", "spaces:setup", "POST", { requestId, space: { spaceType: emails.length === 1 ? "DIRECT_MESSAGE" : "GROUP_CHAT" }, memberships: emails.map(email => ({ member: { name: `users/${email}`, type: "HUMAN" } })) }),
  };
}
