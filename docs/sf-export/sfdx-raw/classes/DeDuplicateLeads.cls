public inherited sharing class DeDuplicateLeads {

    public static void deDuplicateLeads(Set<Id> leadIds) {
        try {
            Set<Id> inputLeadIds = leadIds.clone();
            Map<Id, LeadService.LeadResult> resultMap = AppendAndFive9LeadServicesHelper.initiateAppendLeadsAndAddToFive9(inputLeadIds, null);
            if (resultMap != null && !resultMap.isEmpty()) {
                for (Id leadId : leadIds) {
                    if (resultMap.containsKey(leadId)) {
                        LeadService.LeadResult leadResult = resultMap.get(leadId);
                        if (leadResult.isSuccess == true) {
                            AsyncOperation.logSuccessFutureDeDuplicateLeads(leadId);
                        } else {
                            LeadService.LeadResult result = resultMap.get(leadId);
                            String error;
                            if (String.isNotBlank(result.customError)) {
                                error = result.customError;
                            } else {
                                error = ApexUtil.getErrorMessage(result.dmlResult);
                            }
                            AsyncOperation.logFailureFutureDeDuplicateLeads(leadId, error);
                        }
                    }
                }
                AsyncOperation.dmlCachedAsyncOperations();
            }
        } catch (Exception ex) {
            ApplicationLogger.logException(ex, null);
        }   
    }
}