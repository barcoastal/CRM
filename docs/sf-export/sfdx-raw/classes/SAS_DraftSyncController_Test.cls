@isTest
public class SAS_DraftSyncController_Test {
   
    @TestSetup
    static void makeData(){
        
        Id personAcctRecTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'Business_Account');
        Account acct = new Account(RecordTypeId = personAcctRecTypeId, Name = 'Nyssa Vazquez',  External_SAS_Id__c = '69');
        insert acct;

        Opportunity oppty = new Opportunity(
            Name = 'Opportunity Test', AccountId = acct.Id, CloseDate = System.today().addDays(3), ForecastCategoryName = 'Pipeline',
            Probability = 40, StageName = 'Working Opportunity'
        );
        insert oppty;

        Payment_Processor__c processor = new Payment_Processor__c(Name = 'SAS', Processor_Type__c = 'SAS');
        insert processor;

        Program_Plan__c programPlan = new Program_Plan__c(
            Client__c = acct.Id, Opportunity__c = oppty.Id, Payment_Processor__c = processor.Id
        );
        insert programPlan;

        Draft__c draft = new Draft__c(Program_Plan__c = programPlan.Id, External_SAS_Id__c = '243');
        insert draft;
        insert new SAS_Settings__c(Endpoint__c = 'https://test.com'); 
    }
    
    @isTest
    static void syncClientDraftsTest(){
        Test.startTest();
        Account acc = [SELECT Id FROM Account WHERE External_SAS_Id__c = '69' LIMIT 1];
        
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        SAS_DraftSyncController.syncClientDrafts(acc.Id);
        
        
        List<Draft__c> results = [SELECT Id, External_SAS_Id__c, Draft_Amount__c FROM Draft__c WHERE Program_Plan__r.Client__c = :acc.Id];
        
        System.assertEquals(True, results.size() > 1, 'Draft records should exist after sync.');
        Test.stopTest();
    }
    
    @isTest
    static void syncClientDraftsTest_fail(){
        
        Id AccountId = '001000000000000AAA';
        
        Test.startTest();
        try{
            
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        SAS_DraftSyncController.syncClientDrafts(AccountId);
            
        }catch(Exception ex){
            System.assert(ex.getMessage().contains('Script-thrown exception'), 'Message should indicate an LWC handled error');
        }
        Test.stopTest();
    }
}