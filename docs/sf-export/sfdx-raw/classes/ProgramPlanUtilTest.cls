@IsTest
private class ProgramPlanUtilTest {
    
    @IsTest
    static void testGetSObjName(){
       System.assertEquals('Program_Plan__c', new ProgramPlanUtil().getSObjName());
    }

    @IsTest
    static void testGetSObjLabel(){
        System.assertEquals('Program Plan', new ProgramPlanUtil().getSObjLabel());
    }

    @IsTest
    static void testGetFieldsetDetails(){
        System.assertEquals(null, new ProgramPlanUtil().getFieldsetDetails('Invalid Field Set Name'));
    }
}