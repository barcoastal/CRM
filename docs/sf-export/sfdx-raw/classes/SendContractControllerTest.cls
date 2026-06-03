@isTest
public class SendContractControllerTest {
    @testSetup
    static void makeData(){
        Account account = new Account(Name = 'XYZ COMPANY');
        insert account;
        Account creditroAcc = DataFactoryTest.createCreditorAccount();
        Opportunity opportunity = new Opportunity(
            Name = 'Test Opportunity', StageName = 'Prospect', 
            CloseDate = Date.today(), AccountId = account.Id
        );
        insert creditroAcc;
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
            Payment__c = 1000, Payment_Frequency__c = 'Daily', Program_Plan__c = programPlan.Id,Current_Creditor__c = creditroAcc.Id
        );
        Debt_Details__c debt2 = new Debt_Details__c(
            Opportunity__c = opportunity.Id, Debt_Amount__c = 20000, Creditor_Name__c = 'Test Creditor 2',Account__c=account.Id, 
            Payment__c = 3000, Payment_Frequency__c = 'Weekly', Program_Plan__c = programPlan.Id,Current_Creditor__c = creditroAcc.Id
        );
        insert new List<Debt_Details__c>{ debt1, debt2 };  
    }
    @isTest
    static void testSendWithRedirect() {
 
        SendContractController controller = new SendContractController();
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
        genTemp.Name = 'Opportunity_SendContract_GenTemplate';
        genTemp.dfsle__Description__c = 'SendContract';
        insert genTemp;
 
        Test.startTest();
        SendContractController.SendContractWrapper wrap = SendContractController.getSendContractDetails(opp.Id, 'Opportunity.Send_Contract');
        Test.stopTest();
 
        Assert.areEqual(genTemp.Id, wrap.genTemplateId);
        Assert.areEqual('SendContract', wrap.genTemplateTitle);
    }
 
    @isTest
    static void testGetQuickSendContractDetails() {
        Opportunity opp = [SELECT Id FROM Opportunity Limit 1];
        dfsle__GenTemplate__c genTemp = new dfsle__GenTemplate__c();
        genTemp.Name = 'Opportunity_QuickSendContract_GenTemplate';
        genTemp.dfsle__Description__c = 'QuickSendContract';
        insert genTemp;
 
        Test.startTest();
        SendContractController.SendContractWrapper wrap = SendContractController.getSendContractDetails(opp.Id, 'Opportunity.Quick_Send_Contract');
        Test.stopTest();
 
        Assert.areEqual(genTemp.Id, wrap.genTemplateId);
        Assert.areEqual('QuickSendContract', wrap.genTemplateTitle);
    }
 
    @isTest
    static void testsaveContractDetails() {
        Account acc = [SELECT Id,Name,Primary_Contact__c, BillingState FROM Account Limit 1];
        acc.Name = 'Test Account';
        Contact testContact = new Contact(
            AccountId = acc.Id, FirstName = 'John', LastName = 'Doe', Email = 'johndoe@test.com', 
            MailingStreet = '123 Main St', MailingCity = 'Test City', MailingState = 'California',
            MailingPostalCode = '12345', MailingCountry = 'United States', Lead_Number__c = '123',
            Phone = '9087654321', MobilePhone = '4230987654'
        );
        Opportunity opp = [SELECT Id,Name FROM Opportunity Limit 1];      
        opp.Name = 'Test Opportunity';
        Test.startTest();
        SendContractController.saveContractDetails(acc, testContact, opp);
        Test.stopTest();
        Assert.areEqual([SELECT Id,Name FROM Opportunity Limit 1].Name ,'Test Opportunity');
    }
 
    @isTest
    static void testsaveContractDetailsBusinessStateValidation() {
        Account acc = [SELECT Id, BillingState FROM Account Limit 1];
        acc.BillingState = 'Washington';
        Contact testContact = new Contact(
            AccountId = acc.Id, FirstName = 'John', LastName = 'Doe', Email = 'johndoe@test.com', 
            MailingStreet = '123 Main St', MailingCity = 'Test City', MailingState = 'California',
            MailingPostalCode = '12345', MailingCountry = 'United States', Lead_Number__c = '123',
            Phone = '9087654321', MobilePhone = '4230987654'
        );
        Opportunity opp = [SELECT Id,Name FROM Opportunity Limit 1];      
        opp.Name = 'Test Opportunity';
        String errorMessage;
        Test.startTest();
        try {
        SendContractController.saveContractDetails(acc, testContact, opp);
        } catch (Exception e) {
            errorMessage = e.getMessage();
        }
        Test.stopTest();
        Assert.areEqual(true, errorMessage.contains(System.Label.Sent_Contract_State_Validation), 'Expected no business state validation error message.');
    }
}