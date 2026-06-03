@isTest
public class SMSMagicTriggerHandlerTest {

    @testSetup
    static void setupTestData() {
        Account accountRecord = DataFactoryTest.createAccount();
        insert accountRecord;
        Opportunity opportunityInstance = DataFactoryTest.createOpportunity();
        insert opportunityInstance;
        Contact contactRecord = DataFactoryTest.createContact();
        insert contactRecord;
        
    }

    @isTest
    static void testAfterInsert_smsMagicTrigger() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];

        smagicinteract__smsMagic__c sms = new smagicinteract__smsMagic__c(
            smagicinteract__Account__c = acc.Id,
            smagicinteract__Contact__c = con.Id,
            smagicinteract__Opportunity__c = opp.Id,
            smagicinteract__Name__c = 'test',
            smagicinteract__PhoneNumber__c = '987654321',
            smagicinteract__SenderId__c = 'Transactional',
            smagicinteract__external_field__c = smagicinteract.ApexAPI.generateUniqueKey(),
            smagicinteract__SMSText__c= 'test'
        );

        Test.startTest();
        insert sms; 
        Test.stopTest();

    }
}