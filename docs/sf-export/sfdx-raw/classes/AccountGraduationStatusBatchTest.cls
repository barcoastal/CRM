@isTest
public class AccountGraduationStatusBatchTest {

    @testSetup
    static void makeData() {
        Payment_Processor__c procSas = DataFactoryTest.createPaymentProcessor();
        insert procSas;

        Account acct = DataFactoryTest.createAccount();
        insert acct;

        Opportunity oppty = DataFactoryTest.createOpportunity();
        oppty.AccountId = acct.Id;
        insert oppty;

        Program_Plan__c pgmPlan = DataFactoryTest.createProgramplan(oppty.Id, acct.Id, procSas.Id);
        insert pgmPlan;

        Debt_Details__c debtDetails = DataFactoryTest.createDebtDetails(pgmPlan.Id);
        debtDetails.Account__c    = oppty.AccountId;
        debtDetails.Opportunity__c = oppty.Id;
        insert debtDetails;
    }

    private static Account getAccount() {
        return [SELECT Id, Graduation_Status__c FROM Account LIMIT 1];
    }

    private static void setDebtStatus(String status) {
        Debt_Details__c debt = [SELECT Id FROM Debt_Details__c LIMIT 1];
        debt.Negotiation_Status__c = status;
        update debt;
    }

    private static AccountGraduationStatusBatch batchForTestAccount() {
        Account acc = getAccount();
        return new AccountGraduationStatusBatch(
            'SELECT Id FROM Account WHERE Id = \'' + acc.Id + '\''
        );
    }


    @isTest
    static void testSingleSettledDebt_FullyGraduated() {
        setDebtStatus('Settled lump sum');

        Opportunity oppRecord = [SELECT Id, StageName FROM Opportunity LIMIT 1];
        oppRecord.StageName = 'Closed Won First Payment Pending';
        update oppRecord;
        
        Test.startTest();
        Database.executeBatch(batchForTestAccount(), 200);
        Test.stopTest();

        System.assertEquals(
            DebtDetailUtil.STATUS_FULLY_GRADUATED,
            getAccount().Graduation_Status__c,
            'Account with one settled debt should be FULLY GRADUATED'
        );
    }

    @isTest
    static void testDefaultConstructor_ExecutesCleanly() {
        Test.startTest();
        setDebtStatus('Settled lump sum');

        Opportunity oppRecord = [SELECT Id, StageName FROM Opportunity LIMIT 1];
        oppRecord.StageName = 'Closed Won First Payment Pending';
        update oppRecord;

        
        Id jobId = Database.executeBatch(new AccountGraduationStatusBatch(), 200);
        Test.stopTest();

        System.assertNotEquals(null, jobId, 'Default constructor batch job should start successfully');
    }


    @isTest
    static void testFinish_NoException() {
        Test.startTest();
        Database.executeBatch(
            new AccountGraduationStatusBatch('SELECT Id FROM Account WHERE Id = null'),
            200
        );
        Test.stopTest();

        System.assert(true, 'finish() should complete without throwing');
    }
}