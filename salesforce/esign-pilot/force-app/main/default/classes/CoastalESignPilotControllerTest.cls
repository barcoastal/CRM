@IsTest private class CoastalESignPilotControllerTest {
    private static final String PACKET='sfp_0123456789012345678901234567890123456789';
    @TestSetup static void setup(){
        User u=new User(Alias='cesgtest',Email='pilot@example.test',EmailEncodingKey='UTF-8',LastName='Pilot',LanguageLocaleKey='en_US',LocaleSidKey='en_US',TimeZoneSidKey='America/New_York',ProfileId=[SELECT Id FROM Profile WHERE Name='System Administrator' LIMIT 1].Id,Username='coastal.esign.'+UserInfo.getOrganizationId()+'.'+DateTime.now().getTime()+'@example.test');
        insert u;
        insert new PermissionSetAssignment(AssigneeId=u.Id,PermissionSetId=[SELECT Id FROM PermissionSet WHERE Name='Coastal_ESign_Pilot' LIMIT 1].Id);
    }
    private static User pilot(){return [SELECT Id FROM User WHERE Alias='cesgtest' LIMIT 1];}
    private static Opportunity sample(){
        Account a=new Account(Name='TEST - Coastal E-Sign Unit',RecordTypeId=[SELECT Id FROM RecordType WHERE SObjectType='Account' AND DeveloperName='Business_Account' LIMIT 1].Id);insert a;
        Opportunity o=new Opportunity(Name='TEST - Pilot',AccountId=a.Id,RecordTypeId=[SELECT Id FROM RecordType WHERE SObjectType='Opportunity' AND DeveloperName='Debt_Settlement' LIMIT 1].Id,StageName='Working Opportunity',CloseDate=Date.today().addDays(30),Email__c='pilot@example.test',Current_Total_Debt__c=150000);insert o;return o;
    }
    private class Mock implements HttpCalloutMock {
        Id oppId; Boolean fail; Mock(Id o,Boolean f){oppId=o;fail=f;}
        public HttpResponse respond(HttpRequest req){
            System.assertEquals(UserInfo.getOrganizationId(),req.getHeader('X-Salesforce-Org-Id'));
            HttpResponse r=new HttpResponse();r.setStatusCode(fail?403:200);
            if(fail){r.setBody('{"error":"Pilot not allowed"}');return r;}
            if(req.getEndpoint().endsWith('/session')) {
                System.assertEquals(UserInfo.getUserId(),((Map<String,Object>)JSON.deserializeUntyped(req.getBody())).get('salesforceUserId'));
                r.setBody('{"token":"payload.signature"}');
            }else if(req.getMethod()=='POST'){
                Map<String,Object> b=(Map<String,Object>)JSON.deserializeUntyped(req.getBody());
                System.assertEquals(String.valueOf(oppId),b.get('opportunityId'));
                System.assertEquals(UserInfo.getUserId(),b.get('salesforceUserId'));
                r.setBody(JSON.serialize(new Map<String,Object>{'id'=>PACKET,'status'=>'DRAFT'}));
            }else if(req.getEndpoint().contains('download=true')){
                r.setBody(JSON.serialize(new Map<String,Object>{'id'=>PACKET,'pdfBase64'=>EncodingUtil.base64Encode(Blob.valueOf('%PDF-1.4 test only'))}));
            }else r.setBody(JSON.serialize(new Map<String,Object>{'id'=>PACKET,'status'=>'COMPLETED','opportunityId'=>String.valueOf(oppId)}));
            return r;
        }
    }
    @IsTest static void preparesAndReusesDraft(){System.runAs(pilot()){
        Opportunity o=sample();Test.setMock(HttpCalloutMock.class,new Mock(o.Id,false));Test.startTest();
        Map<String,Object> d=CoastalESignPilotController.prepare(o.Id,'Test Signer',false,'SAS');
        System.assertEquals('DRAFT',d.get('status'));System.assert(String.valueOf(d.get('url')).endsWith(PACKET));
        Integer calls=Limits.getCallouts();CoastalESignPilotController.prepare(o.Id,'Test Signer',false,'SAS');System.assertEquals(calls,Limits.getCallouts());Test.stopTest();
    }}
    @IsTest static void completionAttachesOnceWithoutChangingStage(){System.runAs(pilot()){
        Opportunity o=sample();o.Coastal_Esign_Packet_Id__c=PACKET;update o;
        Test.setMock(HttpCalloutMock.class,new Mock(o.Id,false));Test.startTest();
        CoastalESignPilotController.refreshStatus(o.Id);Test.stopTest();
        Opportunity saved=[SELECT StageName,Coastal_Esign_Status__c,Coastal_Esign_File_Id__c FROM Opportunity WHERE Id=:o.Id];
        System.assertEquals('Working Opportunity',saved.StageName);System.assertEquals('COMPLETED',saved.Coastal_Esign_Status__c);System.assertNotEquals(null,saved.Coastal_Esign_File_Id__c);
        System.assertEquals(1,[SELECT count() FROM ContentDocumentLink WHERE LinkedEntityId=:o.Id]);
    }}
    @IsTest static void completionRefreshDoesNotDuplicateExistingFile(){System.runAs(pilot()){
        Opportunity o=sample();
        ContentVersion v=new ContentVersion(Title='TEST signed copy',PathOnClient='test.pdf',VersionData=Blob.valueOf('%PDF-1.4 test'),FirstPublishLocationId=o.Id);insert v;
        o.Coastal_Esign_Packet_Id__c=PACKET;o.Coastal_Esign_File_Id__c=[SELECT ContentDocumentId FROM ContentVersion WHERE Id=:v.Id].ContentDocumentId;update o;
        Test.setMock(HttpCalloutMock.class,new Mock(o.Id,false));Test.startTest();CoastalESignPilotController.refreshStatus(o.Id);Test.stopTest();
        System.assertEquals(1,[SELECT count() FROM ContentDocumentLink WHERE LinkedEntityId=:o.Id]);
    }}
    @IsTest static void rejectsInvalidSnapshotAndRemoteFailure(){System.runAs(pilot()){
        Opportunity o=sample();Test.startTest();
        Boolean denied=false;try{CoastalESignPilotController.prepare(o.Id,'',false,'SAS');}catch(AuraHandledException e){denied=true;}System.assert(denied);
        Test.setMock(HttpCalloutMock.class,new Mock(o.Id,true));denied=false;try{CoastalESignPilotController.prepare(o.Id,'Test Signer',false,'SAS');}catch(AuraHandledException e){denied=true;}System.assert(denied);Test.stopTest();
        System.assertEquals(null,[SELECT Coastal_Esign_Packet_Id__c FROM Opportunity WHERE Id=:o.Id].Coastal_Esign_Packet_Id__c);
    }}
    @IsTest static void opensEmbeddedSenderInScopedSession(){System.runAs(pilot()){
        Opportunity o=sample();o.Coastal_Esign_Packet_Id__c=PACKET;update o;
        Test.setMock(HttpCalloutMock.class,new Mock(o.Id,false));Test.startTest();
        String url=CoastalESignPilotController.openSender(o.Id);Test.stopTest();
        System.assertEquals('https://crm.coastaldebt-tools.com/salesforce-sign/'+PACKET+'#payload.signature',url);
    }}
    @IsTest static void refusesSenderWithoutPacket(){System.runAs(pilot()){
        Opportunity o=sample();Test.startTest();Boolean denied=false;
        try{CoastalESignPilotController.openSender(o.Id);}catch(AuraHandledException e){denied=true;}
        System.assert(denied);Test.stopTest();
    }}
}
