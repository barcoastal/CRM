public inherited sharing class AsyncOpRedTrackIntegration implements IAsyncOperation {
    
    public static void execute(Map<String, Object> inputMap, Map<String, Object> outputMap) {
        try {
            if (inputMap != null && !inputMap.isEmpty() && inputMap.containsKey('asyncOperationIds')) {
                if (inputMap.containsKey('asyncOperation')) {
                    String asyncOperation = (String)inputMap.get('asyncOperation');
                    Set<Id> asyncOperationIds = (Set<Id>)inputMap.get('asyncOperationIds');
                    if (String.isNotBlank(asyncOperation) && asyncOperationIds != null && !asyncOperationIds.isEmpty()) {
                        executeRedTrackIntegrations(asyncOperation, asyncOperationIds);
                    }
                }
            }
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, null);
        }
        ApplicationLogger.insertStoredLogs();
    }

    private static void executeRedTrackIntegrations(String asyncOperation, Set<Id> asyncOperationIds) {
        if (asyncOperation == 'RedTrackLeadInsert') {
            List<Async_Operation__c> asyncOperationList = queryAsyncOpLeadInsert(asyncOperationIds);
            if (asyncOperationList != null && !asyncOperationList.isEmpty()) {
                List<Async_Operation__c> asyncOperationsToUpdate = new List<Async_Operation__c>();
                for (Async_Operation__c asyncOperationRecord : asyncOperationList) {
                    Async_Operation__c asyncOpToUpdate = constructEndpointLead(asyncOperationRecord);
                    asyncOperationsToUpdate.add(asyncOpToUpdate);
                }
                update asyncOperationsToUpdate;
            }
        }
    }

    private static List<Async_Operation__c> queryAsyncOpLeadInsert(Set<Id> asyncOperationIds) {
        return [SELECT Id, Lead__c, Lead__r.Ad_Click_Id__c 
            FROM Async_Operation__c WHERE Id IN :asyncOperationIds 
        ];
    }

    private static Async_Operation__c constructEndpointLead(Async_Operation__c asyncOpRecord) {
        Async_Operation__c asyncOperationToDML = new Async_Operation__c();
        asyncOperationToDML.Id = asyncOpRecord.Id;
        String endpoint = 'https://click.coastaldebt.com/postback?clickid={replace}&type={event_name_replace}';
        Lead leadRecord = (Lead)asyncOpRecord.getSObject('Lead__r');
        String adClickId = leadRecord.Ad_Click_Id__c;
        endpoint = endpoint.replace('{replace}', adClickId);
        endpoint = endpoint.replace('{event_name_replace}', 'Lead');
        System.debug('endpoint---->'+endpoint);
        HttpClient.HttpResponseWrapper response = performCallout(endpoint, leadRecord.Id);
        if (response.baseResponse.getStatusCode() >= 200 && response.baseResponse.getStatusCode() < 300) {
            asyncOperationToDML.Status__c = 'Completed';
        } else {
            asyncOperationToDML.Status__c = 'Failed';
            asyncOperationToDML.Additional_Details__c = response.baseResponse.getBody().left(5000);
        }
        return asyncOperationToDML;
    }

    private static HttpClient.HttpResponseWrapper performCallout(String endpoint, Id recordId) {
        HttpClient httpClientInstance = new HttpClient();
        httpClientInstance.recordId = recordId;
        httpClientInstance.method = HttpClient.Methods.GET;
        httpClientInstance.endpoint = endpoint;
        HttpClient.HttpResponseWrapper response = httpClientInstance.sendRequest();
        System.debug('response---->'+response);
        return response;
    }
}