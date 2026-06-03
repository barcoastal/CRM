@isTest
private class DraftTriggerHandlerTest {

    @TestSetup
    static void makeData(){
        
            

        Id profileId = [SELECT Id FROM Profile WHERE Name = 'System Administrator'].Id;

        User userInstance = DataFactoryTest.createUser(profileId);

        userInstance.Twilio_Phone__c = '6498345678';

        insert userInstance;

        

        SAS_Settings__c sas = DataFactoryTest.createSASSettings();
        insert sas;
        
        List<Account> accList = new List<Account>{
            DataFactoryTest.createBusinessAccount(), DataFactoryTest.createBusinessAccount()
        };
        accList[0].Lead_Number__c = '123456';
         accList[0].OwnerId = userInstance.Id;
        accList[0].client_status__c = 'First Payment Pending';

        accList[1].OwnerId = userInstance.Id;
        accList[1].client_status__c = 'First Payment Pending';
        insert accList;

        List<Opportunity> oppList = new List<Opportunity>{
            DataFactoryTest.createOpportunity(), DataFactoryTest.createOpportunity()
        };
             oppList[0].OwnerId = userInstance.Id;

        oppList[1].OwnerId = userInstance.Id;

        oppList[0].AccountId = accList[0].Id;

        oppList[1].AccountId = accList[1].Id;
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
            for(draft__c draft : draftList){
                draft.Account__c = accList[0].Id;
            }
        insert draftList;
    }
    
   /* @IsTest
    static void updateOpportunityBasedOnFirstPaymentCompleteTest(){
        Draft__c draft = [SELECT Id,Program_Plan__c FROM Draft__c LIMIT 1];
        draft.Draft_Status__c = DraftUtil.STATUS_COMPLETED;
        
        Test.startTest();
        update draft;
        Test.stopTest();
        Program_Plan__c programPlan = [SELECt Id,Opportunity__c,Opportunity__r.First_Payment_Completed_Date__c,Opportunity__r.StageName FROM Program_Plan__c WHERE ID =: draft.Program_Plan__c LIMIT 1];

        /*Assert.areEqual(Date.Today(), programPlan.Opportunity__r.First_Payment_Completed_Date__c);
        Assert.areEqual(OpportunityUtil.STAGE_CLOSED_WON_COMPLETED,programPlan.Opportunity__r.StageName);
        Assert.areEqual(DraftUtil.STATUS_COMPLETED, draft.Draft_Status__c);*/
    /*} */
    

    @IsTest
    static void createDebitScheduleTestOnDelete(){

        Test.startTest();
        delete [SELECT Id FROM Draft__c WHERE Draft_Date__c = :Date.newInstance(2024, 04, 01) LIMIT 1];
        Test.stopTest();
        
        Debit_Schedule__c verifyDebitSchedule = [
            SELECT Id, Deposit_Amount__c, Start_Date__c, Number_of_Payments__c 
            FROM Debit_Schedule__c WHERE Deposit_Amount__c = 132.65 LIMIT 1
        ];
        Assert.areEqual(Date.newInstance(2024, 02, 01), verifyDebitSchedule.Start_Date__c);
        Assert.areEqual(2, verifyDebitSchedule.Number_of_Payments__c);
    }
    
    @IsTest
    static void createDebitScheduleTestOnDateUpdate(){

        Draft__c draft = [SELECT Id FROM Draft__c WHERE Draft_Amount__c = 132.65 LIMIT 1];
        draft.Draft_Date__c = Date.newInstance(2024, 01, 01); 
        
        Test.startTest();
        update draft;
        Test.stopTest();
        
        Debit_Schedule__c verifyDebitSchedule = [
            SELECT Id, Deposit_Amount__c, Start_Date__c, Number_of_Payments__c 
            FROM Debit_Schedule__c WHERE Deposit_Amount__c = 132.65
        ];
        Assert.areEqual(Date.newInstance(2024, 01, 01), verifyDebitSchedule.Start_Date__c);
        Assert.areEqual(3, verifyDebitSchedule.Number_of_Payments__c);
    }

    @IsTest
    static void createDebitScheduleTestOnAmountUpdate(){

        Draft__c draft = [SELECT Id FROM Draft__c WHERE Draft_Amount__c = 300.00 LIMIT 1];
        draft.Retainer_Fee__c = 250.00; 
        draft.Setup_Fee__c = 350.00; 
        draft.Processor_Fee__c = 50.00; 
        draft.Service_Fee__c = 50.00;
        
        Test.startTest();
        update draft;
        Test.stopTest();
        
        Debit_Schedule__c verifyDebitSchedule = [
            SELECT Id, Deposit_Amount__c, Start_Date__c, Number_of_Payments__c 
            FROM Debit_Schedule__c WHERE Deposit_Amount__c = 1000.00
        ];
        Assert.areEqual(Date.newInstance(2024, 01, 10), verifyDebitSchedule.Start_Date__c);
        Assert.areEqual(2, verifyDebitSchedule.Number_of_Payments__c);
    }

    @isTest
    static void createDebitScheduleTestOnInsert() {

        List<Program_Plan__c> programPlanList = [SELECT Id FROM Program_Plan__c];
        
        List<Debit_Schedule__c> debitScheduleToVerify = [
            SELECT Id, Deposit_Amount__c, Start_Date__c, Number_of_Payments__c, Program_Plan__c
            FROM Debit_Schedule__c WHERE Program_Plan__c IN :programPlanList 
        ];

        Assert.areEqual(6, debitScheduleToVerify.size());    
        
        for (Debit_Schedule__c debit : debitScheduleToVerify) {

            if (debit.Deposit_Amount__c == 200) {

                Assert.areEqual(Date.newInstance(2024, 01, 01), debit.Start_Date__c);
                Assert.areEqual(2, debit.Number_of_Payments__c);
                Assert.areEqual(programPlanList[0].Id, debit.Program_Plan__c);

            } else if (debit.Deposit_Amount__c == 100.00) {

                Assert.areEqual(Date.newInstance(2024, 01, 15), debit.Start_Date__c);
                Assert.areEqual(1, debit.Number_of_Payments__c);
                Assert.areEqual(programPlanList[0].Id, debit.Program_Plan__c);

            } else if (debit.Deposit_Amount__c == 300.00) {

                Assert.areEqual(Date.newInstance(2024, 01, 10), debit.Start_Date__c);
                Assert.areEqual(1, debit.Number_of_Payments__c);
                Assert.areEqual(programPlanList[0].Id, debit.Program_Plan__c);

            } else if (debit.Deposit_Amount__c == 750.00) {

                Assert.areEqual(Date.newInstance(2024, 01, 20), debit.Start_Date__c);
                Assert.areEqual(2, debit.Number_of_Payments__c);
                Assert.areEqual(programPlanList[0].Id, debit.Program_Plan__c);

            } else if (debit.Deposit_Amount__c == 1100.00) {

                Assert.areEqual(Date.newInstance(2024, 01, 01), debit.Start_Date__c);
                Assert.areEqual(1, debit.Number_of_Payments__c);
                Assert.areEqual(programPlanList[1].Id, debit.Program_Plan__c);

            } else if (debit.Deposit_Amount__c == 132.65) {

                Assert.areEqual(Date.newInstance(2024, 02, 01), debit.Start_Date__c);
                Assert.areEqual(3, debit.Number_of_Payments__c);
                Assert.areEqual(programPlanList[1].Id, debit.Program_Plan__c);
            }
        }
    }

    @isTest
    static void verifySyncStatusIfClientNotSyncedNewDraftCreated() {
        List<Account> accts = [SELECT Id FROM Account];
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        Draft__c newDraft = createDraftInstance(prgmPlans[0].Id, 100.00, 0.00, 0.00, 50.00, 50.00, Date.newInstance(2024, 01, 01));
        Test.startTest();
        insert newDraft;
        Test.stopTest();
        List<Draft__c> draftsToVerify = [SELECT Id, Sync_Status__c FROM Draft__c WHERE Id = :newDraft.Id];
        Assert.areEqual('Sync Pending', draftsToVerify[0].Sync_Status__c, 'Verifying the Sync Status is not populated');
    }

    @isTest
    static void verifySyncStatusIfClientSyncedNewDraftCreated() {
        List<Account> accts = [SELECT Id FROM Account];
        Account acctRecord = accts[0];
        acctRecord.External_SAS_Id__c = '238467234';
        update acctRecord;
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        Draft__c newDraft = createDraftInstance(prgmPlans[0].Id, 100.00, 0.00, 0.00, 50.00, 50.00, Date.newInstance(2024, 01, 01));
        newDraft.Account__c = acctRecord.Id;
        Test.startTest();
        insert newDraft;
        Test.stopTest();
        List<Draft__c> draftsToVerify = [SELECT Id, Sync_Status__c FROM Draft__c WHERE Id = :newDraft.Id];
        Assert.areEqual('Sync Pending', draftsToVerify[0].Sync_Status__c, 'Verifying the Sync Status is populated');
    }

    @isTest
    static void verifySyncStatusIfClientNotSyncedDraftUpdated() {
        List<Account> accts = [SELECT Id FROM Account];
        Account acctRecord = accts[0];
        Test.startTest();
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        Draft__c newDraft = createDraftInstance(prgmPlans[0].Id, 100.00, 0.00, 0.00, 50.00, 50.00, Date.newInstance(2024, 01, 01));
        newDraft.Account__c = acctRecord.Id;
        insert newDraft;
        newDraft.Draft_Amount__c = 1500;
        
        update newDraft;
        Test.stopTest();
        List<Draft__c> draftsToVerify = [SELECT Id, Sync_Status__c FROM Draft__c WHERE Id = :newDraft.Id];
        Assert.areEqual('Sync Pending', draftsToVerify[0].Sync_Status__c, 'Verifying the Sync Status is not populated');
    }

    @isTest
    static void verifySyncStatusIfClientSyncedDraftUpdated() {
        Test.startTest();
        List<Account> accts = [SELECT Id FROM Account];
        Account acctRecord = accts[0];
        acctRecord.External_SAS_Id__c = '238467234';
        update acctRecord;
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        Draft__c newDraft = createDraftInstance(prgmPlans[0].Id, 100.00, 0.00, 0.00, 50.00, 50.00, Date.newInstance(2024, 01, 01));
        newDraft.Account__c = acctRecord.Id;
        newDraft.External_SAS_Id__c = '453453345';
        newDraft.Sync_Status__c = 'In Sync';
        insert newDraft;
        newDraft.Draft_Amount__c = 1500;        
        update newDraft;
        Test.stopTest();
        List<Draft__c> draftsToVerify = [SELECT Id, Sync_Status__c FROM Draft__c WHERE Id = :newDraft.Id];
        Assert.areEqual('Sync Pending', draftsToVerify[0].Sync_Status__c, 'Verifying the Sync Status is populated');
    }

    @isTest
    static void verifySyncStatusIfClientNotSyncedDraftUpdatedWithOtherFields() {
        List<Account> accts = [SELECT Id FROM Account];
        Account acctRecord = accts[0];
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        Test.startTest();
        Draft__c newDraft = createDraftInstance(prgmPlans[0].Id, 100.00, 0.00, 0.00, 50.00, 50.00, Date.newInstance(2024, 01, 01));
        newDraft.Account__c = acctRecord.Id;
        insert newDraft;
        newDraft.External_RAM_Id__c = '34535646';
        
        update newDraft;
        Test.stopTest();
        List<Draft__c> draftsToVerify = [SELECT Id, Sync_Status__c FROM Draft__c WHERE Id = :newDraft.Id];
        Assert.areEqual('Sync Pending', draftsToVerify[0].Sync_Status__c, 'Verifying the Sync Status is not populated');
    }

    @isTest
    static void verifySyncStatusIfClientSyncedDraftUpdatedWithOtherFields() {
        Test.startTest();
        List<Account> accts = [SELECT Id FROM Account];
        Account acctRecord = accts[0];
        acctRecord.External_SAS_Id__c = '238467234';
        update acctRecord;
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        Draft__c newDraft = createDraftInstance(prgmPlans[0].Id, 100.00, 0.00, 0.00, 50.00, 50.00, Date.newInstance(2024, 01, 01));
        newDraft.Account__c = acctRecord.Id;
        newDraft.External_SAS_Id__c = '453453345';
        newDraft.Sync_Status__c = 'In Sync';
        insert newDraft;
        newDraft.External_RAM_Id__c = '34535646';        
        update newDraft;
        Test.stopTest();
        List<Draft__c> draftsToVerify = [SELECT Id, Sync_Status__c FROM Draft__c WHERE Id = :newDraft.Id];
        Assert.areEqual('In Sync', draftsToVerify[0].Sync_Status__c, 'Verifying the Sync Status is populated');
    }

    @isTest
    static void testCancelDraftStatusUpdate() {
        Test.startTest();
        List<Account> accts = [SELECT Id FROM Account];
        Account acctRecord = accts[0];
        acctRecord.External_SAS_Id__c = '238467234';
        update acctRecord;        
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        Draft__c newDraft = createDraftInstance(prgmPlans[0].Id, 100.00, 0.00, 0.00, 50.00, 50.00, Date.newInstance(2024, 01, 01));
        newDraft.Account__c = acctRecord.Id;
        newDraft.External_SAS_Id__c = '453453345';
        newDraft.Sync_Status__c = 'In Sync';
        insert newDraft;
        newDraft.Draft_Status__c = DraftUtil.STATUS_CANCELLED;        
        update newDraft;
        Test.stopTest();
        List<Draft__c> draftsToVerify = [SELECT Id, Sync_Status__c FROM Draft__c WHERE Id = :newDraft.Id];
        Assert.areEqual('Sync Pending', draftsToVerify[0].Sync_Status__c, 'Verifying the Sync Status is populated');
    }
    
     @IsTest
    static void updateOpportunityBasedOnFirstPaymentCompleteTest() {
     
        Draft__c draft = [SELECT Id, Program_Plan__c, Draft_Cleared_Date__c, Account__c 
                          FROM Draft__c 
                          WHERE Draft_Date__c = 2024-01-01 
                          AND Program_Plan__c != null 
                          LIMIT 1];
        
        draft.Draft_Cleared_Date__c = null;
        update draft;
    
        Test.startTest();
        draft.Draft_Status__c = 'Completed';
        draft.Draft_Cleared_Date__c = Date.today();
        update draft;
        Test.stopTest();
    
        Program_Plan__c pp = [SELECT Opportunity__c, Opportunity__r.AccountId FROM Program_Plan__c WHERE Id = :draft.Program_Plan__c];
        
        Opportunity updatedOpp = [SELECT StageName, First_Payment_Completed__c, First_Payment_Completed_Date__c 
                                  FROM Opportunity WHERE Id = :pp.Opportunity__c];
        
        Account updatedAcc = [SELECT Client_Status__c, First_Payment_Completed_Date__c 
                              FROM Account WHERE Id = :pp.Opportunity__r.AccountId];
    
        Assert.areEqual(OpportunityUtil.STAGE_CLOSED_WON_COMPLETED, updatedOpp.StageName, 'Opp Stage should be updated');
        Assert.areEqual(true, updatedOpp.First_Payment_Completed__c, 'First Payment checkbox should be true');
        Assert.areEqual(Date.today(), updatedOpp.First_Payment_Completed_Date__c, 'Opp Date should match Draft Cleared Date');
    
        Assert.areEqual(AccountUtil.CLIENT_STATUS_ACTIVE, updatedAcc.Client_Status__c, 'Account should be Active');
        Assert.areEqual(Date.today(), updatedAcc.First_Payment_Completed_Date__c, 'Account Date should match Draft Cleared Date');
    }

    @IsTest
    static void testNoDateUpdateWhenClearedDateDoesNotChange() {
        Draft__c draft = [SELECT Id, Draft_Cleared_Date__c,Program_Plan__c FROM Draft__c WHERE Draft_Date__c = 2024-01-01 LIMIT 1];
        Date initialDate = Date.newInstance(2024, 02, 15);
        draft.Draft_Cleared_Date__c = initialDate;
        update draft;
    
        Test.startTest();
        draft.Draft_Status__c = 'Completed';
        draft.Draft_Amount__c = 999; 
        update draft;
        Test.stopTest();
    
        Program_Plan__c pp = [SELECT Opportunity__r.First_Payment_Completed_Date__c FROM Program_Plan__c WHERE Id = :draft.Program_Plan__c];
        
        Assert.areNotEqual(Date.today(), pp.Opportunity__r.First_Payment_Completed_Date__c, 'Date should not update if Cleared Date was not changed');
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