public with sharing class SettlementOverviewController {

    @auraEnabled
    public static ApexActionResult getPaymentSummaryRecords(Id recordId) {
        final String SCOPE = 'SettlementOverviewController.getPaymentSummaryRecords';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            String accountExternalSASId;

            if(OpportunityUtil.isOppId(recordId)){
                List<Opportunity> oppRecord = OpportunityData.queryOpportunity(recordId);
                accountExternalSASId = oppRecord[0].Account.External_SAS_Id__c;
                recordId = oppRecord[0].AccountId;
            }else if(AccountUtil.isAccountId(recordId)){
                List<Account> accRecord = AccountData.queryAccount(recordId);
                accountExternalSASId = accRecord[0].External_SAS_Id__c;
            }
            
            List<SettlementOverviewWrapper> settlementOverviewList = new List<SettlementOverviewWrapper>();
            SettlementOverviewWrapper settlementOverview = new SettlementOverviewWrapper();
            
            settlementOverview = getProgramFeeAndEscrowAmount(settlementOverview,recordId);
            settlementOverview = getProgramPlanDetails(settlementOverview,recordId);
            settlementOverview = getPendingDraftsCount(settlementOverview,recordId);
            settlementOverview = getEscrowBalance(settlementOverview,recordId,accountExternalSASId);
          
            settlementOverviewList.add(settlementOverview);
            result.data = JSON.serialize(settlementOverviewList);
        } catch (Exception ex) {
            result.thrown(ex);
            System.debug('erro ' + ex);
        }
        return result;

    }

    public static SettlementOverviewWrapper getEscrowBalance(SettlementOverviewWrapper settlementOverview,Id recordId,String accountExternalSASId){
        settlementOverview.EscrowBalance = 0;
         if(!String.isEmpty(accountExternalSASId) && recordId != null){
           // settlementOverview.EscrowBalance = SASApi.getCustomerRecords(accountExternalSASId,recordId);
         }
     
        return settlementOverview;
    }

    public static SettlementOverviewWrapper getPendingDraftsCount(SettlementOverviewWrapper settlementOverview,Id recordId) {
        System.debug('inside ');
        AggregateResult draftsCount = DraftData.queryCountOfDraftsByAccountId(recordId);
        System.debug('drafts count ' + draftsCount);
        if (draftsCount != null) {
            Integer draftCount = Integer.valueOf(draftsCount.get('draftsCount'));
            settlementOverview.paymentsLeft = draftCount;
        }
        return settlementOverview;
    }

    public static SettlementOverviewWrapper getProgramFeeAndEscrowAmount(SettlementOverviewWrapper settlementOverview,Id recordId) {
        List < Payment_Summary__c > paymentSummaryList = PaymentsSummaryData.queryPaymentsSummaryWithAccountId(recordId);

        if (paymentSummaryList.size() > 0) {
            for (Payment_Summary__c paymentSummary: paymentSummaryList) {
                if (paymentSummary.Payment_Type__c == PaymentSumaryUtil.PAYMENT_TYPE_PROGRAM_FEE) {
                    settlementOverview.programFeeCollected = paymentSummary.Amount_Collected__c;
                    settlementOverview.programFeePending = paymentSummary.Amount_in_Schedule__c;
                }
                if (paymentSummary.Payment_Type__c == PaymentSumaryUtil.PAYMENT_TYPE_ESCROW_AMOUNT) {
                    settlementOverview.expectedEscrowAmount = paymentSummary.Total_Amount__c;
                }
            }
        }
        return settlementOverview;
    }

    public static SettlementOverviewWrapper getProgramPlanDetails(SettlementOverviewWrapper settlementOverview,Id recordId) {
        Program_Plan__c programPlan = ProgramPlanData.getProgramPlanOfAccount(recordId);

        if (programPlan != null) {
            settlementOverview.totalDebt = programPlan.Total_Debt__c;
            settlementOverview.currentPaymentToEscrow = programPlan.Weekly_Draft_Amount__c;
            settlementOverview.paymentFrequency = programPlan.Payment_Frequency__c;
        }
        return settlementOverview;
    }

    public class SettlementOverviewWrapper {
        public Decimal totalDebt;
        public String paymentFrequency;
        public Decimal currentPaymentToEscrow;
        public Decimal programFeeCollected;
        public Decimal programFeePending;
        public Decimal EscrowBalance;
        public integer paymentsLeft;
        public Decimal expectedEscrowAmount;
    }
}