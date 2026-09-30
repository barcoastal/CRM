import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({find:vi.fn(),history:vi.fn(),create:vi.fn(),used:vi.fn(),send:vi.fn(),document:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:{envelope:{findUnique:m.find},envelopeEvent:{create:m.create},$transaction:async(fn:(tx:unknown)=>unknown)=>fn({$executeRaw:vi.fn(),envelopeEvent:{findMany:m.history,create:m.create,findFirst:m.used}})}}));
vi.mock('@/lib/esign/send-email',()=>({sendESignEmail:m.send}));
vi.mock('@/lib/esign/evidence',async imp=>({...await imp<typeof import('@/lib/esign/evidence')>(),verifiedPreparedPdf:m.document}));
import {POST} from '@/app/api/esign/envelopes/by-token/[token]/verify/route';
import {mac,readProof} from '@/lib/esign/evidence';
const e={id:'e1',signerEmail:'jane@example.test',status:'SENT',expiresAt:null,preparedPdfPath:'e1.pdf'};
const req=(body:unknown)=>POST(new NextRequest('http://localhost/api/esign/envelopes/by-token/test/verify',{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({token:'test'})});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('AUTH_SECRET','test-key');m.find.mockResolvedValue(e);m.history.mockResolvedValue([]);m.document.mockResolvedValue({hash:'hash'});m.create.mockResolvedValue({id:'verified1'});m.used.mockResolvedValue(null);m.send.mockResolvedValue({ok:true});});
afterEach(()=>vi.unstubAllEnvs());
const challenge=()=>({id:'challenge1',eventType:'VERIFY_CHALLENGE',createdAt:new Date(),details:JSON.stringify({nonce:'n',digest:mac('e1:n:123456'),documentHash:'hash'})});
it('only sends to the envelope recipient and never stores the raw code',async()=>{
 expect((await req({action:'send',email:'attacker@example.test'})).status).toBe(200);
 expect(m.send.mock.calls[0][0].to).toBe(e.signerEmail);
 const code=m.send.mock.calls[0][0].html.match(/<strong>(\d+)<\/strong>/)[1];
 expect(m.create.mock.calls[0][0].data.details).not.toContain(code);
});
it('rate limits resends and guessing',async()=>{
 m.history.mockResolvedValue([challenge()]);expect((await req({action:'send'})).status).toBe(429);expect(m.send).not.toHaveBeenCalled();
 m.history.mockResolvedValue([challenge(),...Array.from({length:5},()=>({eventType:'VERIFY_ATTEMPT',createdAt:new Date(Date.now()+10)}))]);expect((await req({action:'verify',code:'123456'})).status).toBe(429);
});
it('rejects expired codes, incorrect codes, reused codes, and changed documents',async()=>{
 m.history.mockResolvedValue([{...challenge(),createdAt:new Date(Date.now()-600001)}]);expect((await req({action:'verify',code:'123456'})).status).toBe(400);
 m.history.mockResolvedValue([challenge()]);expect((await req({action:'verify',code:'000000'})).status).toBe(400);
 m.used.mockResolvedValue({id:'used'});expect((await req({action:'verify',code:'123456'})).status).toBe(400);
 m.used.mockResolvedValue(null);m.document.mockResolvedValue({hash:'changed'});expect((await req({action:'verify',code:'123456'})).status).toBe(400);
});
it('issues a short-lived HttpOnly proof bound to recipient, envelope and document',async()=>{
 m.history.mockResolvedValue([challenge()]);const r=await req({action:'verify',code:'123456'});expect(r.status).toBe(200);
 const cookie=r.cookies.get('esign_e1')!;expect(cookie.httpOnly).toBe(true);expect(cookie.sameSite).toBe('strict');
 expect(readProof(cookie.value,e)).toMatchObject({documentHash:'hash',email:e.signerEmail,eventId:'verified1'});
});

it('opens a signing-link session without an OTP and records its actual authentication method',async()=>{
 const r=await req({action:'link'});expect(r.status).toBe(200);
 expect(m.send).not.toHaveBeenCalled();
 expect(m.create.mock.calls[0][0].data.eventType).toBe('SIGNING_LINK_ACCESSED');
 expect(JSON.parse(m.create.mock.calls[0][0].data.details).method).toBe('email signing link');
 const cookie=r.cookies.get('esign_e1')!;
 expect(cookie.httpOnly).toBe(true);
 expect(readProof(cookie.value,e)).toMatchObject({documentHash:'hash',email:e.signerEmail,eventId:'verified1'});
});
it('rejects unavailable, expired, completed and voided links and damaged documents',async()=>{
 for(const envelope of [null,{...e,expiresAt:new Date(0)},{...e,status:'COMPLETED'},{...e,status:'VOIDED'}]) {
 m.find.mockResolvedValue(envelope);expect((await req({action:'link'})).status).toBe(410);
 }
 m.find.mockResolvedValue(e);m.document.mockRejectedValue(new Error('changed'));
 expect((await req({action:'link'})).status).toBe(409);expect(m.create).not.toHaveBeenCalled();
});
