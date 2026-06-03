@isTest
private class VendorDecryptionServiceTest {
    

    @isTest
    static void test_Decryption_Success() {
        Account acc = new Account(Name = 'Test Account');
        insert acc;

        Test.startTest();
        	VendorDecryptionService.getDecryptedAccountId(acc.Id);
        VendorDecryptionService.getDecryptedAccountId(null);
        Test.stopTest();

    }

}