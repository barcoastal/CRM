import {it,expect} from 'vitest';
import {documentHighlights} from '@/lib/esign/document-highlights';
it('returns original passages with accurate page references and deduplicates repeated terms',()=>{
 const passage='Your weekly payment includes the administrative fee and all program charges described in this agreement.';
 expect(documentHighlights(['Cover',passage,passage])).toEqual([{page:2,text:passage}]);
});
it('does not invent text for scanned or empty pages',()=>expect(documentHighlights(['','Cover page'])).toEqual([]));
