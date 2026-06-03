public inherited sharing class AsyncOperationUtil {

    public static final String OPERATION_IP_QUALITY_SCORE_CHECK = 'IPQualityScoreCheck';
    public static final String OPERATION_RED_TRACK_LEAD_CREATION = 'RedTrack_LeadCreation';
    public static final String OPERATION_RED_TRACK_LEAD_QUALIFICATION = 'RedTrack_LeadQualification';
    public static final String OPERATION_RED_TRACK_OPPORTUNITY_CREATION = 'RedTrack_OpportunityCreation';
    public static final String OPERATION_RED_TRACK_CONTRACT_SENT = 'RedTrack_ContractSent';
    public static final String OPERATION_RED_TRACK_OPPORTUNITY_CLOSED_WON = 'RedTrack_OpportunityClosedWon';
    public static final String OPERATION_RED_TRACK_OPPORTUNITY_FIRST_PAYMENT = 'RedTrack_OpportunityFirstPayment';
    public static final String OPERATION_SET_CUSTOMER_STATUS_API = 'SetCustomerStatusAPI';
    public static final String OPERATION_RED_TRACK_INBOUND_LEAD_QUALIFICATION = 'RedTrack_InboundLeadQualification';
    public static final String OPERATION_RED_TRACK_INBOUND_LEAD_CREATION = 'RedTrack_InboundLeadCreation';
    public static final String OPERATION_ADCLICK_ID_UPDATE = 'AdClick_Id_Update';
    public static final String OPERATION_LEGAL_NETWORK_COMMUNICATION = 'Legal_Network_Communication';

    public static final String STATUS_COMPLETED = 'Completed';
    public static final String STATUS_FAILED = 'Failed';
    public static final String STATUS_PENDING = 'Pending';
    public static final String STATUS_CANCELLED = 'Cancelled';
    public static final String SUB_STATUS_DUPLICATE_RT = 'Duplicate RT Event';

    private static final String ASYNC_TYPE_FUTURE = 'Future';
    private static final String OPERATION_DEDUPLICATE_LEADS = 'DeDuplicate Lead';
    

    private static final String RECORD_ID = 'recordId';
    private static final String STATUS = 'status';
    private static final String ERROR_MESSAGE = 'errorMessage';
    private static final String OPERATION = 'operation';
    private static final String ASYNC_TYPE = 'asyncType';
    private static final String ADDITIONAL_DETAILS = 'additional_details';
    private static final String ADCLICK_ID_TEXT = 'Ad_Click_Id_Text';
    private static final String CUSTOMER_PHONE_NUMBER = 'Customer_Phone_Number';
    private static final String LEAD_SOURCE = 'Lead_Source__c';


    public enum ASYNC_TYPE_ENUM {
        BATCH,
        FUTURE,
        QUEUEABLE
    }

    private static List<Async_Operation__c> cacheAsyncOperations = new List<Async_Operation__c>();

    public static void logSuccessFutureDeDuplicateLeads(Id recordId) {
        Map<String, Object> inputMap = new Map<String, Object>();
        inputMap.put(RECORD_ID, recordId);
        inputMap.put(STATUS, STATUS_COMPLETED);
        inputMap.put(OPERATION, OPERATION_DEDUPLICATE_LEADS);
        inputMap.put(ASYNC_TYPE, ASYNC_TYPE_FUTURE);
        logAsyncOperation(inputMap);
    }

    public static void logFailureFutureDeDuplicateLeads(Id recordId, String errorMessage) {
        Map<String, Object> inputMap = new Map<String, Object>();
        inputMap.put(RECORD_ID, recordId);
        inputMap.put(STATUS, STATUS_FAILED);
        inputMap.put(ERROR_MESSAGE, errorMessage);
        inputMap.put(OPERATION, OPERATION_DEDUPLICATE_LEADS);
        inputMap.put(ASYNC_TYPE, ASYNC_TYPE_FUTURE);
        logAsyncOperation(inputMap);
    }


    public static Set<Id> dmlCachedAsyncOperations() {
       Set<Id> asyncOpIdsUpserted = new Set<Id>();
        
       try {
            Set<String> existingUniqueIds = queryExistingUniqueIds(cacheAsyncOperations);
            List<Async_Operation__c> recordsToUpsert = filterNewRecords(cacheAsyncOperations, existingUniqueIds);
            
            if (!recordsToUpsert.isEmpty()) {
                upsert recordsToUpsert;
                asyncOpIdsUpserted = new Map<Id, Async_Operation__c>(recordsToUpsert).keySet();
                cacheAsyncOperations.clear();
            }
            
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, null, 'Error inserting/updating AsyncOperation records', null);
        }
        
        return asyncOpIdsUpserted;
    }
    
    private static Set<String> queryExistingUniqueIds(List<Async_Operation__c> recordsToProcess) {
        Set<Id> leadIds = new Set<Id>();
        Set<Id> oppIds = new Set<Id>();
        for (Async_Operation__c operation : recordsToProcess) {
            if (String.isBlank(operation.Record_Id__c)) continue;
            String sObjectName = ApexUtil.getSObjectName(operation.Record_Id__c);
            if (sObjectName == new LeadUtil().getSObjName())  {
                leadIds.add(operation.Record_Id__c);
            }
            if (sObjectName == new OpportunityUtil().getSObjName())  {
                oppIds.add(operation.Record_Id__c);
            }
        }
       
        Map<Id, Lead> leadRecordMap = leadIds.isEmpty() ? new Map<Id, Lead>() : LeadData.queryLeadMapByIds(leadIds);
        Map<Id, Opportunity> oppRecordMap = oppIds.isEmpty() ? new Map<Id, Opportunity>() : OpportunityData.queryOpportunityMapByIds(oppIds);
        Set<String> uniqueIdsForQuery = new Set<String>();
        
        for (Async_Operation__c operation : recordsToProcess) {
            if (String.isNotBlank(operation.Record_Id__c)  && String.isNotBlank(operation.Operation__c) && operation.Operation__c.startsWith('RedTrack')) {
                String sObjectName = ApexUtil.getSObjectName(operation.Record_Id__c);
                if (sObjectName == new LeadUtil().getSObjName())  {
                    operation.Unique_Id__c = leadRecordMap.get(operation.Record_Id__c).Ad_Click_Id__c + operation.Operation__c;
                }
                if (sObjectName == new OpportunityUtil().getSObjName())  {
                    operation.Unique_Id__c = oppRecordMap.get(operation.Record_Id__c).Ad_Click_Id__c + operation.Operation__c;
                }
                uniqueIdsForQuery.add(operation.Unique_Id__c);
            }
        }
        
        Set<String> existingIds = new Set<String>();
        if (!uniqueIdsForQuery.isEmpty()) {
            for(Async_Operation__c async : AsyncOperationData.getAsyncOpWithUniqueId(uniqueIdsForQuery)){
                existingIds.add(async.Unique_Id__c);
            }
        }
        return existingIds;
    }

    private static List<Async_Operation__c> filterNewRecords(List<Async_Operation__c> allRecords, Set<String> existingIds) {
        List<Async_Operation__c> newRecords = new List<Async_Operation__c>();
        for(Async_Operation__c operation : allRecords){
            if(!existingIds.contains(operation.Unique_Id__c)){
                newRecords.add(operation);
            } else {
                operation.Status__c = STATUS_CANCELLED;
                operation.Sub_Status__c = SUB_STATUS_DUPLICATE_RT;
                newRecords.add(operation);
            }
        }
        return newRecords;
    }

    private static void logAsyncOperation(Map<String, Object> inputMap) {
        Async_Operation__c asyncOperation = new Async_Operation__c();
        if (inputMap.containsKey(RECORD_ID) && inputMap.get(RECORD_ID) != null) {
            asyncOperation.Record_Id__c = (String)inputMap.get(RECORD_ID);
        }
        if (inputMap.containsKey(STATUS) && inputMap.get(STATUS) != null) {
            asyncOperation.Status__c = (String)inputMap.get(STATUS);
        }
        if (inputMap.containsKey(OPERATION) && inputMap.get(OPERATION) != null) {
            asyncOperation.Operation__c = (String)inputMap.get(OPERATION);
        }
        if (inputMap.containsKey(ASYNC_TYPE) && inputMap.get(ASYNC_TYPE) != null) {
            asyncOperation.Async_Type__c = (String)inputMap.get(ASYNC_TYPE);
        }
        if (inputMap.containsKey(ERROR_MESSAGE) && inputMap.get(ERROR_MESSAGE) != null) {
            asyncOperation.Message__c = (String)inputMap.get(ERROR_MESSAGE);
        }
        if (inputMap.containsKey(ADDITIONAL_DETAILS) && inputMap.get(ADDITIONAL_DETAILS) != null) {
            asyncOperation.Additional_Details__c = (String)inputMap.get(ADDITIONAL_DETAILS);
        }
        if (inputMap.containsKey(ADCLICK_ID_TEXT) && inputMap.get(ADCLICK_ID_TEXT) != null) {
            asyncOperation.Ad_Click_Id_Text__c = (String)inputMap.get(ADCLICK_ID_TEXT);
        }
        if (inputMap.containsKey(CUSTOMER_PHONE_NUMBER) && inputMap.get(CUSTOMER_PHONE_NUMBER) != null) {
            asyncOperation.Customer_Phone_Number__c = (String)inputMap.get(CUSTOMER_PHONE_NUMBER);
        }
        if (inputMap.containsKey(LEAD_SOURCE) && inputMap.get(LEAD_SOURCE) != null) {
            asyncOperation.Lead_Source__c = (String)inputMap.get(LEAD_SOURCE);
        }
        cacheAsyncOperations.add(asyncOperation);
        System.debug(':::cacheAsyncOperations::'+cacheAsyncOperations);
    }

    public static void createIPQualityScoreCheckRecord(Id recordId, String asyncType) {
        Map<String, Object> inputMap = new Map<String, Object>();
        inputMap.put(RECORD_ID, recordId);
        inputMap.put(ASYNC_TYPE, asyncType);
        inputMap.put(OPERATION, OPERATION_IP_QUALITY_SCORE_CHECK);
        logAsyncOperation(inputMap);
    }

    public static Async_Operation__c createFailureAsyncOperationDMLInstance(Id asyncOperationId, String message, String additionalDetails) {
        return new Async_Operation__c(
            Id = asyncOperationId,
            Message__c = message,
            Additional_Details__c = additionalDetails,
            Status__c = STATUS_FAILED
        );
    }

    public static Async_Operation__c createSuccessAsyncOperationDMLInstance(Id asyncOperationId, String message, String additionalDetails) {
        return new Async_Operation__c(
            Id = asyncOperationId,
            Message__c = message,
            Additional_Details__c = additionalDetails,
            Status__c = STATUS_COMPLETED
        );
    }

    //Added method for creating Async record.
    public static void createAsyncOperationRecord(Id recordId, ASYNC_TYPE_ENUM asyncType, String operationValue) {
        Map<String, Object> inputMap = new Map<String, Object>();
        inputMap.put(RECORD_ID, recordId);
        inputMap.put(ASYNC_TYPE, asyncType.toString());
        inputMap.put(OPERATION, operationValue.toString());
        System.debug(':::inputMap:::'+inputMap);
        logAsyncOperation(inputMap);
    }

    public static void createUpdateAdClickIdAsyncOperation(ASYNC_TYPE_ENUM asyncType,String operationValue,String leadDetails,String fromPhone, String adClickId,String leadSource){
        Map<String, Object> inputMap = new Map<String, Object>();
        inputMap.put(ADDITIONAL_DETAILS, leadDetails);
        inputMap.put(ASYNC_TYPE, asyncType.toString());
        inputMap.put(OPERATION, operationValue.toString());
        inputMap.put(LEAD_SOURCE,leadSource);
        inputMap.put(CUSTOMER_PHONE_NUMBER, fromPhone);
        inputMap.put(ADCLICK_ID_TEXT, adClickId);
        inputMap.put(ERROR_MESSAGE,'Lead not found to udpate AdClickId');
        System.debug(':::inputMap:::'+inputMap);
        logAsyncOperation(inputMap);
    }
}