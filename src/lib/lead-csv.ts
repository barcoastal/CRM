/** RFC 4180 fields, including quoted commas, newlines, and escaped quotes. */
export function parseLeadCsv(text:string):Record<string,string>[] {
  const rows:string[][]=[];let row:string[]=[];let field='';let quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n'||c==='\r')){row.push(field);field='';if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v.trim()))rows.push(row);row=[];}}else field+=c;}
  if(quoted)throw Error('Unclosed quoted field');row.push(field);if(row.some(v=>v.trim()))rows.push(row);
  if(rows.length<2)throw Error('Include column headers and at least one lead');
  const aliases:Record<string,string>={name:'contactName',contactname:'contactName',company:'businessName',businessname:'businessName',phone:'phone',email:'email',source:'source',leadsource:'source'};
  const headers=rows.shift()!.map(v=>aliases[v.trim().toLowerCase().replace(/[\s_\uFEFF]/g,'')]||v.trim());
  for(const required of ['contactName','businessName','phone'])if(!headers.includes(required))throw Error(`Missing column: ${required}`);
  if(new Set(headers).size!==headers.length)throw Error('Duplicate column headers');
  if(rows.length>200)throw Error('Import up to 200 leads at a time');
  return rows.map((values,i)=>{if(values.length!==headers.length)throw Error(`Row ${i+2} has ${values.length} fields; expected ${headers.length}`);return Object.fromEntries(headers.map((h,j)=>[h,values[j].trim()]));});
}
