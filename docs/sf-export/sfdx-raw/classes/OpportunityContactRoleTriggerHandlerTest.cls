@isTest
private class OpportunityContactRoleTriggerHandlerTest {

    @isTest
    static void assignPrimaryContactInAccountTest_Create() {
        
        Account acc = DataFactoryTest.createBusinessAccount();
        insert acc;

        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId =  acc.Id;
        insert opp;

        List<Contact> conList = new List<Contact> {
            DataFactoryTest.createContact(), DataFactoryTest.createContact()
        };
        conList[0].Lead_Number__c = '123457';
        insert conList;

        List<OpportunityContactRole> ocrList = new List<OpportunityContactRole> {
            new OpportunityContactRole(
                OpportunityId = opp.Id, ContactId = conList[0].Id, Role = 'Decision Maker', IsPrimary = true
            ),
            new OpportunityContactRole(
                OpportunityId = opp.Id, ContactId = conList[1].Id, Role = 'Business User'
            )
        };

        Test.startTest();
        insert ocrList;
        Test.stopTest();

        Account accToVerify = [SELECT Id, Primary_Contact__c FROM Account WHERE Id = :acc.Id];
        Assert.areEqual(conList[0].Id, accToVerify.Primary_Contact__c);        
    }

    @isTest
    static void assignPrimaryContactInAccountTest_UpdateIsPrimary() {
        
        Account acc = DataFactoryTest.createBusinessAccount();
        insert acc;

        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId =  acc.Id;
        insert opp;

        List<Contact> conList = new List<Contact> {
            DataFactoryTest.createContact(), DataFactoryTest.createContact()
        };
        conList[0].Lead_Number__c = '123457';
        insert conList;

        List<OpportunityContactRole> ocrList = new List<OpportunityContactRole> {
            new OpportunityContactRole(
                OpportunityId = opp.Id, ContactId = conList[0].Id, Role = 'Decision Maker', IsPrimary = true
            ),
            new OpportunityContactRole(
                OpportunityId = opp.Id, ContactId = conList[1].Id, Role = 'Business User'
            )
        };
        insert ocrList;

        Test.startTest();
        ocrList[1].IsPrimary = true;
        update ocrList[1];
        
        Test.stopTest();

        Account accToVerify = [SELECT Id, Primary_Contact__c FROM Account WHERE Id = :acc.Id];
        Assert.areEqual(conList[1].Id, accToVerify.Primary_Contact__c);        
    }

    @isTest
    static void assignPrimaryContactInAccountTest_UpdateContact() {
        
        Account acc = DataFactoryTest.createBusinessAccount();
        insert acc;

        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId =  acc.Id;
        insert opp;

        List<Contact> conList = new List<Contact> {
            DataFactoryTest.createContact(), DataFactoryTest.createContact()
        };
        conList[0].Lead_Number__c = '123457';
        insert conList;

        OpportunityContactRole ocr = new OpportunityContactRole(
            OpportunityId = opp.Id, ContactId = conList[0].Id, Role = 'Decision Maker', IsPrimary = true
        );
        insert ocr;

        Test.startTest();
        ocr.ContactId = conList[1].Id;
        update ocr;
        
        Test.stopTest();

        Account accToVerify = [SELECT Id, Primary_Contact__c FROM Account WHERE Id = :acc.Id];
        Assert.areEqual(conList[1].Id, accToVerify.Primary_Contact__c);        
    }
}