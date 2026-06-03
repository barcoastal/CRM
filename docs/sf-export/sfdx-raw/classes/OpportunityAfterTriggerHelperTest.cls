@isTest
public class OpportunityAfterTriggerHelperTest {
    
    @testSetup
    static void testSetup(){
          // 1. Create User
        Profile p = [SELECT Id FROM Profile WHERE Name='Closer' LIMIT 1]; 
        User u = new User(Alias = 'hndlr', Email='handler@test.com', 
            EmailEncodingKey='UTF-8', LastName='HandlerTest', LanguageLocaleKey='en_US', 
            LocaleSidKey='en_US', ProfileId = p.Id, 
            TimeZoneSidKey='America/Los_Angeles', UserName='handler_test_user@test.com');
        insert u;
        
        Payment_Processor__c proc = DataFactoryTest.createPaymentProcessor();
        insert proc;

        Account acc = DataFactoryTest.createBusinessAccount();
        acc.Client_Status__c = 'Suspended';
        insert acc;
        
        Contact con = DatafactoryTest.createContact();
        con.AccountId = acc.Id;
        insert con;
            
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.StageName = opportunityUtil.STAGE_CLOSED_WON_PENDING;
        opp.AccountId = acc.Id;
        insert opp;

        Program_Plan__c plan = DataFactoryTest.createProgramPlan(opp.Id, acc.Id, proc.Id);
        insert plan;

        List<Draft__c> draftList = new List<Draft__c> {
            DataFactoryTest.createDraft(plan.Id),
            DataFactoryTest.createDraft(plan.Id),
            DataFactoryTest.createDraft(plan.Id),
            DataFactoryTest.createDraft(plan.Id),
            DataFactoryTest.createDraft(plan.Id)
        };
        draftList[1].Draft_Date__c = System.today().addDays(1);
        draftList[2].Draft_Date__c = System.today().addDays(2);
        draftList[3].Draft_Date__c = System.today().addDays(3);
        draftList[4].Draft_Date__c = System.today().addDays(4);
        insert draftList;
    }
    
    @isTest
    static void createIndividualRecordsTest(){
        Opportunity OpportunityInstance = new Opportunity();
        OpportunityInstance.Name = 'Opp Test ';
        OpportunityInstance.Phone__c = '4323232323';
        OpportunityInstance.closeDate = Date.today();
        OpportunityInstance.StageName = 'Working Opportunity';
        
        Test.startTest();
        insert OpportunityInstance;
        Test.stopTest();
        
        List<Opportunity> oppList = [SELECT Id, Name, Individual__c FROM Opportunity WHERE Individual__c != Null];
        
        Assert.areNotEqual(oppList,Null);
        Assert.areEqual(oppList.Size(),2);
    }
    
    @isTest
    static void testFirstPaymentDateUpdate() {
        
        
        Opportunity opp = [SELECT Id, First_Payment_Completed_Date__c,Current_Total_Debt__c FROM Opportunity LIMIT 1];
        List<Draft__c> draftsList = [ SELECT Id, Draft_Total_Amount__c, Draft_Date__c, Program_Plan__r.Opportunity__c 
                FROM Draft__c 
                WHERE Program_Plan__r.Opportunity__c = :opp.Id 
                ORDER BY Draft_Date__c ASC];
    
        User closer = [SELECT Id FROM User WHERE Alias = 'hndlr' LIMIT 1];
        
        Test.startTest();

        OpportunityLockService.disableOppLockForSystemUpdates();
        draftsList[0].draft_status__c = 'Completed';
        draftsList[0].draft_cleared_date__c = date.today();
        update draftsList;
        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
      
        Test.stopTest();

        // --- Assertions ---

        // 1. Verify a Collection record was created
        List<First_Payment_Collection__c> collections = [
            SELECT Id, Closer__c, Opportunity__c, First_Payment_Amount__c, First_Payment_Completed_Date__c,Total_Debt_Amount__c 
            FROM First_Payment_Collection__c 
            WHERE Opportunity__c = :opp.Id
        ];
        
       // System.assertEquals(1, collections.size(), 'Should create exactly 1 First Payment Collection record');
        
        First_Payment_Collection__c fpc = collections[0];

        // 2. Verify Data Mapping
        System.assertEquals(Date.today(), fpc.First_Payment_Completed_Date__c, 'Date should match Opp Date');
        System.assertEquals(opp.Current_Total_Debt__c, fpc.Total_Debt_Amount__c, 'Date should match Opp Date');

    }
}