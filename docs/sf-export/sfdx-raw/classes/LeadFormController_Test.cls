@isTest
public with sharing class LeadFormController_Test {
    @TestSetup
    static void makeData(){
        Lead leadRec = DataFactoryTest.createWebLead();
        leadRec.Description = 'Test Desc';
        leadRec.phone = '1234567890';
        insert leadRec;
    }

    @isTest
    static void testGetLeads() {
        List<Lead> leads = [SELECT Id FROM Lead];
        Test.startTest();
        String leadDetails = LeadFormController.getLeadDetails(leads[0].Id);
        Test.stopTest();
        Assert.isTrue(String.isNotBlank(leadDetails), 'Lead Details are quweried');
    }

    @isTest
    static void testSaveLeads() {
        List<Lead> leads = [SELECT Id, Description FROM Lead];
        Lead leadInstance = leads[0];
        leadInstance.Description = 'Test Desc2';
        leadInstance.phone = '1234567890';
        Test.startTest();
        String result = LeadFormController.saveLeadDetails(JSON.serialize(leadInstance), 'testUrl');
        Map<String, Object> data = (Map<String, Object>) JSON.deserializeUntyped(result);
        Test.stopTest();
        Assert.areEqual('Success', data.get('result'), 'Verifying the result is success or not');
    }
    
    @isTest
    static void updateCallTransferInfoTest(){
        
        String leadId = [SELECT Id FROM Lead LIMIT 1].Id;
        List<User> userList = [SELECT Id, Email FROM User WHERE Id =:userInfo.getUserId()];
        Test.startTest();
        List<User> userRecords = LeadFormController.getUserByEmail(userList[0].Email);
        LeadFormController.WorksheetUserWrapper wsWrapper = new LeadFormController.WorksheetUserWrapper();
        wsWrapper.userId = userRecords[0].Id;
        wsWrapper.description = 'test';
        wsWrapper.callTransferredDateTime = '2026-02-23T14:30:00';
        LeadFormController.updateCallTransferDetails(leadId, wsWrapper); 
        LeadFormController.getWebLeadRecordTypeId();
        Test.stopTest();
        
        Lead leadRec = [SELECT Id, FronterLookup__c, Call_Tranferred_DateTime__c FROM Lead WHERE Id=:leadId];        
        System.assertEquals(userRecords[0].Id , leadRec.FronterLookup__c, 'Verifying the Fronter is null');
    }
    
    @isTest
    static void getLeadSourceByPhoneTest(){
        List<Inbound_Phone_Lead_Source_Mapping__mdt> InboundPhoneLeadSourceMdtList = [SELECT Id,To_Phone__c,Lead_Source__c FROM Inbound_Phone_Lead_Source_Mapping__mdt];
        String toPhoneNumber = InboundPhoneLeadSourceMdtList[0].To_Phone__c;
        String leadSourceMdt = InboundPhoneLeadSourceMdtList[0].Lead_Source__c;

        Test.startTest();
        String result = LeadFormController.getLeadSourceByPhone(toPhoneNumber); 
        Test.stopTest();
        
        System.assertEquals(result, leadSourceMdt);
    }
}