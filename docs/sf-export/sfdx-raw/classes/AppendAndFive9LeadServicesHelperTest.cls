@isTest
public with sharing class AppendAndFive9LeadServicesHelperTest {

    @testSetup
    static void makeData() {

        Five9LSP__Five9_List__c five9List = DataFactoryTest.createFive9List();
        insert five9List;

        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());

        Lead preLeadRec = DataFactoryTest.createPreLead();  
        preLeadRec.Phone = '9845678745';  
        preLeadRec.Outbound_ANI_From__c = '32423423423';
        preLeadRec.Outbound_ANI_Date__c = Date.today();
        preLeadRec.Outbound_ANI_Identifier__c = '32423423423';
        insert preLeadRec;

        Lead businessLeadRec = DataFactoryTest.createWebLead();   
        businessLeadRec.Phone = '8745672321';
        businessLeadRec.Outbound_ANI_From__c = '32423423423';
        businessLeadRec.Outbound_ANI_Date__c = Date.today();
        businessLeadRec.Outbound_ANI_Identifier__c = '32423423423';
        insert businessLeadRec;
        
        Lead businessLeadRec2 = DataFactoryTest.createWebLead();   
        businessLeadRec2.Phone = '8745672321';   
        businessLeadRec2.Outbound_ANI_From__c = '32423423423';
        businessLeadRec2.Outbound_ANI_Date__c = Date.today();
        businessLeadRec2.Outbound_ANI_Identifier__c = '32423423423';
        insert businessLeadRec2;
        
        Lead businessLeadRec3 = DataFactoryTest.createWebLead();   
        businessLeadRec3.Phone = '9845678745';   
        businessLeadRec3.Outbound_ANI_From__c = '32423423423';
        businessLeadRec3.Outbound_ANI_Date__c = Date.today();
        businessLeadRec3.Outbound_ANI_Identifier__c = '32423423423';
        insert businessLeadRec3;
    }

    @isTest
    public static void testQueryNewLeads() {
        Map<Id, Lead> leadsMap = new Map<Id, Lead>([SELECT Id FROM Lead]);
        Test.startTest();
        List<Lead> newLeads = AppendAndFive9LeadServicesHelper.queryNewLeads(leadsMap.keySet());
        Test.stopTest();
        Assert.areEqual(4, newLeads.size(), 'Verifying the new leads size');
    }

    @isTest
    public static void testQueryExistingLeads() {
        Id preLeadRTId = LeadUtil.getRecordTypeId(LeadUtil.RT_PRE_LEAD);
        Map<Id, Lead> leadsMap = new Map<Id, Lead>([SELECT Id FROM Lead WHERE RecordTypeId = :preLeadRTId]);
        Set<String> phoneNumbers = new Set<String> {'9845678745', '8745672321'};
        Test.startTest();
        List<Lead> existingLeads = AppendAndFive9LeadServicesHelper.queryExistingLeads(phoneNumbers, leadsMap.keySet());
        Test.stopTest();
        Assert.areEqual(3, existingLeads.size(), 'Verifying the existing leads size');
    }

    @isTest
    public static void testInitiateAppendLeadsAndAddToFive9() {
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        List<Five9LSP__Five9_List__c> five9List = [SELECT Id FROM Five9LSP__Five9_List__c];
        Id preLeadRTId = LeadUtil.getRecordTypeId(LeadUtil.RT_PRE_LEAD);
        List<Lead> newLeads = [SELECT Id FROM Lead WHERE RecordTypeId = :preLeadRTId];
        Lead preLeadRec = new Lead(); 
        preLeadRec.LastName = 'Test Pre Lead 2';
        preLeadRec.Outbound_ANI_From__c = '32423423423';
        preLeadRec.Outbound_ANI_Date__c = Date.today();
        preLeadRec.Outbound_ANI_Identifier__c = '32423423423';
        insert preLeadRec;
        Lead preLeadRec1 = new Lead();  
        preLeadRec1.LastName = 'Test Pre Lead 3';
        preLeadRec1.Outbound_ANI_From__c = '32423423423';
        preLeadRec1.Outbound_ANI_Date__c = Date.today();
        preLeadRec1.Outbound_ANI_Identifier__c = '32423423423';
        preLeadRec1.Phone = '9845678746';  
        insert preLeadRec1;
        Test.startTest();
        Map<Id, LeadService.LeadResult> leadSvcResult = AppendAndFive9LeadServicesHelper.initiateAppendLeadsAndAddToFive9(
            new Set<Id> {newLeads[0].Id, preLeadRec.Id, preLeadRec1.Id}, five9List[0].Id
        );
        Test.stopTest();
        Assert.areEqual(4, leadSvcResult.size(), 'Verify the size of the Lead Service Results');
        Assert.areEqual(false, leadSvcResult.get(preLeadRec.Id).isSuccess, 'Verify the the success flag is false for the lead which does not have the phone');
        Assert.areEqual('The phone number is blank in the lead.', leadSvcResult.get(preLeadRec.Id).customError, 'Verify the the success flag is false for the lead which does not have the phone');
    }
    
    @isTest
    static void archiveLeadsTest(){
          Map<Id, Lead> leadsMap = new Map<Id, Lead>([SELECT Id FROM Lead]);
        Test.startTest();
        Map<Id, LeadService.LeadResult> newLeads = AppendAndFive9LeadServicesHelper.archiveLeads(leadsMap.keySet());
        Test.stopTest();
    }
    
     @isTest
    static void initiateAddToFive9Test(){
        Lead preLeadRec = DataFactoryTest.createPreLead();    
        insert preLeadRec;
        Lead businessLeadRec = DataFactoryTest.createWebLead();   
        insert businessLeadRec;
        Map<Id, Lead> leadsMap = new Map<Id, Lead>([SELECT Id FROM Lead]);
        List<Five9LSP__Five9_List__c> five9List = [SELECT Id FROM Five9LSP__Five9_List__c];
        Test.startTest();
        Map<Id, LeadService.LeadResult> newLeads = AppendAndFive9LeadServicesHelper.initiateAddToFive9(leadsMap.keySet(), five9List[0].Id);
        Test.stopTest();
    }
    
    @isTest
    static void initiateRemoveFromFive9Test(){
        List<Five9LSP__Five9_List__c> five9List = [SELECT Id FROM Five9LSP__Five9_List__c];
        Lead preLeadRec = DataFactoryTest.createPreLead();    
        insert preLeadRec;
        Lead businessLeadRec = DataFactoryTest.createWebLead();   
        businessLeadRec.Five9_List_Id__c = five9List[0].Id;
        insert businessLeadRec;
        Map<Id, Lead> leadsMap = new Map<Id, Lead>([SELECT Id FROM Lead]);
        Test.startTest();
        Map<Id, LeadService.LeadResult> newLeads = AppendAndFive9LeadServicesHelper.initiateRemoveFromFive9(leadsMap.keySet(), five9List[0].Id);
        Test.stopTest();
        Map<Id, LeadService.LeadResult> newLead = AppendAndFive9LeadServicesHelper.initiateRemoveFromFive9(leadsMap.keySet(), Null);
    }
}