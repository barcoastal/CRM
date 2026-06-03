public inherited sharing class AsyncOpIPQualityScoreCheck implements IAsyncOperation {

    private static final String SCOPE_CONTEXT = 'IPQualityScoreService';

    public static void execute(Map<String, Object> inputMap, Map<String, Object> outputMap) {
        try {
            if (inputMap != null && !inputMap.isEmpty() && inputMap.containsKey('asyncOperationIds')) {
                Set<Id> asyncOperationIds = (Set<Id>)inputMap.get('asyncOperationIds');
                if (asyncOperationIds != null && !asyncOperationIds.isEmpty()) {
                    List<Async_Operation__c> asyncOperationList = queryAsyncOperations(asyncOperationIds);
                    if (!asyncOperationList.isEmpty()) {
                        checkCallQualityScore(asyncOperationList);
                    } 
                }
            }
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, null);
        }
    }

    private static List<Async_Operation__c> queryAsyncOperations(Set<Id> asyncOperationIds) {
        return [SELECT Id, Individual__c, Individual__r.Phone__c FROM Async_Operation__c WHERE Id IN :asyncOperationIds];
    }

    private static void checkCallQualityScore(List<Async_Operation__c> asyncOperationList) {
        Map<Id, Individual> indRecordsToUpdateMap = new Map<Id, Individual>();
        Map<Id, Async_Operation__c> failedAsyncOperationsMap = new Map<Id, Async_Operation__c>();
        for (Async_Operation__c asyncOperation : asyncOperationList) {
            Individual indRecord;
            try {
                if (asyncOperation.Individual__c != null && asyncOperation.Individual__r.Phone__c != null) {
                    indRecord = (Individual)asyncOperation.getsObject('Individual__r');
                    IPQualityCheckResponseWrapper responseWrapper = doCallout(indRecord);
                    if (responseWrapper.success == true) {
                        if (!indRecordsToUpdateMap.containsKey(indRecord.Id)) {
                            Individual indRecordToUpdate = createIndividualDMLInstance(indRecord, responseWrapper);
                            indRecordsToUpdateMap.put(indRecord.Id, indRecordToUpdate);
                        }
                    } else {
                        Async_Operation__c failedAsyncOperation = AsyncOperationUtil.createFailureAsyncOperationDMLInstance(asyncOperation.Id, 'Callout Failure', null);
                        failedAsyncOperationsMap.put(failedAsyncOperation.Id, failedAsyncOperation);
                    }
                } else {
                    if (asyncOperation.Individual__c == null) {
                        Async_Operation__c failedAsyncOperation = AsyncOperationUtil.createFailureAsyncOperationDMLInstance(asyncOperation.Id, 'Individual reference is blank', null);
                        failedAsyncOperationsMap.put(failedAsyncOperation.Id, failedAsyncOperation);
                    } else if (asyncOperation.Individual__r.Phone__c == null) {
                        Async_Operation__c failedAsyncOperation = AsyncOperationUtil.createFailureAsyncOperationDMLInstance(asyncOperation.Id, 'Phone is blank in the Individual', null);
                        failedAsyncOperationsMap.put(failedAsyncOperation.Id, failedAsyncOperation);
                    }
                }
            } catch(Exception ex) {
                if (indRecord != null && indRecord.Id != null) {
                    Individual indRecordToUpdate = new Individual(Id = indRecord.Id);
                    indRecordToUpdate.IPQS_Check_Status__c = 'Failed';
                    indRecordToUpdate.IPQS_Checked_On__c = System.now();
                    indRecordsToUpdateMap.put(indRecordToUpdate.Id, indRecordToUpdate);
                }
                Async_Operation__c failedAsyncOperation = AsyncOperationUtil.createFailureAsyncOperationDMLInstance(asyncOperation.Id, 'Exception Occurred in API or Response Parsing', ex.getMessage());
                failedAsyncOperationsMap.put(asyncOperation.Id, failedAsyncOperation);
            }
        }
        Map<Id, String> individualDMLFailureMap = performIndividualDML(indRecordsToUpdateMap);
        performAsyncOperationsDML(asyncOperationList, failedAsyncOperationsMap, individualDMLFailureMap);
        ApplicationLogger.insertStoredLogs();
    }

    private static IPQualityCheckResponseWrapper doCallout(Individual indRecord) {
        IPQualityCheckResponseWrapper responseWrapper;
        HttpClient httpClientInstance = new HttpClient();
        httpClientInstance.recordId = indRecord.Id;
        httpClientInstance.method = HttpClient.Methods.GET;
        httpClientInstance.endpoint = constructEndpoint(indRecord);
        HttpClient.HttpResponseWrapper response = httpClientInstance.sendRequest();
        if (response != null && response.baseResponse != null) {
            String responseString = response.getFormattedResponseBody();
            //String responseString = '{"message":"Phone is valid.","success":true,"formatted":"+18007132618","local_format":"(800) 713-2618","valid":true,"fraud_score":100,"recent_abuse":true,"VOIP":false,"prepaid":null,"risky":true,"active":true,"carrier":"SomosGov","line_type":"Toll Free","country":"US","city":"Telephone","zip_code":"75488","region":"TX","dialing_code":1,"active_status":"N/A","sms_domain":"N/A","associated_email_addresses":{"status":"No associated emails found.","emails":[]},"user_activity":"Disabled for performance. Contact support for further assistance.","mnc":"N/A","mcc":"N/A","leaked":false,"spammer":false,"request_id":"XT1aXReNFO","name":"N/A","timezone":"America/Chicago","do_not_call":false,"accurate_country_code":true,"sms_email":"N/A"}';
            responseWrapper = (IPQualityCheckResponseWrapper)JSON.deserialize(responseString, IPQualityCheckResponseWrapper.class);
        } else {
            throw new CustomException('API Response is blank');
        }
        return responseWrapper;
    }

    private static String constructEndpoint(Individual indRecord) {
        Set<String> countriesToFilter = new Set<String> {'US', 'UK', 'CA'};
        String endpoint = 'callout:IP_Quality_Score' + '/' + indRecord.Phone__c + '?';
        for (String countryCode : countriesToFilter) {
            endpoint += 'country[]=' + countryCode + '&';
        }
        endpoint = endpoint.removeEnd('&');
        return endpoint;
    }

    private static Individual createIndividualDMLInstance(Individual indRecord, IPQualityCheckResponseWrapper responseWrapper) {
        Individual indToUpdate = new Individual();
        indToUpdate.Id = indRecord.Id; 
        indToUpdate.IPQS_Active_Status__c = responseWrapper.active_status;
        indToUpdate.IPQS_Carrier__c = responseWrapper.carrier;
        indToUpdate.IPQS_email__c = getEmail(responseWrapper.associated_email_addresses);
        indToUpdate.IPQS_Fraud_Score__c = Decimal.valueOf(responseWrapper.fraud_score);
        indToUpdate.IPQS_isActive__c = responseWrapper.active == null ? false : responseWrapper.active;
        indToUpdate.IPQS_Prepaid__c = responseWrapper.prepaid == null ? false : responseWrapper.prepaid;
        indToUpdate.IPQS_isRisky__c = responseWrapper.risky == null ? false : responseWrapper.risky;
        indToUpdate.IPQS_isValid__c = responseWrapper.valid == null ? false : responseWrapper.valid;
        indToUpdate.IPQS_Line_Type__c = responseWrapper.line_type;
        indToUpdate.IPQS_VOIP__c = responseWrapper.voip == null ? false : responseWrapper.voip;
        indToUpdate.IPQS_Check_Status__c = 'Completed';
        indToUpdate.IPQS_Checked_On__c = System.now();
        return indToUpdate;
    }

    private static Map<Id, String> performIndividualDML(Map<Id, Individual> indRecordsToUpdateMap) {
        Map<Id, String> individualDMLFailureMap = new Map<Id, String>();
        if (!indRecordsToUpdateMap.isEmpty()) {
            doDML(indRecordsToUpdateMap.values(), individualDMLFailureMap);
        }
        return individualDMLFailureMap;
    }

    private static void performAsyncOperationsDML(List<Async_Operation__c> asyncOperationsList, Map<Id, Async_Operation__c> failedAsyncOperationsMap, Map<Id, String> individualDMLFailureMap) {
        List<Async_Operation__c> asyncToUpdateList = new List<Async_Operation__c>();
        for (Async_Operation__c asyncOperation : asyncOperationsList) {
            Async_Operation__c asyncOpToDML = new Async_Operation__c();
            if (failedAsyncOperationsMap.containsKey(asyncOperation.Id)) {
                asyncOpToDML = failedAsyncOperationsMap.get(asyncOperation.Id);
            } else if (individualDMLFailureMap.containsKey(asyncOperation.Individual__c)) {
                asyncOpToDML = AsyncOperationUtil.createFailureAsyncOperationDMLInstance(asyncOperation.Id, 'Individual DML Failed', individualDMLFailureMap.get(asyncOperation.Individual__c));
            } else {
                asyncOpToDML = AsyncOperationUtil.createSuccessAsyncOperationDMLInstance(asyncOperation.Id, null, null);
            }
            asyncToUpdateList.add(asyncOpToDML);
        }
        doDML(asyncToUpdateList, null);
    }

    private static void doDML(List<SObject> sObjectList, Map<Id, String> failureIdErrorMessageMap) {
        for (Database.SaveResult saveResult : DMLService.updateRecordsAsync(sObjectList)) {
            if (!saveResult.isSuccess()) {
                String errorMessage;
                for (Database.Error err : saveResult.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                ApplicationLogger.logDMLException(SCOPE_CONTEXT, saveResult.getId(), errorMessage, true);
                if (failureIdErrorMessageMap != null) {
                    failureIdErrorMessageMap.put(saveResult.getId(), errorMessage);
                }
            }
        }
    }

    private static String getEmail(EmailAddressesAssociated emailAddressWrapper) {
        String emailAddr;
        if (emailAddressWrapper != null && emailAddressWrapper.emails != null && !emailAddressWrapper.emails.isEmpty()) {
            emailAddr = emailAddressWrapper.emails[0];
        }
        return emailAddr; 
    }

    private class IPQualityCheckResponseWrapper {
        private Boolean success;
        private String active_status;
        private String carrier;
        private EmailAddressesAssociated associated_email_addresses;
        private String fraud_score;
        private Boolean active;
        private Boolean prepaid;
        private Boolean risky;
        private Boolean valid;
        private String line_type;
        private Boolean voip;
    }

    public class EmailAddressesAssociated {
        public String status;
        public List<String> emails;
    }
}