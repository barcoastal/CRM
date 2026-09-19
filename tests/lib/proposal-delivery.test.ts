import {beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest,NextResponse} from 'next/server';
const mocks=vi.hoisted(()=>({auth:vi.fn(),create:vi.fn(),send:vi.fn(),suppressed:vi.fn(),access:vi.fn()}));
vi.mock('@/lib/api-auth',()=>({requireAuthOrRespond:mocks.auth}));
vi.mock('@/lib/prisma',()=>({prisma:{emailMessage:{create:mocks.create}}}));
vi.mock('@/lib/email-sender',()=>({sendQueuedEmail:mocks.send}));
vi.mock('@/lib/email/suppression',()=>({isEmailSuppressed:mocks.suppressed}));
vi.mock('@/lib/record-access',()=>({canAccessRecord:mocks.access}));
import {POST} from '../../src/app/api/proposals/send/route';
const request=(body:object)=>new NextRequest('http://localhost/api/proposals/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const valid={email:'client@example.com',subject:'Proposal',message:'Review this proposal',calculationSummary:'Total $100'};
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('RESEND_API_KEY','test-only');mocks.auth.mockResolvedValue({session:{userId:'owner'}});mocks.suppressed.mockResolvedValue(false);mocks.access.mockResolvedValue(true);mocks.create.mockResolvedValue({id:'email'});mocks.send.mockResolvedValue({ok:true});});
describe('proposal delivery',()=>{
 it('requires email-send permission',async()=>{mocks.auth.mockResolvedValue({response:NextResponse.json({error:'Forbidden'},{status:403})});expect((await POST(request(valid))).status).toBe(403);expect(mocks.auth).toHaveBeenCalledWith('Email.Send');expect(mocks.send).not.toHaveBeenCalled();});
 it('does not claim success when provider is missing',async()=>{vi.stubEnv('RESEND_API_KEY','');expect((await POST(request(valid))).status).toBe(503);expect(mocks.create).not.toHaveBeenCalled();});
 it('rejects suppression and inaccessible records before creating mail',async()=>{mocks.suppressed.mockResolvedValue(true);expect((await POST(request(valid))).status).toBe(409);mocks.access.mockResolvedValue(false);expect((await POST(request({...valid,leadId:'secret'}))).status).toBe(404);expect(mocks.create).not.toHaveBeenCalled();});
 it('logs the message with its summary and reports actual send failures',async()=>{mocks.send.mockResolvedValue({ok:false});expect((await POST(request(valid))).status).toBe(502);expect(mocks.create.mock.calls[0][0].data).toMatchObject({ownerId:'owner',status:'DRAFT',bodyText:'Review this proposal\n\nTotal $100'});});
 it('reports success only after delivery submission',async()=>{const result=await POST(request(valid));expect(result.status).toBe(200);expect(mocks.send).toHaveBeenCalledWith('email');expect((await result.json()).success).toBe(true);});
});
