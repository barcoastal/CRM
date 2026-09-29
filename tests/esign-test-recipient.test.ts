import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), template: vi.fn(), user: vi.fn(), create: vi.fn(), update: vi.fn(), events: vi.fn(), send: vi.fn(), render: vi.fn(),
}));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  envelopeTemplate: { findUnique: mocks.template }, user: { findUnique: mocks.user },
  envelope: { create: mocks.create, update: mocks.update }, envelopeEvent: { createMany: mocks.events },
} }));
vi.mock("@/lib/esign/storage", () => ({ readTemplatePdf: vi.fn().mockResolvedValue(Buffer.from('pdf')), saveEnvelopePdf: vi.fn().mockResolvedValue('test.pdf') }));
vi.mock("@/lib/esign/merge", () => ({ fillAcroForm: vi.fn().mockResolvedValue(Buffer.from('pdf')), stampDataBoxes: vi.fn().mockResolvedValue(Buffer.from('pdf')) }));
vi.mock("@/lib/esign/send-email", () => ({ sendESignEmail: mocks.send, renderSignRequestHtml: mocks.render }));
import { POST } from "@/app/api/esign/templates/[id]/test-send/route";
function request(body?: string) {
  return POST(new NextRequest('http://localhost/api/esign/templates/t1/test-send', { method:'POST', ...(body === undefined ? {} : {body}) }), {params:Promise.resolve({id:'t1'})});
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({session:{userId:'u1'}});
  mocks.template.mockResolvedValue({id:'t1',name:'Agreement',recordType:'CONTRACT',pdfPath:'template.pdf',pageCount:1});
  mocks.user.mockResolvedValue({name:'Sender',email:'sender@example.com'});
  mocks.create.mockResolvedValue({id:'e1',signingToken:'test-token'});
  mocks.send.mockResolvedValue({ok:true});
  mocks.render.mockReturnValue('test html');
});
describe('e-sign test recipient', () => {
  it('sends an alternate recipient the test, keeping the authenticated sender and no CRM record association', async () => {
    const response = await request(JSON.stringify({recipientEmail:'  other@example.com  '}));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({sentTo:'other@example.com',emailSent:true});
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({to:'other@example.com',replyTo:'sender@example.com'}));
    const data=mocks.create.mock.calls[0][0].data;
    expect(data).toMatchObject({signerEmail:'other@example.com',signerName:'other@example.com',createdById:'u1',documentName:'[TEST] Agreement'});
    expect(data.opportunityId).toBeUndefined(); expect(data.accountId).toBeUndefined();
    expect(mocks.events.mock.calls[0][0].data[1].details).toBe('TEST to other@example.com');
  });
  it.each([undefined,'{}'])('preserves send-to-self for an omitted recipient (%s)', async body => {
    expect((await request(body)).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({to:'sender@example.com'}));
    expect(mocks.create.mock.calls[0][0].data.signerName).toBe('Sender');
  });
  it.each(['not-json', JSON.stringify({recipientEmail:'bad'}), JSON.stringify({recipientEmail:'a@example.com,b@example.com'}), JSON.stringify({recipientEmail:42}), JSON.stringify({recipientEmail:'a@example.com\r\nBcc: b@example.com'})])('rejects invalid input before creating or sending (%s)', async body => {
    expect((await request(body)).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('requires authentication', async () => {
    mocks.auth.mockResolvedValue({response:new Response('Unauthorized',{status:401})});
    expect((await request('{}')).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
});
