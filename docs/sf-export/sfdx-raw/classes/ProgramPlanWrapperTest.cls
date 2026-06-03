@IsTest
private class ProgramPlanWrapperTest {
    
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
        // Create payment processor
        Payment_Processor__c paymentprocessor = new Payment_Processor__c(
            Processor_Type__c='SAS', Name='SAS', Bank_Setup_Fee__c = 34.45, Monthly_Bank_Fee__c = 23.43
        );
        insert paymentprocessor;         
        // Create a test Program_Plan__c record related to the Opportunity
        Program_Plan__c programPlan = new Program_Plan__c(
            Opportunity__c = opportunity.Id, Client__c = account.Id, Last_Rescheduled_Date_Time__c = Date.today(),
            Payment_Processor__c = paymentprocessor.Id, Last_Rescheduled_By__c = UserInfo.getUserId()    
        );
        insert programPlan;
        // Create a test Draft__c record related to the Program_Plan__c
        List<Draft__c> draftList = new List<Draft__c> {
            new Draft__c(
                Program_Plan__c = programPlan.Id, Draft_Status__c = 'Scheduled', Draft_Date__c = Date.today().addDays(3),
                Draft_Amount__c = 100, Retainer_Fee__c = 10, Setup_Fee__c = 20, Processor_Fee__c = 30, Service_Fee__c = 40,
                Program_Fee__c = 100
            ),
            new Draft__c(
                Program_Plan__c = programPlan.Id, Draft_Status__c = 'Processing', Draft_Date__c = Date.today().addDays(5),
                Draft_Amount__c = 100, Retainer_Fee__c = 10, Setup_Fee__c = 20, Processor_Fee__c = 30, Service_Fee__c = 40,
                Program_Fee__c = 100
            ),
            new Draft__c(
                Program_Plan__c = programPlan.Id, Draft_Status__c = 'Completed', Draft_Date__c = Date.today().addDays(7),
                Draft_Amount__c = 100, Retainer_Fee__c = 10, Setup_Fee__c = 20, Processor_Fee__c = 30, Service_Fee__c = 40,
                Program_Fee__c = 100
            )
        };
        insert draftList;
    }

    @IsTest
    static void testGetProgramPlanInstance(){

        Id opptyId = [SELECT Id FROM Opportunity LIMIT 1].Id;
        
        Test.startTest();
        ProgramPlanWrapper programPlanwrap1 = new ProgramPlanWrapper();
        ProgramPlanWrapper programPlanwrap = new ProgramPlanWrapper(ProgramPlanData.queryProgramPlanDetails(
            opptyId, new List<String>(ProgramPlanWrapper.programPlanFields)
        )[0]);
        Program_Plan__c programPlan = programPlanwrap.getProgramPlanInstance();
        Test.stopTest();        
        
        System.assertEquals(Date.today(), programPlanwrap.lastRescheduledDateTime);
        System.assertEquals(UserInfo.getUserId(), programPlanwrap.lastRescheduledById);
        System.assertEquals(Date.today().addDays(7), programPlanwrap.lastCompletedDraftDate);
        System.assertEquals(Date.today().addDays(3), programPlanwrap.nextDraftDate);
        System.assertEquals(1, programPlanwrap.completedDraftsCount);
        //System.assertEquals(100, programPlanwrap.completedDraftsAmount);
        System.assertEquals('SAS', programPlanwrap.paymentProcessorName);
        System.assertEquals(34.45, programPlanwrap.bankSetupFee);
        System.assertEquals(23.43, programPlanwrap.monthlyBankFee);
        System.assertEquals(programPlanwrap.noOfDebts, programPlan.No_of_Debts__c);
        System.assertEquals(programPlanwrap.totalDebt, programPlan.Total_Debt__c);
        System.assertEquals(programPlanwrap.weeklyPaymentDay, programPlan.Weekly_Payment_Day__c);
        System.assertEquals(programPlanwrap.secondPaymentDay, programPlan.Second_Payment_Day__c);
        System.assertEquals(programPlanwrap.nextPaymentDay, programPlan.Next_Payment_Day__c);
        System.assertEquals(programPlanwrap.firstPaymentDate, programPlan.First_Payment_Date__c);
        System.assertEquals(programPlanwrap.paymentTerm, programPlan.Payment_Term__c);
        System.assertEquals(programPlanwrap.setupFee, programPlan.Setup_Fee__c);
        System.assertEquals(programPlanwrap.paymentFrequency, programPlan.Payment_Frequency__c);
        System.assertEquals(programPlanwrap.retainerPercentage, programPlan.Retainer_Percentage__c);
        System.assertEquals(programPlanwrap.programFeePercentage, programPlan.Program_Fee_Percentage__c);
        System.assertEquals(programPlanwrap.settlementPercentage, programPlan.Settlement_Percentage__c);
        System.assertEquals(programPlanwrap.opportunityId, programPlan.Opportunity__c);
        System.assertEquals(programPlanwrap.recordId, programPlan.Id);
        System.assert(programPlanwrap.programRescheduledAlready());
        System.assert(programPlanwrap.businessClient);
    }
}