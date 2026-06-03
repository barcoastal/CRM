@IsTest
private class Batch_UpdateFieldsOnAccountTest {
    @TestSetup
    static void makeData(){

        SAS_Settings__c sas = DataFactoryTest.createSASSettings();
        insert sas;
        
        List<Account> accList = new List<Account>{
            DataFactoryTest.createBusinessAccount(), DataFactoryTest.createBusinessAccount()
        };
        accList[0].Lead_Number__c = '123456';
        insert accList;

        List<Opportunity> oppList = new List<Opportunity>{
            DataFactoryTest.createOpportunity(), DataFactoryTest.createOpportunity()
        };
        oppList[0].AccountId = accList[0].Id;
        insert oppList;

        Payment_Processor__c processor = DataFactoryTest.createPaymentProcessor();
        insert processor;

        List<Program_Plan__c> programPlanList = new List<Program_Plan__c>{
            DataFactoryTest.createProgramPlan(oppList[0].Id, accList[0].Id, processor.Id),
            DataFactoryTest.createProgramPlan(oppList[0].Id, accList[1].Id, processor.Id)
        };
        insert programPlanList;

        List<Draft__c> draftList = new List<Draft__c>{
            createDraftInstance(programPlanList[0].Id, 100.00, 0.00, 0.00, 50.00, 50.00, Date.newInstance(2024, 01, 01)),//200
            createDraftInstance(programPlanList[0].Id, 100.00, 0.00, 0.00, 50.00, 50.00, Date.newInstance(2024, 01, 5)),//200
            createDraftInstance(programPlanList[0].Id, 300.00, 0.00, 0.00, 0.00, 0.00, Date.newInstance(2024, 01, 10)),//300.00
            createDraftInstance(programPlanList[0].Id, 0.00, 150.00, 750.00, 50.00, 50.00, Date.newInstance(2024, 01, 15)),//1000.00
            createDraftInstance(programPlanList[0].Id, 650.00, 0.00, 0.00, 50.00, 50.00, Date.newInstance(2024, 01, 25)),//750.00
            createDraftInstance(programPlanList[0].Id, 650.00, 0.00, 0.00, 50.00, 50.00, Date.newInstance(2024, 01, 20)),//750.00
            createDraftInstance(programPlanList[1].Id, 0.00, 250.00, 750.00, 50.00, 50.00, Date.newInstance(2024, 01, 01)),//1100.00
            createDraftInstance(programPlanList[1].Id, 132.65, 0.00, 0.00, 0.00, 0.00, Date.newInstance(2024, 04, 01)),//132.65
            createDraftInstance(programPlanList[1].Id, 132.65, 0.00, 0.00, 0.00, 0.00, Date.newInstance(2024, 02, 01)),//132.65
            createDraftInstance(programPlanList[1].Id, 132.65, 0.00, 0.00, 0.00, 0.00, Date.newInstance(2024, 03, 01))//132.65
        };
        insert draftList;
    }
    
     @IsTest
    static void updateAccountField(){
        Test.startTest();        
        Database.executeBatch(new Batch_UpdateFieldsOnAccount());        
        Test.stopTest();
    }
    
    private static Draft__c createDraftInstance(
        Id programPlanId, Decimal draftAmount, Decimal retainerFee, Decimal setupFee, 
        Decimal processorFee, Decimal serviceFee, Date draftdate
    ) {
        return new Draft__c(
            Draft_Date__c = draftdate, Draft_Amount__c = draftAmount, Program_Plan__c = programPlanId,
            Retainer_Fee__c = retainerFee, Setup_Fee__c = setupFee, Processor_Fee__c = processorFee, Service_Fee__c = serviceFee
        );
    }
}