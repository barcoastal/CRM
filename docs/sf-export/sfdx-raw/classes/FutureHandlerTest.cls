@isTest
public class FutureHandlerTest {
     
    @TestSetup
    static void makeData(){
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        List<Lead> leads = new List<Lead>();
        Lead leadRec1 = DataFactoryTest.createListLead();
        Lead leadRec2 = DataFactoryTest.createListLead();
        leadRec2.Phone = '8722334455';
        leads.add(leadRec1);
        leads.add(leadRec2);
        insert leads;
        List<Account> accts = new List<Account>();
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.Name = 'Test Account';
        acctRecord.SSN__c = '123456780';
        acctRecord.Phone = '123-456-7890' ;
        acctRecord.Lead_Number__c = '123456';
        acctRecord.Program_Start_Date__c = Date.today();
        acctRecord.Program_End_Date__c = Date.today().addDays(30); 
        acctRecord.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'Business_Account');
        acctRecord.BillingStreet = 'Ap #696-3279 Viverra. Avenue';
        acctRecord.BillingCity = 'Latrobe';
        acctRecord.BillingStateCode = 'DE';
        acctRecord.BillingPostalCode = '38100'; 
        acctRecord.BillingCountryCode = 'US';
        Account acctRecord2 = DataFactoryTest.createBusinessAccount();
        accts.add(acctRecord);
        accts.add(acctRecord2);
        insert accts;   
        
        Payment_Processor__c paymentprocessor = new Payment_Processor__c(
            Processor_Type__c='SAS', Name='SAS'
        );
        insert paymentprocessor;         
       
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = accts[0].Id;
        insert opp;   
        
         Program_Plan__c programPlan = new Program_Plan__c(
            Opportunity__c = opp.Id, Client__c =  accts[0].Id, Last_Rescheduled_Date_Time__c = Date.today(),
            Payment_Processor__c = paymentprocessor.Id, Last_Rescheduled_By__c = UserInfo.getUserId()    
        );
        insert programPlan;
        
        SAS_Settings__c settings = new SAS_Settings__c();
        settings.Endpoint__c = 'https://test.com';
        insert settings;        
        
        Contact con = DataFactoryTest.createContact();
        con.BirthDate = System.today().addYears(-25);
        con.AccountId = accts[0].Id;
        insert con;
        
        ContentVersion contVersion = new ContentVersion();
        contVersion.Title = 'SAS Agreement_TestDocument_' + opp.Name + '_completed.pdf';
        contVersion.VersionData = Blob.valueOf('Test Contract');
        contVersion.PathOnClient = 'Test';
        insert contVersion;

        ContentVersion contVersion2 = new ContentVersion();
        contVersion2.Title = 'Citadel Legal Plan_TestDocument_' + opp.Name + '_completed.pdf';
        contVersion2.VersionData = Blob.valueOf('Test Contract');
        contVersion2.PathOnClient = 'Test';
        insert contVersion2;

        List<ContentDocument> contentDocuments = [SELECT Id FROM ContentDocument];
        System.debug('contentDocuments----->'+contentDocuments);

        List<ContentDocumentLink> contentDocLink = new List<ContentDocumentLink>();
        ContentDocumentLink contDoc = new ContentDocumentLink();        
        contDoc.ContentDocumentId = contentDocuments[0].Id;
        contDoc.LinkedEntityId = opp.Id;
        contentDocLink.add(contDoc);        
        ContentDocumentLink contDoc1 = new ContentDocumentLink();
        contDoc1.ContentDocumentId = contentDocuments[1].Id;
        contDoc1.LinkedEntityId = opp.Id;
        contentDocLink.add(contDoc1);
        insert contentDocLink;
        
        Draft__c draft = new Draft__c(
            Program_Plan__c = programPlan.Id, Draft_Amount__c = 100, Retainer_Fee__c = 10,
            Setup_Fee__c = 20, Processor_Fee__c = 30, Service_Fee__c = 40, 
            Draft_Status__c = 'Scheduled', Program_Fee__c = 10, Draft_Date__c = Date.newInstance(2023, 06, 24)
        );
        insert draft;        
        insert new Citadel_Callout_Settings__c(Endpoint__c = 'https://test.com');
    }
    
    @isTest
    private static void testAsyncOPBatch() {
        Map<Id, Async_Operation__c> asyncOperationMap = new Map<Id, Async_Operation__c>([SELECT Id, Individual__c, Individual__r.Phone__c, Status__c, Async_Type__c, Operation__c FROM Async_Operation__c]);
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        Database.executeBatch(new Batch_ProcessAsyncOperations());
        Test.stopTest();
        List<Async_Operation__c> asyncOperationsToVerify = [SELECT Id, Status__c FROM Async_Operation__c];
        Assert.areEqual('Completed', asyncOperationsToVerify[0].Status__c, 'Verifying the Async Operation is successfully completed.');
    }       
    
    @isTest
    static void testFutureHandler() {
        List<Individual> individuals = [SELECT Id FROM Individual];
        List<Lead> leads = [SELECT Id FROM Lead];
        Test.startTest();
        FutureHandler.deduplicateLeads(new Set<Id> {leads[0].Id});
        FutureHandler.deduplicateLeads(new Set<Id> {individuals[0].Id});
        Test.stopTest();
    }
    
    @isTest
    private static void testAsyncSetCustomerStatusBatch() {                
        List<Account> accts = [SELECT Id, Fee_Paid_In_Full__c FROM Account];
        accts[0].Fee_Paid_In_Full__c = true;
        accts[0].External_SAS_Id__c = '117';
        accts[1].Fee_Paid_In_Full__c = true;
        accts[1].External_SAS_Id__c = '118';
        update accts;
        Map<Id, Async_Operation__c> asyncOperationMap = new Map<Id, Async_Operation__c>([SELECT Id, Individual__c, Individual__r.Phone__c, Status__c, Async_Type__c, Operation__c FROM Async_Operation__c WHERE Operation__c =:AsyncOperationUtil.OPERATION_SET_CUSTOMER_STATUS_API]);
        List<Async_Operation__c> asyncOperationsToVerify = [SELECT Id, Status__c FROM Async_Operation__c];
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        FutureHandler.processAsyncOperations(asyncOperationsToVerify[0].Id);
        FutureHandler.initiatePaymentProcessorSync(accts[0].Id);
        try {
            FutureHandler.processAsyncOperations('test');
        } catch(Exception ex){
            //System.assertNotEquals(true, ex.getMessage() != null, 'Expected an exception');
        }
        Test.stopTest();
        
    } 
    
    @IsTest
    static void syncPaymentTest_Success(){
        Account acct = [SELECT Id, External_SAS_Id__c FROM Account Limit 1];
        Opportunity opp = [SELECT Id,Phone__c FROM Opportunity Limit 1];
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        FutureHandler.makeCreateBankAccountSync(acct.Id, opp.Id);
        opp.Phone__c = '123-456-7910';
        update opp;
        FutureHandler.makeUpdateClientSync(acct.Id, opp.Id);
        Test.stopTest();
        Account verifyAccount = [SELECT Id, External_SAS_Id__c,Phone FROM Account WHERE Id =:acct.Id];
        System.assertEquals('123-456-7910', verifyAccount.Phone);        
    }    
}