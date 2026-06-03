@isTest
public with sharing class Batch_ArchiveDupeLeadOfConvertLeads_Test {
    @testSetup
    static void makeData() { 

        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());

        Payment_Processor__c processor = new Payment_Processor__c(Name = 'SAS', Processor_Type__c = 'SAS');
        insert processor;

        Payment_Processor__c procRam = DataFactoryTest.createPaymentProcessor();
        procRam.Processor_Type__c = 'RAM';
        insert procRam;

        Lead leadInstance = new Lead(
            FirstName='Test', LastName='Lead Julia', Email='john@company.com', CurrentGenerators__c = 'Generators',
            Lenders__c='Lenders - ABC Company', Phone='4166661216', City='San Francisco', SSN__c = '765432189', NumberofLocations__c = 100,
            State='California', Work_Phone__c='4166661211', Current_Payment_Amount__c=123.45, Call_counter__c=16500, Country_Code__c=119, 
            EIN_Number_Tax_Id__c='876543875', Monthly_Revenue__c=123.45, PostalCode='94105', Company='XYZ Company Test', 
            MCA_Amount__c=123.45, Date_Of_Birth__c=Date.valueOf('1997-03-17'), MCA_Amount_Requested__c=123.45, Status='Open - Not Contacted', 
            Frequency__c='Weekly', UCC_filing_Date__c=Date.valueOf('2023-03-21'), Business_Start_Date__c=Date.valueOf('2023-03-20'), 
            Payment_Amount__c=123.45, Total_Debt_Amount__c=123.45, Country='United States',
            Alternate_Email__c='john.sample@company.com', Credit_Score__c=558, Street='Suite 300, The landmark @ One Market',
            Payment_Term__c = '12', Setup_Fee__c = '850', Settlement_Percentage__c = '44', Retainer_Percentage__c = '5', 
            Program_Fee_Percentage__c = '22', Creditor_1_Name__c = 'Test Creditor Name', Creditor_1_Total_Debt__c = 300, 
            Creditor_1_Payment__c = 200, Creditor_1_Payment_Frequency__c = 'Weekly', Creditor_10_Name__c = 'Creditor Test Name', 
            Creditor_10_Total_Debt__c = 500, Call_Received_By__c = UserInfo.getUserId(), Call_Received_Date__c = System.today(),
            CloserLookup__c=UserInfo.getUserId(),
            Call_Received_By_Lookup__c = UserInfo.getUserId(),
            LeadSource = 'Web', Closer__c = UserInfo.getUserId(), Industry = 'Technology'
        );
        leadInstance.RecordTypeId = LeadUtil.getRecordTypeId(LeadUtil.RT_LIST_LEAD);
        LeadTriggerHandler.preventRecursion = true;
        insert leadInstance;

        Lead leadInstance2 = new Lead(
            FirstName='Test', LastName='Lead Julia2', Email='john1@company.com', CurrentGenerators__c = 'Generators',
            Lenders__c='Lenders - ABC Company', Phone='4166661216', City='San Francisco', SSN__c = '765432189', NumberofLocations__c = 100,
            State='California', Work_Phone__c='4166661211', Current_Payment_Amount__c=123.45, Call_counter__c=16500, Country_Code__c=119, 
            EIN_Number_Tax_Id__c='876543875', Monthly_Revenue__c=123.45, PostalCode='94105', Company='XYZ Company Test', 
            MCA_Amount__c=123.45, Date_Of_Birth__c=Date.valueOf('1997-03-17'), MCA_Amount_Requested__c=123.45, Status='Open - Not Contacted', 
            Frequency__c='Weekly', UCC_filing_Date__c=Date.valueOf('2023-03-21'), Business_Start_Date__c=Date.valueOf('2023-03-20'), 
            Payment_Amount__c=123.45, Total_Debt_Amount__c=123.45, Country='United States',
            Alternate_Email__c='john.sample@company.com', Credit_Score__c=558, Street='Suite 300, The landmark @ One Market',
            Payment_Term__c = '12', Setup_Fee__c = '850', Settlement_Percentage__c = '44', Retainer_Percentage__c = '5', 
            Program_Fee_Percentage__c = '22', Creditor_1_Name__c = 'Test Creditor Name', Creditor_1_Total_Debt__c = 300, 
            CloserLookup__c=UserInfo.getUserId(),
            Call_Received_By_Lookup__c = UserInfo.getUserId(),
            Creditor_1_Payment__c = 200, Creditor_1_Payment_Frequency__c = 'Weekly', Creditor_10_Name__c = 'Creditor Test Name', 
            Creditor_10_Total_Debt__c = 500, Call_Received_By__c = UserInfo.getUserId(), Call_Received_Date__c = System.today(),
            LeadSource = 'Web', Closer__c = UserInfo.getUserId(), Industry = 'Technology'
        );
        leadInstance2.RecordTypeId = LeadUtil.getRecordTypeId(LeadUtil.RT_WEB_LEAD);
        LeadTriggerHandler.preventRecursion = true;
        insert leadInstance2;
    }

    @isTest
    static void testArchiveDupeLeads() {
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
        List<Lead> leads = [SELECT Id FROM Lead ORDER BY Id LIMIT 1];
        test.startTest();
        Database.LeadConvert lc = new Database.LeadConvert();
        lc.setLeadId(leads[0].Id);
        LeadStatus convertStatus = [SELECT Id, MasterLabel FROM LeadStatus WHERE IsConverted=true LIMIT 1];
        lc.setConvertedStatus(convertStatus.MasterLabel);
        Database.LeadConvertResult lcr = Database.convertLead(lc);
        
        Database.executeBatch(new Batch_ArchiveDupeLeadsOfConvertedLeads());
        test.stopTest();
        List<Lead> leadsToVerify = [SELECT Id, Archived_Duplicate_Leads__c, Status FROM Lead ORDER BY Id];
        Assert.areEqual(true, leadsToVerify[0].Archived_Duplicate_Leads__c, 'Verify the Lead is updated with archived duplicate leads flag true');
        //Assert.areEqual('Archive Disposition', leadsToVerify[1].Status, 'Verify the duplicate lead is archived');
    }

    public class MockHttpResponseGenerator implements HttpCalloutMock {

        public HttpResponse respond(HttpRequest request) {
            return new HttpResponse();
        }
    }
}