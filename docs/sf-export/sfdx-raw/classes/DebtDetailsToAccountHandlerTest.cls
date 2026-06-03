@isTest
public class DebtDetailsToAccountHandlerTest {
    @testSetup
    static void makeData() {
        Payment_Processor__c procSas = DataFactoryTest.createPaymentProcessor();
        insert procSas;
        Account acct = DataFactoryTest.createAccount();
        insert acct;
        Opportunity oppty = DataFactoryTest.createOpportunity();
        oppty.AccountId = acct.Id;
        insert oppty;
        Program_Plan__c pgmPlan = DataFactoryTest.createProgramplan(oppty.Id, acct.Id, procSas.id);
        insert pgmPlan;
        Debt_Details__c debtDetails = DataFactoryTest.createDebtDetails(pgmPlan.id);
        debtDetails.Account__c = oppty.AccountId;
        debtDetails.Opportunity__c = oppty.Id;
        insert debtDetails;
    }
    
    @isTest
    static void testLegalStatusAssignment(){
        Debt_Details__c debt = [Select Id,Account__c,Legal_Status__c from Debt_Details__c limit 1];
        debt.Legal_Status__c = 'UCC Lien';
        update debt;
        Account acc = [Select id,Legal_Status__c from Account where id=:debt.Account__c];
        assert.isNotNull(acc.Legal_Status__c, 'Legal Status should not be null');
    }
}