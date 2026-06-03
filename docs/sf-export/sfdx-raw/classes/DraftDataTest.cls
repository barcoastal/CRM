@isTest
private class DraftDataTest {

    @TestSetup
    static void makeData(){
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
            Processor_Type__c='SAS', Name='SAS'
        );
        insert paymentprocessor;         
        // Create a test Program_Plan__c record related to the Opportunity
        Program_Plan__c programPlan = new Program_Plan__c(
            Opportunity__c = opportunity.Id, Client__c = account.Id,
            Payment_Processor__c= paymentprocessor.Id            
        );
        insert programPlan;
        // Create a test Draft__c record related to the Program_Plan__c
        Draft__c draft = new Draft__c(
            Program_Plan__c = programPlan.Id, Draft_Status__c = 'Scheduled', Draft_Date__c = Date.today().addDays(3),
            Draft_Amount__c = 100, Retainer_Fee__c = 10, Setup_Fee__c = 20, Processor_Fee__c = 30, Service_Fee__c = 40,
            Program_Fee__c = 100
        );
        insert draft;
        // Create fee record and related it to draft
        /*List<Fee__c> fees = new List<Fee__c> {
            new Fee__c(
                Draft__c = draft.Id, Fee_Amount__c = 456.34, Fee_Date__c = Date.today().addDays(2),
                RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Fee__c', 'Setup_Fee')
            ),
            new Fee__c(
                Draft__c = draft.Id, Fee_Amount__c = 666.37, Fee_Date__c = Date.today().addDays(5),
                RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Fee__c', 'Retainer_Fee')
            )
        };
        insert fees;*/
    }

    @isTest
    static void testQueryUnlockedDrafts() {

        Program_Plan__c programPlan = [SELECT Id FROM Program_Plan__c LIMIT 1];

        Test.startTest();
        // Call the queryUnlockedDrafts method
        List<Draft__c> unlockedDrafts = DraftData.queryUnlockedDrafts(programPlan.Id);
        System.debug('unlockedDrafts---->'+unlockedDrafts);
        Test.stopTest();

        // Assert that the returned list contains the expected draft
        System.assertEquals(1, unlockedDrafts.size());
        //System.assertEquals(7, unlockedDrafts[0].Fees__r.size());
        //System.assertEquals(Date.today().addDays(3), unlockedDrafts[0].Draft_Date__c);
    }

    @isTest
    static void testQueryLockedDrafts() {
        Opportunity opportunityRec = [SELECT Id FROM Opportunity LIMIT 1];
        Account acc = [SELECT Id FROM Account LIMIT 1];

        Program_Plan__c programPlan = [SELECT Id FROM Program_Plan__c LIMIT 1];
        Draft__c draft = [SELECT Id FROM Draft__c LIMIT 1];
        draft.Draft_Status__c = 'Processing';
        
        Test.startTest();
        update draft;
        
        // Call the queryLockedDrafts method
        List<Draft__c> lockedDrafts = DraftData.queryLockedDrafts(acc.Id, opportunityRec.Id);
        Test.stopTest();

        // Assert that the returned list contains the expected draft
        System.assertEquals(1, lockedDrafts.size());
        System.assertEquals(300, lockedDrafts[0].Draft_Total_Amount__c);
    }
    
    @isTest
    static void testQueryDrafts(){
         Opportunity opportunityRec = [SELECT Id FROM Opportunity LIMIT 1];
        
        Program_Plan__c programPlan = [SELECT Id FROM Program_Plan__c LIMIT 1];
        Account acc = [SELECT Id FROM Account LIMIT 1];

        Test.startTest();
        List<Draft__c> drafts = DraftData.queryDrafts(acc.Id, opportunityRec.Id);
        Test.stopTest();
        
        System.assertEquals(Date.today().addDays(3), drafts[0].Draft_Date__c);
        System.assertEquals(100, drafts[0].Draft_Amount__c);
        System.assertEquals(10, drafts[0].Retainer_Fee__c);
        System.assertEquals(20, drafts[0].Setup_Fee__c);
        System.assertEquals(30, drafts[0].Processor_Fee__c);
        System.assertEquals(40, drafts[0].Service_Fee__c);
        System.assertEquals('Scheduled', drafts[0].Draft_Status__c);
        System.assertEquals(programPlan.Id, drafts[0].Program_Plan__c);
        System.assertEquals(acc.Id, drafts[0].Program_Plan__r.Client__c);
        System.assertEquals(100, drafts[0].Program_Fee__c);
        System.assertEquals(true, drafts[0].Retainer_SetupFee_Draft__c);    
    }

    @isTest
    static void testGetCompletedDraftDetails() {

        Opportunity opportunity = [SELECT Id FROM Opportunity LIMIT 1];
        Program_Plan__c programPlan = [SELECT Id FROM Program_Plan__c LIMIT 1];
        //Draft__c draft = [SELECT Id FROM Draft__c LIMIT 1];
      //  draft.Draft_Status__c = 'Completed';
        Draft__c draft1 = new Draft__c(
            Program_Plan__c = programPlan.Id, Draft_Status__c = 'Completed', Draft_Amount__c = 100
        );        
        
        Test.startTest();
        upsert new List<Draft__c>{draft1};
        // Call the getCompletedDraftDetails method
        List<AggregateResult> completedDraftDetails = DraftData.getCompletedDraftDetails(opportunity.Id);
        Test.stopTest();

        // Assert that the returned list contains the expected aggregate result
        System.assertEquals(1, completedDraftDetails.size());
        System.assertEquals(1, completedDraftDetails[0].get('completedRecordsCount'));
        System.assertEquals(100, completedDraftDetails[0].get('completedDraftsAmount'));
        System.assertEquals(programPlan.Id, completedDraftDetails[0].get('prgmPlanId'));
    }
    
    @isTest
    static void testQueryDraftByIdSet() {
        
        Program_Plan__c programPlan = [SELECT Id FROM Program_Plan__c LIMIT 1];
        Draft__c draft = [SELECT Id FROM Draft__c LIMIT 1];
        draft.External_SAS_Id__c = '678';
        List<Draft__c> drafts = new List<Draft__c>{
            new Draft__c(Program_Plan__c = programPlan.Id, Draft_Status__c = 'Completed', Draft_Amount__c = 100, External_SAS_Id__c = '456'),
            new Draft__c(Program_Plan__c = programPlan.Id, Draft_Status__c = 'Processing', Draft_Amount__c = 300), draft            
        };        
        
        Test.startTest();
        upsert drafts; 
        // Call the getCompletedDraftDetails method
        List<Draft__c> draftList = DraftData.queryDraftBySASIds(new Set<String>{'456', '678'});
        Test.stopTest();
        
        System.assertEquals(2, draftList.size());
        System.assertEquals('456', draftList[1].External_SAS_Id__c);
        System.assertEquals('678', draftList[0].External_SAS_Id__c);
        System.assertEquals('Completed', draftList[1].Draft_Status__c);
        System.assertEquals('Scheduled', draftList[0].Draft_Status__c);
    }

    @isTest
    static void getStartEndDraftDatesTest(){

        Id programPlanId = [SELECT Id FROM Program_Plan__c LIMIT 1].Id;

        List<Draft__c> draftList = new List<Draft__c> {
            DataFactoryTest.createDraft(programPlanId),
            DataFactoryTest.createDraft(programPlanId),
            DataFactoryTest.createDraft(programPlanId),
            DataFactoryTest.createDraft(programPlanId),
            DataFactoryTest.createDraft(programPlanId)
        };
        draftList[1].Draft_Date__c = System.today().addDays(1);
        draftList[2].Draft_Date__c = System.today().addDays(2);
        draftList[3].Draft_Date__c = System.today().addDays(3);
        draftList[4].Draft_Date__c = System.today().addMonths(4);
        insert draftList;
        
        Test.startTest();
        Map<Id, AggregateResult> prgmPlanWithDraftMap = DraftData.getStartEndDraftDates(new Set<Id> {programPlanId});
        Test.stopTest();

        Assert.areEqual(System.today(), prgmPlanWithDraftMap.get(programPlanId).get('startDate'), 'Verify the program start date');
        Assert.areEqual(System.today().addMonths(4), prgmPlanWithDraftMap.get(programPlanId).get('endDate'), 'Verify the program end date');
    }

    @isTest
    static void queryDraftsBasedOnOpportunityTest(){
        
        Id programPlanId = [SELECT Id FROM Program_Plan__c LIMIT 1].Id;

        Test.startTest();
        List<Draft__c> draftList = DraftData.queryDraftsBasedOnOpportunity(new Set<Id>{programPlanId});
        Test.stopTest();

        Assert.areEqual(Date.today().addDays(3), draftList[0].Draft_Date__c, 'Verify the Draft date');
        Assert.areEqual(300, draftList[0].Draft_Total_Amount__c, 'Verify the draft total amount');
        Assert.areEqual(10, draftList[0].Retainer_Fee__c, 'Verify the retainer fee');
        Assert.areEqual(20, draftList[0].Setup_Fee__c, 'Verify the setup fee');
        Assert.areEqual(100, draftList[0].Program_Fee__c, 'Verify the program fee');
        Assert.areEqual(40, draftList[0].Service_Fee__c, 'Verify the service fee');
        Assert.areEqual(100, draftList[0].Draft_Amount__c, 'Verify the draft amount');
    }
    /**
     * @description: Verifying the Querying Drafts method using the draft Ids
    **/
    @isTest
    static void testQueryDraftsByDraftsIds() {
        Set<Id> draftIds = new Map<Id, Draft__c>([SELECT Id FROM Draft__c]).keySet();
        List<Draft__c> draftsResult;
        Test.startTest();
        draftsResult = DraftData.queryDrafts(draftIds);
        Test.stopTest();
        Assert.areEqual(100, draftsResult[0].Draft_Amount__c, 'Verying the amount of the draft');
    }
    //Test Comment
    
      /**
     * @description: Verifying the queryDraftsByStaus method 
    **/
    @isTest
    static void testqueryDraftsByStaus() {
        Program_Plan__c programPlan = [SELECT Id FROM Program_Plan__c LIMIT 1];
        Set<Id> draftIds = new Map<Id, Draft__c>([SELECT Id FROM Draft__c]).keySet();
        List<Draft__c> draftsResult;
        Test.startTest();
        draftsResult = DraftData.queryDraftsByStaus(programPlan.Id,new Set<String> {'Scheduled'});
        Test.stopTest();
        Assert.areEqual(draftsResult[0].Draft_Status__c, 'Scheduled');
    }
    
     @isTest
    static void testqueryDraftsByProgramPlanId() {
        Program_Plan__c programPlan = [SELECT Id FROM Program_Plan__c LIMIT 1];
        Set<Id> draftIds = new Map<Id, Draft__c>([SELECT Id FROM Draft__c]).keySet();
        List<Draft__c> draftsResult;
        Test.startTest();
        draftsResult = DraftData.queryDraftsByProgramPlanId(programPlan.Id);
        Test.stopTest();
        Assert.areNotEqual(draftsResult.Size(), null);
    }
    
       @isTest
    static void testqueryCountOfDraftsByAccountId() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        Program_Plan__c programPlan = [SELECT Id FROM Program_Plan__c LIMIT 1];
        Set<Id> draftIds = new Map<Id, Draft__c>([SELECT Id FROM Draft__c]).keySet();
        List<Draft__c> draftsResult;
        Test.startTest();
        AggregateResult result = DraftData.queryCountOfDraftsByAccountId(acc.Id);
        Test.stopTest();
        Assert.areNotEqual(result, null);
    }
    
     @isTest
    static void testqueryPendingDraftsByAccountId() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        Program_Plan__c programPlan = [SELECT Id FROM Program_Plan__c LIMIT 1];
        Set<Id> draftIds = new Map<Id, Draft__c>([SELECT Id FROM Draft__c]).keySet();
        List<Draft__c> draftsResult;
        Test.startTest();
       draftsResult = DraftData.queryPendingDraftsByAccountId(acc.Id);
        Test.stopTest();
        Assert.areNotEqual(draftsResult, null);
    }
    
    
    @isTest
    static void testqueryDraftsByIds() {
       
        Set<Id> draftIds = new Map<Id, Draft__c>([SELECT Id FROM Draft__c]).keySet();
        List<Draft__c> draftsResult;
        Test.startTest();
        draftsResult = DraftData.queryDraftsByIds(draftIds);
        Test.stopTest();
        Assert.areNotEqual(draftsResult, null);
    }
    
    @isTest
    static void testqueryDraftsBySASIds() {
       
        Draft__c draftRecord = [SELECT Id FROM Draft__c LIMIT 1];
        draftRecord.External_SAS_Id__c = '234';
        update draftRecord;
        Map<String,Draft__c> draftsResult;
        List<Draft__c> draftsResult2;
        Test.startTest();
        draftsResult = DraftData.queryDraftsBySASIds(New Set<String>{'234'});
        draftsResult2 = DraftData.queryDraftBySASIds(New Set<String>{'234'});
        Test.stopTest();
        Assert.areNotEqual(draftsResult, null);
        Assert.areNotEqual(draftsResult2, null);
    }
    
    @isTest
    static void testqueryDraftByIds() {
       
        Set<Id> draftIds = new Map<Id, Draft__c>([SELECT Id FROM Draft__c]).keySet();
        Set<String> draftIdStrings = New Set<String>();
        for(Id draftId : draftIds){
            draftIdStrings.add(String.valueOf(draftId));
        }
        List<Draft__c> draftsResult;
        Test.startTest();
        draftsResult = DraftData.queryDraftByIds(draftIdStrings);
        Test.stopTest();
        Assert.areNotEqual(draftsResult, null);
    }
}