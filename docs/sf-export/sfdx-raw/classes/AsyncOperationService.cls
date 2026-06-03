public inherited sharing class AsyncOperationService {
    
    //Added methods for Async Operations
    public static void initiateAsyncOperations(List<Async_Operation__c> asyncOperationsList) {
        if (asyncOperationsList != null && !asyncOperationsList.isEmpty()) {
            Set<Id> asyncOpIdsIPQualityScoreCheck = new Set<Id>();
            List<Async_Operation__c> asyncOpRecordsRedTrackLeadCreation = new List<Async_Operation__c>();
            List<Async_Operation__c> asyncOpRecordsRedTrackLeadQualification = new List<Async_Operation__c>();
            List<Async_Operation__c> asyncOpRecordsRedTrackOpportunityCreation = new List<Async_Operation__c>();
            List<Async_Operation__c> asyncOpRecordsRedTrackContractSent = new List<Async_Operation__c>();
            List<Async_Operation__c> asyncOpRecordsRedTrackOpportunityClosedWon = new List<Async_Operation__c>();
            List<Async_Operation__c> asyncOpRecordsRedTrackOpportunityFirstPayment = new List<Async_Operation__c>();
            List<Async_Operation__c> asyncOpRecordsSetCustomerStatus = new List<Async_Operation__c>();
            List<Async_Operation__c> asyncOpRecordsRedTrackInboundLeadQualification = new List<Async_Operation__c>();
            List<Async_Operation__c> asyncOpRecordsRedTrackInboundLeadCreation = new List<Async_Operation__c>();
            list<Async_Operation__c> asyncOpUpdateAdClickId = new List<Async_Operation__c>();
            list<Async_Operation__c> asyncOpLegalNetworkCommunication = new List<Async_Operation__c>();
            for (Async_Operation__c asyncOperationRecord : asyncOperationsList) {
                if (asyncOperationRecord.Operation__c == AsyncOperationUtil.OPERATION_IP_QUALITY_SCORE_CHECK) {
                    asyncOpIdsIPQualityScoreCheck.add(asyncOperationRecord.Id);
                } else if (asyncOperationRecord.Operation__c == AsyncOperationUtil.OPERATION_RED_TRACK_LEAD_CREATION) {
                    asyncOpRecordsRedTrackLeadCreation.add(asyncOperationRecord);
                } else if (asyncOperationRecord.Operation__c == AsyncOperationUtil.OPERATION_RED_TRACK_LEAD_QUALIFICATION) {
                    asyncOpRecordsRedTrackLeadQualification.add(asyncOperationRecord);
                } else if (asyncOperationRecord.Operation__c == AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_CREATION) {
                    asyncOpRecordsRedTrackOpportunityCreation.add(asyncOperationRecord);
                } else if (asyncOperationRecord.Operation__c == AsyncOperationUtil.OPERATION_RED_TRACK_CONTRACT_SENT) {
                    asyncOpRecordsRedTrackContractSent.add(asyncOperationRecord);
                } else if (asyncOperationRecord.Operation__c == AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_CLOSED_WON) {
                    asyncOpRecordsRedTrackOpportunityClosedWon.add(asyncOperationRecord);
                } else if (asyncOperationRecord.Operation__c == AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_FIRST_PAYMENT) {
                    asyncOpRecordsRedTrackOpportunityFirstPayment.add(asyncOperationRecord);
                } else if (asyncOperationRecord.Operation__c == AsyncOperationUtil.OPERATION_SET_CUSTOMER_STATUS_API) {
                    asyncOpRecordsSetCustomerStatus.add(asyncOperationRecord);
                } else if (asyncOperationRecord.Operation__c == AsyncOperationUtil.OPERATION_RED_TRACK_INBOUND_LEAD_QUALIFICATION) {
                    asyncOpRecordsRedTrackInboundLeadQualification.add(asyncOperationRecord);
                } else if (asyncOperationRecord.Operation__c == AsyncOperationUtil.OPERATION_RED_TRACK_INBOUND_LEAD_CREATION) {
                    asyncOpRecordsRedTrackInboundLeadCreation.add(asyncOperationRecord);
                } else if (asyncOperationRecord.Operation__c == AsyncOperationUtil.OPERATION_ADCLICK_ID_UPDATE) {
                    asyncOpUpdateAdClickId.add(asyncOperationRecord);
                } else if (asyncOperationRecord.Operation__c == AsyncOperationUtil.OPERATION_LEGAL_NETWORK_COMMUNICATION) {
                    asyncOpLegalNetworkCommunication.add(asyncOperationRecord);
                }
            }
            
            if (!asyncOpIdsIPQualityScoreCheck.isEmpty()) {
                invokeIPQualityScoreCheck(asyncOpIdsIPQualityScoreCheck);
            }
            if (!asyncOpRecordsRedTrackLeadCreation.isEmpty()) {
                invokeRedTrackIntegration(asyncOpRecordsRedTrackLeadCreation, AsyncOperationUtil.OPERATION_RED_TRACK_LEAD_CREATION);
            }
            if (!asyncOpRecordsRedTrackLeadQualification.isEmpty()) {
                invokeRedTrackIntegration(asyncOpRecordsRedTrackLeadQualification, AsyncOperationUtil.OPERATION_RED_TRACK_LEAD_QUALIFICATION);
            }
            if (!asyncOpRecordsRedTrackOpportunityCreation.isEmpty()) {
                invokeRedTrackIntegration(asyncOpRecordsRedTrackOpportunityCreation, AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_CREATION);
            }
            if (!asyncOpRecordsRedTrackContractSent.isEmpty()) {
                invokeRedTrackIntegration(asyncOpRecordsRedTrackContractSent, AsyncOperationUtil.OPERATION_RED_TRACK_CONTRACT_SENT);
            }
            if (!asyncOpRecordsRedTrackOpportunityClosedWon.isEmpty()) {
                invokeRedTrackIntegration(asyncOpRecordsRedTrackOpportunityClosedWon, AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_CLOSED_WON);
            }
            if (!asyncOpRecordsRedTrackOpportunityFirstPayment.isEmpty()) {
                invokeRedTrackIntegration(asyncOpRecordsRedTrackOpportunityFirstPayment, AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_FIRST_PAYMENT);
            }
            if (!asyncOpRecordsRedTrackInboundLeadQualification.isEmpty()) {
                invokeRedTrackIntegration(asyncOpRecordsRedTrackInboundLeadQualification, AsyncOperationUtil.OPERATION_RED_TRACK_INBOUND_LEAD_QUALIFICATION);
            }
            if (!asyncOpRecordsRedTrackInboundLeadCreation.isEmpty()) {
                invokeRedTrackIntegration(asyncOpRecordsRedTrackInboundLeadCreation, AsyncOperationUtil.OPERATION_RED_TRACK_INBOUND_LEAD_CREATION);
            }
            if (!asyncOpUpdateAdClickId.isEmpty()) {
                invokeUpdateAdClickId(asyncOpUpdateAdClickId);
            }
            if(!asyncOpLegalNetworkCommunication.isEmpty()){
                invokeLegalNetworkCommunication(asyncOpLegalNetworkCommunication);
            }
        }
    }

    private static void invokeIPQualityScoreCheck(Set<Id> asyncOpIdsIPQualityScoreCheck) {
        Map<String, Object> inputMap = new Map<String, Object>();
        Map<String, Object> outputMap = new Map<String, Object>();
        inputMap.put('asyncOperationIds', asyncOpIdsIPQualityScoreCheck);
        IAsyncOperation asyncOpInterface = getInstance(AsyncOperationUtil.OPERATION_IP_QUALITY_SCORE_CHECK);
        asyncOpInterface.execute(inputMap, outputMap);
    }

    private static void invokeRedTrackIntegration(List<Async_Operation__c> asyncOperationList, String operationName) {
        Map<String, Object> inputMap = new Map<String, Object>();
        Map<String, Object> outputMap = new Map<String, Object>();
        inputMap.put('asyncOperationName', operationName);
        inputMap.put('asyncOperationRecords', asyncOperationList);
        IAsyncOperation asyncOpInterface = getInstance(operationName);
        asyncOpInterface.execute(inputMap, outputMap);
    }

    private static void invokeUpdateAdClickId(List<Async_Operation__c> asyncOperationList) {
        Map<String, Object> inputMap = new Map<String, Object>();
        Map<String, Object> outputMap = new Map<String, Object>();
        inputMap.put('asyncOperationRecords', asyncOperationList);
        IAsyncOperation asyncOpInterface = getInstance('UpdateAdClickId');
        asyncOpInterface.execute(inputMap, outputMap);
    }
    
    private static void invokeLegalNetworkCommunication(List<Async_Operation__c> asyncOperationList) {
        Map<String, Object> inputMap = new Map<String, Object>();
        Map<String, Object> outputMap = new Map<String, Object>();
        inputMap.put('asyncOperationRecords', asyncOperationList);
        IAsyncOperation asyncOpInterface = getInstance('LegalNetworkCommunication');
        asyncOpInterface.execute(inputMap, outputMap);
    }

    private static IAsyncOperation getInstance(String asyncOperationName) {
        IAsyncOperation asyncOpInterface;
        if (asyncOperationName.contains('_')) {
            asyncOperationName = asyncOperationName.substringBefore('_');
        }
        Type t = Type.forName('AsyncOp' + asyncOperationName);
        asyncOpInterface = (IAsyncOperation)t.newInstance();
        return asyncOpInterface;
    }
}