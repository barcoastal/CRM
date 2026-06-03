@IsTest
private class RAMWrapperTest {

    @IsTest
    static void testStaticMapsAndMethods() {
        
        Test.startTest();
        Assert.areEqual('CONSUMER_DEBIT_CHECKING', RAMWrapper.ACCOUNT_TYPE_MAP.get('Checking'), 'Expected account type is not matching.');
        Assert.areEqual('ACTIVE', RAMWrapper.ACCOUNT_STATUS_MAP.get('Active'), 'Expected account status is not matching.');
        Assert.areEqual('CONSUMER_DEBIT_CHECKING', RAMWrapper.getBankAccountType('Checking'), 'Expected Bank Account type is not matching.');
        Assert.areEqual('ACTIVE', RAMWrapper.getAccountStatus('Active'), 'Expected Account status is not matching.');
        Assert.areEqual(null, RAMWrapper.getBankAccountType('unknown'), 'Expected Bank Account type is not matching.');
        Assert.areEqual(null, RAMWrapper.getAccountStatus('unknown'), 'Expected Account status is not matching.');
        Test.stopTest();
    }

    @IsTest
    static void testCreateClientMapAndRequiredFieldList() {
        
        Test.startTest();
        Assert.areEqual('ClientID', RAMWrapper.createClientMap.get('clientNumber'), 'Expected parameter is not matching.');
        Assert.areEqual('Firstname', RAMWrapper.createClientMap.get('firstName'), 'Expected parameter is not matching.');
        Test.stopTest();
    }
}