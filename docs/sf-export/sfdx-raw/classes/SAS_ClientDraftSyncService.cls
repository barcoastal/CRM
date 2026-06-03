public without sharing class SAS_ClientDraftSyncService {

    public static Payment_Processor__c sasProcessor = getSASPaymentProcessor();
    public static final Integer SETUP_FEE_AND_CITADEL_FEE_PAYEE_ID = sasProcessor.Setup_Fee_Payee_Id__c != Null ? Integer.valueOf(sasProcessor.Setup_Fee_Payee_Id__c) : Null;

    public static void syncDraftsForClient(String sasClientId, Id accountId) {
        try {
           List<GetDebitScheduleWrapper> getDebitScheduleWrap;
           ProcessorWrapper.API_Response apiResponse = SASApi.getDebitScheduleById(sasClientId);
           if (apiResponse.isSuccess && apiResponse.processData != null && apiResponse.processData != '' && apiResponse.processData != '[]') {
               String rawJson = (String) JSON.deserialize(apiResponse.processData, String.class);
               getDebitScheduleWrap = (List<GetDebitScheduleWrapper>)JSON.deserialize(rawJson, List<GetDebitScheduleWrapper>.class);
            } else {
                ApplicationLogger.logDebugInfo(String.isNotBlank(apiResponse.message) ? apiResponse.message : 'No Data found.',null);  
            }

            Set<String> parentSASIds = new Set<String>();
            Set<Id> existingDrafts = New Set<Id>();
            Set<String> newDraftsSASIds = New Set<String>();
            for (GetDebitScheduleWrapper debit : getDebitScheduleWrap) {
                
                if(String.isNotBlank(debit.DebitID)){
                    parentSASIds.add(debit.DebitID);
                }
                if(String.isNotBlank(debit.DebitRemoteID)){
                    existingDrafts.add(debit.DebitRemoteID);
                } else if (String.isBlank(debit.DebitRemoteID)){
                    newDraftsSASIds.add(debit.DebitID);
                }
            }
            List<Opportunity> oppList = opportunityData.getLatestActiveOpportunityByAccount(accountId);
            Program_Plan__c programPlan = [SELECT Id, Setup_fee__c FROM Program_Plan__c WHERE Client__c = :accountId AND Opportunity__c =: oppList[0].Id LIMIT 1];
            Map<Id, Draft__c> draftsToUpdate = new Map<Id, Draft__c>(DraftData.queryDraftsByIds(existingDrafts));
            Map<String,Draft__c> draftsBySASId = DraftData.queryDraftsBySASIds(newDraftsSASIds);

            Map<String, String> statusMapping = getPaymentStatusMap();
            Map<Integer, String> payeeFieldMapping = getSASPayeesById(sasProcessor);
            List<Draft__c> draftsToUpsert = new List<Draft__c>();

            for (GetDebitScheduleWrapper parent : getDebitScheduleWrap) {
                
                if (String.isBlank(parent.status) || !statusMapping.containsKey(parent.status)) {
                    continue;
                }
                
                Draft__c draftRecord;
                Boolean isUpdate = String.isNotBlank(parent.DebitRemoteID);
                Boolean isUpdateBySasId = draftsBySASId.containsKey(parent.DebitID);

                if (isUpdate) {
                    draftRecord = draftsToUpdate.get(parent.DebitRemoteID);
                } else if(isUpdateBySASId){
                   draftRecord = draftsBySASId.get(parent.DebitID);
                } else {
                    draftRecord = initializeNewDraft(parent, programPlan);
                }
                
                if(draftRecord == null){
                    ApplicationLogger.logException('Draft missing in Salesforce during SAS debits import for a single client',parent.DebitID,'Expected Salesforce Draft ID (DebitRemoteID): ' + parent.DebitRemoteID);
                    continue;
                }

                if (String.isNotBlank(parent.DebitDate)) {
                    draftRecord.Draft_Date__c = convertToDate(parent.DebitDate);
                }
                if (parent.Total != null) {
                    draftRecord.Draft_Amount__c = Decimal.valueOf(parent.Total);
                }

                if (String.isNotBlank(parent.DateCleared)) {
                   draftRecord.Draft_Cleared_Date__c = convertToDate(parent.DateCleared);
                }

                if (statusMapping.containsKey(parent.status)) {
                    draftRecord.Draft_Status__c = statusMapping.get(parent.status);
                }

                if (parent.Payments != null ) {
                    List<getPayoutsWrapper> payouts = (List<getPayoutsWrapper>) JSON.deserialize(parent.Payments, List<getPayoutsWrapper>.class);
                    Decimal setupFeeFromPlan = (programPlan != null && programPlan.Setup_fee__c != null) ? Decimal.valueOf(programPlan.Setup_fee__c) : 0;

                    for (getPayoutsWrapper childFee : payouts) {
                        Integer payeeId = Integer.valueOf(childFee.payees_id); 
                        Decimal feeAmount = Decimal.valueOf(childFee.amount);

                        if (payeeFieldMapping.containsKey(payeeId)) {
                            String draftFieldName = payeeFieldMapping.get(payeeId);
                            
                            if(payeeId == SETUP_FEE_AND_CITADEL_FEE_PAYEE_ID && setupFeeFromPlan == feeAmount){
                                draftRecord.put(DraftUtil.SETUP_FEE_FIELD, feeAmount);
                            } else {
                                draftRecord.put(draftFieldName, feeAmount);
                            }
                            
                            if(draftRecord.Draft_Amount__c != null) {
                                draftRecord.Draft_Amount__c = draftRecord.Draft_Amount__c - feeAmount;
                            }
                        }
                    }
                }

                Decimal processorFee = draftRecord.Processor_Fee__c != null ? draftRecord.Processor_Fee__c : 0;
                if(draftRecord.Draft_Amount__c != null) {
                    draftRecord.Draft_Amount__c = draftRecord.Draft_Amount__c - processorFee;
                }

                draftsToUpsert.add(draftRecord);
            }

            if (!draftsToUpsert.isEmpty()) {
                OpportunityLockService.disableOppLockForSystemUpdates();
                DraftTriggerHandler.bypassPopulateSyncPending = true;
                
                DMLService.performUpsertDML(draftsToUpsert,'SAS_ClientDraftSyncService');
                
                DraftTriggerHandler.bypassPopulateSyncPending = false;
                OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
            }

            ApplicationLogger.insertStoredLogs();

        } catch (Exception ex) {
            ApplicationLogger.logException(ex, null);
            ApplicationLogger.insertStoredLogs(); 
        }
    }

    private static Draft__c initializeNewDraft(GetDebitScheduleWrapper parent, Program_Plan__c plan) {
        return new Draft__c(
            Program_Plan__c = (plan != null) ? plan.Id : null,
            External_SAS_Id__c = parent.DebitID,
            Program_Fee__c = 0,
            Processor_Fee__c = 0,
            Retainer_Fee__c = 0,
            Citadel_Fee__c = 0,
            Service_Fee__c = 0,
            Setup_Fee__c = 0,
            Draft_Date__c = null,
            Draft_Amount__c = null,
            Draft_Status__c = null
        );
    }

    public static Payment_Processor__c getSASPaymentProcessor(){
        return PaymentProcessorData.querySASPaymentProceesor();
    }

    private static Map<Integer,String> getSASPayeesById(Payment_Processor__c sasProcessor){
        Map<Integer,String> payeesById = new Map<Integer,String>();
        if(sasProcessor == null) return payeesById;

        if(sasProcessor.Program_Fee_Payee_Id__c != null) payeesById.put(Integer.valueOf(sasProcessor.Program_Fee_Payee_Id__c), DraftUtil.PROGRAM_FEE_FIELD);
        if(sasProcessor.Citadel_Fee_Payee_Id__c != null) payeesById.put(Integer.valueOf(sasProcessor.Citadel_Fee_Payee_Id__c), DraftUtil.CITADEL_FEE_FIELD); 
        if(sasProcessor.Service_Fee_Payee_Id__c != null) payeesById.put(Integer.valueOf(sasProcessor.Service_Fee_Payee_Id__c), DraftUtil.SERVICE_FEE_FIELD); 
        if(sasProcessor.Retainer_Fee_Payee_Id__c != null) payeesById.put(Integer.valueOf(sasProcessor.Retainer_Fee_Payee_Id__c), DraftUtil.RETAINER_FEE_FIELD);
        
        return payeesById;
    }

    private static Map<String, String> getPaymentStatusMap() {
        Map<String, String> paymentStatusMapping = new Map<String, String>();
        for(SAS_Payment_Status_Mapping__mdt paymentMap : [SELECT SF_Draft_Status__c, SAS_Draft_Status__c FROM SAS_Payment_Status_Mapping__mdt]){
            paymentStatusMapping.put(paymentMap.SAS_Draft_Status__c, paymentMap.SF_Draft_Status__c);
        }
        return paymentStatusMapping;
    }

    public static Date convertToDate(String dateString){
        if(String.isBlank(dateString)) return null;  
        return Date.parse(dateString.split(' ')[0]);
    }

 public class GetDebitScheduleWrapper {
        public String PaymentID;
        public String DebitID;
        public String CustomerID;
        public String RemoteID;
        public String DebitScheduleID;
        public String Total;
        public String Status;
        public String DateLastModified;
        public String DebitDate;
        public String DateCleared;
        public String TransactionID;
        public String Reason; 
        public String DebitRemoteID;  
        public String Payments;
    }
    
    public class getPayoutsWrapper {
        public String id;
        public String amount;
        public String reason;
        public String debitschedules_debits_id;
        public String payees_id;
        public String payees_remoteid;
    }
}