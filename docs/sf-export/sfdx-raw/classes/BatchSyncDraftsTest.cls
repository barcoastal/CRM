@IsTest
public class BatchSyncDraftsTest {
	
    @TestSetup
    static void makeData(){
        // Create a test Account
        Account account = new Account(Name = 'XYZ COMPANY');
        insert account;
        // Create a test Opportunity record
        Opportunity opportunity = new Opportunity(
            Name = 'Test Opportunity', StageName = 'Prospect',
            CloseDate = Date.today(), AccountId = account.Id
        );
        insert opportunity;
        
        Payment_Processor__c	paymentprocessor = new Payment_Processor__c(
            Processor_Type__c='SAS', Name='SAS'
        );
        insert paymentprocessor;
         
        // Create a test Program_Plan__c record related to the Opportunity
        Program_Plan__c programPlan = new Program_Plan__c(
            Opportunity__c = opportunity.Id, Client__c = account.Id, Payment_Processor__c= paymentprocessor.Id            
        );
        insert programPlan;
        // Create a test Draft__c record related to the Program_Plan__c
        Draft__c draft = new Draft__c(
            Program_Plan__c = programPlan.Id, Draft_Amount__c = 100, Processor_Fee__c = 30, Service_Fee__c = 40, 
            Draft_Status__c = 'Pending', Program_Fee__c = 10, Draft_Date__c = Date.newInstance(2023, 06, 24)
        );
        insert draft;
        
        SAS_Settings__c settings = new SAS_Settings__c();
        settings.Endpoint__c = 'https://test.com';
        insert settings;
    }
    
    //This test method need to be revisited once the batch is is upto date.
    /*@IsTest
    static void syncDraftsTestWithDate_Success() {
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpDraftResponse(true));
        Database.executeBatch(new BatchSyncDrafts(Date.newInstance(2023, 06, 24)));
        Test.stopTest();
        
        Draft__c verifyDraft = [SELECT Id, External_SAS_Id__c, Draft_Status__c FROM Draft__c LIMIT 1];
        System.assertEquals('280', verifyDraft.External_SAS_Id__c);
        System.assertEquals('Scheduled', verifyDraft.Draft_Status__c);
    }*/
    
    @IsTest
    static void syncDraftsTestWithoutDate_Failure() {
        Id programPlanId = [SELECT Id FROM Program_Plan__c LIMIT 1].Id;
        Draft__c draft = new Draft__c(
            Program_Plan__c = programPlanId, Draft_Amount__c = 100, Processor_Fee__c = 30, Service_Fee__c = 40, 
            Draft_Status__c = 'Pending', Program_Fee__c = 10, Draft_Date__c = System.today().addDays(1)
        );
        insert draft;
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpDraftResponse(false));
        Database.executeBatch(new BatchSyncDrafts());
        Test.stopTest();
        
        Draft__c verifyDraft = [SELECT Id, External_SAS_Id__c, Draft_Status__c FROM Draft__c LIMIT 1];
        System.assertEquals(null, verifyDraft.External_SAS_Id__c);
        System.assertEquals('Pending', verifyDraft.Draft_Status__c);
    }
    
    public class MockHttpDraftResponse implements HttpCalloutMock {
        Boolean isSuccess = false;
        public MockHttpDraftResponse(Boolean isSuccess) {
            this.isSuccess = isSuccess;
        }
        public HttpResponse respond(HttpRequest request) {
            HttpResponse response = new HttpResponse();
            response.setHeader('Content-Type', 'application/json');
            response.setStatusCode(200);
            response.setStatus('OK');
            if(this.isSuccess) {
                response.setBody(
                    '{"RequestID": 1673,"PrimaryKeyID": 280,"Success": true,"Message": "Your account is in test mode","Records": 0,'
                    +'"ProcessData": null,"EchoRequest": "Form Variables:\\r\\nRemoteID = 0017800000LgBiOAAV\\r\\nInvoiceNumber = 11111'
                    +'\\r\\nAmount = 10.00\\r\\nQueryString Variables:\\r\\nAPIKey = 12801d1f-9f8a-4827-88e3-1b08eec15edc\\r\\n'
                    +'CompanyKey = 8\\r\\nMethod = ProcessTrustPayment\\r\\n"}'
                );
            } else {
                response.setBody(
                    '{"RequestID": 1674,"PrimaryKeyID": 0,"Success": false,"Message": "General error occured. Please check all parameters and try again.",'
                    +'"Records": 0,"ProcessData": null,"EchoRequest": "Form Variables:\\r\\nRemoteID = 0017800000LgBiOAAV'
                    +'\\r\\nInvoiceNumber = 11111\\r\\nAmount =10.00\\r\\nPaymentRemoteID = a030l00000AypedAAC\\r\\nQueryString Variables:'
                    +'\\r\\nAPIKey =12801d1f-9f8a-4827-88e3-1b08eec15edc\\r\\nCompanyKey = 8\\r\\nMethod = ProcessTrustPayment\\r\\n"}'
                );
            }
            return response;
        }
    }
}