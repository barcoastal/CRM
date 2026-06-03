@IsTest
public class InvocableOpportunityLockEnableTest {
    
    @IsTest
    static void testReEnableOppLockAsSystemUpdatesDone() {
        Test.startTest();
        InvocableOpportunityLockEnable.reEnableOppLockAsSystemUpdatesDone();
        Test.stopTest();
    }
}