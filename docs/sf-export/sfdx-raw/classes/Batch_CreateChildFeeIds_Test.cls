@isTest
public class Batch_CreateChildFeeIds_Test {
    @testSetup
    static void setupTestData() {

        Account account = new Account(Name = 'Test Account');
        insert account;

        Opportunity opp = new Opportunity(Name = 'Test Opportunity', AccountId = account.Id, CloseDate = Date.today(), StageName = 'Prospecting');
        insert opp;

        Payment_Processor__c paymentProcessor = DataFactoryTest.createPaymentProcessor();
        insert paymentProcessor;

        Program_Plan__c programPlan = new Program_Plan__c(Client__c = account.Id, Opportunity__c = opp.Id, Settlement_Program_Fee__c = 50,Payment_Processor__c = paymentProcessor.Id
                                                         ,Settlement_Percentage__c = '45' , Total_Debt__c = 100000,Weekly_Draft_Amount__c = 1000);
        insert programPlan;

        Draft__c draft = DataFactoryTest.createDraft(programPlan.Id,'Pending',null);
        insert draft;
        
    }
    
    @isTest
    static void testBatchExecution() {
        List<Draft__c> drafts = [SELECT Id FROM Draft__c LIMIT 1];
        List<Fee__c> feesToUpdate = new List<Fee__c>();
        for (Fee__c feeRecord : [SELECT Id FROM Fee__c WHERE Draft__c = :drafts[0].Id]) {
            feeRecord.Unique_Id__c = null;
            feesToUpdate.add(feeRecord);

        }
        update feesToUpdate;
        Test.startTest();
        Batch_CreateChildFeeIds batchJob = new Batch_CreateChildFeeIds();
        Database.ExecuteBatch(batchJob);
        Test.stopTest();
        
        List<Fee__c> updatedFees = [SELECT Unique_Id__c FROM Fee__c WHERE Unique_Id__c != null];
        System.assertEquals(6, updatedFees.size(), 'All records should have been updated.');
    }

    @isTest
    static void testBatchExecutionFailedUseCase() {
        List<Draft__c> draftsQueried = [SELECT Id FROM Draft__c LIMIT 1];
        List<Fee__c> feesToUpdate = new List<Fee__c>();
        for (Fee__c feeRecord : [SELECT Id FROM Fee__c WHERE Draft__c = :draftsQueried[0].Id]) {
            feeRecord.Unique_Id__c = null;
            feesToUpdate.add(feeRecord);

        }
        update feesToUpdate;
        List<Draft__c> drafts = [SELECT Id FROM Draft__c LIMIT 1];
        Fee__c feeRecord = new Fee__c();
        feeRecord.Draft__c = drafts[0].Id;
        feeRecord.Unique_Id__c = drafts[0].Id + '-' + 'Retainer_Fee';
        insert feeRecord;
        Test.startTest();
        Batch_CreateChildFeeIds batchJob = new Batch_CreateChildFeeIds();
        Database.ExecuteBatch(batchJob);
        Test.stopTest();
        
    }
}