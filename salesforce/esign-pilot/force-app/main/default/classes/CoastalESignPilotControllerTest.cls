@IsTest private class CoastalESignPilotControllerTest {
    private static final String PACKET='sfp_0123456789012345678901234567890123456789';
    @TestSetup static void setup(){
        User u=new User(Alias='cesgtest',Email='pilot@example.test',EmailEncodingKey='UTF-8',LastName='Pilot',LanguageLocaleKey='en_US',LocaleSidKey='en_US',TimeZoneSidKey='America/New_York',ProfileId=[SELECT Id FROM Profile WHERE Name='System Administrator' LIMIT 1].Id,Username='coastal.esign.'+UserInfo.getOrganizationId()+'.'+DateTime.now().getTime()+'@example.test');
        insert u;
        List<PermissionSetAssignment> grants=new List<PermissionSetAssignment>();
        for(PermissionSet ps:[SELECT Id FROM PermissionSet WHERE Name IN ('Coastal_ESign_Pilot','Modify_All_Data')]) grants.add(new PermissionSetAssignment(AssigneeId=u.Id,PermissionSetId=ps.Id));
        insert grants;
        System.runAs(new User(Id=UserInfo.getUserId())) { createSample(); }
    }
    private static User pilot(){return [SELECT Id FROM User WHERE Alias='cesgtest' LIMIT 1];}
    private static Opportunity sample(){return [SELECT Id,StageName FROM Opportunity WHERE Name='TEST - Pilot' LIMIT 1];}
    private static Opportunity createSample(){
        Payment_Processor__c processor=new Payment_Processor__c(Name='TEST SAS',Processor_Type__c='SAS',Default_Processor__c=true);insert processor;
        Account a=new Account(Name='TEST - Coastal E-Sign Unit',BillingState='Florida',RecordTypeId=[SELECT Id FROM RecordType WHERE SObjectType='Account' AND DeveloperName='Business_Account' LIMIT 1].Id);insert a;
        Opportunity o=new Opportunity(Name='TEST - Pilot',AccountId=a.Id,RecordTypeId=[SELECT Id FROM RecordType WHERE SObjectType='Opportunity' AND DeveloperName='Debt_Settlement' LIMIT 1].Id,StageName='Working Opportunity',CloseDate=Date.today().addDays(30),Email__c='pilot@example.test',Current_Total_Debt__c=150000);insert o;
        Contact contact=new Contact(FirstName='Test',LastName='Signer',Title='Owner',Email='pilot@example.test',Phone='202-555-0147',Birthdate=Date.newInstance(1990,1,1),AccountId=a.Id);insert contact;
        a.Primary_Contact__c=contact.Id;a.BillingStreet='123 Test Street';a.BillingCity='Fort Lauderdale';a.BillingState='Florida';a.BillingPostalCode='33309';a.BillingCountry='United States';a.BillingCounty__c='Broward';a.EIN_Number_Tax_Id__c='000000000';a.Bank_Name__c='TEST BANK';a.Bank_Routing_Number__c='021000021';a.Bank_Account_Number__c='000123456789';a.Bank_Account_Type__c='Checking';update a;
        Program_Plan__c plan=new Program_Plan__c(Opportunity__c=o.Id,Client__c=a.Id,Payment_Processor__c=processor.Id,Payment_Term__c='6',Payment_Frequency__c='Weekly',First_Payment_Date__c=Date.today().addDays(7),Settlement_Percentage__c='40',Program_Fee_Percentage__c='20',Retainer_Percentage__c='10',Total_Debt__c=150000);insert plan;
        Account creditor=new Account(Name='TEST Creditor',RecordTypeId=[SELECT Id FROM RecordType WHERE SObjectType='Account' AND DeveloperName='Creditor' LIMIT 1].Id,Creditor_Category__c='Citadel');insert creditor;
        insert new Debt_Details__c(Opportunity__c=o.Id,Account__c=a.Id,Program_Plan__c=plan.Id,Current_Creditor__c=creditor.Id,Debt_Amount__c=150000,Include_in_the_Program__c=true,Account_Number__c='TEST-001');
        DraftTriggerHandler.bypassPopulateSyncPending=true;
        insert new Draft__c(Program_Plan__c=plan.Id,Account__c=a.Id,Draft_Date__c=Date.today().addDays(7),Draft_Status__c='Pending',Draft_Amount__c=60000,Retainer_Fee__c=15000,Program_Fee__c=30000,Setup_Fee__c=850,Service_Fee__c=55,Processor_Fee__c=0,Citadel_Fee__c=0);
        return o;
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
                Map<String,Object> c=(Map<String,Object>)b.get('contract');
                System.assertEquals(2,c.get('version'));
                System.assertEquals(1,((List<Object>)c.get('drafts')).size());
                System.assertEquals(1,((List<Object>)c.get('debts')).size());
                System.assertEquals('Citadel',c.get('legalNetwork'));
                r.setBody(JSON.serialize(new Map<String,Object>{'id'=>PACKET,'status'=>'DRAFT'}));
            }else if(req.getEndpoint().contains('download=true')){
                r.setBody(JSON.serialize(new Map<String,Object>{'id'=>PACKET,'pdfBase64'=>EncodingUtil.base64Encode(Blob.valueOf('%PDF-1.4 test only'))}));
            }else r.setBody(JSON.serialize(new Map<String,Object>{'id'=>PACKET,'status'=>'COMPLETED','opportunityId'=>String.valueOf(oppId)}));
            return r;
        }
    }
    @IsTest static void preparesAndReusesDraft(){Opportunity o=sample();System.runAs(pilot()){Test.setMock(HttpCalloutMock.class,new Mock(o.Id,false));Test.startTest();
        Map<String,Object> d=CoastalESignPilotController.prepare(o.Id,'Test Signer',false,'SAS');
        System.assertEquals('DRAFT',d.get('status'));System.assert(String.valueOf(d.get('url')).endsWith(PACKET));
        Integer calls=Limits.getCallouts();CoastalESignPilotController.prepare(o.Id,'Test Signer',false,'SAS');System.assertEquals(calls,Limits.getCallouts());Test.stopTest();
    }}
    @IsTest static void completionAttachesOnceWithoutChangingStage(){Opportunity o=sample();System.runAs(pilot()){o.Coastal_Esign_Packet_Id__c=PACKET;update o;
        Test.setMock(HttpCalloutMock.class,new Mock(o.Id,false));Test.startTest();
        CoastalESignPilotController.refreshStatus(o.Id);Test.stopTest();
        Opportunity saved=[SELECT StageName,Coastal_Esign_Status__c,Coastal_Esign_File_Id__c FROM Opportunity WHERE Id=:o.Id];
        System.assertEquals('Working Opportunity',saved.StageName);System.assertEquals('COMPLETED',saved.Coastal_Esign_Status__c);System.assertNotEquals(null,saved.Coastal_Esign_File_Id__c);
        System.assertEquals(1,[SELECT count() FROM ContentDocumentLink WHERE LinkedEntityId=:o.Id]);
    }}
    @IsTest static void completionRefreshDoesNotDuplicateExistingFile(){Opportunity o=sample();System.runAs(pilot()){Test.startTest();
        ContentVersion v=new ContentVersion(Title='TEST signed copy',PathOnClient='test.pdf',VersionData=Blob.valueOf('%PDF-1.4 test'),FirstPublishLocationId=o.Id);insert v;
        o.Coastal_Esign_Packet_Id__c=PACKET;o.Coastal_Esign_File_Id__c=[SELECT ContentDocumentId FROM ContentVersion WHERE Id=:v.Id].ContentDocumentId;update o;
        Test.setMock(HttpCalloutMock.class,new Mock(o.Id,false));CoastalESignPilotController.refreshStatus(o.Id);Test.stopTest();
        System.assertEquals(1,[SELECT count() FROM ContentDocumentLink WHERE LinkedEntityId=:o.Id]);
    }}
    @IsTest static void rejectsInvalidSnapshotAndRemoteFailure(){Opportunity o=sample();System.runAs(pilot()){Test.startTest();
        Boolean denied=false;try{CoastalESignPilotController.prepare(o.Id,'',false,'SAS');}catch(AuraHandledException e){denied=true;}System.assert(denied);
        Test.setMock(HttpCalloutMock.class,new Mock(o.Id,true));denied=false;try{CoastalESignPilotController.prepare(o.Id,'Test Signer',false,'SAS');}catch(AuraHandledException e){denied=true;}System.assert(denied);Test.stopTest();
        System.assertEquals(null,[SELECT Coastal_Esign_Packet_Id__c FROM Opportunity WHERE Id=:o.Id].Coastal_Esign_Packet_Id__c);
    }}
    @IsTest static void opensEmbeddedSenderInScopedSession(){Opportunity o=sample();System.runAs(pilot()){o.Coastal_Esign_Packet_Id__c=PACKET;update o;
        Test.setMock(HttpCalloutMock.class,new Mock(o.Id,false));Test.startTest();
        String url=CoastalESignPilotController.openSender(o.Id);Test.stopTest();
        System.assertEquals('https://crm.coastaldebt-tools.com/salesforce-sign/'+PACKET+'#payload.signature',url);
    }}
    @IsTest static void refusesSenderWithoutPacket(){Opportunity o=sample();System.runAs(pilot()){Test.startTest();Boolean denied=false;
        try{CoastalESignPilotController.openSender(o.Id);}catch(AuraHandledException e){denied=true;}
        System.assert(denied);Test.stopTest();
    }}
}
