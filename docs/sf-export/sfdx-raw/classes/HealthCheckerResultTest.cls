@isTest
private class HealthCheckerResultTest {

    @isTest
    static void testCreateSuccessfulResult() {
        HealthCheckerResult result = HealthCheckerResult.createSuccessfulResult('Success message');
        System.assertEquals(HealthCheckerResult.HealthCheckStatus.SUCCESS, result.status);
        System.assertEquals('Success message', result.message);
        System.assertEquals(false, result.preventSave);
    }

    @isTest
    static void testCreateWarningResult() {
        HealthCheckerResult result = HealthCheckerResult.createWarningResult('Warning message');
        System.assertEquals(HealthCheckerResult.HealthCheckStatus.WARNING, result.status);
        System.assertEquals('Warning message', result.message);
        System.assertEquals(false, result.preventSave);
    }

    @isTest
    static void testCreateErrorResult() {
        HealthCheckerResult result = HealthCheckerResult.createErrorResult('Error message');
        System.assertEquals(HealthCheckerResult.HealthCheckStatus.ERROR, result.status);
        System.assertEquals('Error message', result.message);
        System.assertEquals(false, result.preventSave);
    }

    @isTest
    static void testCreateWarningResultPreventSave() {
        HealthCheckerResult result = HealthCheckerResult.createWarningResultPreventSave('Warning message');
        System.assertEquals(HealthCheckerResult.HealthCheckStatus.WARNING, result.status);
        System.assertEquals('Warning message', result.message);
        System.assertEquals(true, result.preventSave);
    }

    @isTest
    static void testCreateErrorResultPreventSave() {
        HealthCheckerResult result = HealthCheckerResult.createErrorResultPreventSave('Error message');
        System.assertEquals(HealthCheckerResult.HealthCheckStatus.ERROR, result.status);
        System.assertEquals('Error message', result.message);
        System.assertEquals(true, result.preventSave);
    }

    @isTest
    static void testCreateNotApplicableResult() {
        HealthCheckerResult result = HealthCheckerResult.createNotApplicableResult('NA message');
        System.assertEquals(HealthCheckerResult.HealthCheckStatus.NA, result.status);
        System.assertEquals('NA message', result.message);
        System.assertEquals(false, result.preventSave);
    }

    @isTest
    static void testIsNA() {
        HealthCheckerResult result = HealthCheckerResult.createNotApplicableResult('NA message');
        System.assertEquals(true, result.isNA());
    }

    @isTest
    static void testIsSuccess() {
        HealthCheckerResult result = HealthCheckerResult.createSuccessfulResult('Success message');
        System.assertEquals(true, result.isSuccess());
    }

    @isTest
    static void testIsWarning() {
        HealthCheckerResult result = HealthCheckerResult.createWarningResult('Warning message');
        System.assertEquals(true, result.isWarning());
    }

    @isTest
    static void testIsError() {
        HealthCheckerResult result = HealthCheckerResult.createErrorResult('Error message');
        System.assertEquals(true, result.isError());
    }

    @isTest
    static void testDetermineIconName() {
        String iconName = HealthCheckerResult.determineIconName(HealthCheckerResult.HealthCheckStatus.ERROR);
        System.assertEquals('utility:error', iconName);
    }

    @isTest
    static void testDetermineIconVariant() {
        String iconVariant = HealthCheckerResult.determineIconVariant(HealthCheckerResult.HealthCheckStatus.ERROR);
        System.assertEquals('error', iconVariant);
    }

    @isTest
    static void testCompareTo() {
        // Creating HealthCheckerResult instances with different statuses
        HealthCheckerResult successResult = HealthCheckerResult.createSuccessfulResult('Success message');
        HealthCheckerResult warningResult = HealthCheckerResult.createWarningResult('Warning message');
        HealthCheckerResult errorResult = HealthCheckerResult.createErrorResult('Error message');
        HealthCheckerResult naResult = HealthCheckerResult.createNotApplicableResult('NA message');

        System.assertEquals(1, successResult.compareTo(warningResult));

        System.assertEquals(1, naResult.compareTo(errorResult));

        // Ensure results with the same status return 0
        HealthCheckerResult successResult2 = HealthCheckerResult.createSuccessfulResult('Another success message');
        System.assertEquals(0, successResult.compareTo(successResult2));
    }
}