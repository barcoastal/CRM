import { chatAccount } from "@/lib/google-chat/access";
import { ChatError } from "@/lib/google-chat/client";
import { ChatInbox } from "./chat-inbox";
export const dynamic = "force-dynamic";
export default async function GoogleChatPage() {
  let account;
  try { account = await chatAccount(); }
  catch (error) { return <div role="alert" style={{ padding: 32 }}><h1>Google Chat</h1><p>{error instanceof ChatError ? error.message : "Unable to open Google Chat. Please try again."}</p></div>; }
  return <ChatInbox account={account} />;
}
