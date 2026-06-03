@IsTest
private class BankAccountWrapperTest {
    
    @IsTest
    public static void testBankAccountWrapper(){

        Contact contInstance = DataFactoryTest.createContact();
        insert contInstance;
        
        Account acctInstance = DataFactoryTest.createBusinessAccount();
        acctInstance.Name = 'John Tech LLC';
        acctInstance.SSN__c = '123456789';
        acctInstance.Phone = '123-456-7890';
        acctInstance.Lead_Number__c = '12345';
        acctInstance.Program_Start_Date__c = Date.today();
        acctInstance.Program_End_Date__c = Date.today().addDays(30);
        acctInstance.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'Business_Account');
        acctInstance.Bank_Account_Number__c = '1234567890';
        acctInstance.Bank_Routing_Number__c = '123456789';
        acctInstance.Bank_Account_Type__c = 'Checking';
        acctInstance.Bank_Name__c = 'Test Bank';
        acctInstance.External_RAM_Id__c = '123123123';
        acctInstance.Primary_Contact__c = contInstance.Id;
        insert acctInstance;

        Test.startTest();
        BankAccountWrapper bankAccountWrap = new BankAccountWrapper(
            ProcessorAPI.getAccountDetailsWithoutSyncStatusFilter(acctInstance.Id), 
            'RAM'
        );
        Test.stopTest();

        Assert.areEqual('Checking', bankAccountWrap.bankAccountType, 'Expected value in bank account wrapper is not matching.');
        Assert.areEqual(acctInstance.Id, bankAccountWrap.recordId);
        Assert.areEqual('ACH', bankAccountWrap.paymentType);
        Assert.areEqual('1234567890', bankAccountWrap.bankAccountNumber);
        Assert.areEqual('123456789', bankAccountWrap.routingNumber);
        Assert.areEqual('Jane Smith' ,bankAccountWrap.nameOnAccount);
        Assert.areEqual('123123123', bankAccountWrap.clientProcessorId);
        Assert.areEqual('Checking', bankAccountWrap.bankAccountType);
        Assert.areEqual('Test Bank', bankAccountWrap.bankName);
        Assert.isNotNull(bankAccountWrap.clientNumber);
    }
}