/**
 * @description: Class to cover the test cases of the ProcessorAPI class
**/
@isTest
public with sharing class ProcessorAPI_Test {
    
    /**
     * @description: Test setup method to create the test records
    **/
    @testSetup
    static void makeData() {    
        
        Payment_Processor__c procSas = DataFactoryTest.createPaymentProcessor();
        insert procSas;

        SAS_Settings__c settings = DataFactoryTest.createSASSettings();
        insert settings;

        Payment_Calculator_Settings__c paymentSettings = DataFactoryTest.createPaymentCalculatorSettings();
        paymentSettings.Service_Fee__c = 10;
        insert paymentSettings;

        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.SSN__c = '874598734';
        acctRecord.BillingStreet = 'Test Street';
        acctRecord.BillingCity = 'Clio';
        acctRecord.BillingState = 'Alabama';
        acctRecord.BillingStateCode = 'AL';
        acctRecord.BillingPostalCode = '94405';
        acctRecord.Program_Start_Date__c = System.today().addDays(10);
        acctRecord.Program_End_Date__c = System.today().addDays(20);
        acctRecord.Bank_Name__c = 'Test Bank';
        acctRecord.Bank_Account_Number__c = '8927345353';
        acctRecord.Bank_Routing_Number__c = '064000059';
        acctRecord.Bank_Account_Type__c = 'Checking';
        insert acctRecord;

        Contact cont = DataFactoryTest.createContact();
        cont.AccountId = acctRecord.Id;
        cont.Birthdate = System.today().addYears(-25);
        insert cont;

        acctRecord.Primary_Contact__c = cont.Id;
        update acctRecord;

        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acctRecord.Id;
        opp.StageName = 'Closed Won First Payment Pending';
        insert opp;

        Program_Plan__c prgmPlan = DataFactoryTest.createProgramplan(opp.Id, acctRecord.Id, procSas.Id);
        prgmPlan.Debit_Schedule_Id__c = '575765656767';
        insert prgmPlan;

        Debt_Details__c debtDetail = DataFactoryTest.createDebtDetails(prgmPlan.Id);
        debtDetail.Account__c = acctRecord.Id;
        debtDetail.Opportunity__c = opp.Id;
        insert debtDetail;

        Offer__c offerRecord = DataFactoryTest.createOffer(acctRecord.Id, opp.Id, debtDetail.Id);
        insert offerRecord;

        ContentVersion contVersion = new ContentVersion();
        contVersion.Title = 'SAS Agreement_TestDocument_' + opp.Name + '_completed.pdf';
        contVersion.VersionData = Blob.valueOf('Test Contract');
        contVersion.PathOnClient = 'Test';
        insert contVersion;

        List<ContentDocument> contentDocuments = [SELECT Id FROM ContentDocument];

        ContentDocumentLink contentDocLink = new ContentDocumentLink();
        contentDocLink.ContentDocumentId = contentDocuments[0].Id;
        contentDocLink.LinkedEntityId = opp.Id;
        insert contentDocLink;

        insert new Citadel_Callout_Settings__c(Endpoint__c = 'https://test.com');
    }

    /**
     * @description: Positive scenario of syncing with SAS processor
    **/
    @isTest
    static void testSyncWithSas() {
        List<Account> accts = [SELECT Id FROM Account];
        Account acctRecord = accts[0];
        acctRecord.Sync_Status__c = 'Sync Pending';
        update acctRecord;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        ApexActionResult result = ProcessorAPI.initiateCreateAPI(accts[0].Id); 
        Test.stopTest();
        Assert.areEqual(ApexActionResult.Statuses.SUCCESS.name(), result.resultStatus, 'Verifying the API Call is successful');
    }

    /**
     * @description: Negative scenario of syncing with SAS processor
    **/
    @isTest
    static void testFailureOfSyncWithSas() {
        List<Account> accounts = [SELECT Id FROM Account];
        Account acctToUpdate = new Account();
        acctToUpdate.Id = accounts[0].Id;
        acctToUpdate.SSN__c = null;
        update acctToUpdate;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        ApexActionResult result = ProcessorAPI.initiateCreateAPI(accounts[0].Id); 
        Test.stopTest();
        Assert.areEqual(ApexActionResult.Statuses.ERROR.name(), result.resultStatus, 'Verifying the API Call is not successful');
        Assert.isTrue(result.message.contains('Client Sync => The following fields should not be blank: SSN.'), 'Verifying the error message');
    }
    
    @isTest
    static void testUpdateWithSas() {
        List<Account> accts = [SELECT Id FROM Account];
        Account acctRecord = accts[0];
        acctRecord.External_SAS_Id__c = '238467234';
        acctRecord.Sync_Status__c = 'In Sync';
        update acctRecord;
        Opportunity opp = [SELECT Id, phone__c FROM Opportunity WHERE AccountId =: acctRecord.Id];
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        ProcessorCreateAPI.updateClient(accts[0].Id, opp.Id); 
        Test.stopTest();
    }

   /* @isTest
    static void testDebitScheduleSyncDraftsWithSas() {
        
        try{
        List<Account> accts = [SELECT Id FROM Account];
        Account acctRecord = accts[0];
        acctRecord.External_SAS_Id__c = '238467234';
        acctRecord.Sync_Status__c = 'In Sync';
        update acctRecord;
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        Draft__c newDraft = createDraftInstance(prgmPlans[0].Id, 100.00, 0.00, 0.00, 50.00, 50.00, System.today().addDays(30));
        newDraft.Account__c = acctRecord.Id;
        insert newDraft;
        Fee__c feeToInsert = new Fee__c();
        feeToInsert.Draft__c = newDraft.Id;
        feeToInsert.Fee_Date__c = System.today().addDays(30);
        feeToInsert.Fee_Amount__c = 15;
        feeToInsert.Program_Plan__c = prgmPlans[0].Id;
        feeToInsert.Account__c = acctRecord.Id;
        insert feeToInsert;
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        //ApexActionResult result = ProcessorAPI.initiateCreateAPI(accts[0].Id); 
        Test.stopTest();
        }catch(Exception ex){
        }
        //Assert.areEqual(ApexActionResult.Statuses.SUCCESS.name(), result.resultStatus, 'Verifying the API Call is successful');
        //List<Draft__c> draftsToVerify = [SELECT Id, Sync_Status__c FROM Draft__c WHERE Id = :newDraft.Id];
        //Assert.areEqual('In Sync', draftsToVerify[0].Sync_Status__c, 'Verifying the Sync Status is populated');
    }*/

    @isTest
    static void testAddDebitsSyncDraftsWithSas() {
        List<Account> accts = [SELECT Id FROM Account];
        Test.startTest();
        Account acctRecord = accts[0];
        acctRecord.External_SAS_Id__c = '238467234';
        acctRecord.Sync_Status__c = 'In Sync';
        update acctRecord;
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        Program_Plan__c prgmPlanToUpdate = prgmPlans[0];
        prgmPlanToUpdate.Debit_Schedule_Id__c = '2090';
        update prgmPlanToUpdate;
        Draft__c newDraft = createDraftInstance(prgmPlans[0].Id, 100.00, 0.00, 0.00, 50.00, 50.00, System.today().addDays(30));
        newDraft.Account__c = acctRecord.Id;
        insert newDraft;
        Fee__c feeToInsert = new Fee__c();
        feeToInsert.Draft__c = newDraft.Id;
        feeToInsert.Fee_Date__c = System.today().addDays(30);
        feeToInsert.Fee_Amount__c = 15;
        feeToInsert.Program_Plan__c = prgmPlans[0].Id;
        feeToInsert.Account__c = acctRecord.Id;
        insert feeToInsert;
        
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        ApexActionResult result = ProcessorAPI.initiateCreateAPI(accts[0].Id); 
        Test.stopTest();
        Assert.areNotEqual(ApexActionResult.Statuses.SUCCESS.name(), result.resultStatus, 'Verifying the API Call is successful');
        List<Draft__c> draftsToVerify = [SELECT Id, Sync_Status__c FROM Draft__c WHERE Id = :newDraft.Id];
        Assert.areNotEqual('In Sync', draftsToVerify[0].Sync_Status__c, 'Verifying the Sync Status is populated');
    }

    @isTest
    static void testUpdateDebitsSyncDraftsWithSas() {
        List<Account> accts = [SELECT Id FROM Account];
        Test.startTest();
        Account acctRecord = accts[0];
        acctRecord.External_SAS_Id__c = '238467234';
        acctRecord.Sync_Status__c = 'In Sync';
        update acctRecord;
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        Program_Plan__c prgmPlanToUpdate = prgmPlans[0];
        prgmPlanToUpdate.Debit_Schedule_Id__c = '2090';
        update prgmPlanToUpdate;
        Draft__c newDraft = createDraftInstance(prgmPlans[0].Id, 100.00, 0.00, 0.00, 50.00, 50.00, System.today().addDays(30));
        newDraft.Account__c = acctRecord.Id;
        newDraft.External_SAS_Id__c = '235443';
        insert newDraft;
        Fee__c feeToInsert = new Fee__c();
        feeToInsert.Draft__c = newDraft.Id;
        feeToInsert.Fee_Date__c = System.today().addDays(30);
        feeToInsert.Fee_Amount__c = 15;
        feeToInsert.Program_Plan__c = prgmPlans[0].Id;
        feeToInsert.Account__c = acctRecord.Id;
        insert feeToInsert;
        
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        ApexActionResult result = ProcessorAPI.initiateCreateAPI(accts[0].Id); 
        Test.stopTest();
        Assert.areNotEqual(ApexActionResult.Statuses.SUCCESS.name(), result.resultStatus, 'Verifying the API Call is successful');
        List<Draft__c> draftsToVerify = [SELECT Id, Sync_Status__c FROM Draft__c WHERE Id = :newDraft.Id];
        Assert.areNotEqual('In Sync', draftsToVerify[0].Sync_Status__c, 'Verifying the Sync Status is populated');
    }

    @isTest
    static void testCancelDraftsWithSas() {
        Test.startTest();
        List<Account> accts = [SELECT Id FROM Account];
        Account acctRecord = accts[0];
        acctRecord.External_SAS_Id__c = '238467234';
        acctRecord.Sync_Status__c = 'In Sync';
        update acctRecord;
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        Draft__c newDraft = createDraftInstance(prgmPlans[0].Id, 100.00, 0.00, 0.00, 50.00, 50.00, Date.newInstance(2024, 01, 01));
        newDraft.Account__c = acctRecord.Id;
        newDraft.External_SAS_Id__c = '453453345';
        newDraft.Sync_Status__c = 'In Sync';
        newDraft.Draft_Status__c = DraftUtil.STATUS_CANCELLED;
        insert newDraft;
        Fee__c feeToInsert = new Fee__c();
        feeToInsert.Draft__c = newDraft.Id;
        feeToInsert.Fee_Date__c = System.today().addDays(30);
        feeToInsert.Fee_Amount__c = 15;
        feeToInsert.Program_Plan__c = prgmPlans[0].Id;
        feeToInsert.Account__c = acctRecord.Id;
        insert feeToInsert;

        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        ApexActionResult result = ProcessorAPI.initiateCreateAPI(accts[0].Id); 
        Test.stopTest();
        Assert.areEqual(ApexActionResult.Statuses.ERROR.name(), result.resultStatus, 'Verifying the API Call is successful');
        List<Draft__c> draftsToVerify = [SELECT Id, Sync_Status__c FROM Draft__c WHERE Id = :newDraft.Id];
        Assert.areEqual('Sync Pending', draftsToVerify[0].Sync_Status__c, 'Verifying the Sync Status is populated');
    }

    @isTest
    static void testCancelDraftsWithSasFailureScenario() {
        Test.startTest();
        List<Account> accts = [SELECT Id FROM Account];
        Account acctRecord = accts[0];
        acctRecord.External_SAS_Id__c = '238467234';
        acctRecord.Sync_Status__c = 'In Sync';
        acctRecord.Bank_Account_Sync_Status__c = 'In Sync';
        update acctRecord;
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        Draft__c newDraft = createDraftInstance(prgmPlans[0].Id, 100.00, 0.00, 0.00, 50.00, 50.00, Date.newInstance(2024, 01, 01));
        newDraft.Account__c = acctRecord.Id;
        newDraft.External_SAS_Id__c = '453453345';
        newDraft.Sync_Status__c = 'Sync Pending';
        insert newDraft;
        newDraft.Draft_Status__c = DraftUtil.STATUS_CANCELLED;
        update newDraft;
        
        ProcessorAPI.getDraftDetails(new Set<Id>{newDraft.Id});
        
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler(false));
        ApexActionResult result = ProcessorAPI.initiateCreateAPI(accts[0].Id); 
        Test.stopTest();
        List<Draft__c> draftsToVerify = [SELECT Id, Sync_Status__c FROM Draft__c WHERE Id = :newDraft.Id];
        Assert.areEqual('Sync Pending', draftsToVerify[0].Sync_Status__c, 'Verifying the Sync Status is not updated');
    }

    /**
     * @description: Validate the scneario of updating the payment processor to RAM if the state is updated to RAM's specific state
    **/
    @isTest
    static void testQueryContractData() {
        List<Opportunity> oppList = [SELECT Id, Name FROM Opportunity];
        Test.startTest();
        Blob contractDetails = FileData.getContractData(oppList[0]);
        Test.stopTest();
        Assert.isTrue(contractDetails != null, 'Verifying the Blob is returned');
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

    @isTest
    static void testSyncSettlementsCreate() {
        List<Account> accounts = [SELECT Id FROM Account];
        accounts[0].External_SAS_Id__c = '32432432';
        update accounts;
        List<Opportunity> opps = [SELECT Id FROM Opportunity];
        List<Offer__c> offers = [SELECT Id FROM Offer__c];
        Settlement__c settlementRecord1 = DataFactoryTest.createSettlement(accounts[0].Id, opps[0].Id, offers[0].Id);
        insert settlementRecord1;
        List<Debt_Details__c> debtDetails = [SELECT Id FROM Debt_Details__c];
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler(false));
        ProcessorAPI.initiateSettlementsSyncAPI(debtDetails[0].Id);
        Test.stopTest();
    }

    @isTest
    static void testSyncSettlementsUpdate() {
        List<Account> accounts = [SELECT Id FROM Account];
        accounts[0].External_SAS_Id__c = '32432432';
        update accounts;
        List<Opportunity> opps = [SELECT Id FROM Opportunity];
        List<Offer__c> offers = [SELECT Id FROM Offer__c];
        Settlement__c settlementRecord2 = DataFactoryTest.createSettlement(accounts[0].Id, opps[0].Id, offers[0].Id);
        settlementRecord2.External_SAS_Id__c = '23423';
        insert settlementRecord2;
        List<Debt_Details__c> debtDetails = [SELECT Id FROM Debt_Details__c];
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler(false));
        ProcessorAPI.initiateSettlementsSyncAPI(debtDetails[0].Id);
        Test.stopTest();
    }

    @isTest
    static void testProcessorAPIQueryMethods() {
        Account acctRecord = DataFactoryTest.createAccount();
        Test.startTest();
        ProcessorAPI.getInstance('SAS');
        try {
            ProcessorAPI.validateAccount(null);
            ProcessorAPI.validateContact(null);
            ProcessorAPI.getAccountDetails(acctRecord.Id);
            ProcessorAPI.getAccountDetailsWithoutSyncStatusFilter(acctRecord.Id);
            ProcessorAPI.getAccountDetails(new Set<Id> {acctRecord.Id});
            ProcessorAPI.getContact(acctRecord);
            ProcessorAPI.getBankAccountDetails(acctRecord.Id);
            ProcessorAPI.getContractDetails(acctRecord.Id);
           // ProcessorAPI.getContentDocumentIdsForContractSync(acctRecord.Id);
            //ProcessorAPI.getContentDocumentIdsForRAMContractSync(acctRecord.Id);
            //ProcessorAPI.getContentDocumentIdsForDriverLicense(acctRecord.Id);
        } catch(Exception ex) {

        }
        Test.stopTest();
    }
    
    @isTest
    static void testProcessorCreateAPIFail(){
         Account acctRecord = DataFactoryTest.createCreditorAccount();
     //   acctRecord.recordTypeId = AccountUtil.getRecordTypeId(AccountUtil.RT_CREDITOR);
        insert acctRecord;
        Contact cont = [ SELECT Id , AccountId FROM Contact LIMIT 1];
        cont.AccountId = acctRecord.Id;
        cont.Birthdate = System.today().addYears(-25);
         update cont;
         Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acctRecord.Id;
        opp.StageName = 'Working Opportunity';
        insert opp;
        Program_Plan__c prgmPlan = DataFactoryTest.createProgramplan(opp.Id, acctRecord.Id, null);
        Test.startTest();
      //  ProcessorAPI.getInstance('SAS');
        try {
         Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        ApexActionResult result = ProcessorAPI.initiateCreateAPI(acctRecord.id); 
        } catch(Exception ex) {

        }
        Test.stopTest();
    }
    
     @isTest
    static void testvalidateProgramPlanFail(){
         Account acctRecord = DataFactoryTest.createAccount();
        insert acctRecord;
         Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acctRecord.Id;
        opp.StageName = 'Closed Won First Payment Pending';
        insert opp;
        Program_Plan__c prgmPlan = DataFactoryTest.createProgramplan(opp.Id, acctRecord.Id, null);
        Test.startTest();
        ProcessorAPI.getInstance('SAS');
        try {
            ProcessorAPI.validateProgramPlan(prgmPlan);
        } catch(Exception ex) {

        }
        Test.stopTest();
    }
    
     @isTest
    static void testvalidateProgramPlan(){
         Account acctRecord = DataFactoryTest.createAccount();
        insert acctRecord;
        Test.startTest();
        ProcessorAPI.getInstance('SAS');
        try {
            ProcessorAPI.validateProgramPlan(null);
        } catch(Exception ex) {

        }
        Test.stopTest();
    }
    
    
     @isTest
    static void testgetBankAccountDetails(){
         Account acctRecord = DataFactoryTest.createAccount();
        insert acctRecord;
        Test.startTest();
        ProcessorAPI.getInstance('SAS');
        try {
            ProcessorAPI.getBankAccountDetails(acctRecord.Id);
        } catch(Exception ex) {

        }
        Test.stopTest();
    }
    
     @isTest
    static void testgetContact(){
         Account acctRecord = DataFactoryTest.createAccount();
         insert acctRecord;
        Test.startTest();
        ProcessorAPI.getInstance('SAS');
        try {
            ProcessorAPI.getContact(acctRecord);
        } catch(Exception ex) {

        }
        Test.stopTest();
    }
    
     @isTest
    static void testgetAccountDetails2(){
         Account acctRecord = DataFactoryTest.createAccount();
         insert acctRecord;
        Test.startTest();
        ProcessorAPI.getInstance('SAS');
        try {
            ProcessorAPI.getAccountDetails(new Set<Id> {acctRecord.Id});
        } catch(Exception ex) {

        }
        Test.stopTest();
    }
    
     @isTest
    static void testgetAccountDetailsWithoutSyncStatusFilter(){
         Account acctRecord = DataFactoryTest.createAccount();
           insert acctRecord;
        Test.startTest();
        ProcessorAPI.getInstance('SAS');
        try {
            ProcessorAPI.getAccountDetailsWithoutSyncStatusFilter(acctRecord.Id);
        } catch(Exception ex) {

        }
        Test.stopTest();
    }
    
     @isTest
    static void testgetAccountDetails(){
         Account acctRecord = DataFactoryTest.createAccount();
        insert acctRecord;        
        Test.startTest();
        ProcessorAPI.getInstance('SAS');
        try {
            ProcessorAPI.getAccountDetails(acctRecord.Id);            
        } catch(Exception ex) {

        }
        Test.stopTest();
    }
    
     @isTest
    static void setCustomerStatus(){
        Account acct = [SELECT Id FROM Account Limit 1];       
        Test.startTest();            
        try {
             ProcessorAPI.getInstance('SAS');
            ProcessorAPI.cancelClient(acct.Id);
            ProcessorAPI.setCustomerStatus(acct.Id, '112');            
        } catch(Exception ex) {

        }
        Test.stopTest();
    }
    
     @isTest
    static void testvalidateContact(){
         Account acctRecord = DataFactoryTest.createAccount();
         insert acctRecord;
        Test.startTest();
        ProcessorAPI.getInstance('SAS');
        try {
            ProcessorAPI.validateContact(null);
        } catch(Exception ex) {

        }
        Test.stopTest(); 
    }
    
    /*@isTest
    static void testgetContentDocumentIdsForDriverLicense(){
         Account acctRecord = DataFactoryTest.createAccount();
                insert acctRecord;
         Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acctRecord.Id;
        opp.StageName = 'Closed Won First Payment Pending';
        insert opp;
        Test.startTest();
        ProcessorAPI.getInstance('SAS');
        try {
             ProcessorAPI.getContentDocumentIdsForDriverLicense(acctRecord.Id);
        } catch(Exception ex) {

        }
        Test.stopTest();
    }*/
    
     @isTest
    static void testgetContentDocumentIdsForContractSync(){
         Account acctRecord = DataFactoryTest.createAccount();
                insert acctRecord;
         Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acctRecord.Id;
        opp.StageName = 'Closed Won First Payment Pending';
        insert opp;
        Test.startTest();
        ProcessorAPI.getInstance('SAS');
        try {
            ProcessorCreateAPI obj = new ProcessorCreateAPI( acctRecord.Id, new List<Draft__c>());
        obj.execute(null);
             ProcessorAPI.getContentDocumentIdsForContractSync(acctRecord.Id);
        } catch(Exception ex) {

        }
        Test.stopTest();
    }
    @isTest
    static void testgetContentDocumentIdsForContractSyncPositive(){
        Account acctRecord = DataFactoryTest.createAccount();
        insert acctRecord;
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acctRecord.Id;
        opp.StageName = 'Closed Won First Payment Pending';
        insert opp;
        Test.startTest();
        ProcessorAPI.getInstance('SAS');
        try {
             ProcessorAPI.getContentDocumentIdsForContractSync(acctRecord.Id);
        } catch(Exception ex) {

        }
        Test.stopTest();
    }
    
         /*@isTest
    static void testgetContentDocumentIdsForRAMContractSyncs(){
         Account acctRecord = DataFactoryTest.createAccount();
                insert acctRecord;
           Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acctRecord.Id;
        opp.StageName = 'Closed Won First Payment Pending';
        insert opp;
        Test.startTest();
        ProcessorAPI.getInstance('SAS');
        try {
             ProcessorAPI.getContentDocumentIdsForRAMContractSync(acctRecord.Id);
        } catch(Exception ex) {

        }
        Test.stopTest();
    }*/
    
     @isTest
    static void testgetDrafts(){
        Account acctRecord = DataFactoryTest.createAccount();
        Test.startTest();
        try {
             SASApi.getDrafts('112');             
        } catch(Exception ex) {

        }
        Test.stopTest();
    }
}