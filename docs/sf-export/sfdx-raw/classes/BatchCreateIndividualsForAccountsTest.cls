@IsTest
public class BatchCreateIndividualsForAccountsTest {
    
    @testSetup
    public static void testSetup(){
        
        // Create test data
    }
    
    @IsTest
    public static void testBatchCreateIndividualRecords(){
        
        // Run the batch job
        Test.startTest();
        Id recordTypeBussinessAccount = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName()
          .get('Business_Account')
          .getRecordTypeId();
        // Create test data
        List<Account> Accounts = new List<Account>();
        for (Integer i = 0; i < 200; i++) {
            Accounts.add(new Account(
                Name = 'Account' + i,
                Phone = '1234567890',
                RecordTypeId = recordTypeBussinessAccount
            ));
        }
        AccountHandler.byPassAccountTrigger = true;
        insert Accounts;
        BatchCreateIndividualsForAccounts batchJob = new BatchCreateIndividualsForAccounts();
        Id batchId = Database.executeBatch(batchJob);
        Test.stopTest();
        
        // Verify the results
        List<Account> accountsList = [SELECT Id, Individual__c FROM Account WHERE Individual__c != Null];
        System.assertEquals(200, accountsList.size(), 'Expected 200 Accounts to be created');
        for (Account account : accountsList) {
            System.assertNotEquals(null, account.Individual__c, 'Expected IndividualId to be populated for each Account');
        }
    }
}