import { afterEach, expect, it, vi } from "vitest";
import { esignPublicUrl } from "@/lib/esign/public-url";
import { renderSignRequestHtml } from "@/lib/esign/send-email";
import { sendPacketInvitation } from "@/lib/esign/packet-email";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("uses the public CRM domain even when auth points at Railway", () => {
  vi.stubEnv("NEXTAUTH_URL", "https://crm-production-613a.up.railway.app");
  vi.stubEnv("ESIGN_PUBLIC_URL", undefined);
  expect(esignPublicUrl()).toBe("https://crm.coastaldebt-tools.com");
  const html = renderSignRequestHtml({ signerName: "Test", senderName: "Bar", documentName: "[TEST] <Agreement>", signingUrl: `${esignPublicUrl()}/sign/test-token` });
  expect(html).toContain('/email/coastal-logo.png');
  expect(html).toContain('Review Documents');
  expect(html).toContain('#ffcb22');
  expect(html).toContain('&lt;Agreement&gt;');
  expect(html).not.toContain('railway.app');
});
it("uses the same branded design and domain for packet invitations", async () => {
  vi.stubEnv("NEXTAUTH_URL", "https://old.up.railway.app");
  vi.stubEnv("ESIGN_PUBLIC_URL", undefined);
  vi.stubEnv("RESEND_API_KEY", "test");
  const request=vi.fn().mockResolvedValue({ok:true,json:async()=>({id:"test"})});
  vi.stubGlobal("fetch",request);
  await sendPacketInvitation({email:"test@example.com",senderName:"Bar",senderEmail:"bar@example.com",subject:"Test",message:"Test only",token:"test-token"});
  const html=JSON.parse(request.mock.calls[0][1].body).html;
  expect(html).toContain('https://crm.coastaldebt-tools.com/sign/test-token');
  expect(html).toContain('Review Documents');
  expect(html).not.toContain('railway.app');
});
