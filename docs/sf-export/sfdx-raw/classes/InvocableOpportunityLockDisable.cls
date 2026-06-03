public class InvocableOpportunityLockDisable {
    @InvocableMethod(label='Disable Opportunity Lock')
    public static void disableOppLockForSystemUpdates() {
        OpportunityLockService.disableOppLockForSystemUpdates();
    }
}