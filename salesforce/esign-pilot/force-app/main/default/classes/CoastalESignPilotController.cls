public with sharing class CoastalESignPilotController {
    private static final String ROOT = 'https://crm.coastaldebt-tools.com';
    private static final String ENDPOINT = 'callout:Coastal_ESign_Pilot/api/esign/salesforce/packets';
    private static void authorize() {
        if (![SELECT IsSandbox FROM Organization LIMIT 1].IsSandbox ||
            !FeatureManagement.checkPermission('Coastal_ESign_Pilot')) {
            throw new AuraHandledException('Coastal E-Sign pilot is restricted to authorized sandbox users.');
        }
    }
    private static Opportunity opportunity(Id recordId) {
        authorize();
        if(recordId == null || recordId.getSObjectType() != Opportunity.SObjectType) throw new AuraHandledException('Choose an Opportunity.');
        return [SELECT Id, Name, Email__c, Current_Total_Debt__c, Account.Name,
            Account.BillingStreet, Account.BillingCity, Account.BillingState, Account.BillingPostalCode, Account.BillingCountry,
            Coastal_Esign_Packet_Id__c, Coastal_Esign_Status__c, Coastal_Esign_File_Id__c
            FROM Opportunity WHERE Id = :recordId WITH USER_MODE LIMIT 1];
    }
    @AuraEnabled public static Map<String,Object> details(Id recordId) {
        Opportunity o = opportunity(recordId);
        return new Map<String,Object>{'name'=>o.Name,'accountName'=>o.Account.Name,'email'=>o.Email__c,
            'totalDebt'=>o.Current_Total_Debt__c,'status'=>o.Coastal_Esign_Status__c,
            'url'=>String.isBlank(o.Coastal_Esign_Packet_Id__c) ? null : ROOT+'/envelopes/packets/'+o.Coastal_Esign_Packet_Id__c,
            'fileId'=>o.Coastal_Esign_File_Id__c};
    }
    private static Map<String,Object> request(String method, String suffix, Map<String,Object> body) {
        HttpRequest r = new HttpRequest();
        r.setEndpoint(ENDPOINT+suffix); r.setMethod(method); r.setTimeout(120000);
        r.setHeader('Content-Type','application/json');
        r.setHeader('X-Salesforce-Org-Id', UserInfo.getOrganizationId());
        if(body!=null) r.setBody(JSON.serialize(body));
        HttpResponse response = new Http().send(r);
        Map<String,Object> result;
        try { result=(Map<String,Object>)JSON.deserializeUntyped(response.getBody()); }
        catch(Exception e) { throw new AuraHandledException('CRM connection did not return a valid response. Retry preparation.'); }
        if(response.getStatusCode()>=300) throw new AuraHandledException(String.valueOf(result.get('error')));
        return result;
    }
    @AuraEnabled public static Map<String,Object> prepare(Id recordId, String signerName, Boolean includeAddendum, String processor) {
        return preparePacket(recordId,signerName,includeAddendum,processor,false);
    }
    private static Map<String,Object> preparePacket(Id recordId, String signerName, Boolean includeAddendum, String processor, Boolean renew) {
        Opportunity o = opportunity(recordId);
        if(!renew && !String.isBlank(o.Coastal_Esign_Packet_Id__c)) return details(recordId);
        if(o.Account==null || !o.Account.Name.startsWith('TEST -') || String.isBlank(signerName) || signerName.trim().length()<2 ||
            String.isBlank(o.Email__c) || o.Current_Total_Debt__c==null || o.Current_Total_Debt__c<=0 || (processor!='SAS' && processor!='RAM'))
            throw new AuraHandledException('Use a TEST account with a signer name, email, positive debt amount and processor.');
        String requestId = EncodingUtil.convertToHex(Crypto.generateDigest('SHA-256',Blob.valueOf(UserInfo.getOrganizationId()+':'+recordId+':pilot-v1'))).substring(0,32);
        if(renew) requestId=EncodingUtil.convertToHex(Crypto.generateAesKey(128));
        Map<String,Object> s=CoastalESignSnapshot.build(recordId,requestId);
        Map<String,Object> result=request('POST','',s);
        String packetId=(String)result.get('id');
        if(packetId==null || !Pattern.matches('sfp_[a-f0-9]{40}',packetId)) throw new AuraHandledException('Invalid packet returned by CRM.');
        Opportunity locked=[SELECT Id,Coastal_Esign_Packet_Id__c FROM Opportunity WHERE Id=:recordId FOR UPDATE];
        if(renew || String.isBlank(locked.Coastal_Esign_Packet_Id__c)) {
            locked.Coastal_Esign_Packet_Id__c=packetId; locked.Coastal_Esign_Status__c='DRAFT'; locked.Coastal_Esign_File_Id__c=null; update as user locked;
        }
        return details(recordId);
    }
    @AuraEnabled public static String openSender(Id recordId) {
        Opportunity o=opportunity(recordId);
        if(String.isBlank(o.Coastal_Esign_Packet_Id__c)) {
            // Preparation writes the reference; openSender is called again after that transaction.
            throw new AuraHandledException('Prepare a packet after completing contract review.');
        }
        String packetId=o.Coastal_Esign_Packet_Id__c;
        if(!Pattern.matches('sfp_[a-f0-9]{40}',packetId)) throw new AuraHandledException('Invalid packet reference.');
        Map<String,Object> result=request('POST','/'+packetId+'/session',new Map<String,Object>{'salesforceUserId'=>UserInfo.getUserId()});
        String token=(String)result.get('token');
        if(String.isBlank(token) || !Pattern.matches('[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+',token)) throw new AuraHandledException('Invalid sender session.');
        return ROOT+'/salesforce-sign/'+packetId+'#'+token;
    }
    @AuraEnabled public static Map<String,Object> prepareReviewed(Id recordId) {
        opportunity(recordId);
        Opportunity o=[SELECT Account.Primary_Contact__r.Name,Addendum_Required__c FROM Opportunity WHERE Id=:recordId WITH USER_MODE];
        if(o.Account.Primary_Contact__r==null) throw new AuraHandledException('Add the primary contact in contract review.');
        List<Program_Plan__c> plans=[SELECT Payment_Processor__r.Processor_Type__c FROM Program_Plan__c WHERE Opportunity__c=:recordId ORDER BY CreatedDate DESC LIMIT 1];
        String processor=plans.isEmpty() ? null : plans[0].Payment_Processor__r?.Processor_Type__c;
        if(processor!='SAS' && processor!='RAM') throw new AuraHandledException('Choose SAS or RAM on the Salesforce program plan before preparing the test.');
        return preparePacket(recordId,o.Account.Primary_Contact__r.Name,o.Addendum_Required__c,processor,true);
    }
    private static String empty(String s) { return s==null ? '' : s; }
    @AuraEnabled public static Map<String,Object> refreshStatus(Id recordId) {
        Opportunity o=opportunity(recordId);
        String packetId=o.Coastal_Esign_Packet_Id__c;
        if(String.isBlank(packetId)) return details(recordId);
        if(!Pattern.matches('sfp_[a-f0-9]{40}',packetId)) throw new AuraHandledException('Invalid packet reference.');
        Map<String,Object> state=request('GET','/'+packetId,null);
        if((String)state.get('id')!=packetId || (String)state.get('opportunityId')!=String.valueOf(recordId)) throw new AuraHandledException('Packet does not match this Opportunity.');
        String status=(String)state.get('status');
        if(!new Set<String>{'DRAFT','SENT','VIEWED','SIGNED','COMPLETED','DECLINED','VOIDED','EXPIRED'}.contains(status)) throw new AuraHandledException('Invalid signing status returned by CRM.');
        Blob signedPdf;
        if(status=='COMPLETED' && String.isBlank(o.Coastal_Esign_File_Id__c)) {
            Map<String,Object> file=request('GET','/'+packetId+'?download=true',null);
            if((String)file.get('id')!=packetId || String.isBlank((String)file.get('pdfBase64'))) throw new AuraHandledException('Signed file does not match this packet.');
            signedPdf=EncodingUtil.base64Decode((String)file.get('pdfBase64'));
        }
        Opportunity locked=[SELECT Id,Coastal_Esign_Packet_Id__c,Coastal_Esign_File_Id__c,Coastal_Esign_Status__c FROM Opportunity WHERE Id=:recordId FOR UPDATE];
        if(locked.Coastal_Esign_Packet_Id__c!=packetId) throw new AuraHandledException('Packet changed. Refresh again.');
        Boolean changed=locked.Coastal_Esign_Status__c!=status;
        locked.Coastal_Esign_Status__c=status;
        if(signedPdf!=null && String.isBlank(locked.Coastal_Esign_File_Id__c)) {
            ContentVersion v=new ContentVersion(Title='TEST - Coastal E-Sign - signed packet',PathOnClient='Coastal-ESign-TEST-signed.pdf',VersionData=signedPdf,FirstPublishLocationId=recordId);
            insert as user v;
            changed=true;
            locked.Coastal_Esign_File_Id__c=[SELECT ContentDocumentId FROM ContentVersion WHERE Id=:v.Id].ContentDocumentId;
        }
        // Pilot status is separate from StageName so it cannot trigger copied payment or welcome automations.
        if(changed) update as user locked;
        return details(recordId);
    }
}
