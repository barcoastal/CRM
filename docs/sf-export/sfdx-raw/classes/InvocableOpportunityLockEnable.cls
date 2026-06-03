public class InvocableOpportunityLockEnable {
    @InvocableMethod(label='Enable Opportunity Lock')
    public static void reEnableOppLockAsSystemUpdatesDone() {
        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
    }

}