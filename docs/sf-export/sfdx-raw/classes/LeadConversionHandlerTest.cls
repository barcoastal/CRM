@isTest
private class LeadConversionHandlerTest {

    @TestSetup
    static void makeData(){      
        
        RAMS_Settings__c settings = new RAMS_Settings__c();
        settings.Name = 'RAM Settings';
        settings.Endpoint__c = 'https://example.com/api';
        settings.APIKey__c = 'testApiKey';
        settings.Affiliate_ID__c = '1234';
        settings.Fee_Split_Group_ID__c = '1234';
        insert settings;
        
        Payment_Processor__c processor = new Payment_Processor__c(Name = 'SAS', Processor_Type__c = 'SAS');
        insert processor;

        Payment_Processor__c procRam = DataFactoryTest.createPaymentProcessor();
        procRam.Processor_Type__c = 'RAM';
        insert procRam;
        
        Lead leadInstance = new Lead(
            FirstName = 'Test',
            LastName = 'Lead Julia',
            Email = 'john@company.com',
            CurrentGenerators__c = 'Generators',
            Lenders__c = 'Lenders - ABC Company',
            Phone = '4166661216',
            SSN__c = '765432189',
            NumberofLocations__c = 100,
            Work_Phone__c = '4166661211',
            Current_Payment_Amount__c = 123.45,
            Call_counter__c = 16500,
            Country_Code__c = 119,
            EIN_Number_Tax_Id__c = '876543875',
            Monthly_Revenue__c = 123.45,
            Company = 'XYZ Company Test',
            MCA_Amount__c = 123.45,
            Date_Of_Birth__c = Date.valueOf('1997-03-17'),
            MCA_Amount_Requested__c = 123.45,
            Status = 'Open - Not Contacted',
            Frequency__c = 'Weekly',
            UCC_filing_Date__c = Date.valueOf('2023-03-21'),
            Business_Start_Date__c = Date.valueOf('2023-03-20'),
            Payment_Amount__c = 123.45,
            Total_Debt_Amount__c = 123.45,
            Country = 'United States',
            Alternate_Email__c = 'john.sample@company.com',
            Credit_Score__c = 558,
            Street = 'Suite 300, The landmark @ One Market',
            City = 'San Francisco',
            State = 'California',
            PostalCode = '94105',
            Payment_Term__c = '12',
            Setup_Fee__c = '850',
            Settlement_Percentage__c = '44',
            Retainer_Percentage__c = '5',
            Program_Fee_Percentage__c = '22',
            Creditor_1_Name__c = 'Test Creditor Name',
            Creditor_1_Total_Debt__c = 300,
            Creditor_1_Payment__c = 200,
            Creditor_1_Payment_Frequency__c = 'Weekly',
            Creditor_10_Name__c = 'Creditor Test Name',
            Creditor_10_Total_Debt__c = 500,
            Call_Received_By__c = UserInfo.getUserId(),
            Call_Received_Date__c = System.today(),
            LeadSource = 'Web',
            Closer__c = UserInfo.getUserId(),
            CloserLookup__c=UserInfo.getUserId(),
            Call_Received_By_Lookup__c = UserInfo.getUserId(),
            Industry = 'Technology',
            Outbound_ANI_From__c = '123456789',
            Outbound_ANI_Identifier__c = '123456789',
            Outbound_ANI_Date__c = date.today()
        );
        LeadTriggerHandler.preventRecursion = true;
        insert leadInstance;

        Product2 product2Record = DataFactoryTest.createProduct();
        insert product2Record;

        Id pricebookId = Test.getStandardPricebookId();

        PricebookEntry pricebookEntryStd = DataFactoryTest.createPriceBookEntryId(pricebookId, product2Record.Id);
        insert pricebookEntryStd;

        Pricebook2 pricebookRecord = DataFactoryTest.createPriceBook();
        insert pricebookRecord;

        PricebookEntry pricebookEntry = DataFactoryTest.createPriceBookEntryId(pricebookRecord.Id, product2Record.Id);
        insert pricebookEntry;
    }

    @IsTest
    static void testPostLeadConversion(){

        Id leadId = [SELECT Id FROM Lead LIMIT 1].Id;
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
        
        Database.LeadConvert lc = new Database.LeadConvert();
        lc.setLeadId(leadId);

        LeadStatus convertStatus = [SELECT Id, MasterLabel FROM LeadStatus WHERE IsConverted=true LIMIT 1];
        lc.setConvertedStatus(convertStatus.MasterLabel);

        Database.LeadConvertResult lcr = Database.convertLead(lc);
        Test.stopTest();

        System.assert(lcr.isSuccess());
        System.assertNotEquals(null, lcr.getAccountId());
        System.assertNotEquals(null, lcr.getContactId());
        System.assertNotEquals(null, lcr.getOpportunityId());

        Account convertedAcct = [SELECT Id, SSN__c, Business_Start_Date__c, Lead_Number__c, EIN_Number_Tax_Id__c, Primary_Contact__c, Lead_Created_Date__c, 
        Monthly_Revenue__c, NumberofLocations__c, UCC_Filing_Date__c, Work_Phone__c, RecordType.Name FROM Account WHERE Id = :lcr.getAccountId() LIMIT 1];

        Contact convertedCont = [SELECT Id, SSN_Encrypted__c, Alternate_Email__c, Lead_Number__c, Credit_Score__c FROM Contact WHERE Id = :lcr.getContactId() LIMIT 1];

        Opportunity convertedOppty = [SELECT Id, Name, Lead_Id__c, CurrentGenerators__c, Phone__c, Lead_Created_Date__c  
        FROM Opportunity WHERE Id = :lcr.getOpportunityId()  LIMIT 1];

        Program_Plan__c programPlan = [SELECT Id, Opportunity__c, Client__c, Payment_Frequency__c, Payment_Term__c, Setup_Fee__c,
        Settlement_Percentage__c, Retainer_Percentage__c, Program_Fee_Percentage__c, First_Payment_Date__c, Payment_Processor__r.Name
        FROM Program_Plan__c WHERE Opportunity__c = :lcr.getOpportunityId() AND Client__c = :lcr.getAccountId() LIMIT 1];

        List<Debt_Details__c> debtDetails = [SELECT Id, Program_Plan__c, Creditor_Name__c, Debt_Amount__c, Payment__c,
        Payment_Frequency__c FROM Debt_Details__c WHERE Opportunity__c = :lcr.getOpportunityId()];

        System.assertEquals('765432189', convertedAcct.SSN__c);
        System.assertEquals(convertedCont.Id, convertedAcct.Primary_Contact__c);
        System.assertEquals(Date.valueOf('2023-03-20'), convertedAcct.Business_Start_Date__c);
        Assert.isNotNull(convertedAcct.Lead_Number__c);
        System.assertEquals('876543875', convertedAcct.EIN_Number_Tax_Id__c);
        System.assertEquals(123.45, convertedAcct.Monthly_Revenue__c);
        System.assertEquals(100, convertedAcct.NumberofLocations__c);
        System.assertEquals(Date.valueOf('2023-03-21'), convertedAcct.UCC_Filing_Date__c);
        System.assertEquals('4166661211', convertedAcct.Work_Phone__c);
        System.assertEquals('Business Account', convertedAcct.RecordType.Name);
        System.assertEquals(System.today(), convertedAcct.Lead_Created_Date__c.date());
        System.assertEquals('765432189', convertedCont.SSN_Encrypted__c);
        System.assertEquals('john.sample@company.com', convertedCont.Alternate_Email__c);
        Assert.isNotNull(convertedCont.Lead_Number__c);
        System.assertEquals(558, convertedCont.Credit_Score__c);
        System.assertEquals(System.today(), convertedOppty.Lead_Created_Date__c.date());
        Assert.isNotNull(convertedOppty.Lead_Id__c);
        System.assertEquals('Generators', convertedOppty.CurrentGenerators__c);
        System.assertEquals('Test Lead Julia', convertedOppty.Name);
        System.assertEquals('4166661216', convertedOppty.Phone__c);
        System.assertEquals('Weekly', programPlan.Payment_Frequency__c);
        System.assertEquals('12', programPlan.Payment_Term__c);
        System.assertEquals('850', programPlan.Setup_Fee__c);
        System.assertEquals('44', programPlan.Settlement_Percentage__c);
        System.assertEquals('5', programPlan.Retainer_Percentage__c);
        System.assertEquals('22', programPlan.Program_Fee_Percentage__c);
        System.assertEquals(System.today().addDays(2), programPlan.First_Payment_Date__c);
        System.assertEquals(2, debtDetails.size());
        System.assertEquals(programPlan.Id, debtDetails[0].Program_Plan__c);
        System.assertEquals('Test Creditor Name', debtDetails[0].Creditor_Name__c);
        System.assertEquals(300, debtDetails[0].Debt_Amount__c);
        System.assertEquals(200, debtDetails[0].Payment__c);
        System.assertEquals('Weekly', debtDetails[0].Payment_Frequency__c);
        System.assertEquals('Creditor Test Name', debtDetails[1].Creditor_Name__c);        
        System.assertEquals(500, debtDetails[1].Debt_Amount__c);

        List<OpportunityLineItem> oppLineItems = [SELECT Id FROM OpportunityLineItem WHERE OpportunityId = :lcr.getOpportunityId()];
        Assert.isTrue(!oppLineItems.isEmpty(), 'Verifying the Opportunity Item is created');
    }

    @isTest
    static void removeLeadsFromFive9Test(){
        
        Id leadId = [SELECT Id FROM Lead LIMIT 1].Id;

        Five9LSP__Five9_List__c five9List = DataFactoryTest.createFive9List();
        insert five9List;

        Lead leadInstance = new Lead(Id = leadId, Five9_List_Id__c = five9List.Id);
        update leadInstance;
        
        Test.startTest();
        LeadTriggerHandler.preventRecursion = true;
        Database.LeadConvert lc = new Database.LeadConvert();
        lc.setLeadId(leadId);

        LeadStatus convertStatus = [SELECT Id, MasterLabel FROM LeadStatus WHERE IsConverted=true LIMIT 1];
        lc.setConvertedStatus(convertStatus.MasterLabel);

        Database.LeadConvertResult lcr = Database.convertLead(lc);
        Test.stopTest();

        Lead leadToVerify = [SELECT Id, Five9_List_Id__c FROM Lead WHERE Id = :leadId LIMIT 1];
        /*Assert.isNull(
            [SELECT Id, Five9_List_Id__c FROM Lead WHERE Id = :leadId LIMIT 1].Five9_List_Id__c, 
            'Verify the five9 list Id is removed'
        );*/
    }
    
    public class MockHttpResponseGenerator implements HttpCalloutMock {

        public HttpResponse respond(HttpRequest request) {
            return new HttpResponse();
        }
    }

    /**
     * @description: Validate the scneario of updating the payment processor to SAS if the state is updated to SAS's specific state
    **/
    @isTest
    public static void LeadConversion_PaymentProcVerificationSAS() {
        Id leadId = [SELECT Id FROM Lead LIMIT 1].Id;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
        Database.LeadConvert leadConvert = new Database.LeadConvert();
        leadConvert.setLeadId(leadId);
        List<LeadStatus> convertStatuses = [SELECT Id, MasterLabel FROM LeadStatus WHERE IsConverted = true LIMIT 1];
        leadConvert.setConvertedStatus(convertStatuses[0].MasterLabel);
        Database.LeadConvertResult lcr = Database.convertLead(leadConvert);
        Test.stopTest();
        List<Account> acctList = [SELECT Id FROM Account];
        System.assert(acctList.size() == 1, 'Validating the account is created');
        List<Opportunity> oppList = [SELECT Id FROM Opportunity WHERE AccountId = :acctList[0].Id];
        System.assert(oppList.size() == 1, 'Validating the opportunity is created');
        List<Program_Plan__c> prgmPlans = [SELECT Id, Payment_Processor__r.Processor_Type__c FROM Program_Plan__c WHERE Opportunity__c = :oppList[0].Id];
        System.assert(prgmPlans.size() == 1, 'Validating the program plan is created');
        System.assertEquals('SAS', prgmPlans[0].Payment_Processor__r.Processor_Type__c, 'Verifying the Payment Processor');
    }

    /**
     * @description: Validate the scneario of updating the payment processor to RAM if the state is updated to RAM's specific state
    **/
    @isTest
    public static void LeadConversion_PaymentProcVerificationRAM() {
        Lead leadRecord = [SELECT Id FROM Lead LIMIT 1];
        leadRecord.State = 'New York';
        update leadRecord;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
        Database.LeadConvert leadConvert = new Database.LeadConvert();
        leadConvert.setLeadId(leadRecord.Id);
        List<LeadStatus> convertStatuses = [SELECT Id, MasterLabel FROM LeadStatus WHERE IsConverted = true LIMIT 1];
        leadConvert.setConvertedStatus(convertStatuses[0].MasterLabel);
        Database.LeadConvertResult lcr = Database.convertLead(leadConvert);
        Test.stopTest();
        List<Account> acctList = [SELECT Id FROM Account];
        System.assert(acctList.size() == 1, 'Validating the account is created');
        List<Opportunity> oppList = [SELECT Id FROM Opportunity WHERE AccountId = :acctList[0].Id];
        System.assert(oppList.size() == 1, 'Validating the opportunity is created');
        List<Program_Plan__c> prgmPlans = [SELECT Id, Payment_Processor__r.Processor_Type__c FROM Program_Plan__c WHERE Opportunity__c = :oppList[0].Id];
        System.assert(prgmPlans.size() == 1, 'Validating the program plan is created');
        System.assertEquals('RAM', prgmPlans[0].Payment_Processor__r.Processor_Type__c, 'Verifying the Payment Processor');
    }
    @isTest
    public static void LeadConversion_NoAddress() {
    Lead leadInstance = new Lead(
        FirstName = 'Julius',
        LastName = 'Caesar',
        Email = 'john@company.com',
        CurrentGenerators__c = 'Generators',
        Lenders__c = 'Lenders - ABC Company',
        Phone = '4166661216',
        SSN__c = '765432189',
        NumberofLocations__c = 100,
        Work_Phone__c = '4166661211',
        Current_Payment_Amount__c = 123.45,
        Call_counter__c = 16500,
        Country_Code__c = 119,
        EIN_Number_Tax_Id__c = '876543875',
        Monthly_Revenue__c = 123.45,
        Company = 'XYZ Company Test',
        MCA_Amount__c = 123.45,
        Date_Of_Birth__c = Date.valueOf('1997-03-17'),
        MCA_Amount_Requested__c = 123.45,
        Status = 'Open - Not Contacted',
        Frequency__c = 'Weekly',
        UCC_filing_Date__c = Date.valueOf('2023-03-21'),
        Business_Start_Date__c = Date.valueOf('2023-03-20'),
        Payment_Amount__c = 123.45,
        Total_Debt_Amount__c = 123.45,
        Country = 'United States',
        Alternate_Email__c = 'john.sample@company.com',
        Credit_Score__c = 558,
        Street = 'Suite 300, The landmark @ One Market',
        City = 'San Francisco',
        State = 'California',
        PostalCode = '94105',
        Payment_Term__c = '12',
        Setup_Fee__c = '850',
        Settlement_Percentage__c = '44',
        Retainer_Percentage__c = '5',
        Program_Fee_Percentage__c = '22',
        Creditor_1_Name__c = 'Test Creditor Name',
        Creditor_1_Total_Debt__c = 300,
        Creditor_1_Payment__c = 200,
        Creditor_1_Payment_Frequency__c = 'Weekly',
        Creditor_10_Name__c = 'Creditor Test Name',
        Creditor_10_Total_Debt__c = 500,
        Call_Received_By__c = UserInfo.getUserId(),
        Call_Received_Date__c = System.today(),
        LeadSource = 'Web',
        Closer__c = UserInfo.getUserId(),
        CloserLookup__c=UserInfo.getUserId(),
        Call_Received_By_Lookup__c = UserInfo.getUserId(),
        Industry = 'Technology',
        Outbound_ANI_From__c = '123456789',
        Outbound_ANI_Identifier__c = '123456789',
        Outbound_ANI_Date__c = date.today()
    );
        LeadTriggerHandler.preventRecursion = true;
        insert leadInstance;
        Lead leadRecord = [SELECT Id FROM Lead WHERE LastName = 'Caesar' LIMIT 1];
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
            Database.LeadConvert leadConvert = new Database.LeadConvert();
            leadConvert.setLeadId(leadRecord.Id);
            List<LeadStatus> convertStatuses = [SELECT Id, MasterLabel FROM LeadStatus WHERE IsConverted = true LIMIT 1];
            leadConvert.setConvertedStatus(convertStatuses[0].MasterLabel);
            Database.LeadConvertResult lcr = Database.convertLead(leadConvert);
        Test.stopTest();
        List<Account> acctList = [SELECT Id FROM Account];
        System.assert(acctList.size() == 1, 'Validating the account is created');
        List<Opportunity> oppList = [SELECT Id FROM Opportunity WHERE AccountId = :acctList[0].Id];
        System.assert(oppList.size() == 1, 'Validating the opportunity is created');
        List<Program_Plan__c> prgmPlans = [SELECT Id, Payment_Processor__r.Processor_Type__c FROM Program_Plan__c WHERE Opportunity__c = :oppList[0].Id];
        System.assert(prgmPlans.size() == 1, 'Validating the program plan is created');
        System.assertEquals('SAS', prgmPlans[0].Payment_Processor__r.Processor_Type__c, 'Verifying the Payment Processor');

    }
}