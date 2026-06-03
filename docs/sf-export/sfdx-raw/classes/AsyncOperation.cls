public inherited sharing class AsyncOperation {

    private static final String STATUS_COMPLETED = 'Completed';
    private static final String STATUS_FAILED = 'Failed';
    private static final String ASYNC_TYPE_FUTURE = 'Future';
    private static final String OPERATION_DEDUPLICATE_LEADS = 'DeDuplicate Lead';

    private static final String RECORD_ID = 'recordId';
    private static final String STATUS = 'status';
    private static final String ERROR_MESSAGE = 'errorMessage';
    private static final String OPERATION = 'operation';
    private static final String ASYNC_TYPE = 'asyncType';

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

    public static void dmlCachedAsyncOperations() {
        if (cacheAsyncOperations != null && !cacheAsyncOperations.isEmpty()) {
            upsert cacheAsyncOperations;
            cacheAsyncOperations.clear();
        }
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
        cacheAsyncOperations.add(asyncOperation);
    }
}