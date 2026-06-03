@isTest
public class QualifiedFinancialControllerTest {
    
    @testSetup
    static void makeData(){
        Account account = new Account(Name = 'XYZ COMPANY',Net_Profit__c= 1);
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
    static void updateAccount() {

        Opportunity opp = [SELECT Id, AccountId FROM Opportunity Limit 1];

        Test.startTest();        
        QualifiedFinancialController.getAccountDetails(opp.AccountId);
        Test.stopTest();
    }
    
    @isTest
    static void testCustomException() {
        
        Account account = new Account(Name = 'XYZ COMPANY1');
        insert account;
        try{
        Test.startTest();        
        QualifiedFinancialController.getAccountDetails(account.Id);
        Test.stopTest();
        }catch(Exception ex){
        
        }
    }
}