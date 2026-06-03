@IsTest
private class AccountUtilTest {
    @TestSetup
    static void makeData(){
        Account acct = DataFactoryTest.createAccount();
        insert acct;
    }
    @IsTest
    static void testGetSObjName(){        
        System.assertEquals('Account', new AccountUtil().getSObjName());
    }

    @IsTest
    static void testGetSObjLabel(){        
        System.assertEquals('Account', new AccountUtil().getSObjLabel());
    }
     @IsTest
    static void testIsAccountId(){   
        Account acc = [Select id from Account limit 1];
        Boolean result = AccountUtil.isAccountId(acc.id);
        Assert.areEqual(true, result);
    }
    
    @IsTest
    static void testgetRecordTypeId(){   
        Id result = AccountUtil.getRecordTypeId('Client');
        Assert.isNotNull(result);
    }
    
}