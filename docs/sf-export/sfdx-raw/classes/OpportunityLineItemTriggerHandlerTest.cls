@isTest
private class OpportunityLineItemTriggerHandlerTest {
	@TestSetup
    static void setupData() {
        Payment_Processor__c proc = DataFactoryTest.createPaymentProcessor();
        insert proc;
        
        Account acc = DataFactoryTest.createBusinessAccount();
        insert acc;
        
        Contact con = DataFactoryTest.createContact();
        con.AccountId = acc.Id;
        insert con;
        
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acc.Id;
        insert opp;
        
     	Product2 product2Record = DataFactoryTest.createProduct();
        insert product2Record;

        Id pricebookId = Test.getStandardPricebookId();

        PricebookEntry pricebookEntryStd = DataFactoryTest.createPriceBookEntryId(pricebookId, product2Record.Id);
        insert pricebookEntryStd;

        Pricebook2 pricebookRecord = DataFactoryTest.createPriceBook();
        insert pricebookRecord;

        PricebookEntry pricebookEntry = DataFactoryTest.createPriceBookEntryId(pricebookRecord.Id, product2Record.Id);
        insert pricebookEntry;

        OpportunityLineItem oppLineItem = DataFactoryTest.createOppLineItem(opp.Id, product2Record.Id, pricebookEntry.Id);
        insert oppLineItem;
    }
    
    @isTest
    static void programPlanInsertTest() {
        Test.startTest();
        List<Account> accList = [SELECT Id FROM Account LIMIT 1];
        List<Payment_Processor__c> processorList = [SELECT Id FROM Payment_Processor__c LIMIT 1];
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.StageName = 'Closed Won First Payment Pending';
        opp.AccountId = accList[0].Id;
        insert opp;
         	Product2 product2Record = DataFactoryTest.createProduct();
        insert product2Record;

        Id pricebookId = Test.getStandardPricebookId();

        PricebookEntry pricebookEntryStd = DataFactoryTest.createPriceBookEntryId(pricebookId, product2Record.Id);
        insert pricebookEntryStd;

        Pricebook2 pricebookRecord = DataFactoryTest.createPriceBook();
        insert pricebookRecord;

        PricebookEntry pricebookEntry = DataFactoryTest.createPriceBookEntryId(pricebookRecord.Id, product2Record.Id);
        insert pricebookEntry;

        OpportunityLineItem oppLineItem = DataFactoryTest.createOppLineItem(opp.Id, product2Record.Id, pricebookEntry.Id);
        
        String errMsg;
        try {
           insert oppLineItem;
        } catch (Exception exp) {
            errMsg = exp.getMessage();
        }
        Test.stopTest();
    }
    
    @isTest
    static void programPlanUpdateTest() {
        List<Opportunity> oppList = [SELECT Id,StageName FROM Opportunity Limit 1];
        oppList[0].StageName = 'Closed Won First Payment Pending';
        update oppList;

        OpportunityLineItem opli = [SELECT Id,Quantity FROM OpportunityLineItem LIMIT 1];
        opli.Quantity = 2;
        String errMsg;
        
        Test.startTest();
        try {
            update opli;
        } catch (Exception exp) {
            errMsg = exp.getMessage();
        }
        Test.stopTest();
    }
    
    @isTest
    static void programPlanDeleteTest() {
        List<Opportunity> oppList = [SELECT Id,StageName FROM Opportunity Limit 1];
        oppList[0].StageName = 'Closed Won First Payment Pending';
        update oppList;
        
        OpportunityLineItem opli = [SELECT Id,Quantity FROM OpportunityLineItem LIMIT 1];
        String errMsg;
        
        Test.startTest();
        try {
            delete opli;
        } catch (Exception exp) {
            errMsg = exp.getMessage();
        }
        Test.stopTest();
    }
}