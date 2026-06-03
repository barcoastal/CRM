public class InvocablePaymentSummaryUpdate {
	@InvocableMethod(label='Payment Summary Update')
    public static void updateAccountFeeStatus(List<List<Id>> accIds) {
 		Set<Id> accIdSet = new Set<Id>(accIds[0]);
        PaymentSummaryService.createPaymentSummaries(accIdSet, new Set<String>());
        PaymentSummaryTriggerHelper.updateAccountFeeStatus(accIdSet);
    }
}