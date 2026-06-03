@isTest
public with sharing class ProcessExecutionControlUtility_Test {
    @isTest
    static void testProcessExecution() {
        Test.startTest();
        ProcessExecutionControlUtility.executeIPQSCheck();
        Test.stopTest();
    }
}