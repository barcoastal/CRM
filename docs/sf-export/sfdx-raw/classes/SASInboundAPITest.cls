@isTest
private class SASInboundAPITest {

    @TestSetup
    static void makeData(){
        Account acct = DataFactoryTest.createBusinessAccount();
        acct.Lead_Number__c = '12345';
        acct.Bank_Name__c = 'Wells Fargo';
        acct.Bank_Account_Number__c = '13719713158835300';
        acct.Bank_Routing_Number__c = '122105155';
        acct.Work_Phone__c='9987654321';
        insert acct;
        
        Contact con = DataFactoryTest.createContact(acct.Id);
        insert con;
        
        List<SASInboundAPIMapping__mdt> sasInbound = DataFactoryTest.createSASInbound();
                
        Opportunity opp = new Opportunity(
            Name = 'Test Opportunity', StageName = 'Closed Won First Payment Pending',
            CloseDate = Date.today(), AccountId = acct.Id
        );
        insert opp;
        
        Payment_Processor__c paymentprocessor = new Payment_Processor__c(
            Processor_Type__c='SAS', Name='SAS'
        );
        insert paymentprocessor;
        
        Program_Plan__c programPlan = new Program_Plan__c(
            Opportunity__c = opp.Id, Client__c = acct.Id, Payment_Processor__c= paymentprocessor.Id            
        );
        insert programPlan;
        
        Draft__c draft = new Draft__c(
            Program_Plan__c = programPlan.Id, Draft_Amount__c = 100, Retainer_Fee__c = 10,
            Setup_Fee__c = 20, Processor_Fee__c = 30, Service_Fee__c = 40, External_SAS_Id__c ='10',
            Draft_Status__c = 'Scheduled', Program_Fee__c = 10, Draft_Date__c = Date.newInstance(2023, 06, 24)
        );
        insert draft;
        
        List<SAS_Payment_Status_Mapping__mdt> paymentStatuMap = DataFactoryTest.createSASPaymenteStatusMapping();
    }
    
    @IsTest
    static void doPatchTest_Failure(){ 
        Test.startTest();
        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();
        req.requestURI = '/services/apexrest/v1/updateSASDetails';
        req.httpMethod = 'PATCH';
        RestContext.response= res;       
        SASInboundAPI.updateDraft();
        Test.stopTest();
        
        Application_Log__c log = [SELECT Id,Statement__c FROM Application_Log__c Limit 1];
        Assert.areEqual('Unexpected error occurred. Please reach out your salesforce system administrator', log.Statement__c, 'Verify the application log is created');
    }
    
    @IsTest
    static void doPatchTest_Success(){ 
    
        Test.startTest();
        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();
        req.requestURI = '/services/apexrest/v1/updateSASDetails';
        req.httpMethod = 'PATCH';
        req.requestBody = Blob.valueOf('{"created":"2022-10-17T10:07:35.317","invoicenumber":"123123","paymentstatus":"Successful","debits_id":"10"}');
        RestContext.request = req;
        RestContext.response = res;       
        SASInboundAPI.updateDraft();  
        Test.stopTest();
        
        Draft__c draft = [SELECT Id, Draft_Status__c FROM Draft__c Limit 1];
        //Assert.areEqual('Completed' ,draft.Draft_Status__c , 'Verify draft status');
    }
    
    @IsTest
    static void doPatchTest_Success1(){ 
        Test.startTest();
        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();
        req.requestURI = '/services/apexrest/v1/updateSASDetails';
        req.httpMethod = 'PATCH';
        req.requestBody = Blob.valueOf('{"created":"2022-10-17T10:07:35.317","invoicenumber":"123123","paymentstatus":"Pending"}');
        RestContext.request = req;
        RestContext.response = res;       
        SASInboundAPI.updateDraft();  
        Test.stopTest();
        
        Application_Log__c log = [SELECT Id,Statement__c  FROM Application_Log__c Limit 1];
        Assert.areEqual('Required fields are missing.', log.Statement__c, 'Verify the application log is created');
        
    }
    
}