/**
 * Class contains specific methods for SAS Processor to do the callouts.
 */
public inherited sharing class SASApi extends ProcessorWrapper implements PaymentProcessor {

    public static API_Response createClient(CreateClientRequest request, CreateBankAccountRequest bankAccountRequest) {
        API_Response result = new API_Response();
        String clientSASId;
        if (request != null && bankAccountRequest != null) {
            if (request.clientWrap != null && String.isNotBlank(request.clientWrap.externalSASId)) {
                result = updateClientService(request.clientWrap);
            } else {
                API_Response customerResponse = getCustomerDetails(request.clientWrap.recordId);
                if(customerResponse.isSuccess == true){
                    clientSASId = customerResponse.externalId;
                }
                if (String.isNotBlank(clientSASId)) {
                    request.clientWrap.externalSASId = clientSASId;
                    result = updateClientService(request.clientWrap);
                } else {
                result = createClientService(request.clientWrap, bankAccountRequest.bankAccountWrap);
            }
        }
        }
        return result;
    }

    public static API_Response getCustomerDetails(String clientSFId) {
        String clientSASId;
        SASWrapper.GetCustomerBySFId getCustomerRequest = new SASWrapper.GetCustomerBySFId();
        getCustomerRequest.RemoteID = clientSFId;
        String requestBody = JSON.serialize(getCustomerRequest, true);
        System.HttpResponse response = doCalloutWithJSONBody(requestBody, 'GetCustomerRecords', clientSFId, false);
        API_Response result = parseResponse(response, null, 'GetCustomerRecords');        
        return result;
    }

    public static API_Response createClientService(ClientWrapper clientWrap, BankAccountWrapper bankAccountWrap) {
        API_Response result =  new API_Response();
        String errorMessage = SASValidation.clientValidation(clientWrap);
        if (String.isNotBlank(errorMessage)) {
            result = constructErrorResponse(errorMessage);
        } else {
            SASWrapper.CreateClient createClientRequest = constructClientRequest(clientWrap);
            String requestBody = JSON.serialize(createClientRequest, true);
            System.HttpResponse response = doCalloutWithJSONBody(requestBody, 'CreateTrustAccount', clientWrap.recordId, false);
            result = parseResponse(response, null, null);
        }
        return result;
    }

    private static SASWrapper.CreateClient constructClientRequest(ClientWrapper clientWrap) {
        SASWrapper.CreateClient clientWrapOutput = new SASWrapper.CreateClient();
        clientWrapOutput.RemoteID = clientWrap.recordId;
        clientWrapOutput.CustomerID = clientWrap.externalSASId;
        clientWrapOutput.FirstName = clientWrap.firstName;
        clientWrapOutput.LastName = clientWrap.lastName;
        clientWrapOutput.Company = clientWrap.companyName;
        clientWrapOutput.SsnTid = clientWrap.ssn;
        clientWrapOutput.Dob = String.valueOf(clientWrap.dob);
        clientWrapOutput.Email = clientWrap.email;
        clientWrapOutput.Phone1 = clientWrap.phone;
        clientWrapOutput.Address1 = clientWrap.address;
        clientWrapOutput.City = clientWrap.city;
        clientWrapOutput.State = clientWrap.state;
        clientWrapOutput.PostalCode = clientWrap.postalCode;
        clientWrapOutput.Country = clientWrap.country;
        clientWrapOutput.TotalValue = clientWrap.totalDebt;
        clientWrapOutput.InvoiceNumber = clientWrap.invoiceNumber;
        clientWrapOutput.StartDate = String.valueOf(clientWrap.programStartDate);
        clientWrapOutput.EndDate = String.valueOf(clientWrap.programEndDate);
        clientWrapOutput.Contract = clientWrap.contractDetails;
        return clientWrapOutput;
    }

    public static API_Response updateClient(UpdateClientRequest request) {
        ApexUtil.requireValue('Update Client Request', request);
        return updateClientService(request.clientWrap);
    }

    public static API_Response updateClientService(ClientWrapper clientWrap) {
        API_Response result =  new API_Response();
        String errorMessage = SASValidation.clientValidation(clientWrap);
        if (String.isNotBlank(errorMessage)) {
            result = constructErrorResponse(errorMessage);
        } else {
            SASWrapper.CreateClient createClientRequest = constructClientRequest(clientWrap);
            String requestBody = JSON.serialize(createClientRequest, true);
            System.HttpResponse response = doCalloutWithJSONBody(requestBody, 'UpdateCustomer', clientWrap.recordId, false);
            result = parseResponse(response, null, null);
            result.externalId = clientWrap.externalSASId;
        }
        return result;
    }

    public static API_Response cancelClient(CancelClientRequest request) {
        API_Response result = new API_Response();
        if (request != null) {
            if (request.clientWrap != null && String.isNotBlank(request.clientWrap.externalSASId)) {
                SASWrapper.CancelClient cancelClientRequest = new SASWrapper.CancelClient();
                cancelClientRequest.CustomerID = request.clientWrap.externalSASId;
                cancelClientRequest.RemoteID = request.clientWrap.recordId;
                String requestBody = JSON.serialize(cancelClientRequest, true);
                System.HttpResponse response = doCalloutWithJSONBody(requestBody, 'CloseAccount', request.clientWrap.recordId, false);
                result = parseResponse(response, null, null);
                result.externalId = request.clientWrap.externalSASId;
            } 
        }
        return result;
    }
    
    public static API_Response setCustomerStatus(SetCustomerStatuRequest request, String customerStatusId) {
        API_Response result = new API_Response();
        if (request != null) {
            if (request.clientWrap != null && String.isNotBlank(request.clientWrap.externalSASId)) {
                SASWrapper.SetCustomerStatus setCustomerStatusRequest = new SASWrapper.SetCustomerStatus();                
                setCustomerStatusRequest.RemoteID = request.clientWrap.recordId;
                setCustomerStatusRequest.CustomerStatusID = customerStatusId;
                String requestBody = JSON.serialize(setCustomerStatusRequest, true);
                System.HttpResponse response = doCalloutWithJSONBody(requestBody, 'SetCustomerStatus', request.clientWrap.recordId, false);
                result = parseResponse(response, null, null);
                result.externalId = request.clientWrap.externalSASId;
            } 
        }
        return result;
    }

    public static API_Response createBankAccount(CreateBankAccountRequest request) {
        ApexUtil.requireValue('Create Bank Account Request', request);
        return updateBankAccountService(request.bankAccountWrap);
    }

    public static API_Response updateBankAccount(UpdateBankAccountRequest request) {
        ApexUtil.requireValue('Update Bank Account Request', request);
        return updateBankAccountService(request.bankAccountWrap);
    }

    public static API_Response updateBankAccountService(BankAccountWrapper bankAccountWrap) {
        API_Response result =  new API_Response();
        String errorMessage = SASValidation.bankAccountValidation(bankAccountWrap);
        if (String.isNotBlank(errorMessage)) {
            result = constructErrorResponse(errorMessage);
        } else {
            BankAccountWrapper bankAccountWrapResult = trimBankAccountWrapper(bankAccountWrap);
            String requestBody = JSON.serialize(bankAccountWrapResult, true);
            for (String bankAcctParam : SASWrapper.createBankAccountMap.keySet()) {
                requestBody = requestBody.replaceAll(bankAcctParam, SASWrapper.createBankAccountMap.get(bankAcctParam));
            }
            System.HttpResponse response = doCalloutWithJSONBody(requestBody, 'SetPaymentMethod', bankAccountWrap.recordId, false);
            result = parseResponse(response, null, null);
        }
        return result;
    }

    public static BankAccountWrapper trimBankAccountWrapper(BankAccountWrapper bankWrapInput) {
        BankAccountWrapper bankWrapOutput = new BankAccountWrapper();
        bankWrapOutput.recordId = bankWrapInput.recordId;
        bankWrapOutput.bankAccountNumber = bankWrapInput.bankAccountNumber;
        bankWrapOutput.routingNumber = bankWrapInput.routingNumber;
        bankWrapOutput.paymentType = bankWrapInput.paymentType;
        bankWrapOutput.clientProcessorId = bankWrapInput.clientProcessorId;
        return bankWrapOutput;
    }

    public static API_Response createDraft(CreateDraftRequest request) {
        return null;
    }

    public static API_Response updateDraft(UpdateDraftRequest request) {
        return null;
    }

    public static API_Response syncDrafts(ProcessorWrapper.SyncDraftsRequest request) {
        API_Response debitScheduleResult = new API_Response();
        if (request != null && request.draftWrapList != null && !request.draftWrapList.isEmpty() && String.isNotBlank(request.apiMethod)) {
            List<Id> sobjectSFIds = new List<Id>();
            String apiMethod = request.apiMethod;
            List<SASWrapper.Debit> debitInstances = new List<SASWrapper.Debit>();
            List<LineItemResponse> validationErrors = new List<LineItemResponse>();
            DraftWrapper firstDraftInstance;
            for (DraftWrapper draftWrap : request.draftWrapList) {
                LineItemResponse lineItemResult = new LineItemResponse();
                String errorMsg = SASValidation.draftsValidation(draftWrap);
                if (String.isNotBlank(errorMsg)) {
                    lineItemResult.isSuccess = false;
                    lineItemResult.errorMessage = errorMsg;
                    lineItemResult.sfId = draftWrap.recordId;
                    validationErrors.add(lineItemResult);
                } else {
                    if (firstDraftInstance == null) {
                        firstDraftInstance = draftWrap;
                    }
                    SASWrapper.Debit debitInstance = constructDebitsInstance(draftWrap, apiMethod); //'SetDebitSchedule'
                    debitInstances.add(debitInstance);
                    sobjectSFIds.add(draftWrap.recordId);
                }
            }
            if (debitInstances != null && !debitInstances.isEmpty()) {
                SASWrapper.DebitSchedule debitScheduleInstance = new SASWrapper.DebitSchedule();
                debitScheduleInstance.CustomerID = firstDraftInstance.clientExternalProcId;
                debitScheduleInstance.RemoteID = firstDraftInstance.clientSFId;
                debitScheduleInstance.DebitScheduleID = firstDraftInstance.debitScheduleId;
                debitScheduleInstance.Debits = debitInstances;
                String requestBody = JSON.serialize(debitScheduleInstance, true);
                requestBody = requestBody.replaceAll('Date_x', 'Date');
                System.HttpResponse response = doCalloutWithJSONBody(requestBody, apiMethod, firstDraftInstance.clientSFId, false);
                debitScheduleResult = parseResponse(response, sobjectSFIds, null);
            }
            if (!validationErrors.isEmpty() && debitScheduleResult != null) {
                if (debitScheduleResult.results == null) {
                    debitScheduleResult.results = validationErrors;
                } else {
                    debitScheduleResult.results.addAll(validationErrors);
                }
            }
        }
        return debitScheduleResult;
    }

    public static SASWrapper.Debit constructDebitsInstance(DraftWrapper draftWrap, String apiMethod) {
        SASWrapper.Debit debitInstance = new SASWrapper.Debit();
        debitInstance.DebitRemoteID = draftWrap.recordId;
        debitInstance.DebitID = draftWrap.externalSASId;
        debitInstance.Amount = ApexUtil.stringValue(draftWrap.totalAmount);
        debitInstance.Date_x = ApexUtil.stringValue(draftWrap.paymentDate);
        List<SASWrapper.Payout> payouts = constructPayouts(draftWrap);
        if (!payouts.isEmpty()) {
            debitInstance.Payouts = payouts;
        }
        return debitInstance;
    } 

    private static List<SASWrapper.Payout> constructPayouts(DraftWrapper draftWrap) {
        List<SASWrapper.Payout> payouts = new List<SASWrapper.Payout>();
        if (draftWrap != null && draftWrap.payouts != null && !draftWrap.payouts.isEmpty()) {
            for (DraftWrapper.Payouts draftPayout : draftWrap.payouts) {
                if (FeeUtil.FEES_INTEGRATION_SUPPORTED_SAS.contains(draftPayout.FeeType)) {
                    SASWrapper.Payout payout = new SASWrapper.Payout();
                    payout.PayeeID = draftPayout.PayeeID;
                    payout.Amount = ApexUtil.stringValue(draftPayout.Amount); 
                    payout.PayoutDate = ApexUtil.stringValue(draftPayout.PayoutDate);
                    payouts.add(payout);
                }
            }
        }
        return payouts;
    }

    public static API_Response getDrafts(String clientSFId) {
        String clientSASId;
        SASWrapper.GetDebitScheduleBySFId getDebitSchedule = new SASWrapper.GetDebitScheduleBySFId();
        getDebitSchedule.RemoteID = clientSFId;
        String requestBody = JSON.serialize(getDebitSchedule, true);
        System.HttpResponse response = doCalloutWithJSONBody(requestBody, 'GetDebitSchedule', clientSFId, false);
        API_Response result = parseResponse(response, null, 'GetDebitSchedule');
        return result;
    }
    
    public static API_Response getDebitScheduleById(String clientSFId){
        String clientSASId;
        SASWrapper.GetDebitScheduleBySFId getDebitSchedule = new SASWrapper.GetDebitScheduleBySFId();
        getDebitSchedule.CustomerID = clientSFId;
        String requestBody = JSON.serialize(getDebitSchedule, true);
        System.HttpResponse response = doCalloutWithJSONBody(requestBody, 'GetDebitSchedule', clientSFId, false);
        API_Response result = parseResponse(response, null, 'GetDebitScheduleBySfId');
        return result;
    }

    public static API_Response syncSettlements(SyncSettlementsRequest request) {
        API_Response settlementScheduleResult = new API_Response();
        if (request != null && request.settlementWrapList != null && !request.settlementWrapList.isEmpty() && String.isNotBlank(request.apiMethod)) {
            List<Id> sobjectSFIds = new List<Id>();
            String apiMethod = request.apiMethod;
            List<SASWrapper.Settlement> settlementInstances = new List<SASWrapper.Settlement>();
            List<LineItemResponse> validationErrors = new List<LineItemResponse>();
            SettlementWrapper firstSettlementInstance;
            for (SettlementWrapper settlementWrap : request.settlementWrapList) {
                LineItemResponse lineItemResult = new LineItemResponse();
                String errorMsg = SASValidation.settlementsValidation(settlementWrap);
                if (String.isNotBlank(errorMsg)) {
                    lineItemResult.isSuccess = false;
                    lineItemResult.errorMessage = errorMsg;
                    lineItemResult.sfId = settlementWrap.recordId;
                    validationErrors.add(lineItemResult);
                } else {
                    if (firstSettlementInstance == null) {
                        firstSettlementInstance = settlementWrap;
                    }
                    SASWrapper.Settlement settlementInstance = constructSettlementsInstance(settlementWrap, apiMethod); 
                    settlementInstances.add(settlementInstance);
                    sobjectSFIds.add(settlementWrap.recordId);
                }
            }
            if (settlementInstances != null && !settlementInstances.isEmpty()) {
                SASWrapper.SettlmentSchedule settlementScheduleInstance = new SASWrapper.SettlmentSchedule();
                settlementScheduleInstance.CustomerID = firstSettlementInstance.clientExternalProcId;
                if (apiMethod == SettlementUtil.SAS_API_CREATE_SETTLEMENT_SCHEDULE) {
                    settlementScheduleInstance.DebitScheduleID = firstSettlementInstance.debitScheduleId;
                    settlementScheduleInstance.Settlements = settlementInstances;
                } else if (apiMethod == SettlementUtil.SAS_API_UPDATE_PAYOUTS || apiMethod == SettlementUtil.SAS_API_CANCEL_PAYOUTS) {
                    settlementScheduleInstance.Payouts = settlementInstances;
                }
                String requestBody = JSON.serialize(settlementScheduleInstance, true);
                requestBody = requestBody.replaceAll('Date_x', 'Date');
                String apiMethodSAS = (apiMethod == SettlementUtil.SAS_API_CANCEL_PAYOUTS ? SettlementUtil.SAS_API_UPDATE_PAYOUTS : apiMethod);
                System.HttpResponse response = doCalloutWithJSONBody(requestBody, apiMethodSAS, firstSettlementInstance.recordId, false);
                settlementScheduleResult = parseResponse(response, sobjectSFIds, null);
            }
            if (!validationErrors.isEmpty() && settlementScheduleResult != null) {
                if (settlementScheduleResult.results == null) {
                    settlementScheduleResult.results = validationErrors;
                } else {
                    settlementScheduleResult.results.addAll(validationErrors);
                }
            }
        }
        return settlementScheduleResult;
    }

    public static SASWrapper.Settlement constructSettlementsInstance(SettlementWrapper settlementWrap, String apiMethod) {
        SASWrapper.Settlement settlementInstance = new SASWrapper.Settlement();
        if (apiMethod == SettlementUtil.SAS_API_CREATE_SETTLEMENT_SCHEDULE) {
            settlementInstance.PayeeID = settlementWrap.payeeId;
            settlementInstance.PayoutDate = ApexUtil.stringValue(settlementWrap.settlementDate); 
            settlementInstance.Amount = ApexUtil.stringValue(settlementWrap.settlementAmount); 
        } else if (apiMethod == SettlementUtil.SAS_API_UPDATE_PAYOUTS) {
            settlementInstance.PayoutID = settlementWrap.settlementExternalProcId;
            settlementInstance.Date_x = ApexUtil.stringValue(settlementWrap.settlementDate);  
            settlementInstance.Amount = ApexUtil.stringValue(settlementWrap.settlementAmount);
        } else if (apiMethod == SettlementUtil.SAS_API_CANCEL_PAYOUTS) {
            settlementInstance.PayoutID = settlementWrap.settlementExternalProcId;
            settlementInstance.Date_x = ApexUtil.stringValue(settlementWrap.settlementDate);  
            settlementInstance.Amount = String.valueOf(0.00);
        }
        return settlementInstance;
    }

    public static API_Response uploadContract(UploadContractRequest request) {
        ApexUtil.requireValue('Update Contract Request', request);
        API_Response result =  new API_Response();
        String errorMessage = SASValidation.contractValidation(request.fileWrap);
        if (String.isNotBlank(errorMessage)) {
            result = constructErrorResponse(errorMessage);
        } else {
            SASWrapper.SyncContract syncContractRequest = constructContractRequest(request.fileWrap);
            String requestBody = JSON.serialize(syncContractRequest, true);
            System.HttpResponse response = doCalloutWithJSONBody(requestBody, 'CreateDocument', request.fileWrap.clientSFId, false);
            result = parseResponse(response, null, null);
        }
        return result;
    }

    private static SASWrapper.SyncContract constructContractRequest(FileWrapper fileWrap) {
        SASWrapper.SyncContract syncContract = new SASWrapper.SyncContract();
        syncContract.CustomerID = fileWrap.clientExtProcId;
        syncContract.RemoteID = fileWrap.clientSFId;
        syncContract.Document = fileWrap.contractDetails;
        syncContract.FileName = fileWrap.fileName;
        return syncContract;
    }

    public static API_Response syncPayee(PayeeRequest request) {
        ApexUtil.requireValue('Payee Request', request);
        API_Response result =  new API_Response();
        String errorMessage = SASValidation.payeeValidation(request.clientWrap);
        if (String.isNotBlank(errorMessage)) {
            result = constructErrorResponse(errorMessage);
        } else {
            SASWrapper.SyncPayee payeeRequest = constructPayeeRequest(request.clientWrap);
            String requestBody = JSON.serialize(payeeRequest, true);
            System.HttpResponse response;
            if (String.isNotBlank(payeeRequest.PayeeID)) {
                response = doCalloutWithJSONBody(requestBody, 'UpdatePayee', request.clientWrap.recordId, false);
            } else {
                response = doCalloutWithJSONBody(requestBody, 'CreatePayeeAccount', request.clientWrap.recordId, false);
            }
            result = parseResponse(response, null, null);
            if (String.isNotBlank(payeeRequest.PayeeID)) {
                result.externalId = payeeRequest.PayeeID;
            }
        }
        return result;
    }

    private static SASWrapper.SyncPayee constructPayeeRequest(ClientWrapper clientWrap) {
        SASWrapper.SyncPayee payeeWrapOutput = new SASWrapper.SyncPayee();
        payeeWrapOutput.PayeeID = clientWrap.externalSASId;
        payeeWrapOutput.RemoteID = clientWrap.recordId;
        payeeWrapOutput.FirstName = clientWrap.firstName;
        payeeWrapOutput.LastName = clientWrap.lastName;
        payeeWrapOutput.Company = clientWrap.companyName;
        payeeWrapOutput.SsnTid = clientWrap.taxId;
        payeeWrapOutput.Email = clientWrap.email;
        payeeWrapOutput.Phone1 = clientWrap.phone;
        payeeWrapOutput.Address1 = clientWrap.address;
        payeeWrapOutput.City = clientWrap.city;
        payeeWrapOutput.State = clientWrap.state;
        payeeWrapOutput.PostalCode = clientWrap.postalCode;
        payeeWrapOutput.Country = clientWrap.country;
        return payeeWrapOutput;
    }

    /**
     * @description: Method to do callout to get the trust balances for all of the customers.
     * @return apiResponse - Wrapper to store the parsed response from getBalances callout. 
     */
    public static API_Response getBalances() {
        API_Response result =  new API_Response();
        System.HttpResponse response = doCallout(null, 'GetBalances');
        result = parseResponse(response, null, null);
        return result;
    }
    
    /**
     * @description: Method to do callout to request bulk customer information.
     * @return apiResponse - Wrapper to store the parsed response from getCustomerRecords callout. 
     */
    public static API_Response getCustomerRecords(Datetime startDateTime, Datetime endDateTime) {
        API_Response result =  new API_Response();
        //Create body parameter 
        Map<string,string> urlParams = new Map<string,string> {
            'DateStart'=>startDateTime.format('yyyy-MM-dd\'T\'HH:mm:ss.SSS'),
            'DateEnd'=>endDateTime.format('yyyy-MM-dd\'T\'HH:mm:ss.SSS')
        };
        String requestBody = toUrlParams(urlParams);
        System.HttpResponse response = doCallout(requestBody, 'GetCustomerRecords');
        result = parseResponse(response, null, null);
        return result;
    }

    /**
     * @description: Method to do callout to get the status of the payment.
     * @return apiResponse - Wrapper to store the parsed response from getPaymentStatus callout. 
     */
    public static API_Response getPaymentStatus() {
        API_Response result =  new API_Response();
        System.HttpResponse response = doCallout(null, 'GetPaymentStatusBulk');
        result = parseResponse(response, null, null);
        return result;
    }

    public static String constructRequest(Map<String, Object> untypedMap, Map<String, String> fieldNameAPINodeMap) {
        String requestBody = ''; 
        if (untypedMap != null && !untypedMap.isEmpty()) {
            for (String fieldName : untypedMap.keySet()) {
                if (fieldNameAPINodeMap.containsKey(fieldName)) {
                    Object fieldValue = untypedMap.get(fieldName);
                    if (fieldValue != null) {
                        requestBody += fieldNameAPINodeMap.get(fieldName) + '=' + EncodingUtil.urlEncode(String.valueOf(fieldValue), 'UTF-8') + '&';
                    }
                }
            }
            requestBody = requestBody.removeEnd('&');
        }
        return requestBody;
    }

    private static System.HttpResponse doCallout(String requestBody, String apiMethod) {
        Http http = new Http();
        HttpRequest request = new HttpRequest();
        System.HttpResponse response = new System.HttpResponse();
        String reqUrl = new SASSettings().endpoint;
        if (String.isBlank(reqUrl)) {
            throw new CustomException('SAS Endpoint is blank');
        } else {
            reqUrl += '&Method=' + apiMethod;
        }
        request.setEndpoint(reqUrl);
        request.setMethod('POST');
        request.setHeader('Content-Type','application/x-www-form-urlencoded');
        request.setHeader('Content-Length','0');
        if (String.isNotBlank(requestBody)) {
            request.setBody(requestBody);
        }
        try {
            response = new System.Http().send(request);
            ApplicationLogger.logCalloutSuccess(reqUrl, request, response, apiMethod+' Callout request sent to SAS', null);
            return response;
        } catch(System.Exception exp) { 
            ApplicationLogger.logCalloutException(reqUrl, request, response, exp, null);
        }
        return null;
    }

    public static System.HttpResponse doCalloutWithJSONBody(String requestBody, String apiMethod, String recordId, Boolean isModifyResponse) {
        Http http = new Http();
        HttpRequest request = new HttpRequest();
        System.HttpResponse response = new System.HttpResponse();
        SASSettings sasSettingInstance = new SASSettings();
        String reqUrl = sasSettingInstance.endpoint;
        String securityKey = sasSettingInstance.securityKey;
        if (String.isBlank(reqUrl)) {
            throw new CustomException('SAS Endpoint is blank');
        } else {
            reqUrl += '&Method=' + apiMethod;
        }
        request.setEndpoint(reqUrl);
        request.setMethod('POST');
        request.setHeader('Content-Type','application/json');
        if (String.isNotBlank(securityKey)) {
            request.setHeader('X-SecurityKey',securityKey);
        }
        if (String.isNotBlank(requestBody)) {
            request.setBody(requestBody);
        }
        try {
            response = new System.Http().send(request);
            if(isModifyResponse){                
                Map<String, Object> bodyMap= (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
                //bodyMap.remove('ProcessData');
                ApplicationLogger.logCalloutSuccessWithRequiredResponse(reqUrl, request, JSON.serialize(bodyMap), apiMethod+' Callout request sent to SAS', null);
            }else{
                ApplicationLogger.logCalloutSuccess(reqUrl, request, response, apiMethod+' Callout request sent to SAS', recordId);
            }  
            return response;
        } catch(System.Exception exp) { 
            ApplicationLogger.logCalloutException(reqUrl, request, response, exp, null);
        }
        return null;
    }

    public static API_Response parseResponse(System.HttpResponse response, List<Id> sObjectSFIds, String apiMethod) {
        API_Response result = new API_Response();
        result.isSuccess = false;
        if (response != null) {
            System.debug('response.getBody()---->'+response.getBody());
            SASWrapper.SAS_RESPONSE responseWrap = (SASWrapper.SAS_RESPONSE)JSON.deserialize(response.getBody(), SASWrapper.SAS_RESPONSE.class);
            result.status = response.getStatus();
            result.statusCode = String.valueOf(response.getStatusCode());
            if (response.getStatusCode() == 200) {
                if (responseWrap != null) {
                    result.message = responseWrap.Message;
                    if (responseWrap.Success == 'true') {
                        result.isSuccess = true;
                        if (responseWrap.PrimaryKeyID != null) {
                            if (responseWrap.PrimaryKeyID.isNumeric()) {
                                if (Integer.valueOf(responseWrap.PrimaryKeyID) > 0) {
                                    result.externalId = responseWrap.PrimaryKeyID;
                                 } else if (apiMethod == 'GetCustomerRecords' && responseWrap.ProcessData != null) {
                                    List<SASWrapper.ProcessDataDetails> processDataList = (List<SASWrapper.ProcessDataDetails>)JSON.deserialize(responseWrap.ProcessData, List<SASWrapper.ProcessDataDetails>.class);
                                    result.externalId = processDataList[0].id;
                                    result.processData = responseWrap.ProcessData;
                                } else if (apiMethod == 'GetUpdatedDebits' && responseWrap.ProcessData != null) {
                                    result.processData = responseWrap.ProcessData;
                                    result.externalId = responseWrap.PrimaryKeyID;
                                } else if (apiMethod == 'GetDebitSchedule' && responseWrap.ProcessData != null) {
                                    Map<String, Object> resultMap = (Map<String, Object>)JSON.deserializeUntyped(responseWrap.ProcessData);
                                    if (resultMap != null) {
                                        if (resultMap.size() > 1) {
                                            result.isSuccess = false;
                                            result.message = 'More than one Debit Schedules found in SAS. Please correct it manually.';
                                        } else if (resultMap.size() == 1) {
                                            GetDebitScheduleResponse getDebitsResponse = new GetDebitScheduleResponse();
                                            String schedules = JSON.serialize(resultMap.get('Schedules0'));
                                            Map<String, Object> schedulesMap = (Map<String, Object>)JSON.deserializeUntyped(schedules);
                                            getDebitsResponse.debitScheduleId = String.valueOf(schedulesMap.get('ScheduleID'));
                                            getDebitsResponse.sfIdSasIdMap = new Map<String, String>();
                                            String debits = JSON.serialize(schedulesMap.get('Debits'));
                                            Map<String, Object> debitsMap = (Map<String, Object>)JSON.deserializeUntyped(debits);
                                            List<Object> debitsList = debitsMap.values();
                                            for (Integer i=0; i<debitsList.size(); i++) {
                                                String debitsElement = JSON.serialize(debitsList[i]);
                                                Map<String, Object> debitsElementMap = (Map<String, Object>)JSON.deserializeUntyped(debitsElement);
                                                if (debitsElementMap.containsKey('DebitRemoteID') && debitsElementMap.get('DebitRemoteID') != null) {
                                                    getDebitsResponse.sfIdSasIdMap.put(String.valueOf(debitsElementMap.get('DebitRemoteID')), String.valueOf(debitsElementMap.get('DebitID')));
                                                } 
                                            }
                                            result.getDebits = getDebitsResponse;
                                        }
                                    }
                                } else if (apiMethod == 'GetDebitScheduleBySfId' && responseWrap.ProcessData != null){
                                     Map<String, Object> resultMap = (Map<String, Object>)JSON.deserializeUntyped(responseWrap.ProcessData);
                                    if (resultMap != null) {
                                        if (resultMap.size() > 1) {
                                            result.isSuccess = false;
                                            result.message = 'More than one Debit Schedules found in SAS. Please correct it manually.';
                                        } else if (resultMap.size() == 1) {
                                            GetDebitScheduleResponse getDebitsResponse = new GetDebitScheduleResponse();
                                            String schedules = JSON.serialize(resultMap.get('Schedules0'));
                                            Map<String, Object> schedulesMap = (Map<String, Object>)JSON.deserializeUntyped(schedules);
                                            getDebitsResponse.debitScheduleId = String.valueOf(schedulesMap.get('ScheduleID'));
                                            getDebitsResponse.sfIdSasIdMap = new Map<String, String>();
                                            result.processData = JSON.serialize(schedulesMap.get('Debits'));
                                        }
                                    }
                                }
                            }else {
                                result.externalId = responseWrap.PrimaryKeyID;
                            }
                        }
                    }                   
                    
                    if (responseWrap.Records != null) {
                        result.recordsCount = Integer.valueOf(responseWrap.Records);
                    }
                    //result.processData = responseWrap.ProcessData;
                    if (responseWrap.Records != null) {
                        result.recordsCount = Integer.valueOf(responseWrap.Records);
                    }
                    if (responseWrap.JsonData != null) {
                        List<LineItemResponse> apiResults = new List<LineItemResponse>();
                        Integer counter = 0;
                        for (SASWrapper.SAS_RESPONSE_DATA responseLineItem : responseWrap.JsonData) {
                            Id sObjectSFId = sObjectSFIds[counter];
                            counter++;
                            LineItemResponse resultLineItem = new LineItemResponse();
                            resultLineItem.sfId = sObjectSFId;
                            if (responseLineItem.Success == 'true') {
                                resultLineItem.isSuccess = true;
                                if (responseLineItem.DebitID != null) {
                                    if (responseLineItem.DebitID.isNumeric()) {
                                        if (Integer.valueOf(responseLineItem.DebitID) > 0) {
                                            resultLineItem.externalId = responseLineItem.DebitID;
                                        }
                                    } else {
                                        resultLineItem.externalId = responseLineItem.DebitID;
                                    }
                                } else if (responseLineItem.PayoutID != null) {
                                    if (responseLineItem.PayoutID.isNumeric()) {
                                        if (Integer.valueOf(responseLineItem.PayoutID) > 0) {
                                            resultLineItem.externalId = responseLineItem.PayoutID;
                                        }
                                    } else {
                                        resultLineItem.externalId = responseLineItem.PayoutID;
                                    }
                                }
                            }
                            apiResults.add(resultLineItem);
                        }
                        result.results = apiResults;
                    }
                }
            } else {
                result.isSuccess = false;
                result.message = response.getStatus();
            } 
        }
        return result;
    }


    private static API_Response constructErrorResponse(String errorMessage) {
        API_Response result = new API_Response();
        result.message = errorMessage;
        return result;
    }

    private static String toUrlParams(Map<String,String> params){
        List<String> paramsList = new List<String>();
        for(String k :params.keySet()){
            string val=params.get(k);
            paramsList.add(k + '=' + (val!=null?EncodingUtil.URLENCODE(params.get(k),'UTF-8'):''));
        }
        return String.join(paramsList, '&');
    }
    
    /**
     * @description: Method to do callout to get debit schedule for all of the customers.
     * @return apiResponse - Wrapper to store the parsed response from getDebitSchedule callout. 
     */
    public static API_Response getDebitSchedule(Datetime startDateTime, Datetime endDateTime, Integer currentPage, Integer pageSize) {
        API_Response result =  new API_Response();
        SASWrapper.UpdateDebit getUpdateDebit = new SASWrapper.UpdateDebit();
        getUpdateDebit.StartDate = String.valueOf(startDateTime.format('yyyy-MM-dd\'T\'HH:mm:ss.SSS','America/Los_Angeles'));
        getUpdateDebit.EndDate = String.valueOf(endDateTime.format('yyyy-MM-dd\'T\'HH:mm:ss.SSS','America/Los_Angeles'));
        getUpdateDebit.CurrentPage = String.valueOf(currentPage);
        getUpdateDebit.PageSize = String.valueof(pageSize);
        
        String requestBody = JSON.serialize(getUpdateDebit, true);
        System.HttpResponse response = doCalloutWithJSONBody(requestBody, 'GetUpdatedDebits', null, true);
        result = parseResponse(response, null, 'GetUpdatedDebits');
        return result;
    }
}