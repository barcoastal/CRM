@isTest
private class ProgramPlanTriggerHandlerTest {
    
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
        opp.External_Debit_Schedule_Id__c ='11';
        insert opp;
        
        Program_Plan__c plan = DataFactoryTest.createProgramPlan(opp.Id, acc.Id, proc.Id);
        plan.Total_Debt__c = 20000;
        insert plan;

    }
    
    @isTest
    static void programPlanInsertTest() {
        Test.startTest();
        List<Account> accList = [SELECT Id FROM Account LIMIT 1];
        List<Payment_Processor__c> processorList = [SELECT Id FROM Payment_Processor__c LIMIT 1];
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.StageName = 'Closed Won First Payment Pending';
        opp.External_Debit_Schedule_Id__c ='11';
        opp.AccountId = accList[0].Id;
        insert opp;
        Program_Plan__c plan = DataFactoryTest.createProgramPlan(opp.Id, accList[0].Id, processorList[0].Id);
        plan.Total_Debt__c = 20000;
        
        String errMsg;
        try {
            insert plan;
        } catch (Exception exp) {
            errMsg = exp.getMessage();
        }
        Test.stopTest();
        //System.assertNotEquals(null, errMsg, 'Verify exception is thrown on insert');
    }
    
    @isTest
    static void programPlanUpdateTest() {
        List<Opportunity> oppList = [SELECT Id,StageName FROM Opportunity Limit 1];
        oppList[0].StageName = 'Closed Won First Payment Pending';
        update oppList;

        Program_Plan__c existingPlan = [SELECT Id, Total_Debt__c FROM Program_Plan__c LIMIT 1];
        existingPlan.Total_Debt__c = 30000;
        String errMsg;
        
        Test.startTest();
        try {
            update existingPlan;
        } catch (Exception exp) {
            errMsg = exp.getMessage();
        }
        Test.stopTest();
        //System.assertNotEquals(null, errMsg, 'Verify exception is thrown on update');
    }
    
    @isTest
    static void programPlanDeleteTest() {
        List<Opportunity> oppList = [SELECT Id,StageName FROM Opportunity Limit 1];
        oppList[0].StageName = 'Closed Won First Payment Pending';
        update oppList;
        
        Program_Plan__c existingPlan = [SELECT Id FROM Program_Plan__c LIMIT 1];
        String errMsg;
        
        Test.startTest();
        try {
            delete existingPlan;
        } catch (Exception exp) {
            errMsg = exp.getMessage();
        }
        Test.stopTest();
        //System.assertNotEquals(null, errMsg, 'Verify exception is thrown on delete');
    }
}