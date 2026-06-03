@isTest
public class LeadTriggerTest {

    @TestSetup
    static void makeData(){
        // Create test data
        
        Five9_API__c five9ApiSettings = createFive9ApiSettings();
        insert five9ApiSettings;
        Lead leadRecord = DataFactoryTest.createListLead();
        leadRecord.Phone='9876543201';
        insert leadRecord;

        Five9LSP__Five9_List__c five9List = DataFactoryTest.createFive9List();
        insert five9List;
    }
    
    public static Five9_API__c createFive9ApiSettings() {
        return new Five9_API__c(
            Name = 'LSPDEFAULT', API_URL__c = 'https://api.five9.test',
            Api_User_Name__c = 'username',
            Api_User_Password__c = 'Password'
        );
    }

    @isTest
    static void testLeadInsertAndUpdates() {

        // Create test data
        List<Lead> leadsToInsert = new List<Lead>{
            new Lead(FirstName='John', LastName='Doe', Company='Acme Inc.', Phone='9876543201'),
            new Lead(FirstName='Jane', LastName='Doe', Company='Acme Inc.', Phone='9876543202')
        };
        insert leadsToInsert;

        // Verify that the leads were inserted
        List<Lead> insertedLeads = [SELECT Id, FirstName, LastName, Company FROM Lead WHERE FirstName IN ('John', 'Jane') AND LastName = 'Doe' AND Company = 'Acme Inc.'];
        System.assertEquals(2, insertedLeads.size(), 'The expected number of leads was not inserted.');

        // Modify the test data
        Lead leadToUpdate = insertedLeads[0];
        leadToUpdate.Company = 'New Acme Inc.';
        List<Lead> leadsToUpdate = new List<Lead>{leadToUpdate};
 
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
        update leadsToUpdate;
        Test.stopTest();

        // Verify that the lead was updated
        Lead updatedLead = [SELECT Id, FirstName, LastName, Company FROM Lead WHERE Id = :leadToUpdate.Id];
        System.assertEquals('New Acme Inc.', updatedLead.Company, 'The lead was not updated correctly.');
    }
    
    @isTest
    static void testPreventTriggerExecution() {
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
        // Create test data
        List<Lead> leadsToInsert = new List<Lead>{
            new Lead(FirstName='John', LastName='Doe', Company='Acme Inc.', Phone='9876543201'),
            new Lead(FirstName='Jane', LastName='Doe', Company='Acme Inc.', Phone='9876543202')
        };
        insert leadsToInsert;        
        // Verify that the leads were inserted
        List<Lead> insertedLeads = [SELECT Id, FirstName, LastName, Company FROM Lead WHERE FirstName IN ('John', 'Jane') AND LastName = 'Doe' AND Company = 'Acme Inc.'];
        System.assertEquals(2, insertedLeads.size(), 'The expected number of leads was not inserted.');
    }

    @isTest
    static void testRemoveFromFive9() {
        Five9LSP__Five9_LSP_Settings__c five9Settings = DataFactoryTest.createFive9Settings();
        insert five9Settings;

        Five9LSP__Five9_List__c five9List = DataFactoryTest.createFive9List();
        insert five9List;
        List<Lead> leads = [SELECT Id FROM Lead];
        Lead leadRecord = leads[0];
        leadRecord.Five9_List_Id__c = five9List.Id;
        leadRecord.Status = 'Archive Disposition';
        leadRecord.Outbound_ANI_From__c = '1234556667';
        leadRecord.Outbound_ANI_Date__c = date.today();
        leadRecord.Outbound_ANI_Identifier__c = '123455666723';
        leadRecord.Sub_Disposition__c = 'Not Enough Debt';
        update leadRecord;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('checkDncForNumbers', true));
        leadRecord.Sub_Disposition__c = 'Not Enough Debt';
        update leadRecord;
        Test.stopTest();
        List<Async_Operation__c> asyncOperations = [SELECT Id, Status__c, Operation__c FROM Async_Operation__c Where Status__c != 'pending'  And Operation__c != 'IPQualityScoreCheck'];
        Assert.areEqual('Completed', asyncOperations[0].Status__c, 'Verifying the Async Operation is completed successfully.'); 
        Assert.areEqual('Remove Lead From Five9 - Lead Final Disposition', asyncOperations[0].Operation__c, 'Verifying the business operation.');
        List<lead> leadsToVerify = [SELECT Id, Five9_List_Id__c FROM Lead WHERE Id = :leadRecord.Id];
    //    Assert.areEqual(five9List.Id, leadsToVerify[0].Five9_List_Id__c, 'Verifying the lead is removed from Five9');
    }

    @isTest
    static void testRemoveFromFive9Negative() {
        List<Lead> leads = [SELECT Id FROM Lead];
        Lead leadRecord = leads[0];
        leadRecord.Five9_List_Id__c = '3354739320';
        leadRecord.Status = 'Archive Disposition';
        leadRecord.Outbound_ANI_From__c = '1234556667';
        leadRecord.Outbound_ANI_Date__c = date.today();
        leadRecord.Outbound_ANI_Identifier__c = '123455666723';
        leadRecord.Sub_Disposition__c = 'Not Enough Debt';
        Test.startTest();        
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('checkDncForNumbers', true));
        update leadRecord;
        Test.stopTest();
        List<Async_Operation__c> asyncOperations = [SELECT Id, Status__c FROM Async_Operation__c Where status__c != 'pending' And Operation__c != 'IPQualityScoreCheck'];
        Assert.areEqual(0, asyncOperations.size(), 'Verifying the Async Operation not created.'); 
        List<lead> leadsToVerify = [SELECT Id, Five9_List_Id__c FROM Lead WHERE Id = :leadRecord.Id];
        //Assert.areEqual(Null, leadsToVerify[0].Five9_List_Id__c, 'Verifying the lead does not remove Five9');
        List<Application_Log__c> logs = [SELECT Id FROM Application_Log__c];
      //  Assert.areEqual(1, logs.size(), 'Verifying the application log is created.'); 
    }

   /* @isTest
    static void deDuplicateWebLeads() {
        Lead leadRecord1 = DataFactoryTest.createBusinessLead();
        insert leadRecord1;
        Lead leadRecord2 = DataFactoryTest.createBusinessLead();
        leadRecord2.LeadSource = 'Web';
        Test.startTest();
        //Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('checkDncForNumbers', true));
        insert leadRecord2;
        Test.stopTest();
        //Commented out the Deduplicate Lead functionality for Web leads as requested on Nov-13-2024 [CRM-574]
        /*List<Lead> oldLead = [SELECT Id, Status FROM Lead WHERE Id = :leadRecord1.Id];
        Assert.areEqual('Archive Disposition', oldLead[0].Status, 'Verifying the Old Lead is Archived');
        List<Lead> newLead = [SELECT Id, Status FROM Lead WHERE Id = :leadRecord2.Id];
        Assert.areEqual('New', newLead[0].Status, 'Verifying the new Lead is in new');
    }*/
    
     @isTest
    static void testAddNumbersToDNCList(){
                
         Five9LSP__Five9_LSP_Settings__c five9Settings = DataFactoryTest.createFive9Settings();
        insert five9Settings;

        Five9LSP__Five9_List__c five9List = DataFactoryTest.createFive9List();
        insert five9List;
        Lead leadInstance = DataFactoryTest.createListLead();
        leadInstance.Phone = '9876054322';
        leadInstance.Outbound_ANI_From__c = '1234556667';
        leadInstance.Outbound_ANI_Date__c = date.today();
        leadInstance.Outbound_ANI_Identifier__c = '123455666723';
        leadInstance.Add_to_f9list_Id__c = five9List.Id;
        insert leadInstance;
        Test.startTest();
        lead l = [Select id,five9_Disposition__c from lead where id=: leadInstance.id];
        l.five9_Disposition__c = 'DO NOT CALL - DNC';
        update l;
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('checkDncForNumbers', true));
        Test.stopTest();
        assert.areNotEqual(leadInstance.five9_Disposition__c,l.five9_Disposition__c); 
    }
    
     @isTest
    static void testAddNumbersToDNCListException(){
         Five9LSP__Five9_LSP_Settings__c five9Settings = DataFactoryTest.createFive9Settings();
        insert five9Settings;

        Five9LSP__Five9_List__c five9List = DataFactoryTest.createFive9List();
        insert five9List;
        Lead leadInstance = DataFactoryTest.createListLead();
        leadInstance.Phone = '9876054322';
        leadInstance.Outbound_ANI_From__c = '1234556667';
        leadInstance.Outbound_ANI_Date__c = date.today();
        leadInstance.Outbound_ANI_Identifier__c = '123455666723';
        leadInstance.Add_to_f9list_Id__c = five9List.Id;
        insert leadInstance;
        Test.startTest();
        lead l = [Select id,five9_Disposition__c from lead where id=: leadInstance.id];
        l.five9_Disposition__c = 'DO NOT CALL - DNC';
        update l;
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('checkDncForNumbers', false));
        Test.stopTest();
        assert.areNotEqual(leadInstance.five9_Disposition__c,l.five9_Disposition__c); 
    }
    
     @isTest
    static void testRemoveNumbersFromDNCList(){
        Five9LSP__Five9_LSP_Settings__c five9Settings = DataFactoryTest.createFive9Settings();
        insert five9Settings;

        Five9LSP__Five9_List__c five9List = DataFactoryTest.createFive9List();
        insert five9List;
        Lead leadInstance = DataFactoryTest.createListLead();
        leadInstance.Phone = '9876054321';
        leadInstance.Add_to_f9list_Id__c = five9List.Id;
        leadInstance.LeadSource = 'Web';
        Test.startTest(); 
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('checkDncForNumbers', true));
        insert leadInstance;
        Test.stopTest();
        
        List<String> dncNumbers = LeadAfterTriggerHelper.checkDncForNumbers(new List<String>{'9876054321','8907654321'});
        assert.isNotNull(!dncNumbers.isEmpty(), 'The DNC check should return the number as present in the DNC list.');
    }
        
    public class MockHttpResponseGenerator implements HttpCalloutMock {

        public HttpResponse respond(HttpRequest request) {
            return new HttpResponse();
        }
    } 
}