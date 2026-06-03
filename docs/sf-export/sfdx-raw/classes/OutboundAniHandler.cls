public class OutboundAniHandler {
    public static Boolean throwExceptionForTest = false;
    
    @future(callout=true)
    public static void performCallout(Set<Id> recordIds) {
        try {
            OutboundAniService.doCallout(recordIds);
            if (throwExceptionForTest) {
                throw new CalloutException('exception for testing');
            }
        } catch(Exception ex) {
            System.debug(ex.getMessage());
            ApplicationLogger.logException(ex, null);
        }
    }
}