@IsTest
private class DraftWrapperTest {

    @TestSetup
    static void makeData() {
        
        SAS_Settings__c sas = DataFactoryTest.createSASSettings();
        insert sas;

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
            Program_Plan__c = programPlan.Id, Draft_Amount__c = 100, Retainer_Fee__c = 10,
            Setup_Fee__c = 20, Processor_Fee__c = 30, Service_Fee__c = 40, 
            Draft_Status__c = 'Scheduled', Program_Fee__c = 10, Draft_Date__c = Date.newInstance(2023, 06, 24)
        );
        insert draft;

        Fee__c feeToInsert = new Fee__c();
        feeToInsert.Draft__c = draft.Id;
        feeToInsert.Fee_Date__c = System.today().addDays(30);
        feeToInsert.Fee_Amount__c = 15;
        feeToInsert.Program_Plan__c = programPlan.Id;
        feeToInsert.Account__c = account.Id;
        insert feeToInsert;
    }

    @isTest
    static void testGetDraftInstance() {
        Opportunity opportunityRec = [SELECT Id FROM Opportunity LIMIT 1];
        Account acc = [SELECT Id FROM Account LIMIT 1];
        
        Program_Plan__c programPlan = [SELECT Id FROM Program_Plan__c LIMIT 1];
        List<Draft__c> drafts = DraftData.queryDrafts(acc.Id, opportunityRec.Id);

        Test.startTest();
        DraftWrapper draftWrap = new DraftWrapper(drafts[0]);
        ProcessorWrapper.CreateDraftRequest draftRequest = new ProcessorWrapper.CreateDraftRequest();
        draftRequest.draftWrap = draftWrap;
        SASValidation.draftValidation(draftRequest.draftWrap);
        Draft__c draft = draftWrap.getDraftInstance();
        Test.stopTest();

        // Assert that the Draft__c instance is created with the correct values
        System.assertEquals(draftWrap.recordId, drafts[0].Id);
        System.assertEquals(draftWrap.paymentAmount, drafts[0].Draft_Amount__c);
        System.assertEquals(draftWrap.paymentDate, drafts[0].Draft_Date__c);
        System.assertEquals(draftWrap.retainerFee, drafts[0].Retainer_Fee__c);
        System.assertEquals(draftWrap.setupFee, drafts[0].Setup_Fee__c);
        System.assertEquals(draftWrap.processorFee, drafts[0].Processor_Fee__c);
        System.assertEquals(draftWrap.serviceFee, drafts[0].Service_Fee__c);
        System.assertEquals(draftWrap.draftStatus, drafts[0].Draft_Status__c);
        System.assertEquals(draftWrap.programPlanId, drafts[0].Program_Plan__c);
        System.assertEquals(draftWrap.totalAmount, drafts[0].Draft_Total_Amount__c);
        System.assertEquals(draftWrap.programFee, drafts[0].Program_Fee__c);
        System.assertEquals(draftWrap.retainerSetupFeeRecord, drafts[0].Retainer_SetupFee_Draft__c);        
        System.assertEquals(null, draftWrap.processorSetupFee);
        System.assertEquals(null, draftWrap.runningBalance);
        System.assertEquals(null, draftWrap.isFirstPaymentInMonth);
        System.assertEquals(null, draftWrap.previousDraft);
        System.assertEquals(null, draftWrap.firstPaymentOfSchedule);
        System.assertEquals(null, draftWrap.uniqueId);
        System.assertEquals(null, draftWrap.childrens);
    }  

    @IsTest
    static void testCompareTo(){

        Program_Plan__c programPlan = [SELECT Id FROM Program_Plan__c LIMIT 1];
        // Create a test Draft__c record related to the Program_Plan__c
        List<Draft__c> drafts = new List<Draft__c> {
            new Draft__c(Program_Plan__c = programPlan.Id),
            new Draft__c(Program_Plan__c = programPlan.Id, Draft_Date__c = Date.newInstance(2023, 05, 24)),
            new Draft__c(Program_Plan__c = programPlan.Id, Draft_Date__c = Date.newInstance(2023, 07, 24)),            
            new Draft__c(Program_Plan__c = programPlan.Id, Draft_Date__c = Date.newInstance(2023, 06, 24))
        };
        insert drafts;
        
        List<DraftWrapper> draftWrapList = new List<DraftWrapper>{
            new DraftWrapper(drafts[0]), new DraftWrapper(drafts[1]), new DraftWrapper(drafts[2]), 
            new DraftWrapper(drafts[3]), new DraftWrapper()
        };
        
        // Sort using the custom compareTo() method
        draftWrapList.sort();
        
        System.assertEquals(null, draftWrapList[0].paymentDate);
        System.assertEquals(Date.newInstance(2023, 05, 24), draftWrapList[1].paymentDate);
        System.assertEquals(Date.newInstance(2023, 06, 24), draftWrapList[2].paymentDate);
        System.assertEquals(Date.newInstance(2023, 07, 24), draftWrapList[3].paymentDate);
        System.assertEquals(null, draftWrapList[4].paymentDate);
    }
}