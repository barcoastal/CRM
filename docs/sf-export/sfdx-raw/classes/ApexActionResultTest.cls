@IsTest
public with sharing class ApexActionResultTest {
    static String classScope = 'ApexActionResultTest';
    static String SF_ERROR_UPDATE_WITHOUT_ID = 'Id not specified in an update call';
    static String SF_ERROR_NULL_POINTER_EXCEPTION = 'Attempt to de-reference a null object';

    @IsTest
    static void validateScopeMethod() {
        Test.startTest();
        ApexActionResult actionResult = new ApexActionResult(classScope);
        Test.stopTest();
        System.assertEquals(actionResult.scope, classScope, 'Validating the scope is matching');
        System.assertEquals(actionResult.status, ApexActionResult.Statuses.SUCCESS, 'Validating the result is successful');
    }
    
    @IsTest
    static void validateStatus() {
        Test.startTest();
        ApexActionResult actionResult = new ApexActionResult();
        Test.stopTest();
        System.assertEquals(actionResult.status, ApexActionResult.Statuses.SUCCESS, 'Validating the result is successful');
    }

    @IsTest
    static void validateExceptionWithScopeMethod() {
        Exception exceptionInstance;
        try {
            String textVariable = null;
            textVariable = textVariable.capitalize();
        } catch(Exception ex) {
            exceptionInstance = ex;
        }
        Test.startTest();
        ApexActionResult actionResult = new ApexActionResult(exceptionInstance, classScope);
        Test.stopTest();
        System.assertEquals(actionResult.scope, classScope, 'Validating the scope is matching');
        System.assertEquals(actionResult.status, ApexActionResult.Statuses.ERROR, 'Validating the result is error');
        System.assert(actionResult.message.contains(SF_ERROR_NULL_POINTER_EXCEPTION), 'Validating the exception message');
    }

    @IsTest
    static void validateExceptionMethod() {
        Exception exceptionInstance;
        try {
            String textVariable = null;
            textVariable = textVariable.capitalize();
        } catch(Exception ex) {
            exceptionInstance = ex;
        }
        Test.startTest();
        ApexActionResult actionResult = new ApexActionResult(classScope);
        actionResult.thrown(exceptionInstance);
        Test.stopTest();
        System.assertEquals(actionResult.scope, classScope, 'Validating the scope is matching');
        System.assertEquals(actionResult.status, ApexActionResult.Statuses.ERROR, 'Validating the result is error');
        System.assert(actionResult.message.contains(SF_ERROR_NULL_POINTER_EXCEPTION), 'Validating the exception message');
    }

    @IsTest
    static void validateDMLExceptionMethod() {
        Exception exceptionInstance;
        try {
            Account acct = new Account();
            update acct;
        } catch(Exception ex) {
            exceptionInstance = ex;
        }
        Test.startTest();
        ApexActionResult actionResult = new ApexActionResult(classScope);
        actionResult.thrown(exceptionInstance);
        Test.stopTest();
        System.assertEquals(actionResult.scope, classScope, 'Validating the scope is matching');
        System.assertEquals(actionResult.resultStatus, 'ERROR', 'Validating the result is error');
        System.assert(actionResult.message.contains(SF_ERROR_UPDATE_WITHOUT_ID), 'Validating the exception message');
    }
}