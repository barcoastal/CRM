@IsTest
private class OpportunityUtilTest {
    
    @IsTest
    static void testGetSObjName(){
       System.assertEquals('Opportunity', new OpportunityUtil().getSObjName());
    }

    @IsTest
    static void testGetSObjLabel(){
        System.assertEquals('Opportunity', new OpportunityUtil().getSObjLabel());
    }

    @IsTest
    static void testIsOppId_Valid(){

        Id personAcctRecTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'PersonAccount');
        Account acct = new Account(RecordTypeId = personAcctRecTypeId, FirstName = 'Nyssa', LastName = 'Vazquez', External_SAS_Id__c = '69');
        insert acct;

        Opportunity oppty = new Opportunity(
            Name = 'Opportunity Test', AccountId = acct.Id, CloseDate = System.today().addDays(3), ForecastCategoryName = 'Pipeline',
            Probability = 40, StageName = 'Working Opportunity'
        );
        insert oppty;
        
        OpportunityUtil.getActiveOpportunityIdOfAccounts(new Set<Id>{acct.Id});
        System.assert(OpportunityUtil.isOppId(oppty.Id));
    }

    @IsTest
    static void testIsOppId_InValid(){
        Account acct = new Account(FirstName = 'Nyssa', LastName = 'Vazquez');
        insert acct;
        System.assert(!OpportunityUtil.isOppId(acct.Id));
    }

    @IsTest
    static void testGetFieldsetDetails(){
        System.assertEquals(null, new OpportunityUtil().getFieldsetDetails());
    }
}