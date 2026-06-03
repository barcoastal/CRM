@isTest
private class FieldsetServiceTest {
    
    @IsTest
    static void testDescribeFieldsetDetails_Success(){
        
        Test.startTest();
        ApexActionResult result = FieldsetService.describeFieldsetDetails('Event', 'Event_Disposition');
        List<SObjectUtilHelper.FieldSetDetails> fieldsetDetailsList = new EventUtil().getFieldsetDetails('Event_Disposition');
        Test.stopTest();
        
        System.assertEquals(JSON.serialize(fieldsetDetailsList), result.data);    
        System.assertEquals('FieldsetService.describeFieldsetDetails', result.scope);  
        System.assertEquals(ApexActionResult.Statuses.SUCCESS, result.status);        
    }

    @IsTest
    static void testDescribeFieldsetDetails_Failure(){
        
        Test.startTest();
        ApexActionResult result = FieldsetService.describeFieldsetDetails('InvalidObject', null);
        Test.stopTest();
        
        System.assertEquals(ApexActionResult.Statuses.ERROR, result.status); 
        System.assertEquals('Fieldset Name should not be blank.', result.message);       
    }
}