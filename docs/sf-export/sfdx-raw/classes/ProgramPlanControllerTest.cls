@isTest
public with sharing class ProgramPlanControllerTest {

    @testSetup
    static void makeData() {
        SAS_Settings__c sas = DataFactoryTest.createSASSettings();
        insert sas;
        Payment_Processor__c proc = DataFactoryTest.createPaymentProcessor();
        insert proc;
        Account acct = DataFactoryTest.createAccount();
        insert acct;
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acct.Id;
        insert opp;
        Program_Plan__c prgmPlan = DataFactoryTest.createProgramPlan(opp.Id, acct.Id, proc.Id);
        insert prgmPlan;
        Debt_Details__c debtDetail = DataFactoryTest.createDebtDetails(prgmPlan.Id);
        insert debtDetail;

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
    static void retrieveFeesFromOppProductsTest(){
        Opportunity opp = [SELECT Id FROM Opportunity lIMIT 1];
        object result = ProgramPlanController.retrieveFeesFromOppProducts(opp.Id);
        Assert.areNotEqual(result,Null);
    }

    @isTest
    static void verifyGetDebtDetails() {
        List<Opportunity> oppList = [SELECT Id FROM Opportunity];
        Test.startTest();
        ApexActionResult result = ProgramPlanController.getDebtDetails(oppList[0].Id);
        Test.stopTest();
        String resultData = (String)result.data;
        List<ProgramPlanController.DebtAggregation> debts = (List<ProgramPlanController.DebtAggregation>)JSON.deserialize(
            resultData, List<ProgramPlanController.DebtAggregation>.class
        );
        System.assertEquals(1, debts.size(), 'Verify the size of the debts');
    }

    @isTest
    static void verifyGetCurrentRecordDetails() {
        List<Opportunity> oppList = [SELECT Id FROM Opportunity];
        Test.startTest();
        ApexActionResult result = ProgramPlanController.getCurrentRecordDetails(oppList[0].Id);
        Test.stopTest();
        String resultData = (String)result.data;
        ProgramPlanController.ProgramPlanResult prgmPlans = (ProgramPlanController.ProgramPlanResult)JSON.deserialize(
            resultData, ProgramPlanController.ProgramPlanResult.class
        );
        System.assert(prgmPlans.prgmPlanWrapper != null, 'Verify the progrm plan wrapper is not empty');
    }

    @isTest
    static void verifyGetCurrentRecordDetails1() {
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        prgmPlans[0].Last_Rescheduled_By__c = UserInfo.getUserId();
        update prgmPlans;
        Draft__c draftRecord = DataFactoryTest.createDraft(prgmPlans[0].Id);
        insert draftRecord;
        List<Opportunity> oppList = [SELECT Id FROM Opportunity];
        Test.startTest();
        ApexActionResult result = ProgramPlanController.getCurrentRecordDetails(oppList[0].Id);
        Test.stopTest();
        String resultData = (String)result.data;
        ProgramPlanController.ProgramPlanResult prgmPlansDeserialised = (ProgramPlanController.ProgramPlanResult)JSON.deserialize(
            resultData, ProgramPlanController.ProgramPlanResult.class
        );
        System.assert(prgmPlansDeserialised.prgmPlanWrapper != null, 'Verify the progrm plan wrapper is not empty');
    }
    
     @isTest
    static void verifyUpdatePaymentProgram() {
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        List<Opportunity> opportunities = [SELECT Id FROM Opportunity];
        Draft__c draft = DataFactoryTest.createDraft(prgmPlans[0].Id, 'Scheduled', System.today().addDays(15));        
        insert draft;
        
        OpportunityLineItem oppLineItem = [SELECT TotalPrice FROM OpportunityLineItem LIMIT 1];
        Decimal expectedCitadelFee = oppLineItem.TotalPrice;
        try{
            draft.Citadel_Fee__c = expectedCitadelFee;
            ProgramPlanController.editPaymentRecord(draft);
        }Catch(Exception ex){
        }
        Draft__c updatedDrafts = [SELECT Id, Draft_Status__c, Citadel_Fee__c FROM Draft__c WHERE Id =:draft.Id];
        System.assertEquals(expectedCitadelFee, updatedDrafts.Citadel_Fee__c , 'Verify the drafts');
    }

    @isTest
    static void verifyRescheduleProgram() {
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        List<Opportunity> opportunities = [SELECT Id FROM Opportunity];
        Draft__c draft = DataFactoryTest.createDraft(prgmPlans[0].Id, 'Scheduled', System.today().addDays(15));

        insert draft;
        try{
        ProgramPlanController.updatePaymentRecord(draft.Id, 'Completed');
        }Catch(Exception ex){}
        
        PaymentCalculatorElements payCalElements = new PaymentCalculatorElements();
        payCalElements.frequency = 'Weekly';
        payCalElements.paymentTerm = 6;
        payCalElements.firstPaymentDate = String.valueOf(System.today().addDays(5));
        payCalElements.firstPaymentDay = 5;
        payCalElements.secondPaymentDay = 12;
        payCalElements.weeklyPaymentDay = 'Sunday';
        payCalElements.totalDebt = 45000.00;
        payCalElements.settlementPercent = 45.00;
        payCalElements.programFeePercent = 15.00;
        payCalElements.retainerPercent = 5.00;
        payCalElements.setupFee = 150;
        payCalElements.serviceFee = 150;
        payCalElements.monthlyBankFee = 15;
        payCalElements.bankSetupFee = 10;
        payCalElements.businessClient = true;
        payCalElements.opportunityId = opportunities[0].Id;
        payCalElements.parentProgramPlanId = prgmPlans[0].Id;
        payCalElements.completedDraftsAmount = 0;
        payCalElements.completedDraftsCount = 0;
        payCalElements.lastDraftCompletedDate = null;
        Test.startTest();
        ApexActionResult result = ProgramPlanController.rescheduleProgram(JSON.serialize(payCalElements));
        Test.stopTest();
        String resultData = (String)result.data;
        ProgramPlanController.RescheduleResult prgmPlansDeserialised = (ProgramPlanController.RescheduleResult)JSON.deserialize(
            resultData, ProgramPlanController.RescheduleResult.class
        );
        System.assert(prgmPlansDeserialised.payments != null, 'Verify the payments are not empty');
    }
      
    @isTest
    static void verifySaveProgram() {
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];        
        List<Opportunity> opportunities = [SELECT Id FROM Opportunity];   
        opportunities[0].StageName = 'Closed Won First Payment Pending';
        opportunities[0].External_Debit_Schedule_Id__c = '4825';
        update opportunities;             
        List<Draft__c> draftList = new List<Draft__c> ();
        Draft__c draft1 = DataFactoryTest.createDraft(prgmPlans[0].Id, 'Scheduled', null);
        draftList.add(draft1);
        Draft__c draft2 = DataFactoryTest.createDraftWithoutFee(prgmPlans[0].Id, 'Scheduled', null);
        draftList.add(draft2);
        OpportunityLockService.disableOppLockForSystemUpdates();

        insert draftList;
        List<Fee__c> fees = new List<Fee__c> {
            DataFactoryTest.createFee(draft1.Id, 10, Date.today().addDays(2), 'Setup_Fee'),
            DataFactoryTest.createFee(draft1.Id, 20, Date.today().addDays(2), 'Retainer_Fee'),
            DataFactoryTest.createFee(draft1.Id, 30, Date.today().addDays(2), 'Processor_Fee'),
            DataFactoryTest.createFee(draft1.Id, 40, Date.today().addDays(2), 'Service_Fee'),
            DataFactoryTest.createFee(draft1.Id, 50, Date.today().addDays(2), 'Program_Fee'),
            DataFactoryTest.createFee(draft1.Id, 50, Date.today().addDays(2), FeeUtil.RT_CITADEL_FEE),
            DataFactoryTest.createFee(draft2.Id, 0, Date.today().addDays(2), 'Setup_Fee'),
            DataFactoryTest.createFee(draft2.Id, 0, Date.today().addDays(2), 'Retainer_Fee'),
            DataFactoryTest.createFee(draft2.Id, 0, Date.today().addDays(2), 'Processor_Fee'),
            DataFactoryTest.createFee(draft2.Id, 0, Date.today().addDays(2), 'Service_Fee'),
            DataFactoryTest.createFee(draft2.Id, 0, Date.today().addDays(2), 'Program_Fee'),
            DataFactoryTest.createFee(draft2.Id, 0, Date.today().addDays(2), FeeUtil.RT_CITADEL_FEE)
        };
        insert fees;
        
        ProgramPlanWrapper prgmPlanWrap = new ProgramPlanWrapper();
        prgmPlanWrap.recordId = prgmPlans[0].Id;
        prgmPlanWrap.opportunityId = opportunities[0].Id;
        prgmPlanWrap.settlementPercentage = '45';
        prgmPlanWrap.programFeePercentage = '20';
        prgmPlanWrap.retainerPercentage = '5';
        prgmPlanWrap.paymentFrequency = 'Weekly';
        prgmPlanWrap.paymentTerm = '6';
        prgmPlanWrap.setupFee = '850';
        prgmPlanWrap.firstPaymentDate = System.today().addDays(2);
        prgmPlanWrap.nextPaymentDay = '10';
        prgmPlanWrap.secondPaymentDay = '25';
        prgmPlanWrap.totalDebt = 45000.00;
        prgmPlanWrap.noOfDebts = 1;

        List<DraftWrapper> drafts = new List<DraftWrapper>();
        DraftWrapper draftRecord = new DraftWrapper();
        draftRecord.programPlanId = prgmPlans[0].Id;
        draftRecord.paymentDate = System.today().addDays(15);
        draftRecord.retainerFee = 100;
        draftRecord.serviceFee = 100;
        draftRecord.processorFee = 15;
        draftRecord.setupFee = 10;
        DraftWrapper draftRecord2 = new DraftWrapper();
        draftRecord2.programPlanId = prgmPlans[0].Id;
        draftRecord2.paymentDate = System.today().addDays(45);
        draftRecord2.retainerFee = 100;
        draftRecord2.serviceFee = 100;
        draftRecord2.processorFee = 15;
        draftRecord2.setupFee = 10;
        draftRecord2.draftStatus = 'Pending';
        drafts.add(draftRecord2);

        Map<String, Object> programPlanMap = new Map<String, Object>();
        programPlanMap.put('program', JSON.serialize(prgmPlanWrap));
        programPlanMap.put('payments', JSON.serialize(drafts));
        programPlanMap.put('paymentProcessorName', 'SAS');
        Test.startTest();
        ApexActionResult result = ProgramPlanController.saveProgram(JSON.serialize(programPlanMap), new List<String>{draftList[1].Id}, false);
        Test.stopTest();
                OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();

        //Assert.areEqual('SUCCESS', String.valueOf(result.status), 'Expected sucessfull result status.');
    }
        
    @isTest
    static void getSetupFeeMapping() {
        Test.startTest();
        ProgramPlanController.getSetupFeeMapping('Citedal');
        Test.stopTest();
    }

    /*@isTest
    static void verifyRetrieveFeesFromOppProducts() {
        List<Opportunity> oppList = [SELECT Id FROM Opportunity];
        Test.startTest();
        ProgramPlanController.retrieveFeesFromOppProducts(oppList[0].Id);
        Test.stopTest();
    }*/
    @isTest
    static void testCreateSkippedPaymentDrafts() {
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        Draft__c draft = DataFactoryTest.createDraft(prgmPlans[0].Id, 'Skipped Payment',  System.today().addDays(15));
        insert draft;
        DraftWrapper draftRecord = new DraftWrapper();
        draftRecord.programPlanId = prgmPlans[0].Id;
        draftRecord.paymentDate = System.today().addDays(15);
        draftRecord.retainerFee = 100;
        draftRecord.serviceFee = 100;
        draftRecord.processorFee = 15;
        draftRecord.setupFee = 10;
        
        Map<String, Object> draftMap = new Map<String, Object>();
        draftMap.put('payments', JSON.serialize(draftRecord));

        // Test the method
        Test.startTest();
        ApexActionResult result = ProgramPlanController.createSkippedPaymentDrafts(JSON.serialize(draftMap));
        Test.stopTest();
       String resultData = (String)result.data;
         ProgramPlanController.skippedResult prgmPlansDeserialised = (ProgramPlanController.skippedResult)JSON.deserialize(
            resultData, ProgramPlanController.skippedResult.class
        );
        ProgramPlanController.getPaymentCalcSettings();
        // Assert the result
        Assert.areEqual('SUCCESS', String.valueOf(result.status), 'Expected sucessfull result status.');
    }
    
    @isTest
    static void verifyDailyFrequencyProgram() {
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        List<Opportunity> opportunities = [SELECT Id, AccountId FROM Opportunity];
        PaymentCalculatorElements payCalElements = new PaymentCalculatorElements();
        payCalElements.frequency = 'Weekly';
        payCalElements.paymentTerm = 6;
        payCalElements.firstPaymentDate = null;
        payCalElements.firstPaymentDay = 5;
        payCalElements.secondPaymentDay = 12;
        payCalElements.weeklyPaymentDay = 'Monday';
        payCalElements.totalDebt = 45000.00;
        payCalElements.settlementPercent = 45.00;
        payCalElements.programFeePercent = 15.00;
        payCalElements.retainerPercent = 5.00;
        payCalElements.setupFee = 150;
        payCalElements.serviceFee = 150;
        payCalElements.monthlyBankFee = 15;
        payCalElements.bankSetupFee = 10;
        payCalElements.businessClient = true;
        payCalElements.opportunityId = opportunities[0].Id;
        payCalElements.parentProgramPlanId = prgmPlans[0].Id;
        payCalElements.completedDraftsAmount = 0;
        payCalElements.completedDraftsCount = 0;
        payCalElements.noOfActualMonths = 4;
        payCalElements.lastDraftCompletedDate = Date.valueOf(System.today().addDays(10));
        payCalElements.getNewTotalDebtAmount();
        payCalElements.getRetainerAmount();
        payCalElements.getSetupFee();
        Test.startTest(); 
        ApexActionResult result = ProgramPlanController.rescheduleProgram(JSON.serialize(payCalElements));
        ProgramPlanController.getPaymentCalculatorSetting('test');
        ProgramPlanController.checkCompletedPaymentValidation(opportunities[0].Id, opportunities[0].AccountId);
        Test.stopTest();
        String resultData = (String)result.data;
        ProgramPlanController.RescheduleResult prgmPlansDeserialised = (ProgramPlanController.RescheduleResult)JSON.deserialize(
            resultData, ProgramPlanController.RescheduleResult.class
        );
        System.assert(prgmPlansDeserialised.payments != null, 'Verify the payments are not empty');
    }
    @isTest
    static void testGetProgramLengthsForAmount() {
        Test.startTest();
        ProgramPlanController.ProgramLengthWrapper lengthWrapper = ProgramPlanController.getProgramLengthsForAmount(50000);
        Test.stopTest();
        Assert.isNotNull(lengthWrapper.programLengths, 'List should be returned');
    }
    @isTest
    static void testGetOpportunityBasedOnAccountId() {        
                
        Opportunity oppRecord = [SELECT Id, StageName FROM Opportunity LIMIT 1];
        oppRecord.StageName = 'Closed Won First Payment Pending';
        update oppRecord;

                
        List<Account> accounts = [SELECT Id FROM Account];
        
        Test.startTest();
        Opportunity opp = ProgramPlanController.getOpportunityBasedOnAccountId(accounts[0].Id);
        Test.stopTest();
        Assert.isNotNull(opp, 'Opportunity should be returned');
    } 
    
   @isTest
    static void testRAMDraftSync(){
        RAMS_Settings__c settings = new RAMS_Settings__c();
        settings.Name = 'RAM Settings';
        settings.Endpoint__c = 'https://example.com/api';
        settings.APIKey__c = 'testApiKey';
        settings.Affiliate_ID__c = '1234';
        settings.Fee_Split_Group_ID__c = '1234';
        insert settings;
        Contact con = DataFactoryTest.createContact();
        con.BirthDate = System.today().addyears(-18);
        con.Lead_Number__c = '123456';
        insert con;
        Account acct = DataFactoryTest.createBusinessAccount();
        //acct.Primary_Contact__c = con.Id;
        acct.BillingStateCode = 'NY';
        acct.Bank_Account_Number__c = '1234567890';
        acct.Bank_Routing_Number__c = '123456789';
        acct.Bank_Account_Type__c = 'Checking';
        acct.Bank_Name__c = 'Test Bank';
        acct.Lead_Number__c = '123456';
        insert acct;
        con.AccountId = acct.Id;
        update con;
        acct.External_RAM_Id__c = '1232';
        update acct;
        Opportunity opportunity = DataFactoryTest.createOpportunity('Test Opportunity', 'Prospect', acct.Id);
        insert opportunity;
        Payment_Processor__c paymentprocessor = DataFactoryTest.createPaymentProcessor('RAM', 'RAM');
        insert paymentprocessor;
         
        Program_Plan__c programPlan = DataFactoryTest.createProgramPlan(opportunity.Id, acct.Id, paymentprocessor.Id);
        insert programPlan;
        
        Test.startTest();           
        List<Draft__c> draftList = new List<Draft__c> ();
        Draft__c draft1 = DataFactoryTest.createDraft(programPlan.Id, 'Scheduled', null);
        draftList.add(draft1);
        Draft__c draft2 = DataFactoryTest.createDraftWithoutFee(programPlan.Id, 'Scheduled', null);
        draftList.add(draft2);
        insert draftList;
        
        List<Fee__c> fees = new List<Fee__c> {
            DataFactoryTest.createFee(draft1.Id, 10, Date.today().addDays(2), 'Setup_Fee'),
            DataFactoryTest.createFee(draft1.Id, 20, Date.today().addDays(2), 'Retainer_Fee'),
            DataFactoryTest.createFee(draft1.Id, 30, Date.today().addDays(2), 'Processor_Fee'),
            DataFactoryTest.createFee(draft1.Id, 40, Date.today().addDays(2), 'Service_Fee'),
            DataFactoryTest.createFee(draft1.Id, 50, Date.today().addDays(2), 'Program_Fee'),
            DataFactoryTest.createFee(draft1.Id, 50, Date.today().addDays(2), FeeUtil.RT_CITADEL_FEE),
            DataFactoryTest.createFee(draft2.Id, 0, Date.today().addDays(2), 'Setup_Fee'),
            DataFactoryTest.createFee(draft2.Id, 0, Date.today().addDays(2), 'Retainer_Fee'),
            DataFactoryTest.createFee(draft2.Id, 0, Date.today().addDays(2), 'Processor_Fee'),
            DataFactoryTest.createFee(draft2.Id, 0, Date.today().addDays(2), 'Service_Fee'),
            DataFactoryTest.createFee(draft2.Id, 0, Date.today().addDays(2), 'Program_Fee'),
            DataFactoryTest.createFee(draft2.Id, 0, Date.today().addDays(2), FeeUtil.RT_CITADEL_FEE)
        };
        insert fees;
        
        opportunity.StageName = 'Closed Won First Payment Pending';
        opportunity.External_Debit_Schedule_Id__c = '4825';
        update opportunity; 
               
        ProgramPlanWrapper prgmPlanWrap = new ProgramPlanWrapper();
        prgmPlanWrap.recordId = programPlan.Id;
        prgmPlanWrap.opportunityId = opportunity.Id;
        prgmPlanWrap.settlementPercentage = '45';
        prgmPlanWrap.programFeePercentage = '20';
        prgmPlanWrap.retainerPercentage = '5';
        prgmPlanWrap.paymentFrequency = 'Weekly';
        prgmPlanWrap.paymentTerm = '6';
        prgmPlanWrap.setupFee = '850';
        prgmPlanWrap.firstPaymentDate = System.today().addDays(2);
        prgmPlanWrap.nextPaymentDay = '10';
        prgmPlanWrap.secondPaymentDay = '25';
        prgmPlanWrap.totalDebt = 45000.00;
        prgmPlanWrap.noOfDebts = 1;

        List<DraftWrapper> drafts = new List<DraftWrapper>();
        DraftWrapper draftRecord = new DraftWrapper();
        draftRecord.programPlanId = programPlan.Id;
        draftRecord.paymentDate = System.today().addDays(15);
        draftRecord.retainerFee = 100;
        draftRecord.serviceFee = 100;
        draftRecord.processorFee = 15;
        draftRecord.setupFee = 10;
        DraftWrapper draftRecord2 = new DraftWrapper();
        draftRecord2.programPlanId = programPlan.Id;
        draftRecord2.paymentDate = System.today().addDays(45);
        draftRecord2.retainerFee = 100;
        draftRecord2.serviceFee = 100;
        draftRecord2.processorFee = 15;
        draftRecord2.setupFee = 10;
        draftRecord2.draftStatus = 'Pending';
        drafts.add(draftRecord2);

        Map<String, Object> programPlanMap = new Map<String, Object>();
        programPlanMap.put('program', JSON.serialize(prgmPlanWrap));
        programPlanMap.put('payments', JSON.serialize(drafts));
        programPlanMap.put('paymentProcessorName', 'RAM');
       
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        ApexActionResult result = ProgramPlanController.saveProgram(JSON.serialize(programPlanMap), new List<String>{draftList[1].Id}, false);
        Test.stopTest();
    }   
    @isTest
    static void verifygetWirePaymentFee() {
        List<Opportunity> oppList = [SELECT Id FROM Opportunity];
        Test.startTest();
        Decimal wirePayment = ProgramPlanController.getWirePaymentFee(oppList[0].Id);
        Test.stopTest();
        System.assert(wirePayment != null, 'Verify its is not empty');
    }

    @isTest
    static void testUpsertWireDraft_Insert() {
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        Draft__c draft = DataFactoryTest.createDraft(prgmPlans[0].Id, 'Pending', System.today().addDays(5));
        draft.Wire_Payment__c = true;

        Test.startTest();
        Id draftId = ProgramPlanController.upsertWireDraft(draft);
        Test.stopTest();

        Assert.isNotNull(draftId, 'upsertWireDraft should return the inserted Draft Id');
        Draft__c inserted = [SELECT Id, Wire_Payment__c FROM Draft__c WHERE Id = :draftId];
        Assert.isTrue(inserted.Wire_Payment__c, 'Wire_Payment__c should be true');
    }

    @isTest
    static void testUpsertWireDraft_Update() {
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        Draft__c draft = DataFactoryTest.createDraft(prgmPlans[0].Id, 'Pending', System.today().addDays(5));
        draft.Wire_Payment__c = true;
        insert draft;

        draft.Draft_Amount__c = 999;
        Test.startTest();
        Id returnedId = ProgramPlanController.upsertWireDraft(draft);
        Test.stopTest();

        Assert.areEqual(draft.Id, returnedId, 'Returned Id should match the existing draft Id');
        Draft__c updated = [SELECT Id, Draft_Amount__c FROM Draft__c WHERE Id = :draft.Id];
        Assert.areEqual(999, updated.Draft_Amount__c, 'Draft_Amount__c should be updated');
    }

    @isTest
    static void testLinkWirePaymentFile() {
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        List<Opportunity> oppList = [SELECT Id, AccountId FROM Opportunity];

        Draft__c draft = DataFactoryTest.createDraft(prgmPlans[0].Id, 'Pending', System.today().addDays(5));
        insert draft;

        ContentVersion cv = DataFactoryTest.createContentVersion();
        insert cv;
        Id contentDocumentId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id].ContentDocumentId;

        Test.startTest();
        ProgramPlanController.linkWirePaymentFile(
            new List<Id>{ contentDocumentId },
            oppList[0].Id,
            oppList[0].AccountId,
            draft.Id
        );
        Test.stopTest();

        List<ContentDocumentLink> links = [
            SELECT Id FROM ContentDocumentLink WHERE ContentDocumentId = :contentDocumentId
        ];
        Assert.isTrue(links.size() >= 1, 'At least one ContentDocumentLink should be created');
    }

    @isTest
    static void testGetWireDraftFiles() {
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];

        Draft__c draft = DataFactoryTest.createDraft(prgmPlans[0].Id, 'Pending', System.today().addDays(5));
        insert draft;

        ContentVersion cv = DataFactoryTest.createContentVersion();
        insert cv;
        Id contentDocumentId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id].ContentDocumentId;

        insert DataFactoryTest.createContentDocumentLink(draft.Id, contentDocumentId);

        Test.startTest();
        List<Map<String, Object>> files = ProgramPlanController.getWireDraftFiles(draft.Id);
        Test.stopTest();

        Assert.areEqual(1, files.size(), 'One file should be returned for the draft');
        Assert.areEqual(String.valueOf(contentDocumentId), files[0].get('documentId'), 'Document Id should match');
    }

    @isTest
    static void testDeleteWireFiles() {
        ContentVersion cv = DataFactoryTest.createContentVersion();
        insert cv;
        Id contentDocumentId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id].ContentDocumentId;

        Test.startTest();
        ProgramPlanController.deleteWireFiles(new List<Id>{ contentDocumentId });
        Test.stopTest();

        List<ContentDocument> docs = [SELECT Id FROM ContentDocument WHERE Id = :contentDocumentId];
        Assert.areEqual(0, docs.size(), 'ContentDocument should be deleted');
    }

    @isTest
    static void testRenameWireFiles_AddAndRemoveSuffix() {
        ContentVersion cv = DataFactoryTest.createContentVersion();
        insert cv;
        Id contentDocumentId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id].ContentDocumentId;

        Test.startTest();
        ProgramPlanController.renameWireFiles(new List<Id>{ contentDocumentId }, true);
        ProgramPlanController.getActivePaymentProcessors();
        ProgramPlanController.getProcessorFees('SAS');
        ContentDocument afterAdd = [SELECT Title FROM ContentDocument WHERE Id = :contentDocumentId];
        Assert.isTrue(afterAdd.Title.endsWith(' (draft)'), 'Title should end with (draft) after addSuffix=true');

        ProgramPlanController.renameWireFiles(new List<Id>{ contentDocumentId }, false);
        ContentDocument afterRemove = [SELECT Title FROM ContentDocument WHERE Id = :contentDocumentId];
        Test.stopTest();

        Assert.isFalse(afterRemove.Title.endsWith(' (draft)'), 'Title should not end with (draft) after addSuffix=false');
    }

    @isTest
    static void verifyChangeFutureDraftDays_UpdatesDraftsAndPaymentDay() {
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        List<Opportunity> opportunities = [SELECT Id FROM Opportunity];

        Draft__c draft = DataFactoryTest.createDraft(prgmPlans[0].Id, 'Scheduled', System.today().addDays(10));
        insert draft;

        DraftWrapper draftWrap = new DraftWrapper();
        draftWrap.recordId      = draft.Id;
        draftWrap.paymentDate   = System.today().addDays(20);
        draftWrap.processorFee  = 25;
        draftWrap.serviceFee    = 35;
        draftWrap.citaldelFee   = 45;
        draftWrap.paymentAmount = 500;

        Test.startTest();
        ApexActionResult result = ProgramPlanController.changeFutureDraftDays(
            opportunities[0].Id,
            JSON.serialize(new List<DraftWrapper>{ draftWrap }),
            'Monday'
        );
        Test.stopTest();

        Assert.areEqual('SUCCESS', String.valueOf(result.status), 'Expected SUCCESS status');

        Draft__c updated = [
            SELECT Draft_Date__c, Processor_Fee__c, Service_Fee__c, Citadel_Fee__c, Draft_Amount__c
            FROM Draft__c WHERE Id = :draft.Id
        ];
        Assert.areEqual(System.today().addDays(20), updated.Draft_Date__c, 'Draft date should be updated');
        Assert.areEqual(25, updated.Processor_Fee__c, 'Processor fee should be updated');
        Assert.areEqual(35, updated.Service_Fee__c, 'Service fee should be updated');
        Assert.areEqual(45, updated.Citadel_Fee__c, 'Citadel fee should be updated');
        Assert.areEqual(500, updated.Draft_Amount__c, 'Draft amount should be updated');

        Program_Plan__c updatedPlan = [SELECT Weekly_Payment_Day__c FROM Program_Plan__c WHERE Id = :prgmPlans[0].Id];
        Assert.areEqual('Monday', updatedPlan.Weekly_Payment_Day__c, 'Weekly payment day should be updated');
    }

    @isTest
    static void verifyChangeFutureDraftDays_NoDraftsOnlyPaymentDay() {
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];
        List<Opportunity> opportunities = [SELECT Id FROM Opportunity];

        DraftWrapper blankWrap = new DraftWrapper();

        Test.startTest();
        ApexActionResult result = ProgramPlanController.changeFutureDraftDays(
            opportunities[0].Id,
            JSON.serialize(new List<DraftWrapper>{ blankWrap }),
            'Friday'
        );
        Test.stopTest();

        Assert.areEqual('SUCCESS', String.valueOf(result.status), 'Expected SUCCESS status when only updating payment day');

        Program_Plan__c updatedPlan = [SELECT Weekly_Payment_Day__c FROM Program_Plan__c WHERE Id = :prgmPlans[0].Id];
        Assert.areEqual('Friday', updatedPlan.Weekly_Payment_Day__c, 'Weekly payment day should be updated to Friday');
    }

    @isTest
    static void verifyChangeFutureDraftDays_UpdatesDraftsNoPaymentDay() {
        List<Program_Plan__c> prgmPlans = [SELECT Id FROM Program_Plan__c];

        Draft__c draft = DataFactoryTest.createDraft(prgmPlans[0].Id, 'Scheduled', System.today().addDays(5));
        insert draft;

        DraftWrapper draftWrap = new DraftWrapper();
        draftWrap.recordId      = draft.Id;
        draftWrap.paymentDate   = System.today().addDays(15);
        draftWrap.processorFee  = 10;
        draftWrap.serviceFee    = 20;
        draftWrap.citaldelFee   = 30;
        draftWrap.paymentAmount = 300;

        Test.startTest();
        ApexActionResult result = ProgramPlanController.changeFutureDraftDays(
            null,
            JSON.serialize(new List<DraftWrapper>{ draftWrap }),
            null
        );
        Test.stopTest();

        Assert.areEqual('SUCCESS', String.valueOf(result.status), 'Expected SUCCESS status');

        Draft__c updated = [SELECT Draft_Date__c, Draft_Amount__c FROM Draft__c WHERE Id = :draft.Id];
        Assert.areEqual(System.today().addDays(15), updated.Draft_Date__c, 'Draft date should be updated');
        Assert.areEqual(300, updated.Draft_Amount__c, 'Draft amount should be updated');
    }
}