//Dedicated class for RedTrack integration
public inherited sharing class AsyncOpRedTrack implements IAsyncOperation {
    
    public static void execute(Map<String, Object> inputMap, Map<String, Object> outputMap) {
        try {
            if (inputMap != null && !inputMap.isEmpty() && inputMap.containsKey('asyncOperationName') && inputMap.containsKey('asyncOperationRecords')) {
                String asyncOperationName = (String)inputMap.get('asyncOperationName');
                List<Async_Operation__c> asyncOperationRecords = (List<Async_Operation__c>)inputMap.get('asyncOperationRecords');
                if (String.isNotBlank(asyncOperationName) && asyncOperationRecords != null && !asyncOperationRecords.isEmpty()) {
                    doRedTrackIntegrations(asyncOperationName, asyncOperationRecords);
                }
            }
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, null);
        } finally {
            ApplicationLogger.insertStoredLogs();
        }
    }

    private static void doRedTrackIntegrations(String asyncOperationName, List<Async_Operation__c> asyncOperationRecords) {
        List<Async_Operation__c> asyncOperationsToUpdate = new List<Async_Operation__c>();
        if (asyncOperationName == AsyncOperationUtil.OPERATION_RED_TRACK_LEAD_CREATION) {
            List<Async_Operation__c> asyncOperationsList = queryAsyncOpForLead(asyncOperationRecords);
            for (Async_Operation__c asyncOperationRecord : asyncOperationsList) {
                Async_Operation__c asyncOpToUpdate = constructEndpointLeadCreation(asyncOperationRecord);
                asyncOperationsToUpdate.add(asyncOpToUpdate);
            }
        } else if (asyncOperationName == AsyncOperationUtil.OPERATION_RED_TRACK_LEAD_QUALIFICATION) {
            List<Async_Operation__c> asyncOperationsList = queryAsyncOpForLead(asyncOperationRecords);
            for (Async_Operation__c asyncOperationRecord : asyncOperationsList) {
                Async_Operation__c asyncOpToUpdate = constructEndpointLeadQualification(asyncOperationRecord);
                asyncOperationsToUpdate.add(asyncOpToUpdate);
            }
        } else if (asyncOperationName == AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_CREATION) {
            List<Async_Operation__c> asyncOperationsList = queryAsyncOpForOpportunity(asyncOperationRecords);
            for (Async_Operation__c asyncOperationRecord : asyncOperationsList) {
                Async_Operation__c asyncOpToUpdate = constructEndpointOpportunityCreation(asyncOperationRecord);
                asyncOperationsToUpdate.add(asyncOpToUpdate);
            }
        } else if (asyncOperationName == AsyncOperationUtil.OPERATION_RED_TRACK_CONTRACT_SENT) {
            List<Async_Operation__c> asyncOperationsList = queryAsyncOpForOpportunity(asyncOperationRecords);
            for (Async_Operation__c asyncOperationRecord : asyncOperationsList) {
                Async_Operation__c asyncOpToUpdate = constructEndpointContractSent(asyncOperationRecord);
                asyncOperationsToUpdate.add(asyncOpToUpdate);
            }
        } else if (asyncOperationName == AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_CLOSED_WON) {
            List<Async_Operation__c> asyncOperationsList = queryAsyncOpForOpportunity(asyncOperationRecords);
            for (Async_Operation__c asyncOperationRecord : asyncOperationsList) {
                Async_Operation__c asyncOpToUpdate = constructEndpointOpportunityClosedWon(asyncOperationRecord);
                asyncOperationsToUpdate.add(asyncOpToUpdate);
            }
        } else if (asyncOperationName == AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_FIRST_PAYMENT) {
            List<Async_Operation__c> asyncOperationsList = queryAsyncOpForOpportunity(asyncOperationRecords);
            for (Async_Operation__c asyncOperationRecord : asyncOperationsList) {
                Async_Operation__c asyncOpToUpdate = constructEndpointOpportunityFirstPayment(asyncOperationRecord);
                asyncOperationsToUpdate.add(asyncOpToUpdate);
            }
        } else if (asyncOperationName == AsyncOperationUtil.OPERATION_RED_TRACK_INBOUND_LEAD_QUALIFICATION) {
            List<Async_Operation__c> asyncOperationsList = queryAsyncOpForLead(asyncOperationRecords);
            for (Async_Operation__c asyncOperationRecord : asyncOperationsList) {
                Async_Operation__c asyncOpToUpdate = constructEndpointInboundLeadQualification(asyncOperationRecord);
                asyncOperationsToUpdate.add(asyncOpToUpdate);
            }
        } else if (asyncOperationName == AsyncOperationUtil.OPERATION_RED_TRACK_INBOUND_LEAD_CREATION) {
            List<Async_Operation__c> asyncOperationsList = queryAsyncOpForLead(asyncOperationRecords);
            for (Async_Operation__c asyncOperationRecord : asyncOperationsList) {
                Async_Operation__c asyncOpToUpdate = constructEndpointInboundLeadCreation(asyncOperationRecord);
                asyncOperationsToUpdate.add(asyncOpToUpdate);
            }
        }
        updateAsyncOperationRecords(asyncOperationsToUpdate);
    }

    private static List<Async_Operation__c> queryAsyncOpForLead(List<Async_Operation__c> asyncOperationRecords) {
        return [SELECT Id, Lead__c, Lead__r.Ad_Click_Id__c,Lead__r.Current_Total_Debt_Amount__c,lead__r.Formated_Phone__c,
                Lead__r.Email,Lead__r.LastName,Lead__r.FirstName,Lead__r.IP_Address__c,Lead__r.leadSource,Lead__r.RT_Debt_Amount_Lead_Creation__c,
                Lead__r.RT_Debt_Amount_Lead_Qualification__c
               FROM Async_Operation__c WHERE Id IN :asyncOperationRecords 
        ];
    }

    private static List<Async_Operation__c> queryAsyncOpForOpportunity(List<Async_Operation__c> asyncOperationRecords) {
        return [SELECT Id, Opportunity__c, Opportunity__r.Ad_Click_Id__c, Opportunity__r.Total_Debt__c, Opportunity__r.Account.Primary_Contact__r.FirstName,Opportunity__r.leadSource,
            Opportunity__r.Account.Primary_Contact__r.LastName, Opportunity__r.Email__c, Opportunity__r.Formatted_Phone__c, Opportunity__r.DS_First_Deposit_Amount__c,
            Opportunity__r.RT_Debt_Amount_Opportunity_Events__c
            FROM Async_Operation__c WHERE Id IN :asyncOperationRecords 
        ];
    }

    private static Async_Operation__c constructEndpointLeadCreation(Async_Operation__c asyncOpRecord) {
        Lead leadRecord = (Lead)asyncOpRecord.getSObject('Lead__r');
        String adClickId = leadRecord.Ad_Click_Id__c;
        String firstName = leadRecord.FirstName;
        String lastName = leadRecord.LastName;
        String email = leadRecord.Email;
        String phoneNumber = leadRecord.Formated_Phone__c;
        String ipAddress = leadRecord.IP_Address__c;
        String endpoint = RedTrackSettingsUtility.getLeadCreationEndpoint(leadRecord.leadSource);
        String rtDebtAmount = String.valueOf(leadRecord.RT_Debt_Amount_Lead_Creation__c);
    
        String encodedFirstName = String.isBlank(firstName) ? '' :EncodingUtil.urlEncode(firstName, 'UTF-8');
        String encodedLastName = String.isBlank(lastName) ? '' : EncodingUtil.urlEncode(lastName, 'UTF-8');

        endpoint = replaceKeywordInEndpoint(endpoint,'{adClickId}', adClickId);
        endpoint = replaceKeywordInEndpoint(endpoint,'{first_name}', encodedFirstName);
        endpoint = replaceKeywordInEndpoint(endpoint,'{last_name}', encodedLastName);
        endpoint = replaceKeywordInEndpoint(endpoint,'{email}', email);
        endpoint = replaceKeywordInEndpoint(endpoint,'{phone_number}', phoneNumber);
        endpoint = replaceKeywordInEndpoint(endpoint,'{ip}', ipAddress);
        endpoint = replaceKeywordInEndpoint(endpoint,'{rtDebtAmount}', rtDebtAmount);
        
        System.debug('Final Endpoint: ' + endpoint);

        HttpClient.HttpResponseWrapper response = performCallout(endpoint, leadRecord.Id, AsyncOperationUtil.OPERATION_RED_TRACK_LEAD_CREATION);
        Async_Operation__c asyncOperationToDML = parseResponse(response, asyncOpRecord);
        return asyncOperationToDML;
    }

    private static Async_Operation__c constructEndpointLeadQualification(Async_Operation__c asyncOpRecord) {
        Lead leadRecord = (Lead)asyncOpRecord.getSObject('Lead__r');
        String adClickId = leadRecord.Ad_Click_Id__c;
        String totalDebt = String.valueOf(leadRecord.Current_Total_Debt_Amount__c);
        String rtDebtAmount = String.valueOf(leadRecord.RT_Debt_Amount_Lead_Qualification__c);
        String endpoint = RedTrackSettingsUtility.getLeadQualificationEndpoint(leadRecord.leadSource);
        endpoint = replaceKeywordInEndpoint(endpoint, '{adClickId}', adClickId);
        endpoint = replaceKeywordInEndpoint(endpoint, '{totalDebt}', totalDebt);
        endpoint = replaceKeywordInEndpoint(endpoint,'{rtDebtAmount}', rtDebtAmount);
        
        System.debug('endpoint---->'+endpoint);
        HttpClient.HttpResponseWrapper response = performCallout(endpoint, leadRecord.Id, AsyncOperationUtil.OPERATION_RED_TRACK_LEAD_QUALIFICATION);
        Async_Operation__c asyncOperationToDML = parseResponse(response, asyncOpRecord);
        return asyncOperationToDML;
    }

    private static Async_Operation__c constructEndpointOpportunityCreation(Async_Operation__c asyncOpRecord) {
        Opportunity opportunityRecord = (Opportunity)asyncOpRecord.getSObject('Opportunity__r');
        String adClickId = opportunityRecord.Ad_Click_Id__c;
        String debtAmount = String.valueOf(opportunityRecord.Total_Debt__c);
        String firstName = opportunityRecord.Account.Primary_Contact__r.FirstName;
        String lastName = opportunityRecord.Account.Primary_Contact__r.LastName;
        String email = opportunityRecord.Email__c;
        String phoneNumber = opportunityRecord.Formatted_Phone__c;
        String totalDebt = String.valueOf(opportunityRecord.Total_Debt__c);
        String rtDebtAmount = String.valueOf(opportunityRecord.RT_Debt_Amount_Opportunity_Events__c);
        String encodedFirstName = String.isBlank(firstName) ? '' : EncodingUtil.urlEncode(firstName, 'UTF-8');
        String encodedLastName = String.isBlank(lastName) ? '' : EncodingUtil.urlEncode(lastName, 'UTF-8');

        String endpoint = RedTrackSettingsUtility.getOpportunityCreationEndpoint(opportunityRecord.leadSource);
        endpoint = replaceKeywordInEndpoint(endpoint, '{adClickId}', adClickId);
        endpoint = replaceKeywordInEndpoint(endpoint, '{first_name}', encodedFirstName);
        endpoint = replaceKeywordInEndpoint(endpoint, '{last_name}', encodedLastName);
        endpoint = replaceKeywordInEndpoint(endpoint, '{email}', email);
        endpoint = replaceKeywordInEndpoint(endpoint, '{phone_number}', phoneNumber);
        endpoint = replaceKeywordInEndpoint(endpoint, '{totalDebt}', totalDebt);
        endpoint = replaceKeywordInEndpoint(endpoint,'{rtDebtAmount}', rtDebtAmount);
        
        System.debug('endpoint---->'+endpoint);
        HttpClient.HttpResponseWrapper response = performCallout(endpoint, opportunityRecord.Id, AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_CREATION);
        Async_Operation__c asyncOperationToDML = parseResponse(response, asyncOpRecord);
        return asyncOperationToDML;
    }

    private static Async_Operation__c constructEndpointContractSent(Async_Operation__c asyncOpRecord) {
        Opportunity opportunityRecord = (Opportunity)asyncOpRecord.getSObject('Opportunity__r');
        String adClickId = opportunityRecord.Ad_Click_Id__c;
        String totalDebt = String.valueOf(opportunityRecord.Total_Debt__c);
        String rtDebtAmount = String.valueOf(opportunityRecord.RT_Debt_Amount_Opportunity_Events__c);
        String endpoint = RedTrackSettingsUtility.getContractSentEndpoint(opportunityRecord.leadSource);
        endpoint = replaceKeywordInEndpoint(endpoint, '{adClickId}', adClickId);
        endpoint = replaceKeywordInEndpoint(endpoint, '{totalDebt}', totalDebt);   
        endpoint = replaceKeywordInEndpoint(endpoint,'{rtDebtAmount}', rtDebtAmount);
        System.debug('endpoint---->'+endpoint);
        HttpClient.HttpResponseWrapper response = performCallout(endpoint, opportunityRecord.Id, AsyncOperationUtil.OPERATION_RED_TRACK_CONTRACT_SENT);
        Async_Operation__c asyncOperationToDML = parseResponse(response, asyncOpRecord);
        return asyncOperationToDML;
    }

    private static Async_Operation__c constructEndpointOpportunityClosedWon(Async_Operation__c asyncOpRecord) {
        Opportunity opportunityRecord = (Opportunity)asyncOpRecord.getSObject('Opportunity__r');
        String adClickId = opportunityRecord.Ad_Click_Id__c;
        String totalDebt = String.valueOf(opportunityRecord.Total_Debt__c);
        String rtDebtAmount = String.valueOf(opportunityRecord.RT_Debt_Amount_Opportunity_Events__c);
        String endpoint = RedTrackSettingsUtility.getOpportunityClosedWonEndpoint(opportunityRecord.leadSource);
        endpoint = replaceKeywordInEndpoint(endpoint, '{adClickId}', adClickId);
        endpoint = replaceKeywordInEndpoint(endpoint, '{totalDebt}', totalDebt);
        endpoint = replaceKeywordInEndpoint(endpoint,'{rtDebtAmount}', rtDebtAmount);
        System.debug('endpoint---->'+endpoint);
        HttpClient.HttpResponseWrapper response = performCallout(endpoint, opportunityRecord.Id, AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_CLOSED_WON);
        Async_Operation__c asyncOperationToDML = parseResponse(response, asyncOpRecord);
        return asyncOperationToDML;
    }

    private static Async_Operation__c constructEndpointOpportunityFirstPayment(Async_Operation__c asyncOpRecord) {
        Opportunity opportunityRecord = (Opportunity)asyncOpRecord.getSObject('Opportunity__r');
        String adClickId = opportunityRecord.Ad_Click_Id__c;
        String endpoint = RedTrackSettingsUtility.getOpportunityFirstPaymentEndpoint(opportunityRecord.leadSource);
        endpoint = replaceKeywordInEndpoint(endpoint, '{adClickId}', adClickId);
        System.debug('endpoint---->'+endpoint);
        HttpClient.HttpResponseWrapper response = performCallout(endpoint, opportunityRecord.Id, AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_FIRST_PAYMENT);
        Async_Operation__c asyncOperationToDML = parseResponse(response, asyncOpRecord);
        return asyncOperationToDML;
    }
    
    private static Async_Operation__c constructEndpointInboundLeadQualification(Async_Operation__c asyncOpRecord) {
        Lead leadRecord = (Lead)asyncOpRecord.getSObject('Lead__r');
        String adClickId = leadRecord.Ad_Click_Id__c;
        String totalDebt = String.valueOf(leadRecord.Current_Total_Debt_Amount__c);
        String endpoint = RedTrackSettingsUtility.getInboundLeadQualificationEndpoint();
        String rtDebtAmount = String.valueOf(leadRecord.RT_Debt_Amount_Lead_Qualification__c);

        endpoint = replaceKeywordInEndpoint(endpoint, '{adClickId}', adClickId);
        endpoint = replaceKeywordInEndpoint(endpoint, '{totalDebt}', totalDebt);
        endpoint = replaceKeywordInEndpoint(endpoint,'{rtDebtAmount}', rtDebtAmount);
        System.debug('endpoint---->'+endpoint);
        HttpClient.HttpResponseWrapper response = performCallout(endpoint, leadRecord.Id, AsyncOperationUtil.OPERATION_RED_TRACK_INBOUND_LEAD_QUALIFICATION);
        Async_Operation__c asyncOperationToDML = parseResponse(response, asyncOpRecord);
        return asyncOperationToDML;
    }
    
    private static Async_Operation__c constructEndpointInboundLeadCreation(Async_Operation__c asyncOpRecord) {
        Lead leadRecord = (Lead)asyncOpRecord.getSObject('Lead__r');
        String adClickId = leadRecord.Ad_Click_Id__c;
        String firstName = leadRecord.FirstName;
        String lastName = leadRecord.LastName;
        String email = leadRecord.Email;
        String phoneNumber = leadRecord.Formated_Phone__c;
        String ipAddress = leadRecord.IP_Address__c;
        String endpoint = RedTrackSettingsUtility.getInboundLeadCreationEndpoint();
        String rtDebtAmount = String.valueOf(leadRecord.RT_Debt_Amount_Lead_Qualification__c);

        String encodedFirstName = String.isBlank(firstName) ? '' :EncodingUtil.urlEncode(firstName, 'UTF-8');
        String encodedLastName = String.isBlank(lastName) ? '' : EncodingUtil.urlEncode(lastName, 'UTF-8');

        endpoint = replaceKeywordInEndpoint(endpoint,'{adClickId}', adClickId);
        endpoint = replaceKeywordInEndpoint(endpoint,'{first_name}', encodedFirstName);
        endpoint = replaceKeywordInEndpoint(endpoint,'{last_name}', encodedLastName);
        endpoint = replaceKeywordInEndpoint(endpoint,'{email}', email);
        endpoint = replaceKeywordInEndpoint(endpoint,'{phone_number}', phoneNumber);
        endpoint = replaceKeywordInEndpoint(endpoint,'{ip}', ipAddress);
        endpoint = replaceKeywordInEndpoint(endpoint,'{rtDebtAmount}', rtDebtAmount);
        System.debug('Final Endpoint: ' + endpoint);

        HttpClient.HttpResponseWrapper response = performCallout(endpoint, leadRecord.Id, AsyncOperationUtil.OPERATION_RED_TRACK_INBOUND_LEAD_CREATION);
        Async_Operation__c asyncOperationToDML = parseResponse(response, asyncOpRecord);
        return asyncOperationToDML;
    }

    private static String replaceKeywordInEndpoint(String endpoint, String stringToReplace, String replacement) {
        if (String.isNotBlank(replacement)) {
            endpoint = endpoint.replace(stringToReplace, replacement);
        } else {
            endpoint = endpoint.replace(stringToReplace, '');
        }
        return endpoint;
    }

    private static HttpClient.HttpResponseWrapper performCallout(String endpoint, Id recordId, String operation) {
        HttpClient httpClientInstance = new HttpClient();
        httpClientInstance.recordId = recordId;
        httpClientInstance.calloutStatement = operation;
        httpClientInstance.method = HttpClient.Methods.GET;
        httpClientInstance.endpoint = endpoint;
        HttpClient.HttpResponseWrapper response = httpClientInstance.sendRequest();
        return response;
    }

    private static Async_Operation__c parseResponse(HttpClient.HttpResponseWrapper response, Async_Operation__c asyncOpRecord) {
        Async_Operation__c asyncOperationToDML = new Async_Operation__c();
        asyncOperationToDML.Id = asyncOpRecord.Id;
        if (response.baseResponse.getStatusCode() >= 200 && response.baseResponse.getStatusCode() < 300) {
            asyncOperationToDML.Status__c = AsyncOperationUtil.STATUS_COMPLETED;
        } else {
            asyncOperationToDML.Status__c = AsyncOperationUtil.STATUS_FAILED;
            asyncOperationToDML.Additional_Details__c = response.baseResponse.getBody().left(5000);
        }
        return asyncOperationToDML;
    }

    private static void updateAsyncOperationRecords(List<Async_Operation__c> asyncOperationsToUpdate) {
        if (!asyncOperationsToUpdate.isEmpty()) {
            for (Database.SaveResult saveResult : Database.update(asyncOperationsToUpdate, false)) {
                if (!saveResult.isSuccess()) {
                    String errorMessage;
                    for (Database.Error err : saveResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('AsyncOpRedTrack - AsyncOperationsUpdate', saveResult.getId(), errorMessage, true);
                }
            }
        }
    }
}