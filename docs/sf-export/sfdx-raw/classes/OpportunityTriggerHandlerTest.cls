@isTest
private class OpportunityTriggerHandlerTest {

    @TestSetup
    static void makeData(){

        Five9LSP__Five9_List__c five9List = DataFactoryTest.createFive9List();
        insert five9List;

        // Create test data
        Lead leadRecord = DataFactoryTest.createListLead();
        leadRecord.Phone='9876543201';
        leadRecord.Five9_List_Id__c = five9List.Id;
        leadRecord.RecordTypeId = LeadUtil.getRecordTypeId('Pre_Lead');
        insert leadRecord;

        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        oppInstance.Phone__c = '9876543201';
        oppInstance.StageName = 'Working Opportunity';
        oppInstance.Version_Status__c = 'Draft';
        insert oppInstance;
        
    }

    @isTest
    static void createTaskOnStageChangeTest(){
        
        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        oppInstance.StageName = 'Waiting for Agreements';

        Test.startTest();
        insert oppInstance;
        oppInstance.StageName = 'Agreements Received';
        update oppInstance;
        Test.stopTest();
        
        Task taskInstance = [SELECT Id, WhatId, Description, Status, Subject FROM Task LIMIT 1];
        System.assertEquals(oppInstance.Id, taskInstance.WhatId);
        System.assertEquals('Completed', taskInstance.Status);
        //System.assertEquals('Opportunity Stage changed from Closed Won to Agreements Received', taskInstance.Description);
        System.assertEquals('Stage Changed to Agreements Received', taskInstance.Subject);
    }
    
    @isTest
    static void createTaskOnTransferQualificationChangeTest(){
        
        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        oppInstance.Transfer_Qualification__c = 'Qualified';

        Test.startTest();
        insert oppInstance;
        oppInstance.Transfer_Qualification__c = 'Qualified with Bonus';
        update oppInstance;
        Test.stopTest();
        
        Task taskInstance = [SELECT Id, WhatId, Description, Status, Subject FROM Task LIMIT 1];
        System.assertEquals(oppInstance.Id, taskInstance.WhatId);
        System.assertEquals('Completed', taskInstance.Status);
        System.assertEquals('The opportunity transfer qualification changed from Qualified to Qualified with Bonus', taskInstance.Description);
        System.assertEquals('Transfer Qualification changed to Qualified with Bonus', taskInstance.Subject);
    }
    
    @isTest
    static void stageChangeTest(){
        Account acc = DataFactoryTest.createBusinessAccount();
        acc.Qualified_Financial__c = true;
        insert acc;
        
        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        oppInstance.StageName = 'Agreements Received';
        oppInstance.AccountId = acc.Id;
        oppInstance.Sub_Disposition__c = 'Appointment';
        insert oppInstance;

        Test.startTest();
        oppInstance.StageName = 'Ready To Close'; 
        oppInstance.Sub_Disposition__c = 'Callback';
        oppInstance.Bank_Change_Contract_Status__c = 'Completed';
        update oppInstance;
        Test.stopTest();
        
        Opportunity verifyOpp = [SELECT Id, Last_Disposition__c, Last_Sub_Disposition__c, Last_Disposition_DateTime__c FROM Opportunity WHERE Id = :oppInstance.Id];
        //Assert.areEqual('Working Opportunity', verifyOpp.Last_Disposition__c, 'The last disposition was not updated correctly.');
        Assert.areEqual('Appointment', verifyOpp.Last_Sub_Disposition__c, 'Verify the last sub disposition');
        Assert.isNotNull(verifyOpp.Last_Disposition_DateTime__c, 'Verify the last disposition datetime is populated');
    }

    @isTest
    static void totalDebtChangeTest() {
        Payment_Processor__c proc = DataFactoryTest.createPaymentProcessor();
        insert proc;

        Account acc = DataFactoryTest.createBusinessAccount();
        insert acc;
        
        Contact con = DatafactoryTest.createContact();
        con.AccountId = acc.Id;
        insert con;
        
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acc.Id;
        insert opp;

        Program_Plan__c plan = DataFactoryTest.createProgramPlan(opp.Id, acc.Id, proc.Id);
        plan.Total_Debt__c = 20000;
        insert plan;

        SAS_Settings__c sas = DataFactoryTest.createSASSettings();
        insert sas;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler(true));
        plan.Total_Debt__c = 50000;
        update plan;
        Test.stopTest();

        Assert.areEqual(50000, [SELECT Id, Amount FROM Opportunity ORDER BY CreatedDate DESC LIMIT 1].Amount, 'Verify the amount value on total debt change');
    }

    @isTest
    static void assignProgramStartEndDateTest(){

        Payment_Processor__c proc = DataFactoryTest.createPaymentProcessor();
        insert proc;

        Account acc = DataFactoryTest.createBusinessAccount();
        insert acc;
        
        Contact con = DatafactoryTest.createContact();
        con.AccountId = acc.Id;
        insert con;
            
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.StageName = 'Contract Sent';
        opp.AccountId = acc.Id;
        insert opp;

        Program_Plan__c plan = DataFactoryTest.createProgramPlan(opp.Id, acc.Id, proc.Id);
        insert plan;
        
        SAS_Settings__c sas = DataFactoryTest.createSASSettings();
        insert sas;

        List<Draft__c> draftList = new List<Draft__c> {
            DataFactoryTest.createDraft(plan.Id),
            DataFactoryTest.createDraft(plan.Id),
            DataFactoryTest.createDraft(plan.Id),
            DataFactoryTest.createDraft(plan.Id),
            DataFactoryTest.createDraft(plan.Id)
        };
        draftList[1].Draft_Date__c = System.today().addDays(1);
        draftList[1].External_SAS_Id__c = '55';
        draftList[2].Draft_Date__c = System.today().addDays(2);
        draftList[2].External_SAS_Id__c = '56';
        draftList[3].Draft_Date__c = System.today().addDays(3);
        draftList[3].External_SAS_Id__c = '57';
        draftList[4].Draft_Date__c = System.today().addDays(4);
        draftList[4].External_SAS_Id__c = '58';
        insert draftList;
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler(true));
        Opportunity oppty = [SELECT Id,StageName FROM Opportunity WHERE Id= :opp.Id];
        opp.StageName = OpportunityUtil.STAGE_CLOSED_WON_PENDING;
        update opp;   
        Test.stopTest();
        
        Account accToVerify = [SELECT Id, Program_Start_Date__c, Program_End_Date__c FROM Account LIMIT 1];
        Assert.isNotNull(accToVerify, 'Verify the account is retrieved');
        Assert.areEqual(System.today(), accToVerify.Program_Start_Date__c, 'Verify the program start date');
        Assert.areEqual(System.today().addDays(4), accToVerify.Program_End_Date__c, 'Verify the program end date');
    }

    @isTest
    static void assignProgramStartEndDateWithoutDraftsTest(){
        
        Payment_Processor__c proc = DataFactoryTest.createPaymentProcessor();
        insert proc;

        Account acc = DataFactoryTest.createBusinessAccount();
        insert acc;
        
        Contact con = DatafactoryTest.createContact();
        con.AccountId = acc.Id;
        insert con;
            
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.StageName = 'Contract Sent';
        opp.AccountId = acc.Id;
        insert opp;

        Program_Plan__c plan = DataFactoryTest.createProgramPlan(opp.Id, acc.Id, proc.Id);
        insert plan;
        
        SAS_Settings__c sas = DataFactoryTest.createSASSettings();
        insert sas;

        String errMsg;
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler(true));
        opp.StageName = OpportunityUtil.STAGE_CLOSED_WON_PENDING;
        update opp;
        Test.stopTest();
        
    }

    @IsTest
    static void primaryContactEmailTest(){
        
        Account acc = DataFactoryTest.createBusinessAccount();
        insert acc;
        
        List<Contact> conList = new List<Contact> {
            DataFactoryTest.createContact(acc.Id), DataFactoryTest.createContact(acc.Id)
        };
        conList[0].Lead_Number__c = '123457';
        insert conList;

        acc.Primary_Contact__c = conList[0].Id;
        update acc;
        
        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        oppInstance.StageName = 'Agreements Received';
        oppInstance.AccountId =  acc.Id;
        oppInstance.Email__c = 'test@gm.com';
        Test.startTest();
        insert oppInstance;
        oppInstance.StageName = 'Ready To Close';
        update oppInstance;
        Test.stopTest();
        System.assertEquals([SELECT Email FROM Contact LIMIT 1].Email, 'test@gm.com');
        
    }

    @isTest
    static void linkDocumentToAccountTest(){

        Payment_Processor__c proc = DataFactoryTest.createPaymentProcessor();
        insert proc;

        Account acc = DataFactoryTest.createBusinessAccount();
        insert acc;
        
        Contact con = DatafactoryTest.createContact();
        con.AccountId = acc.Id;
        insert con;
            
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.StageName = 'Contract Sent';
        opp.AccountId = acc.Id;
        insert opp;

        Program_Plan__c plan = DataFactoryTest.createProgramPlan(opp.Id, acc.Id, proc.Id);
        insert plan;
        
        SAS_Settings__c sas = DataFactoryTest.createSASSettings();
        insert sas;

        List<Draft__c> draftList = new List<Draft__c> {
            DataFactoryTest.createDraft(plan.Id),
            DataFactoryTest.createDraft(plan.Id),
            DataFactoryTest.createDraft(plan.Id),
            DataFactoryTest.createDraft(plan.Id),
            DataFactoryTest.createDraft(plan.Id)
        };
        draftList[1].Draft_Date__c = System.today().addDays(1);
        draftList[1].External_SAS_Id__c = '55';
        draftList[2].Draft_Date__c = System.today().addDays(2);
        draftList[2].External_SAS_Id__c = '56';
        draftList[3].Draft_Date__c = System.today().addDays(3);
        draftList[3].External_SAS_Id__c = '57';
        draftList[4].Draft_Date__c = System.today().addDays(4);
        draftList[4].External_SAS_Id__c = '58';
        insert draftList;

        ContentVersion contVersion1 = new ContentVersion();
        contVersion1.Title = FileUtil.AGREEMENT_SAS + opp.Name + '_Completed';
        contVersion1.VersionData = Blob.valueOf('Test Contract');
        contVersion1.PathOnClient = 'Test';
        insert contVersion1;
        String sasAgreement = '%' + FileUtil.AGREEMENT_SAS + '%';
        List<ContentDocument> contentDocuments = [SELECT Id FROM ContentDocument WHERE Title LIKE :sasAgreement];
        ContentDocumentLink contentDocLink = new ContentDocumentLink();
        contentDocLink.ContentDocumentId = contentDocuments[0].Id;
        contentDocLink.LinkedEntityId = opp.Id;
        insert contentDocLink;
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler(true));
        opp.StageName = OpportunityUtil.STAGE_CLOSED_WON_PENDING;
        update opp;     
        Test.stopTest();
        
        List<ContentDocumentLink> cdlToVerify = [SELECT Id FROM ContentDocumentLink WHERE LinkedEntityId = :acc.Id LIMIT 1];
        Assert.areEqual(false, cdlToVerify.isEmpty(), 'File should be attached to the account.');
    }

    @isTest
    static void testRemoveFromFive9() {
        List<Opportunity> opps = [SELECT Id FROM Opportunity];
        Opportunity oppRecord = opps[0];
        oppRecord.StageName = 'Archived';
        oppRecord.Sub_Disposition__c = 'Not Enough Debt';
        Test.startTest();
            OpportunityLockService.disableOppLockForSystemUpdates();
            update oppRecord;
            OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        Test.stopTest();
        /*List<Async_Operation__c> asyncOperations = [SELECT Id, Status__c, Operation__c FROM Async_Operation__c];
        Assert.areEqual('Completed', asyncOperations[0].Status__c, 'Verifying the Async Operation is completed successfully.'); 
        Assert.areEqual('Remove Lead From Five9 - Opportunity Final Disposition', asyncOperations[0].Operation__c, 'Verifying the business operation.');
        List<lead> leadsToVerify = [SELECT Id, Five9_List_Id__c FROM Lead];
        Assert.areEqual(null, leadsToVerify[0].Five9_List_Id__c, 'Verifying the lead is removed from Five9');*/
    }

    @isTest
    static void testRemoveFromFive9OppClosed() {
        Account acc = DataFactoryTest.createBusinessAccount();
        insert acc;
        
        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        oppInstance.AccountId = acc.Id;
        oppInstance.StageName = OpportunityUtil.STAGE_CONTRACT_SENT;
        insert oppInstance;
        
        oppInstance.StageName = OpportunityUtil.STAGE_CLOSED_WON_PENDING;        
        Test.startTest();
        update oppInstance;
        oppInstance.StageName = OpportunityUtil.STAGE_CLOSED_WON_COMPLETED; 
        update oppInstance;
        oppInstance.StageName = 'Closed Lost';
        update oppInstance;
        Test.stopTest();
        /*List<Async_Operation__c> asyncOperations = [SELECT Id, Status__c, Operation__c FROM Async_Operation__c];
        Assert.areEqual('Completed', asyncOperations[0].Status__c, 'Verifying the Async Operation is completed successfully.'); 
        Assert.areEqual('Remove Lead From Five9 - Opportunity Closed', asyncOperations[0].Operation__c, 'Verifying the business operation.');
        List<lead> leadsToVerify = [SELECT Id, Five9_List_Id__c FROM Lead];
        Assert.areEqual(null, leadsToVerify[0].Five9_List_Id__c, 'Verifying the lead is removed from Five9');*/
    }

    //Fixed the test method failure issue
    @isTest
    static void testRemoveFromFive9Negative() {
        List<Lead> leads = [SELECT Id FROM Lead];
        Lead leadRecord = leads[0];
        leadRecord.Five9_List_Id__c = 'dshfbsdfdsf';
        leadRecord.Outbound_ANI_Date__c = System.today();
        leadRecord.Outbound_ANI_From__c  = 'testFrom';
        leadRecord.Outbound_ANI_Identifier__c = 'testIdentifier';
        update leadRecord;
        List<Opportunity> opps = [SELECT Id FROM Opportunity];
        Opportunity oppRecord = opps[0];
        oppRecord.StageName = 'Archived';
        oppRecord.Sub_Disposition__c = 'Not Enough Debt';
        Test.startTest();
            OpportunityLockService.disableOppLockForSystemUpdates();
            update oppRecord;
            OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        Test.stopTest();
        List<lead> leadsToVerify = [SELECT Id, Five9_List_Id__c FROM Lead WHERE Id = :leadRecord.Id];
        Assert.areEqual('dshfbsdfdsf', leadsToVerify[0].Five9_List_Id__c, 'Verifying the lead does not remove Five9');
        List<Application_Log__c> logs = [SELECT Id FROM Application_Log__c];
        //Assert.areEqual(1, logs.size(), 'Verifying the application log is created.'); 
    }
     /*@isTest
    static void updateAccountClientStatus(){
        Account acc = DataFactoryTest.createBusinessAccount();
        insert acc;
        
        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        oppInstance.AccountId = acc.Id;
        Test.startTest();
        insert oppInstance;
        oppInstance.StageName = 'Closed Won First Payment Pending';
        update oppInstance;
        Test.stopTest();
        
        Account updatedAcc = [Select id,Client_Status__c from Account where id =:acc.Id];
        Assert.areEqual('Waiting for First payment', updatedAcc.Client_Status__c);
    }*/
    
    @isTest
    static void updateCloserOnAccount(){
        Account acc = DataFactoryTest.createBusinessAccount();
        insert acc;
        
        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        oppInstance.AccountId = acc.Id;
        Test.startTest();
        insert oppInstance;
        Test.stopTest();
        Opportunity opp = [Select id,OwnerId from opportunity where Id=:oppInstance.id];
        Account updatedAcc = [Select id,Closer__c from Account where id =:acc.Id];
        Assert.areEqual(opp.OwnerId,updatedAcc.Closer__c);
    }
    
    @isTest
    static void checkVersionStatusActiveCheck(){
        List<Opportunity> oppList = [SELECT Id FROM Opportunity LIMIT 1];
        oppList[0].Version_Status__c = 'Pending Client Approval';
        update oppList;
        
        Payment_Processor__c proc = DataFactoryTest.createPaymentProcessor();
        insert proc;

        Account acc = DataFactoryTest.createBusinessAccount();
        acc.Client_Status__c = 'First Payment pending';
        insert acc;
        
        Contact con = DatafactoryTest.createContact();
        con.AccountId = acc.Id;
        insert con;
            
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acc.Id;
        insert opp;

        Program_Plan__c plan = DataFactoryTest.createProgramPlan(opp.Id, acc.Id, proc.Id);
        insert plan;
        
        SAS_Settings__c sas = DataFactoryTest.createSASSettings();
        insert sas;

        List<Draft__c> draftList = new List<Draft__c> {
            DataFactoryTest.createDraft(plan.Id),
            DataFactoryTest.createDraft(plan.Id),
            DataFactoryTest.createDraft(plan.Id),
            DataFactoryTest.createDraft(plan.Id),
            DataFactoryTest.createDraft(plan.Id)
        };
        draftList[1].Draft_Date__c = System.today().addDays(1);
        draftList[1].Draft_Status__c = 'Completed';
        draftList[1].External_SAS_Id__c = '55';
        draftList[2].Draft_Date__c = System.today().addDays(2);
        draftList[2].External_SAS_Id__c = '56';
        draftList[3].Draft_Date__c = System.today().addDays(3);
        draftList[3].External_SAS_Id__c = '57';
        draftList[4].Draft_Date__c = System.today().addDays(4);
        draftList[4].External_SAS_Id__c = '58';
        insert draftList;

        Test.startTest();
        oppList[0].Opportunity__c = opp.Id;
        oppList[0].Version_Status__c = 'Active';
        update oppList;     
        Test.stopTest();
 
    }
    
    @isTest
    static void checkCreateBankAccountSync() {
        Payment_Processor__c proc = DataFactoryTest.createPaymentProcessor();
        insert proc;

        Account acc = DataFactoryTest.createBusinessAccount();
        acc.External_SAS_Id__c = '555';
        insert acc;
        
        Contact con = DatafactoryTest.createContact();
        con.AccountId = acc.Id;
        insert con;
        
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acc.Id;
        opp.stageName='Closed Won First Payment Pending';
        insert opp;

        Program_Plan__c plan = DataFactoryTest.createProgramPlan(opp.Id, acc.Id, proc.Id);
        plan.Total_Debt__c = 20000;
        insert plan;

        SAS_Settings__c sas = DataFactoryTest.createSASSettings();
        insert sas;
        

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler(true));
        opp.Bank_Change_Contract_Status__c = 'Completed';
        UPDATE opp;
        SystemActivityService.createSystemActivity('Test','Test Des', acc.Id, 'Pending', null);
        Test.stopTest();
    }
    
    @isTest
    static void checkCreateClientSync() {
        Payment_Processor__c proc = DataFactoryTest.createPaymentProcessor();
        insert proc;

        Account acc = DataFactoryTest.createBusinessAccount();
        acc.External_SAS_Id__c = '555';
        insert acc;
        
        Contact con = DatafactoryTest.createContact();
        con.AccountId = acc.Id;
        insert con;
        
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acc.Id;
        opp.stageName = 'Closed Won First Payment Pending';         
        insert opp;

        Program_Plan__c plan = DataFactoryTest.createProgramPlan(opp.Id, acc.Id, proc.Id);
        plan.Total_Debt__c = 20000;
        insert plan;

        SAS_Settings__c sas = DataFactoryTest.createSASSettings();
        insert sas;
        

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler(true));
        opp.Phone__c= '(609) 265-2215';
        UPDATE opp;
        SystemActivityService.createSystemActivity('Test','Test Des', acc.Id, 'Pending', null);
        Test.stopTest();
    }
    
    @isTest
    static void checkClientSync() {
        Payment_Processor__c proc = DataFactoryTest.createPaymentProcessor();
        insert proc;

        Account acc = DataFactoryTest.createBusinessAccount();
        acc.External_SAS_Id__c = '555';
        insert acc;
        
        Contact con = DatafactoryTest.createContact();
        con.AccountId = acc.Id;
        insert con;
        
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acc.Id;
        opp.stageName = 'Working Opportunity';        
        insert opp;

        Program_Plan__c plan = DataFactoryTest.createProgramPlan(opp.Id, acc.Id, proc.Id);
        plan.Total_Debt__c = 20000;
        insert plan;

        SAS_Settings__c sas = DataFactoryTest.createSASSettings();
        insert sas;
        

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler(true));
        opp.stageName = OpportunityUtil.STAGE_CONTRACT_SINGED;
        update opp;
        Test.stopTest();
        List<Application_Log__c> logs = [SELECT Id FROM Application_Log__c];
        Assert.areEqual(2, logs.size(), 'Verifying the application log is created.');
    }

   // ─── Helper: Create and insert Account + Opportunity, return the Opp ──────

    private static Opportunity setupAndGetOpp() {
        Account acc = DataFactoryTest.createPersonAccount();
        insert acc;

        Opportunity opp = DataFactoryTest.createOpportunity('Test Opp', OpportunityUtil.STAGE_WORKING_OPPORTUNITY, acc.Id);
        insert opp;

        return [SELECT Id, StageName FROM Opportunity WHERE Id = :opp.Id LIMIT 1];
    }

    private static Account setupAndGetAccount() {
        Account acc = DataFactoryTest.createPersonAccount();
        insert acc;
        return acc;
    }

    // ─── Test: Blocked — transition to Archived-Finalized is restricted ───────

    @IsTest
    static void testStageChange_ToArchivedFinalized_IsBlocked() {
        Opportunity opp = setupAndGetOpp();
        opp.StageName = OpportunityUtil.STAGE_ARCHIVED_FINALIZED;

        Test.startTest();
        Database.SaveResult result = Database.update(opp, false);
        Test.stopTest();

        System.assert(
            !result.isSuccess(),
            'Update should have failed — Archived-Finalized transition must be blocked.'
        );
        System.assert(
            result.getErrors()[0].getMessage().contains(OpportunityUtil.STAGE_ARCHIVED_FINALIZED),
            'Error message should reference Archived-Finalized stage.'
        );
    }

    // ─── Test: Allowed — updating a field without changing stage ─────────────

    @IsTest
    static void testStageChange_NoStageChange_IsAllowed() {
        Opportunity opp = setupAndGetOpp();
        opp.StageName = OpportunityUtil.STAGE_WORKING_OPPORTUNITY; // Same stage, no transition

        Test.startTest();
        Database.SaveResult result = Database.update(opp, false);
        Test.stopTest();

        System.assert(
            result.isSuccess(),
            'Update with no stage change should succeed.'
        );
    }

    // ─── Test: Allowed — transition between non-Archived stages ──────────────

    @IsTest
    static void testStageChange_BetweenOtherStages_IsAllowed() {
        Opportunity opp = setupAndGetOpp();
        opp.StageName = 'Closed Won - First payment pending'; // Transition to another non-restricted stage

        Test.startTest();
        Database.SaveResult result = Database.update(opp, false);
        Test.stopTest();

        System.assert(
            result.isSuccess(),
            'Transition between non-Archived-Finalized stages should be allowed.'
        );
    }

    // ─── Test: Bypass via DeDuplication static flag ───────────────────────────

    @IsTest
    static void testStageChange_BypassViaDeDuplicationFlag_IsAllowed() {
        Opportunity opp = setupAndGetOpp();
        opp.StageName = OpportunityUtil.STAGE_ARCHIVED_FINALIZED;

        OpportunityTriggerHandler.bypassForDeDuplication = true;

        Test.startTest();
        Database.SaveResult result = Database.update(opp, false);
        Test.stopTest();

        OpportunityTriggerHandler.bypassForDeDuplication = false;

        System.assert(
            result.isSuccess(),
            'Update should succeed when DeDuplication bypass flag is active.'
        );
    }

    // ─── Test: Bypass via Custom Setting (Org-level) ──────────────────────────

    @IsTest
    static void testStageChange_BypassViaCustomSetting_IsAllowed() {
        SystemControlSettings__c settings = new SystemControlSettings__c(
            SetupOwnerId                             = UserInfo.getOrganizationId(),
            Disable_Archived_Finalized_Validation__c = true
        );
        insert settings;

        Opportunity opp = setupAndGetOpp();
        opp.StageName = OpportunityUtil.STAGE_ARCHIVED_FINALIZED;

        Test.startTest();
        Database.SaveResult result = Database.update(opp, false);
        Test.stopTest();

        System.assert(
            result.isSuccess(),
            'Update should succeed when Custom Setting bypass is enabled at org level.'
        );
    }

    // ─── Test: Custom Setting present but set to FALSE → validation fires ─────

    @IsTest
    static void testStageChange_CustomSettingFalse_IsBlocked() {
        SystemControlSettings__c settings = new SystemControlSettings__c(
            SetupOwnerId                             = UserInfo.getOrganizationId(),
            Disable_Archived_Finalized_Validation__c = false
        );
        insert settings;

        Opportunity opp = setupAndGetOpp();
        opp.StageName =OpportunityUtil.STAGE_ARCHIVED_FINALIZED;

        Test.startTest();
        Database.SaveResult result = Database.update(opp, false);
        Test.stopTest();

        System.assert(
            !result.isSuccess(),
            'Update should fail when Custom Setting bypass is explicitly set to false.'
        );
        System.assert(
            result.getErrors()[0].getMessage().contains(OpportunityUtil.STAGE_ARCHIVED_FINALIZED),
            'Error message should reference Archived-Finalized stage.'
        );
    }

    // ─── Test: Bypass via Custom Setting at User level ────────────────────────

    @IsTest
    static void testStageChange_BypassViaCustomSetting_UserLevel_IsAllowed() {
        SystemControlSettings__c settings = new SystemControlSettings__c(
            SetupOwnerId                             = UserInfo.getUserId(),
            Disable_Archived_Finalized_Validation__c = true
        );
        insert settings;

        Opportunity opp = setupAndGetOpp();
        opp.StageName = OpportunityUtil.STAGE_ARCHIVED_FINALIZED;

        Test.startTest();
        Database.SaveResult result = Database.update(opp, false);
        Test.stopTest();

        System.assert(
            result.isSuccess(),
            'Update should succeed when Custom Setting bypass is enabled at user level.'
        );
    }

    // ─── Test: DeDuplication flag resets after use (no state leak) ───────────

    @IsTest
    static void testDeDuplicationFlag_ResetsAfterUse_ValidationFires() {
        Opportunity opp = setupAndGetOpp();

        // Simulate DeDuplication ran and reset the flag
        OpportunityTriggerHandler.bypassForDeDuplication = true;
        OpportunityTriggerHandler.bypassForDeDuplication = false; // Reset

        opp.StageName = OpportunityUtil.STAGE_ARCHIVED_FINALIZED;

        Test.startTest();
        Database.SaveResult result = Database.update(opp, false);
        Test.stopTest();

        System.assert(
            !result.isSuccess(),
            'Validation should fire again after DeDuplication flag is reset to false.'
        );
    }

    // ─── Test: Bulk — all records blocked when no bypass active ──────────────

    @IsTest
    static void testBulkStageChange_AllBlocked_WhenNoBypass() {
        Account acc = setupAndGetAccount();

        List<Opportunity> opps = new List<Opportunity>();
        for (Integer i = 0; i < 5; i++) {
            opps.add(DataFactoryTest.createOpportunity('Bulk Opp ' + i, OpportunityUtil.STAGE_WORKING_OPPORTUNITY, acc.Id));
        }
        insert opps;

        List<Id> oppIds = new List<Id>();
        for (Opportunity o : opps) {
            oppIds.add(o.Id);
        }

        List<Opportunity> freshOpps = [SELECT Id, StageName FROM Opportunity WHERE Id IN :oppIds];
        for (Opportunity opp : freshOpps) {
            opp.StageName = OpportunityUtil.STAGE_ARCHIVED_FINALIZED;
        }

        Test.startTest();
        List<Database.SaveResult> results = Database.update(freshOpps, false);
        Test.stopTest();

        for (Database.SaveResult result : results) {
            System.assert(
                !result.isSuccess(),
                'Every bulk update to Archived-Finalized should be blocked.'
            );
        }
    }

    // ─── Test: Bulk — all records allowed when DeDuplication bypass active ────

    @IsTest
    static void testBulkStageChange_AllAllowed_WhenDeDuplicationBypass() {
        Account acc = setupAndGetAccount();

        List<Opportunity> opps = new List<Opportunity>();
        for (Integer i = 0; i < 5; i++) {
            opps.add(DataFactoryTest.createOpportunity('Bulk Bypass Opp ' + i,OpportunityUtil.STAGE_WORKING_OPPORTUNITY, acc.Id));
        }
        insert opps;

        List<Id> oppIds = new List<Id>();
        for (Opportunity o : opps) {
            oppIds.add(o.Id);
        }

        List<Opportunity> freshOpps = [SELECT Id, StageName FROM Opportunity WHERE Id IN :oppIds];
        for (Opportunity opp : freshOpps) {
            opp.StageName = OpportunityUtil.STAGE_ARCHIVED_FINALIZED;
        }

        OpportunityTriggerHandler.bypassForDeDuplication = true;

        Test.startTest();
        List<Database.SaveResult> results = Database.update(freshOpps, false);
        Test.stopTest();

        OpportunityTriggerHandler.bypassForDeDuplication = false;

        for (Database.SaveResult result : results) {
            System.assert(
                result.isSuccess(),
                'Every bulk update should succeed when DeDuplication bypass is active.'
            );
        }
    }
}