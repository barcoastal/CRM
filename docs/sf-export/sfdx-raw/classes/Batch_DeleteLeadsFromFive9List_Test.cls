@isTest
public class Batch_DeleteLeadsFromFive9List_Test {
     
    @isTest
    static void DeleteLeadsFromFive9_Test(){
        Five9LSP__Five9_LSP_Settings__c five9Settings = DataFactoryTest.createFive9Settings();
        insert five9Settings;
        
        Five9_API__c five9ApiSettings = DataFactoryTest.createFive9ApiSettings();
        insert five9ApiSettings;
       
        five9_lsp2__Five9_Data_Center__c five9Lsp2DataCenter = DataFactoryTest.createFive9Lsp2DataCenter();
        insert five9Lsp2DataCenter;
        five9_lsp2__Five9_Domain__c five9Lsp2Domain = DataFactoryTest.createFive9Lsp2Domain(five9Lsp2DataCenter.Id);
        insert five9Lsp2Domain;
        five9_lsp2__Five9_Object_Fields_Mapping__c five9Lsp2ObjectFieldsMapping = DataFactoryTest.createFive9Lsp2ObjectFieldMapping(five9Lsp2Domain.Id);
        insert five9Lsp2ObjectFieldsMapping;
        five9_lsp2__Five9_List_Config__c five9List = DataFactoryTest.createFive9Lsp2List(five9Lsp2ObjectFieldsMapping.Id);
        five9List.five9_lsp2__Five9_List_Name__c = 'Test List';
        insert five9List;
        
        List<Lead> leadList = new List<Lead> {
            DataFactoryTest.createListLead(),
            DataFactoryTest.createListLead(),
            DataFactoryTest.createListLead(),
            DataFactoryTest.createListLead(),
            DataFactoryTest.createListLead()
        };
        LeadTriggerHandler.preventRecursion = true;
        leadList[0].status = leadUtil.LEAD_ARCHIVED_STATUS;
        leadList[0].phone = '1234567890';
        leadList[1].status = leadUtil.LEAD_ARCHIVED_STATUS;
        leadList[1].phone = '1234567891';
        leadList[2].status = leadUtil.LEAD_ARCHIVED_STATUS;
        leadList[2].phone = '1234567892';
        leadList[3].status = leadUtil.LEAD_ARCHIVED_STATUS;
        leadList[3].phone = '1234567893';
        leadList[4].status = leadUtil.LEAD_ARCHIVED_STATUS;
        leadList[4].phone = '1234567894';
        insert leadList;    
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('deleteFromFive9List', true));
        Batch_DeleteLeadsFromFive9List deleteFromFive9List = new Batch_DeleteLeadsFromFive9List('Test List');
        Database.executeBatch(deleteFromFive9List);
        Test.stopTest();
    }
    
     @isTest
    static void DeleteLeadsFromFive9_Test_Fail(){
        Five9LSP__Five9_LSP_Settings__c five9Settings = DataFactoryTest.createFive9Settings();
        insert five9Settings;

        Five9LSP__Five9_List__c five9List = DataFactoryTest.createFive9List();
         five9List.Name = 'Test List';
        insert five9List;
        
        List<Lead> leadList = new List<Lead> {
            DataFactoryTest.createListLead(),
            DataFactoryTest.createListLead(),
            DataFactoryTest.createListLead(),
            DataFactoryTest.createListLead(),
            DataFactoryTest.createListLead()
        };
        LeadTriggerHandler.preventRecursion = true;
        leadList[0].status = leadUtil.LEAD_ARCHIVED_STATUS;
        leadList[0].phone = '1234567890';
        leadList[1].status = leadUtil.LEAD_ARCHIVED_STATUS;
        leadList[1].phone = '1234567891';
        leadList[2].status = leadUtil.LEAD_ARCHIVED_STATUS;
        leadList[2].phone = '1234567892';
        leadList[3].status = leadUtil.LEAD_ARCHIVED_STATUS;
        leadList[3].phone = '1234567893';
        leadList[4].status = leadUtil.LEAD_ARCHIVED_STATUS;
        leadList[4].phone = '1234567894';
        insert leadList;    
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('deleteFromFive9List', true));
        Batch_DeleteLeadsFromFive9List deleteFromFive9List = new Batch_DeleteLeadsFromFive9List('Test List');
        Database.executeBatch(deleteFromFive9List);
        Test.stopTest();
    }
}