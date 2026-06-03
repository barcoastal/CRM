@IsTest
private class DraftUtilTest {

    @IsTest
    static void testGetSObjName() {

        Test.startTest();
        DraftUtil draftUtil = new DraftUtil();
        String sObjName = draftUtil.getSObjName();
        Test.stopTest();
        
        System.assertEquals('Draft__c', sObjName);
    }
    
    @IsTest
    static void testGetSObjLabel() {

        Test.startTest();
        DraftUtil draftUtil = new DraftUtil();
        String sObjLabel = draftUtil.getSObjLabel();
        Test.stopTest();
        
        System.assertEquals('Draft', sObjLabel);
    }
    
    @IsTest
    static void testUnlockedStatuses() {

        Test.startTest();
        Set<String> unlockedStatuses = DraftUtil.unlockedStatuses;
        Test.stopTest();
        
        // Assert that the unlockedStatuses set contains the expected values
        System.assert(unlockedStatuses.contains('Pending'));
        System.assert(unlockedStatuses.contains('Scheduled'));
    }
    
    @IsTest
    static void testLockedStatuses() {

        Test.startTest();
        Set<String> lockedStatuses = DraftUtil.lockedStatuses;
        Test.stopTest();
        
        // Assert that the lockedStatuses set contains the expected values
        System.assert(lockedStatuses.contains('Processing'));
        System.assert(lockedStatuses.contains('Completed'));
        System.assert(lockedStatuses.contains('NSF'));
    }
    
    @IsTest
    static void testCompletedStatuses() {

        Test.startTest();
        Set<String> completedStatuses = DraftUtil.completedStatuses;
        Test.stopTest();
        
        // Assert that the completedStatuses set contains the expected values
        System.assert(completedStatuses.contains('Processing'));
        System.assert(completedStatuses.contains('Completed'));
    }
}