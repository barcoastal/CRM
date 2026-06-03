@IsTest
public class CaseUtilTest {
   @TestSetup
    static void makeData(){
        Account acct = DataFactoryTest.createAccount();
        insert acct;
        
        Case cs = DataFactoryTest.createCase();
        insert cs;
        
    }
    @IsTest
    static void testGetSObjName(){        
        System.assertEquals('Case', new CaseUtil().getSObjName());
    }

    @IsTest
    static void testGetSObjLabel(){        
        System.assertEquals('Case', new CaseUtil().getSObjLabel());
    }
        
    @IsTest
    static void testgetRecordTypeId(){   
        Id result = CaseUtil.getRecordTypeId('Customer_Support');
        Assert.isNotNull(result);
    }
}