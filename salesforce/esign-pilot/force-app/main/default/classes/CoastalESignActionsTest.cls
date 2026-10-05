@IsTest private class CoastalESignActionsTest {
    private static final String PACKET='sfp_0123456789012345678901234567890123456789';
    @TestSetup static void setup(){
        User u=new User(Alias='cesgtest',Email='pilot@example.test',EmailEncodingKey='UTF-8',LastName='Pilot',LanguageLocaleKey='en_US',LocaleSidKey='en_US',TimeZoneSidKey='America/New_York',ProfileId=[SELECT Id FROM Profile WHERE Name='System Administrator' LIMIT 1].Id,Username='coastal.esign.'+UserInfo.getOrganizationId()+'.'+DateTime.now().getTime()+'@example.test');
        insert u;
        List<PermissionSetAssignment> grants=new List<PermissionSetAssignment>();
        for(PermissionSet ps:[SELECT Id FROM PermissionSet WHERE Name IN ('Coastal_ESign_Pilot','Modify_All_Data')]) grants.add(new PermissionSetAssignment(AssigneeId=u.Id,PermissionSetId=ps.Id));
        insert grants;
        System.runAs(new User(Id=UserInfo.getUserId())) { Test.startTest(); createSample(); Test.stopTest(); }
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
    private class ActionMock implements HttpCalloutMock {
        Boolean fail; ActionMock(Boolean f){fail=f;}
        public HttpResponse respond(HttpRequest req){
            HttpResponse r=new HttpResponse();r.setStatusCode(200);
            if(req.getEndpoint().endsWith('/session')) r.setBody('{"token":"test.signature"}');
            else { System.assertEquals('Bearer test.signature',req.getHeader('Authorization'));System.assertEquals('POST',req.getMethod());
                if(req.getEndpoint().endsWith('/void')) System.assertEquals('Test withdrawal',((Map<String,Object>)JSON.deserializeUntyped(req.getBody())).get('reason'));
                else System.assert(req.getEndpoint().endsWith('/resend'));
                r.setStatusCode(fail?409:200);r.setBody(fail?'{"error":"Inactive envelope"}':'{"ok":true}');
            } return r;
        }
    }
    @IsTest static void performsAuthorizedActions(){Opportunity o=sample();o.Coastal_Esign_Packet_Id__c=PACKET;update o;
        System.runAs(pilot()){Test.setMock(HttpCalloutMock.class,new ActionMock(false));Test.startTest();CoastalESignActions.applyAction(o.Id,'resend',null);CoastalESignActions.applyAction(o.Id,'void',' Test withdrawal ');Test.stopTest();}
    }
    @IsTest static void rejectsRemoteFailure(){Opportunity o=sample();o.Coastal_Esign_Packet_Id__c=PACKET;update o;
        System.runAs(pilot()){Test.setMock(HttpCalloutMock.class,new ActionMock(true));Test.startTest();Boolean denied=false;try{CoastalESignActions.applyAction(o.Id,'resend',null);}catch(AuraHandledException e){denied=true;}System.assert(denied);Test.stopTest();}
    }
    @IsTest static void rejectsInvalidActions(){Test.startTest();Integer denied=0;try{CoastalESignActions.applyAction(null,'delete',null);}catch(AuraHandledException e){denied++;}try{CoastalESignActions.applyAction(null,'void',' ');}catch(AuraHandledException e){denied++;}System.assertEquals(2,denied);System.assertEquals(0,Limits.getCallouts());Test.stopTest();}
}
