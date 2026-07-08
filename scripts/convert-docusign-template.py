#!/usr/bin/env python3
"""
Convert a DocuSign-Gen (Salesforce) .docx into a Coastal contract-packet template.

DocuSign Gen embeds regions like:
  <# <Signature Placeholder="\\s1\\" Hidden="true" /> #>
  <# <Content Select="/Opportunity/Account.Name"/> #>
  <# <TableRow Select="/Opportunity//Debt_Details__r"/> #>

This rewrites them to our syntax:
  \\s\\  (signature anchor the packet detector reads)
  {{ClientName}}                 (docxtemplater scalar)
  {{#Creditors}} … {{/Creditors}} (docxtemplater row loop)

Usage: convert-docusign-template.py input.docx output.docx
All formatting/legal text is preserved; only the merge marks change.
"""
import sys, re, zipfile, shutil, html

SCALAR = {
    "Account.Name": "ClientName",
    "Account.BillingStreet": "ClientAddress",
    "Account.BillingCity": "ClientCity",
    "Account.BillingStateCode": "ClientState",
    "Account.BillingPostalCode": "ClientZip",
    "Account.BillingCounty__c": "ClientCounty",
    "Account.Primary_Contact__r.FirstName": "ContactFirstName",
    "Account.Primary_Contact__r.LastName": "ContactLastName",
    "Account.Primary_Contact__r.Title": "ContactTitle",
    "Client_Name__c": "ClientSignerName",
    "State__c": "ProgramState",
    "Total_Debt__c": "TotalDebt",
    "DS_Payment_Term__c": "ProgramLength",
    "DS_First_Payment_Date__c": "FirstPaymentDate",
    "DS_First_Deposit_Amount__c": "FirstPaymentAmount",
    "DS_First_Retainer_Setup_Fee__c": "FirstRetainerSetupFee",
    "DS_Settlement_Percentage__c": "SettlementPercent",
    "DS_Program_Fee_Percentage__c": "ProgramFeePercent",
    "DS_Retainer_Percentage__c": "RetainerPercent",
    "DS_Total_Fee_Percentage__c": "TotalFeePercent",
    "DS_Weekly_Service_Fee__c": "ServiceFee",
    "DS_Estimated_Retainer_Fee__c": "RetainerAmount",
    "DS_Estimated_Program_Fee__c": "ProgramFeeAmount",
    "DS_Estimated_Amount_You_Save__c": "EstimatedSavings",
    "DS_Total_Draft_Amount__c": "TotalWithFees",
    "DS_Total_Retainer_Fee__c": "TotalRetainerFee",
    "DS_Total_Program_Fee__c": "TotalProgramFee",
    "DS_Total_Setup_Fee__c": "TotalSetupFee",
    "DS_Total_Service_Fee__c": "TotalServiceFee",
    "DS_Total_Processor_Fee__c": "TotalBankFee",
    "DS_Total_Citadel_Fee__c": "TotalLegalPlanFee",
    "DS_Total_Escrow_Amount__c": "TotalEscrowAmount",
    "DS_Current_Day__c": "CurrentDay",
    "DS_Current_Month__c": "CurrentMonth",
    "DS_Current_Year__c": "CurrentYear",
}
ITEM = {
    "Debt_Amount__c": "Balance",
    "Creditor_Name_Formula__c": "CreditorName",
    "Account_Number__c": "AccountNumber",
    "Draft_Date__c": "Date",
    "Draft_Total_Amount__c": "Amount",
    "Retainer_Fee__c": "RetainerFee",
    "Program_Fee__c": "ProgramFee",
    "Setup_Fee__c": "SetupFee",
    "Service_Fee__c": "ServiceFee",
    "Processor_Fee__c": "BankFee",
    "Citadel_Fee__c": "LegalPlanFee",
    "DS_Escrow_Amount__c": "SettlementAccount",
}
LOOP = {
    "Debt_Details__r": "Creditors",
    "Drafts__r": "Schedule",
}

def scalar_token(path):
    p = path.strip().lstrip("/").replace("Opportunity/", "").strip()
    if p in SCALAR:
        return "{{%s}}" % SCALAR[p]
    tail = p.split("/")[-1].split(".")[-1].replace("__c", "").replace("__r", "")
    return "{{%s}}" % re.sub(r"[^A-Za-z0-9]", "_", tail)

def item_token(path):
    key = path.strip().lstrip("./").split("/")[-1]
    if key in ITEM:
        return "{{%s}}" % ITEM[key]
    return "{{%s}}" % re.sub(r"[^A-Za-z0-9]", "_", key.replace("__c", ""))

def region_to_token(inner):
    """inner = decoded text between <# and #>."""
    inner = " ".join(inner.split())
    m = re.search(r'Signature\s+Placeholder="([^"]+)"', inner)
    if m:
        # keep the bare anchor (e.g. \s1\) which the packet detector reads
        return m.group(1)
    m = re.search(r'TableRow\s+Select="([^"]+)"', inner)
    if m:
        loop = None
        for k, v in LOOP.items():
            if k in m.group(1):
                loop = v
        return ("LOOP_OPEN", loop) if loop else ""
    if "SuppressTableRow" in inner:
        return ""  # we feed a clean schedule; nothing to suppress
    m = re.search(r'Content\s+Select="([^"]+)"', inner)
    if m:
        path = m.group(1)
        return item_token(path) if path.strip().startswith(".") else scalar_token(path)
    return ""

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def region_token(inner_decoded, sentinels, counter):
    """inner_decoded includes the <# ... #> wrapper (decoded). Return replacement text."""
    inner = inner_decoded.strip()
    if inner.startswith("<#"):
        inner = inner[2:]
    if inner.endswith("#>"):
        inner = inner[:-2]
    tok = region_to_token(inner)
    if isinstance(tok, tuple) and tok[0] == "LOOP_OPEN":
        if tok[1]:
            counter[0] += 1
            s = "@@LOOP%d@@" % counter[0]
            sentinels.append((s, tok[1]))
            return s
        return ""
    return tok

def convert(xml):
    # 1. Drop spellcheck split markers.
    xml = re.sub(r'<w:proofErr[^>]*/>', '', xml)

    # 2. Flatten all <w:t> text nodes into one decoded string so we can find
    #    <# ... #> regions even when Word split the marker across runs. Then map
    #    each region back onto the nodes it spans and rewrite in place.
    node_re = re.compile(r'(<w:t\b[^>]*>)(.*?)(</w:t>)', re.S)
    nodes = []  # (xml_start, xml_end, open_tag, decoded_text, close_tag)
    concat = ""
    spans = []  # (concat_start, concat_end, node_index)
    for m in node_re.finditer(xml):
        dec = html.unescape(m.group(2))
        idx = len(nodes)
        spans.append((len(concat), len(concat) + len(dec), idx))
        nodes.append([m.start(), m.end(), m.group(1), dec, m.group(3)])
        concat += dec

    counter = [0]
    sentinels = []
    # New decoded text per node (default: unchanged).
    newtext = {i: nodes[i][3] for i in range(len(nodes))}

    def node_at(pos):
        for cs, ce, i in spans:
            if cs <= pos < ce:
                return i, pos - cs
        # position at very end
        return (len(nodes) - 1, len(nodes[-1][3])) if nodes else (None, 0)

    for rm in re.compile(r'<#.*?#>', re.S).finditer(concat):
        token = region_token(rm.group(0), sentinels, counter)
        si, sa = node_at(rm.start())
        ei, ea = node_at(rm.end() - 1)
        ea += 1  # end offset exclusive
        if si is None:
            continue
        if si == ei:
            t = newtext[si]
            newtext[si] = t[:sa] + token + t[ea:]
        else:
            newtext[si] = nodes[si][3][:sa] + token
            for mid in range(si + 1, ei):
                newtext[mid] = ""
            newtext[ei] = nodes[ei][3][ea:]

    # 3. Rebuild xml: replace each node's inner text (right-to-left to keep offsets).
    for i in range(len(nodes) - 1, -1, -1):
        s, e, otag, _, ctag = nodes[i]
        xml = xml[:s] + otag + esc(newtext[i]) + ctag + xml[e:]

    # 4. Wrap each loop's row in document order.
    for sentinel, loop in sentinels:
        xml = wrap_loop_row(xml, sentinel, loop)
    return xml

def wrap_loop_row(xml, sentinel, loop):
    oi = xml.find(sentinel)
    if oi < 0:
        return xml
    trstart = xml.rfind('<w:tr', 0, oi)
    trend = xml.find('</w:tr>', oi)
    if trstart < 0 or trend < 0:
        return xml.replace(sentinel, "")  # not in a table; drop the mark
    # Replace the sentinel with the loop OPEN tag.
    xml = xml[:oi] + ("{{#%s}}" % loop) + xml[oi + len(sentinel):]
    # Recompute the row bounds (offsets shifted), then inject the CLOSE tag at
    # the end of the row's last cell.
    trend = xml.find('</w:tr>', trstart)
    row = xml[trstart:trend]
    tci = max(row.rfind('<w:tc>'), row.rfind('<w:tc '))
    if tci < 0:
        return xml
    tcseg = row[tci:]
    pend = tcseg.rfind('</w:p>')
    if pend < 0:
        return xml
    injected = '<w:r><w:t xml:space="preserve">{{/%s}}</w:t></w:r>' % loop
    newtc = tcseg[:pend] + injected + tcseg[pend:]
    return xml[:trstart] + row[:tci] + newtc + xml[trend:]

def main():
    src, dst = sys.argv[1], sys.argv[2]
    shutil.copy(src, dst)
    z = zipfile.ZipFile(src)
    xml = z.read('word/document.xml').decode('utf-8')
    new = convert(xml)
    # rewrite the docx with the modified document.xml
    import os
    tmp = dst + '.tmp'
    zin = zipfile.ZipFile(src, 'r')
    zout = zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED)
    for item in zin.namelist():
        data = zin.read(item)
        if item == 'word/document.xml':
            data = new.encode('utf-8')
        zout.writestr(item, data)
    zin.close(); zout.close()
    os.replace(tmp, dst)
    # report
    scal = len(re.findall(r'\{\{[A-Za-z]', new))
    loops = re.findall(r'\{\{#(\w+)\}\}', new)
    anchors = re.findall(r'\\[sidn]\d*\\', new)
    print("scalar/loop tokens:", scal)
    print("loops opened:", loops)
    print("loop closes:", re.findall(r'\{\{/(\w+)\}\}', new))
    print("signature anchors:", sorted(set(anchors)), "count", len(anchors))
    leftover = new.count('&lt;#')
    print("leftover DocuSign regions:", leftover)

if __name__ == "__main__":
    main()
