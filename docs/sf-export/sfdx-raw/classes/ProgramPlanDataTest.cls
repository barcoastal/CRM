@isTest
private class ProgramPlanDataTest {
    
    @TestSetup
    static void makeData() {
        SAS_Settings__c sas = DataFactoryTest.createSASSettings();
        insert sas;
        // Create a test Account
        Account account = new Account(Name = 'XYZ COMPANY');
        insert account;
        // Create a test Opportunity record
        Opportunity opportunity = new Opportunity(
            Name = 'Test Opportunity', StageName = 'Working Opportunity', 
            CloseDate = Date.today(), AccountId = account.Id
        );
        insert opportunity;
        // Create payment processor
        Payment_Processor__c paymentprocessor = new Payment_Processor__c(
            Processor_Type__c='SAS', Name='SAS'
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
                Program_Plan__c = programPlan.Id, Draft_Status__c = 'Scheduled', Draft_Date__c = Date.today().addDays(1),
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

    @isTest
    static void testGetActiveProgramPlan(){

                
        Opportunity opp = [SELECT Id, StageName FROM Opportunity LIMIT 1];
        opp.StageName = 'Closed Won First Payment Pending';
        update opp;

        Id acctId = [SELECT Id FROM Account LIMIT 1].Id;
        Id paymentProcessorId = [SELECT Id FROM Payment_Processor__c LIMIT 1].Id;

        Test.startTest();
        List<Program_Plan__c> programPlanList = ProgramPlanData.getActiveProgramPlan(acctId);
        Test.stopTest();

        System.assert(!programPlanList.isEmpty());
        System.assertEquals(1, programPlanList[0].Completed_Drafts_Count__c);
        System.assertEquals(paymentProcessorId, programPlanList[0].Payment_Processor__c);
        System.assertEquals('SAS', programPlanList[0].Payment_Processor__r.Processor_Type__c);
        //System.assertEquals(100, programPlanList[0].Completed_Drafts_Amount__c);
        System.assertEquals(Date.today().addDays(1), programPlanList[0].Next_Draft_Date__c);
        System.assertEquals(Date.today().addDays(7), programPlanList[0].Last_Completed_Draft_Date__c);
        System.assertEquals(UserInfo.getUserId(), programPlanList[0].Last_Rescheduled_By__c);
        System.assertEquals(Date.today(), programPlanList[0].Last_Rescheduled_Date_Time__c);
    }

    @isTest
    static void testQueryProgramPlanDetails(){

        Id opptyId = [SELECT Id FROM Opportunity LIMIT 1].Id;
        Id paymentProcessorId = [SELECT Id FROM Payment_Processor__c LIMIT 1].Id;
        
        Test.startTest();
        List<Program_Plan__c> programPlanList = ProgramPlanData.queryProgramPlanDetails(opptyId, new List<String> {
            'Completed_Drafts_Count__c', 'Payment_Processor__c', 'Payment_Processor__r.Processor_Type__c', 'Last_Rescheduled_By__c', 
            'Completed_Drafts_Amount__c', 'Next_Draft_Date__c', 'Last_Completed_Draft_Date__c', 'Last_Rescheduled_Date_Time__c'
        });
        Test.stopTest();
        
        System.assert(!programPlanList.isEmpty());
        System.assertEquals(1, programPlanList[0].Completed_Drafts_Count__c);
        System.assertEquals(paymentProcessorId, programPlanList[0].Payment_Processor__c);
        System.assertEquals('SAS', programPlanList[0].Payment_Processor__r.Processor_Type__c);
        //System.assertEquals(100, programPlanList[0].Completed_Drafts_Amount__c);
        System.assertEquals(Date.today().addDays(1), programPlanList[0].Next_Draft_Date__c);
        System.assertEquals(Date.today().addDays(7), programPlanList[0].Last_Completed_Draft_Date__c);
        System.assertEquals(UserInfo.getUserId(), programPlanList[0].Last_Rescheduled_By__c);
        System.assertEquals(Date.today(), programPlanList[0].Last_Rescheduled_Date_Time__c);
    }

    @isTest
    static void getAccountsWithProgramPlansTest(){

        List<Opportunity> oppList = [SELECT Id, AccountId FROM Opportunity];
        
        Test.startTest();
        Map<Id, Id> accIdWithPrgmPlanIdMap = ProgramPlanData.getAccountsWithProgramPlans(oppList);
        Test.stopTest();
        
        Assert.areEqual(
            [SELECT Id FROM Program_Plan__c LIMIT 1].Id, 
            accIdWithPrgmPlanIdMap.get(oppList[0].AccountId), 
            'Verify the Program Plan Id'
        );
    }

    @isTest
    static void getProgramPlanDetailsMapTest(){

        Id oppId = [SELECT Id FROM Opportunity LIMIT 1].Id;
        
        Test.startTest();
        Map<Id, Program_Plan__c> prgmMap = ProgramPlanData.getProgramPlanDetailsMap(oppId);
        Test.stopTest();
        
        Assert.isNotNull(prgmMap, 'Verify the program plan is retrieved');
    }

    @isTest
    static void getActiveProgramPlanOfAccountsTest(){
        
        Id acctId = [SELECT Id FROM Account LIMIT 1].Id;
        Id paymentProcessorId = [SELECT Id FROM Payment_Processor__c LIMIT 1].Id;

        Opportunity opp = [SELECT Id, StageName FROM Opportunity LIMIT 1];
        opp.StageName = 'Working Opportunity';
        update opp;

        Test.startTest();
        Map<Id, Program_Plan__c> prgmMap = ProgramPlanData.getActiveProgramPlanOfAccounts(new Set<Id>{acctId});
        Test.stopTest();
        
        Assert.areEqual(acctId, prgmMap.values()[0].Client__c, 'Verify the client in the program plan');
        Assert.areEqual(paymentProcessorId, prgmMap.values()[0].Payment_Processor__c, 'Verify the payment processor in the program plan');
    }
    
    @isTest
    static void getActiveProgramPlanOfAccountTest(){
        
        Id acctId = [SELECT Id FROM Account LIMIT 1].Id;
        Id paymentProcessorId = [SELECT Id FROM Payment_Processor__c LIMIT 1].Id;

        Opportunity opp = [SELECT Id, StageName FROM Opportunity LIMIT 1];
        opp.StageName = 'Working Opportunity';
        update opp;

        Test.startTest();
        Map<Id, Program_Plan__c> prgmMap = ProgramPlanData.getActiveProgramPlanOfAccount(new Set<Id>{acctId});
        Map<Id, Program_Plan__c> prgmMap2 = ProgramPlanData.getProgramPlanOfAccounts(new Set<Id>{acctId});
        Test.stopTest();
        
        Assert.areEqual(acctId, prgmMap.values()[0].Client__c, 'Verify the client in the program plan');
        Assert.areEqual(paymentProcessorId, prgmMap.values()[0].Payment_Processor__c, 'Verify the payment processor in the program plan');
    }
    
    @isTest
    static void getActiveProgramPlanIdOfAccountsTest(){
        
        Id acctId = [SELECT Id FROM Account LIMIT 1].Id;
        Id paymentProcessorId = [SELECT Id FROM Payment_Processor__c LIMIT 1].Id;

        Opportunity opp = [SELECT Id, StageName FROM Opportunity LIMIT 1];
        opp.StageName = 'Working Opportunity';
        update opp;

        Test.startTest();
        Map<Id, Id> prgmMap = ProgramPlanData.getActiveProgramPlanIdOfAccounts(new Set<Id>{acctId});
        Test.stopTest();
        
        Assert.areNotEqual(prgmMap,Null);
    }
    
    @isTest
    static void getProgramPlanOfAccountTest(){
        Id acctId = [SELECT Id FROM Account LIMIT 1].Id;
        Id paymentProcessorId = [SELECT Id FROM Payment_Processor__c LIMIT 1].Id;

        Opportunity opp = [SELECT Id, StageName FROM Opportunity LIMIT 1];
        opp.StageName = 'Working Opportunity';
        update opp;

        Test.startTest();
        Program_Plan__c prgmMap = ProgramPlanData.getProgramPlanOfAccount(acctId);
        Test.stopTest();
        
        Assert.areNotEqual(prgmMap,Null);
    }
}