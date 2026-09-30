import { describe,it,expect,vi,beforeEach,afterEach } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { saveEnvelopePdf } from "@/lib/esign/storage";
import { sha256, verifiedPreparedPdf, signProof, readProof, isSignable } from "@/lib/esign/evidence";
import { signingInput, requiredFieldsError } from "@/lib/esign/signing-input";
import { DISCLOSURE_VERSION } from "@/lib/esign/disclosure";
let dir:string;
beforeEach(async()=>{dir=await mkdtemp(path.join(tmpdir(),'esign-test-'));vi.stubEnv('AUTH_SECRET','test-secret-only');vi.stubEnv('ESIGN_ENVELOPES_DIR',dir);vi.stubEnv('ESIGN_SIGNED_DIR',dir);vi.stubEnv('ESIGN_TEMPLATES_DIR',dir);});
afterEach(async()=>{vi.unstubAllEnvs();await rm(dir,{recursive:true,force:true});});
describe('document evidence',()=>{
 it('retains an immutable prepared snapshot and rejects modifications',async()=>{
   const filename=await saveEnvelopePdf(Buffer.from('original PDF'),'e1');
   expect((await verifiedPreparedPdf(filename)).hash).toBe(sha256('original PDF'));
   await expect(saveEnvelopePdf(Buffer.from('replacement'),'e1')).rejects.toThrow();
   expect((await readFile(path.join(dir,filename))).toString()).toBe('original PDF');
   await writeFile(path.join(dir,filename),'tampered');
   await expect(verifiedPreparedPdf(filename)).rejects.toThrow('integrity');
 });
 it('rejects proof substitution, tampering, expiration and another recipient',()=>{
   const e={id:'e1',signerEmail:'signer@example.test'};
   const p={envelopeId:e.id,email:e.signerEmail,documentHash:sha256('pdf'),fieldsHash:sha256('fields'),verifiedAt:new Date().toISOString(),expires:Date.now()+60000,eventId:'v1'};
   const signed=signProof(p);
   expect(readProof(signed,e)?.documentHash).toBe(p.documentHash);
   expect(readProof(signed+'x',e)).toBeNull();
   expect(readProof(signed,{...e,id:'e2'})).toBeNull();
   expect(readProof(signed,{...e,signerEmail:'other@example.test'})).toBeNull();
   expect(readProof(signProof({...p,expires:Date.now()-1}),e)).toBeNull();
 });
 it('only allows active, unexpired envelopes',()=>{
   for(const status of ['COMPLETED','VOIDED','DECLINED','DRAFT','SIGNED']) expect(isSignable({status,expiresAt:null})).toBe(false);
   expect(isSignable({status:'SENT',expiresAt:new Date(Date.now()-1)})).toBe(false);
   expect(isSignable({status:'VIEWED',expiresAt:null})).toBe(true);
 });
});
const input={signature:'data:image/png;base64,YWJj',fullName:'Jane Smith',consent:true,disclosureVersion:DISCLOSURE_VERSION,textValues:{},dateValues:{},checkboxValues:{}};
describe('server signing validation',()=>{
 it.each([{consent:false},{disclosureVersion:'old'},{fullName:''},{signature:'javascript:bad'},{dateValues:{0:'2026-02-31'}}])('rejects malformed or unconsented signing (%j)',override=>expect(signingInput.safeParse({...input,...override}).success).toBe(false));
 it('requires configured signatures, separately adopted initials and all text/date fields',()=>{
  const e={signatureBoxes:[{}],initialBoxes:[{}],textBoxes:[{label:'Title'}],dateBoxes:[{}]};
  const b=signingInput.parse(input);
  expect(requiredFieldsError(b,{...e,signatureBoxes:[]})).toMatch('No signature');
  expect(requiredFieldsError(b,e)).toMatch('initials');
  b.initial=b.signature;expect(requiredFieldsError(b,e)).toMatch('text');
  b.textValues['0']='Owner';expect(requiredFieldsError(b,e)).toMatch('date');
  b.dateValues['0']='2026-09-30';expect(requiredFieldsError(b,e)).toBeNull();
 });
 it('uses one asserted name for every full-name location, overriding conflicting payload fields',()=>{
   const b=signingInput.parse({...input,textValues:{0:'Wrong Name'}});
   expect(requiredFieldsError(b,{signatureBoxes:[{}],initialBoxes:[],textBoxes:[{label:'Full name — agreement'},{label:'Full name — Exhibit A'}],dateBoxes:[]})).toBeNull();
   expect(b.textValues).toEqual({0:'Jane Smith',1:'Jane Smith'});
 });
});
