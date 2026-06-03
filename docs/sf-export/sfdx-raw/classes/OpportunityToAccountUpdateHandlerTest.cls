@IsTest
public class OpportunityToAccountUpdateHandlerTest {
    
    @isTest
    static void clientStatusAssignmentTest(){
        Account acc = DataFactoryTest.createBusinessAccount();
        acc.Client_Status__c = 'Cancelled';
        insert acc;
        
        Contact con = DatafactoryTest.createContact();
        con.AccountId = acc.Id;
        insert con;
                    
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.StageName = 'Contract Sent';
        opp.AccountId = acc.Id;
        insert opp;
        
        Map<Id, Opportunity> oldOppMap = new Map<Id, Opportunity>(new List<Opportunity>{opp});
        Test.startTest();
        Opportunity oppty = [SELECT Id,StageName FROM Opportunity WHERE Id= :opp.Id];
        opp.StageName = OpportunityUtil.STAGE_CLOSED_WON_PENDING;
        update opp;           
        OpportunityToAccountUpdateHandler handler = new OpportunityToAccountUpdateHandler();
        handler.clientStatusAssignment(new List<Opportunity>{opp}, oldOppMap);
        Test.stopTest();
        List<Account> updatedAccounts = [SELECT Id, Client_Status__c FROM Account where Id =: opp.AccountId];
        System.assertEquals(AccountUtil.CLIENT_STATUS_WAITING_FIRST_PAYMENT, updatedAccounts[0].Client_Status__c, 'Client_Status__c should be updated');  
    }
    
      @isTest
    static void closerAssignmentTest(){
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        insert acctRecord;  
        
        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        oppInstance.AccountId = acctRecord.Id;
        insert oppInstance;
        
        List<Opportunity> oppList = [SELECT Id, AccountId, StageName FROM Opportunity limit 1];
        Map<Id, Opportunity> oldOppMap = new Map<Id, Opportunity>(oppList);
        Test.startTest();
        for (Opportunity opp : oppList) {
            opp.OwnerId = UserInfo.getUserId();
        }
        update oppList;
        
        OpportunityToAccountUpdateHandler handler = new OpportunityToAccountUpdateHandler();
        handler.closerAssignment(oppList, oldOppMap);
        Test.stopTest();
        List<Account> updatedAccounts = [SELECT Id, Closer__c  FROM Account where Id =: oppList[0].AccountId];
        System.assertEquals(UserInfo.getUserId(), updatedAccounts[0].Closer__c,  'Closer__c should be updated with new OwnerId');  
    }
    @isTest
    static void syncLegalNetworkToAccount_VictoryTest() {
        Account acc = DataFactoryTest.createBusinessAccount();
        insert acc;

        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acc.Id;
        opp.StageName = 'Contract Sent';
        opp.Legal_Network__c = FileUtil.AGREEMENT_VICTORY;
        insert opp;

        Map<Id, Opportunity> oldOppMap = new Map<Id, Opportunity>(new List<Opportunity>{opp});
        opp.StageName = OpportunityUtil.STAGE_CONTRACT_SINGED;

        Test.startTest();
        update opp;
        OpportunityToAccountUpdateHandler handler = new OpportunityToAccountUpdateHandler();
        handler.syncLegalNetworkToAccount(new List<Opportunity>{opp}, oldOppMap);
        Test.stopTest();

        Account updatedAcc = [SELECT Legal_Network__c FROM Account WHERE Id = :acc.Id];
        System.assertEquals(FileUtil.AGREEMENT_VICTORY, updatedAcc.Legal_Network__c, 'Legal_Network__c should be synced to Victory Legal Plan');
    }

    @isTest
    static void syncLegalNetworkToAccount_CitadelTest() {
        Account acc = DataFactoryTest.createBusinessAccount();
        insert acc;

        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acc.Id;
        opp.StageName = 'Contract Sent';
        opp.Legal_Network__c = FileUtil.CITADEL_LEGAL_PLAN;
        insert opp;

        Map<Id, Opportunity> oldOppMap = new Map<Id, Opportunity>(new List<Opportunity>{opp});
        opp.StageName = OpportunityUtil.STAGE_CONTRACT_SINGED;

        Test.startTest();
        update opp;
        OpportunityToAccountUpdateHandler handler = new OpportunityToAccountUpdateHandler();
        handler.syncLegalNetworkToAccount(new List<Opportunity>{opp}, oldOppMap);
        Test.stopTest();

        Account updatedAcc = [SELECT Legal_Network__c FROM Account WHERE Id = :acc.Id];
        System.assertEquals(FileUtil.CITADEL_LEGAL_PLAN, updatedAcc.Legal_Network__c, 'Legal_Network__c should be synced to Citadel Legal Plan');
    }
}