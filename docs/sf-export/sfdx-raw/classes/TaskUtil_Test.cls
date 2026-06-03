/*----------------------------------------------------------------
    Author: Vignesh
    Description: Test class of TaskUtil.cls

    History
    <Date>          <Authors Name>          <Brief Description of Change>    
    June-18-2023    Vignesh                  Initial Development         
    
--------------------------------------------------------------------*/
@isTest
public with sharing class TaskUtil_Test {
    @isTest
    static void verifySObjectName() {
        String sObjectName;
        Test.startTest();
        TaskUtil taskUtilClass = new TaskUtil();
        sObjectName = taskUtilClass.getSObjName();
        Test.stopTest();
        System.assertEquals('Task', sObjectName, 'Verifying the SObject Name');
    }

    @isTest
    static void verifySObjectLabel() {
        String sObjectLabel;
        Test.startTest();
        TaskUtil taskUtilClass = new TaskUtil();
        sObjectLabel = taskUtilClass.getSObjLabel();
        Test.stopTest();
        System.assertEquals('Task', sObjectLabel, 'Verifying the SObject Label');
    }

    @isTest
    static void verifyGetRecordTypeId() {
        Id recordTypeId;
        Test.startTest();
        recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_SMS);
        Test.stopTest();
        List<RecordType> recordTypes = [SELECT Id FROM RecordType WHERE SObjectType = 'Task' 
            AND DeveloperName = :TaskUtil.RT_SMS];
        System.assertEquals(recordTypes[0].Id, recordTypeId, 'Verifying the Task Record Type Id');
    }

    @isTest
    static void testGetFieldsetDetails(){
        
        Test.startTest();
        ApexActionResult result = FieldsetService.describeFieldsetDetails('Task', 'Task_Disposition');
        List<SObjectUtilHelper.FieldSetDetails> fieldsetDetailsList = new TaskUtil().getFieldsetDetails('Task_Disposition');
        Test.stopTest();
        
        System.assertEquals(JSON.serialize(fieldsetDetailsList), result.data); 
    }
}