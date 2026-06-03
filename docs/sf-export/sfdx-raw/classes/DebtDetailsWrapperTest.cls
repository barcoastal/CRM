@IsTest
private class DebtDetailsWrapperTest {

    @IsTest
    static void testDebtDetailsWrapper() {
        List<Account> accounts = new List<Account>();
        // Create test Account records for original and current creditors
        Account originalCreditor = new Account(Name = 'Original Creditor');
        originalCreditor.RecordTypeId = AccountUtil.getRecordTypeId(AccountUtil.RT_CREDITOR);
        originalCreditor.Creditor_Category__c = 'Citadel';
        accounts.add(originalCreditor);
        //insert originalCreditor;
        Account currentCreditor = new Account(Name = 'Current Creditor');
        currentCreditor.RecordTypeId = AccountUtil.getRecordTypeId(AccountUtil.RT_CREDITOR);
        currentCreditor.Creditor_Category__c = 'Citadel';
        accounts.add(currentCreditor);
        //insert currentCreditor;
        insert accounts;
        
        // Create a test Opportunity record
        Opportunity opportunity = new Opportunity(
            Name = 'Test Opportunity', StageName = 'Prospecting', CloseDate = Date.today() + 30
        );
        insert opportunity;
        
        // Create a test Debt_Details__c record
        Debt_Details__c debtDetails = new Debt_Details__c();
        debtDetails.Original_Creditor__c = accounts[0].Id;
        debtDetails.Current_Creditor__c = accounts[1].Id;
        debtDetails.Debt_Amount__c = 1000;
        debtDetails.Opportunity__c = opportunity.Id;
        insert debtDetails;

        Test.startTest();
        List<Debt_Details__c> debtDetailList = DebtDetailsData.getDebtDetailByOppId(opportunity.Id);
        
        // Create an instance of the DebtDetailsWrapper
        DebtDetailsWrapper wrapper = new DebtDetailsWrapper(debtDetailList[0]);
        Test.stopTest();

        // Assert the values assigned in the wrapper
        System.assertEquals(accounts[0].Id, wrapper.originalCreditorId);
        System.assertEquals(accounts[1].Id, wrapper.currentCreditorId);
        System.assertEquals(originalCreditor.Name, wrapper.originalCreditor);
        System.assertEquals(currentCreditor.Name, wrapper.currentCreditor);
        System.assertEquals(1000, wrapper.debtAmount);
    }
}