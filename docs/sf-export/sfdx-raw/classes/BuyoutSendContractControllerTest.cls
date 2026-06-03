@isTest
public class BuyoutSendContractControllerTest {
    
    @testSetup
    static void makeData(){
        Account account = new Account(Name = 'XYZ COMPANY');
        insert account;
        Opportunity opportunity = new Opportunity(
            Name = 'Test Opportunity', StageName = 'Prospect', 
            CloseDate = Date.today(), AccountId = account.Id
        );
        insert opportunity;
        Payment_Processor__c paymentprocessor = new Payment_Processor__c(
            Processor_Type__c='SAS', Name='SAS'
        );
        insert paymentprocessor;         
        Program_Plan__c programPlan = new Program_Plan__c(
            Opportunity__c = opportunity.Id, Client__c = account.Id,
            Payment_Processor__c= paymentprocessor.Id            
        );
        insert programPlan;
        Draft__c draft = new Draft__c(
            Program_Plan__c = programPlan.Id, Draft_Status__c = 'Scheduled', Draft_Date__c = Date.today().addDays(3),
            Draft_Amount__c = 100, Retainer_Fee__c = 10, Setup_Fee__c = 20, Processor_Fee__c = 30, Service_Fee__c = 40,
            Program_Fee__c = 100
        );
        insert draft;
        
        Debt_Details__c debt1 = new Debt_Details__c(
            Opportunity__c = opportunity.Id, Debt_Amount__c = 50000, Creditor_Name__c = 'Test Creditor 1',Account__c=account.Id, 
            Payment__c = 1000, Payment_Frequency__c = 'Daily', Program_Plan__c = programPlan.Id
        );
        Debt_Details__c debt2 = new Debt_Details__c(
            Opportunity__c = opportunity.Id, Debt_Amount__c = 20000, Creditor_Name__c = 'Test Creditor 2',Account__c=account.Id, 
            Payment__c = 3000, Payment_Frequency__c = 'Weekly', Program_Plan__c = programPlan.Id
        );
        insert new List<Debt_Details__c>{ debt1, debt2 };  
    }
    
    @isTest
    static void testSendWithRedirect() {

        BuyoutSendContractController controller = new BuyoutSendContractController();
        Opportunity opp = [SELECT Id FROM Opportunity Limit 1];

        Test.startTest();
        Id mockTemplateId = opp.Id;
        String mockSId = 'mockSId';
        String mockRecordId = 'mockRecordId';
        String mockTitle = 'mockTitle';
        String url = controller.sendWithRedirect(mockTemplateId, mockSId, mockRecordId, mockTitle);
        String expectedUrl = '/apex/sendcontract?recordId=mockRecordId&sId=mockSId&templateId='+opp.Id+'&title=mockTitle';
        Test.stopTest();

        Assert.areEqual(expectedUrl, url, 'Generated URL should be correct');
    }
    
    @isTest
    static void testGetSendContractDetails() {
        Opportunity opp = [SELECT Id FROM Opportunity Limit 1];
        dfsle__GenTemplate__c genTemp = new dfsle__GenTemplate__c();
        genTemp.Name = 'Opportunity_BuyoutSendContract_GenTemplate';
        genTemp.dfsle__Description__c = 'BuyoutSendContract';
        insert genTemp;

        Test.startTest();
        BuyoutSendContractController.SendContractWrapper wrap = BuyoutSendContractController.getSendContractDetails(opp.Id, 'Opportunity.Buyout_Send_Contract');
        Test.stopTest();

        //Assert.areEqual(genTemp.Id, wrap.genTemplateId);
        //Assert.areEqual('SendContract', wrap.genTemplateTitle);
    }

    @isTest
    static void testsaveContractDetails() {
        Account acc = [SELECT Id,Name,Primary_Contact__c, BillingState FROM Account Limit 1];
        acc.Name = 'Test Account';
        acc.Actual_Program_Term__c = 10;
        acc.Actual_Weekly_Payment__c = 5000;
        update acc;
        
        Contact testContact = new Contact(
            AccountId = acc.Id, FirstName = 'John', LastName = 'Doe', Email = 'johndoe@test.com', 
            MailingStreet = '123 Main St', MailingCity = 'Test City', MailingState = 'California',
            MailingPostalCode = '12345', MailingCountry = 'United States', Lead_Number__c = '123',
            Phone = '9087654321', MobilePhone = '4230987654'
        );
        insert testContact;
        
        Opportunity opp = [SELECT Id,Name FROM Opportunity Limit 1];      
        opp.Name = 'Test Opportunity';
        
        Financial_Summary__c financialSummary = new Financial_Summary__c();
        financialSummary.Actual_Weekly_Payment__c = 2000;
        financialSummary.Account__c = acc.Id;
        financialSummary.Opportunity__c = opp.Id;
        insert financialSummary;
        
        Program_Plan__c programPlan = [SELECT Id, Name, First_Payment_Date__c FROM Program_Plan__c Limit 1];
        try{
        Test.startTest();
            testContact.Email = 'test@gmail.com';
            update testContact;            
            programPlan.First_Payment_Date__c = System.today().addDays(3);
            update programPlan;
            BuyoutSendContractController.saveContractDetails(acc, testContact, opp, programPlan);
        Test.stopTest();
        }catch(Exception ex){
            System.debug('-------->'+ ex.getMessage());
        }
        
        //Assert.areEqual([SELECT Id,Name FROM Opportunity Limit 1].Name ,'Test Opportunity');
    }

    @isTest
    static void testsaveContractDetailsBusinessStateValidation() {
        Account acc = [SELECT Id, BillingState FROM Account Limit 1];
        acc.Actual_Program_Term__c = null;
        acc.Actual_Weekly_Payment__c = null;
        update acc;       
        
        Contact testContact = new Contact(
            AccountId = acc.Id, FirstName = 'John', LastName = 'Doe', Email = 'johndoe@test.com', 
            MailingStreet = '123 Main St', MailingCity = 'Test City', MailingState = 'California',
            MailingPostalCode = '12345', MailingCountry = 'United States', Lead_Number__c = '123',
            Phone = '9087654321', MobilePhone = '4230987654'
        );
        Opportunity opp = [SELECT Id,Name FROM Opportunity Limit 1];      
        opp.Name = 'Test Opportunity';
        
        Program_Plan__c programPlan = [SELECT Id, Name, First_Payment_Date__c FROM Program_Plan__c Limit 1];
        programPlan.First_Payment_Date__c = System.today().addDays(10);
        
        String errorMessage;
        Test.startTest();
        try {
            acc.BillingState = 'Washington';
            acc.Actual_Program_Term__c = 20;
            acc.Actual_Weekly_Payment__c = 3000;
            BuyoutSendContractController.saveContractDetails(acc, testContact, opp, programPlan);
        } catch (Exception e) {
            errorMessage = e.getMessage();
        }
        Test.stopTest();
        //Assert.areEqual(true, errorMessage.contains(System.Label.Sent_Contract_State_Validation), 'Expected no business state validation error message.');
    }
}