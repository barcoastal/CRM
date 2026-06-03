@isTest
public class AccountServiceTest {
    
    @testSetup
    static void makeData() {  
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        insert acctRecord;  
    }
    
    @isTest
    static void updateAccountData(){
        Account acc = [Select id,Closer__c,client_status__c from account limit 1];
        acc.client_status__c = AccountUtil.CLIENT_STATUS_WAITING_FIRST_PAYMENT;
        update acc;
        List<Account> accList = New List<Account>();
        accList.add(acc);
        AccountService accountService = new AccountService();
        accountService.updateAccountData(accList);
        Account updatedAcc = [Select id,Client_Status__c from Account where id =:acc.Id];
        Assert.areEqual(AccountUtil.CLIENT_STATUS_WAITING_FIRST_PAYMENT, updatedAcc.Client_Status__c);   
    }
}