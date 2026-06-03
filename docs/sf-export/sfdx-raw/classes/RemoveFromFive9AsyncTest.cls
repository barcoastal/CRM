@IsTest
public class RemoveFromFive9AsyncTest {

    @testSetup
    static void setup() {
        
        Five9LSP__Five9_List__c five9List = DataFactoryTest.createFive9List();
        insert five9List;
        List<Lead> leads = new List<Lead>();
        for (Integer i = 0; i < 5; i++) {
            Lead lead = new Lead(
                FirstName = 'John' + i,
                LastName = 'Doe' + i,
                Company = 'Test Company' + i,
                Phone = '123456789' + i,
                Five9_List_Id__c = five9List.Id
            );
            leads.add(lead);
        }
        insert leads;
        
        

        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());

        Lead preLeadRec = DataFactoryTest.createPreLead();  
        preLeadRec.Phone = '9845678745';  
        insert preLeadRec;

        Lead businessLeadRec = DataFactoryTest.createListLead();   
        businessLeadRec.Phone = '8745672321';   
        insert businessLeadRec;
    }

    @IsTest
    static void testRemoveLeadsFromFive9() {
        Map<Id, Lead> leadsMap = new Map<Id, Lead>([SELECT Id, Phone FROM Lead]);
        Map<String, String> phoneNumberOperationTypeMap = new Map<String, String>();
        for (Lead lead : leadsMap.Values()) {
            phoneNumberOperationTypeMap.put(lead.Phone, 'Remove');
        }

        Test.startTest();
        RemoveFromFive9Async.removeLeadsFromFive9(phoneNumberOperationTypeMap, leadsMap.keySet());
        Test.stopTest();
        Assert.areNotEqual([Select Id, Name From Lead Where Is_Archived__c = True AND Archived_Date__c = Today],Null);
    }

    @IsTest
    static void testRemoveLeadsFromFive9WithNullLeadIds() {
        List<Lead> leads = [SELECT Id, Phone FROM Lead];
        Map<String, String> phoneNumberOperationTypeMap = new Map<String, String>();
        for (Lead lead : leads) {
            phoneNumberOperationTypeMap.put(lead.Phone, 'Remove');
        }

        Test.startTest();
        RemoveFromFive9Async.removeLeadsFromFive9(phoneNumberOperationTypeMap, null);
        Test.stopTest();
        Assert.areNotEqual([Select Id, Name From Lead Where Is_Archived__c = True AND Archived_Date__c = Today],Null);
    }
    
     @isTest
    static void initiateRemoveFromFive9Test(){
                 List<Five9LSP__Five9_List__c> five9List = [SELECT Id FROM Five9LSP__Five9_List__c];
        Lead preLeadRec = DataFactoryTest.createPreLead();    
        insert preLeadRec;
        Lead businessLeadRec = DataFactoryTest.createListLead();   
        businessLeadRec.Five9_List_Id__c = five9List[0].Id;
        insert businessLeadRec;
          Map<Id, Lead> leadsMap = new Map<Id, Lead>([SELECT Id FROM Lead]);
        Test.startTest();
       Map<Id, RemoveFromFive9Async.LeadResult> newLeads = RemoveFromFive9Async.initiateRemoveFromFive9(leadsMap.keySet(), five9List[0].Id);
        Test.stopTest();
                Map<Id, RemoveFromFive9Async.LeadResult> newLead = RemoveFromFive9Async.initiateRemoveFromFive9(leadsMap.keySet(), Null);
    }
}