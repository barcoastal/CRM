@IsTest
private class ContactUtilTest {
    
    @IsTest
    static void testGetSObjName(){        
        System.assertEquals('Contact', new ContactUtil().getSObjName());
    }

    @IsTest
    static void testGetSObjLabel(){        
        System.assertEquals('Contact', new ContactUtil().getSObjLabel());
    }
}