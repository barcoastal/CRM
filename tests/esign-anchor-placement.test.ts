import {expect,it} from 'vitest';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {prepareAnchoredPacket} from '@/lib/contracts/anchors';
it('places the client signature beside its label while preserving the label',async()=>{
 const doc=await PDFDocument.create();const page=doc.addPage();const font=await doc.embedFont(StandardFonts.HelveticaBold);
 page.drawText('by Client:',{x:50,y:500,font,size:12});page.drawText('\\s1\\',{x:50,y:480,font,size:12});
 const result=await prepareAnchoredPacket(Buffer.from(await doc.save()));
 expect(result.signatureBoxes[0].x).toBeCloseTo(50+font.widthOfTextAtSize('by Client:',12)+12,0);
 expect(result.signatureBoxes[0].y).toBe(494);
});
