@isTest
public class GetCustomerDetailsControllerTest {
    @isTest
    static void getRTDetailsOfOpportunityRecord() { 
        ApexActionResult result;
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.Escrow_Balance__c = 100;
        acctRecord.Escrow_Balance_Pulled_Date_Time__c = system.now();
        insert acctRecord;
        
        Opportunity oppRec = DataFactoryTest.createOpportunity();
        oppRec.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Opportunity', 'Debt_Settlement');
        oppRec.AccountId = acctRecord.Id;
        insert oppRec;
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        result = GetCustomerDetailsController.getAccountDetails(acctRecord.Id);
        Test.stopTest();
    }
    
    @isTest
    static void refreshSASCustomerDetails() { 
        ApexActionResult result;
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.Escrow_Balance__c = 100;
        acctRecord.Escrow_Balance_Pulled_Date_Time__c = system.now();
        acctRecord.External_SAS_Id__c = '12345';
        insert acctRecord;        
        
        SAS_Settings__c settings = new SAS_Settings__c();
        settings.Endpoint__c = 'https://test.com';
        insert settings;
        
        Opportunity oppRec = DataFactoryTest.createOpportunity();
        oppRec.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Opportunity', 'Debt_Settlement');
        oppRec.AccountId = acctRecord.Id;
        insert oppRec;
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        result = GetCustomerDetailsController.refreshCustomerDetails(acctRecord.Id, '12345' , null);
    }
    
    @isTest
    static void refreshRAMCustomerDetails() { 
        ApexActionResult result;       
        
        RAMS_Settings__c ramSettings = new RAMS_Settings__c();
        ramSettings.Name = 'RAM Settings';
        ramSettings.Endpoint__c = 'https://example.com/api';
        ramSettings.APIKey__c = 'testApiKey';
        ramSettings.Affiliate_ID__c = '1234';
        ramSettings.Fee_Split_Group_ID__c = '1234';
        insert ramSettings;
        
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.Escrow_Balance__c = 100;
        acctRecord.Escrow_Balance_Pulled_Date_Time__c = system.now();
        acctRecord.External_RAM_Id__c = '12345';
        insert acctRecord;
        
        Opportunity oppRec = DataFactoryTest.createOpportunity();
        oppRec.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Opportunity', 'Debt_Settlement');
        oppRec.AccountId = acctRecord.Id;
        insert oppRec;
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        result = GetCustomerDetailsController.refreshCustomerDetails(acctRecord.Id, null, '12345');
    }    
}