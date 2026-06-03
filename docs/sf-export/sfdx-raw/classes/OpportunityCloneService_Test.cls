@isTest
public class OpportunityCloneService_Test {

    @testSetup
    static void setupTestData() {
        SAS_Settings__c sas = DataFactoryTest.createSASSettings();
        insert sas;
        Payment_Processor__c proc = DataFactoryTest.createPaymentProcessor();
        insert proc;
        Account acct = DataFactoryTest.createAccount();
        insert acct;
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.Version_Status__c ='Active';
        insert opp;
        Program_Plan__c prgmPlan = DataFactoryTest.createProgramPlan(opp.Id, acct.Id, proc.Id);
        insert prgmPlan;
        Debt_Details__c debtDetail = DataFactoryTest.createDebtDetails(prgmPlan.Id);
        insert debtDetail;
    }

    @isTest
    static void testCloneOpportunity_Success() {
        Opportunity activeOpp = [
            SELECT Id, Name, Version__c, Version_Status__c
            FROM Opportunity
            WHERE Version_Status__c = 'Active'
            LIMIT 1
        ];

        Test.startTest();
        Id newDraftOppId = OpportunityCloneService.cloneOpportunity(activeOpp.Id);
        Test.stopTest();

        // Validate Draft Opportunity
        Opportunity draftOpp = [
            SELECT Id, Name, Version__c, Version_Status__c, StageName, Opportunity__c
            FROM Opportunity
            WHERE Id = :newDraftOppId
            LIMIT 1
        ];

        System.assertEquals('Draft', draftOpp.Version_Status__c, 'Draft opportunity must be created');
        System.assertEquals('Working Opportunity', draftOpp.StageName, 'Stage should be Working Opportunity');
        System.assertEquals(activeOpp.Id, draftOpp.Opportunity__c, 'Draft must point to Active Opp');
    }

    @isTest
    static void testCloneOpportunity_NullId() {
        try {
            Test.startTest();
            OpportunityCloneService.cloneOpportunity(null);
            Test.stopTest();
            System.assert(false, 'Exception should have been thrown for null Id');
        } catch (AuraHandledException e) {
        }
    }
}