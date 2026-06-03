@IsTest
public class InvocableOpportunityLockDisableTest {
    
    @IsTest
    static void testDisableOppLockForSystemUpdates() {
        Test.startTest();
        InvocableOpportunityLockDisable.disableOppLockForSystemUpdates();
        Test.stopTest();
    }
}