@IsTest
private class OpportunityDataTest {

    /**
     * @description: Test Method to create the test records
    **/
    @testSetup
    static void makeData() { 
        Account acct = DataFactoryTest.createAccount();
        insert acct;

        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acct.Id;
        opp.Phone__c = '123456';
        opp.StageName = 'Closed Won First Payment Pending';
        insert opp;
    }
    
    @IsTest
    static void testQueryOpportunity(){

        Id personAcctRecTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'PersonAccount');
        Account acct = new Account(RecordTypeId = personAcctRecTypeId, FirstName = 'Nyssa', LastName = 'Vazquez', External_SAS_Id__c = '69');
        insert acct;

        Opportunity oppty = new Opportunity(
            Name = 'Opportunity Test', AccountId = acct.Id, CloseDate = System.today().addDays(3), ForecastCategoryName = 'Pipeline',
            Probability = 40, StageName = 'Working Opportunity'
        );
        insert oppty;
        
        Test.startTest();
        List<Opportunity> opportunities = OpportunityData.queryOpportunity(oppty.Id);
        Test.stopTest();
        
        System.assertEquals(acct.Id, opportunities[0].AccountId);
    }

    /**
     * @description: Veriying the querying Active Opportunity of an account
    **/
    @isTest
    static void testGetActiveOpportunity() {
        List<Account> accts = [SELECT Id FROM Account];
        List<Opportunity> oppList = [SELECT Id FROM Opportunity];
        Opportunity opp;
        Test.startTest();
        opp = OpportunityData.getActiveOpportunityId(accts[0].Id);
         OpportunityData.getActiveInProgressOpportunityId(accts[0].Id);
        OpportunityData.queryOppLineItems(New Set<Id> {accts[0].Id});
        OpportunityData.queryActiveOpportunities(New Set<Id> {accts[0].Id});
        Test.stopTest();
        Assert.areEqual(oppList[0].Id, opp.Id, 'Verifying the Opportunity Stage');
    }
    /**
 	* Method to test the getOppIdMap method in the OpportunityData class.
 	* This method verifies if the getOppIdMap method correctly retrieves Opportunities based on the provided set of Opportunity IDs.
	 */
      @IsTest
    static void testgetOppIdMap(){
        set<id> oppIdSet = new Set<Id>();
        list<Opportunity> oppList = [Select Id, Name, AccountId from opportunity limit 2];
        for(opportunity opp : oppList){
            oppIdSet.add(opp.Id);
        }
        Test.startTest();
        Map<Id, Opportunity> finalOppMap = OpportunityData.getOppIdMap(oppIdSet);
        Test.stopTest();
        Assert.areEqual(oppIdSet.size(), finalOppMap.size());
    }
    /**
 	* Method to test the queryClosedWonOpportunities method in the OpportunityData class.
 	* This method verifies if the queryClosedWonOpportunities method correctly retrieves Closed Won Opportunities based on the provided set of Opportunity IDs.
 	*/
    @IsTest
    static void testQueryClosedWonOpportunities(){
        set<id> oppIdSet = new Set<Id>();
        list<Opportunity> oppList = [Select Id, Name, AccountId from opportunity where stageName=:'Closed Won First Payment Pending'];
        for(opportunity opp : oppList){
            oppIdSet.add(opp.Id);
        }
        Test.startTest();
        List<Opportunity> finalOppList = OpportunityData.queryClosedWonOpportunities(oppIdSet);
        Test.stopTest();
        Assert.areEqual(oppIdSet.size(), finalOppList.size());
    }
    
      @IsTest
    static void testqueryOpportunitiesWithoutIndividualReference(){
       
        Test.startTest();
        List<Opportunity> finalOppList = OpportunityData.queryOpportunitiesWithoutIndividualReference(New Set<String> {'1234567890'});
        OpportunityData.queryOpportunitiesWithSamePhone(New Set<String> {'1234567890'});
        Test.stopTest();
    }
    
     @IsTest
    static void getLatestActiveOpportunityByAccount(){
        List<Account> accList = [SELECT Id FROM Account LIMIT 1];
        Test.startTest();
        List<Opportunity> finalOppList = OpportunityData.getLatestActiveOpportunityByAccount(New Set<Id> {accList[0].Id});
        List<Opportunity> finalOppList2 = OpportunityData.getLatestActiveOpportunityByAccount(accList[0].Id);

        Opportunity opp = OpportunityData.getOpportunityId(accList[0].Id);
        Test.stopTest();
        
        Assert.areNotEqual(finalOppList.size(), 0);
        Assert.areNotEqual(finalOppList2.size(), 0);
        Assert.areNotEqual(opp,NUll);
    }
   
    @IsTest
    static void queryOpportunityMapByIdsTest(){
        List<Opportunity> oppList = [SELECT Id FROM Opportunity LIMIT 1];
        Test.startTest();
        Map<Id,Opportunity> finalOppList = OpportunityData.queryOpportunityMapByIds(New Set<Id> {oppList[0].Id});
        Map<Id,Opportunity> finalOppList2 = OpportunityData.queryOpportunityMapByOppIds(New Set<Id> {oppList[0].Id});
        List<Opportunity> finalOppList3 = OpportunityData.getOpportunityDataById(oppList[0].Id);
        
        Test.stopTest();
        
        Assert.areNotEqual(finalOppList.size(), 0);
        Assert.areNotEqual(finalOppList2.size(), 0);
        Assert.areNotEqual(finalOppList3.size(), 0);
    }
    
     @IsTest
    static void getActiveOpportunitiesByPhoneNumbersTest(){
        List<Opportunity> oppList = [SELECT Id FROM Opportunity LIMIT 1];
        Test.startTest();
        List<Opportunity> finalOppList = OpportunityData.getActiveOpportunitiesByPhoneNumbers(New Set<String> {'123456'});
        Test.stopTest();
        
        Assert.areNotEqual(finalOppList.size(), 0);
    }
    
     @IsTest
    static void queryRecordTypesTest(){
        Test.startTest();
        List<RecordType> recordTypeList = OpportunityData.queryRecordTypes();
        Test.stopTest();
        
        Assert.areNotEqual(recordTypeList.size(), 0);
    }
}