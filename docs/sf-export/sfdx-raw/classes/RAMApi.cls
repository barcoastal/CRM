/**
 * Class contains specific methods for SAS Processor to do the callouts.
 */
public inherited sharing class RAMApi extends ProcessorWrapper implements PaymentProcessor {
    public static String env = 'http://schemas.xmlsoap.org/soap/envelope/';
    public static String XSI = 'http://www.w3.org/2001/XMLSchema-instance';
    public static String soapXSD = 'http://www.w3.org/2001/XMLSchema';
    public static String XMLNS = 'http://www.w3.org/2003/05/soap-envelope';
    public static String XSD = 'http://www.ramservicing.com/';
    public static String endpoint;
    public static String apiKey;
    public static String affiliateId;
    public static String feeSplitGroupId;
    public static String sessionId;
    public static String clientId;
    public static FINAL String CLIENT_NUMBER = 'clientNumber';

    public static API_Response createClient(CreateClientRequest request, CreateBankAccountRequest bankAccountRequest) {
        API_Response result = new API_Response();
        if (request != null && bankAccountRequest != null) {
            if (request.clientWrap != null && String.isNotBlank(request.clientWrap.externalRAMId)) {
                result = updateClientService(request.clientWrap);
            } else {
                result = createClientService(request.clientWrap);
            }
        }
        return result;
    }

    public static API_Response createClientService(ClientWrapper clientWrap) {
        API_Response result =  new API_Response();
        if (String.isBlank(apiKey)) {
            getRAMSCredentials();
        }
        clientWrap = getSetupValuesForAPI(clientWrap);
        String errorMessage = RAMValidation.clientValidation(clientWrap, RAMWrapper.createClientRequiredField);
        if (String.isNotBlank(errorMessage)) {
            result = constructErrorResponse(errorMessage);
        } else {
            if (String.isBlank(sessionId)) {
                getSessionId();
                ApexUtil.requireValue('Session Id for RAM processor', sessionId);
            }
            Map<String, Object> untypedMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(clientWrap));
            getClientId(untypedMap);
            DOM.Document doc = new DOM.Document();
            dom.XmlNode envelope  = doc.createRootElement('Envelope', env, 'soap');
            envelope.setNamespace('xsi', XSI);
            envelope.setNamespace('xsd', soapXSD);
            dom.XmlNode body =  envelope.addChildElement('Body', env, 'soap');
            dom.XmlNode newClient =  body.addChildElement('NewClient', XSD , '');
            newClient.addChildElement('sessid', null, null).addTextNode(sessionId);
            addChildElementToDoc(untypedMap, newClient, RAMWrapper.createClientMap);
            HttpClient httpClientInst = new HttpClient();
            HttpClient.HttpResponseWrapper responseWrapper;
            try {
                httpClientInst.method = HttpClient.Methods.POST;
                httpClientInst.endpoint = endpoint;
                httpClientInst.bodyDocument = doc;
                Map<String, String> headerMap = new Map<String, String> ();
                headerMap.put('Content-Type', 'text/xml;');
                headerMap.put('Method', 'CreateClient');
                httpClientInst.headerMap = headerMap;
                httpClientInst.timeout = 120000;
                responseWrapper = httpClientInst.sendRequest();
                result = parseResponse(responseWrapper.baseResponse);
                if (result.statusCode == '200') {
                    ApplicationLogger.logXMLCalloutSuccess(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Create Client - Callout request sent to RAMS', null);
                } else {
                    ApplicationLogger.logXMLCalloutFailure(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Create Client - Callout request sent to RAMS. ' + result.message, null);
                }
            } catch(System.Exception exp) { 
                ApplicationLogger.logCalloutException(endpoint, httpClientInst.constructedRequest, null, exp, null);
            }
        }
        return result;
    }

    public static API_Response updateClient(UpdateClientRequest request) {
        ApexUtil.requireValue('Update Client Request', request);
        return updateClientService(request.clientWrap);
    }

    public static API_Response updateClientService(ClientWrapper clientWrap) {
        API_Response result =  new API_Response();
        if (String.isBlank(apiKey)) {
            getRAMSCredentials();
        }
        clientWrap = getSetupValuesForAPI(clientWrap);
        String errorMessage = RAMValidation.clientValidation(clientWrap, RAMWrapper.updateClientRequiredField);
        if (String.isNotBlank(errorMessage)) {
            result = constructErrorResponse(errorMessage);
        } else {
            if (String.isBlank(sessionId)) {
                getSessionId();
                ApexUtil.requireValue('Session Id for RAM processor', sessionId);
            }
            Map<String, Object> untypedMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(clientWrap));
            DOM.Document doc = new DOM.Document();
            dom.XmlNode envelope  = doc.createRootElement('Envelope', env, 'soap');
            envelope.setNamespace('xsi', XSI);
            envelope.setNamespace('xsd', soapXSD);
            dom.XmlNode body =  envelope.addChildElement('Body', env, 'soap');
            dom.XmlNode updateClient =  body.addChildElement('UpdateClient', XSD , '');
            updateClient.addChildElement('sessid', null, null).addTextNode(sessionId);
            addChildElementToDoc(untypedMap, updateClient, RAMWrapper.updateClientMap);
            HttpClient httpClientInst = new HttpClient();
            HttpClient.HttpResponseWrapper responseWrapper;
            try {
                httpClientInst.method = HttpClient.Methods.POST;
                httpClientInst.endpoint = endpoint;
                httpClientInst.bodyDocument = doc;
                Map<String, String> headerMap = new Map<String, String> ();
                headerMap.put('Content-Type', 'text/xml;charset=UTF-8');
                headerMap.put('Method', 'UpdateClient');
                httpClientInst.headerMap = headerMap;
                httpClientInst.timeout = 120000;
                responseWrapper = httpClientInst.sendRequest();
                result = parseResponseUpdateClient(responseWrapper.baseResponse);
                if (result.statusCode == '200') {
                    ApplicationLogger.logXMLCalloutSuccess(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Update Client - Callout request sent to RAMS', null);
                } else {
                    ApplicationLogger.logXMLCalloutFailure(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Update Client - Callout request sent to RAMS. ' + result.message, null);
                }
            } catch(System.Exception exp) {
                ApplicationLogger.logCalloutException(endpoint, httpClientInst.constructedRequest, null, exp, null);
            }
        }
        return result;
    }
    
    /* Create and Update bankaccount has same API, we need to pass ClientID field which has id for account, it will update the bank details under that account. */
    public static API_Response createBankAccount(ProcessorWrapper.CreateBankAccountRequest request) {
        ApexUtil.requireValue('Create Bank Account Request', request);
        return bankAccountCallout(request.bankAccountWrap, RAMWrapper.createBankAccountMap);
    }

    public static API_Response updateBankAccount(ProcessorWrapper.UpdateBankAccountRequest request) {
        ApexUtil.requireValue('Update Bank Account Request', request);
        return bankAccountCallout(request.bankAccountWrap, RAMWrapper.updateBankAccountMap);
    }

    public static API_Response bankAccountCallout(BankAccountWrapper bankAccountWrap, Map<String, String> addElementBankAccountMap) {
        API_Response result =  new API_Response();
        String errorMessage = RAMValidation.bankAccountValidation(bankAccountWrap, RAMWrapper.bankAccountRequiredField);
        if (String.isNotBlank(errorMessage)) {
            result = constructErrorResponse(errorMessage);
        } else {
            if (String.isBlank(apiKey)) {
                getRAMSCredentials();                
            }
            if (String.isBlank(sessionId)) {
                getSessionId();
                ApexUtil.requireValue('Session Id for RAM processor', sessionId);
            }
            bankAccountWrap.bankAccountType = RAMWrapper.getBankAccountType(bankAccountWrap.bankAccountType);
            Map<String, Object> untypedMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(bankAccountWrap));
            DOM.Document doc = new DOM.Document();
            dom.XmlNode envelope  = doc.createRootElement('Envelope', env, 'soap');
            envelope.setNamespace('xsi', XSI);
            envelope.setNamespace('xsd', soapXSD);
            dom.XmlNode body =  envelope.addChildElement('Body', env, 'soap');
            dom.XmlNode bankAccount =  body.addChildElement('AddUpdateClientBanking', XSD , '');
            bankAccount.addChildElement('sessid', null, null).addTextNode(sessionId);
            addChildElementToDoc(untypedMap, bankAccount, addElementBankAccountMap);
            HttpClient httpClientInst = new HttpClient();
            HttpClient.HttpResponseWrapper responseWrapper;
            try {
                httpClientInst.method = HttpClient.Methods.POST;
                httpClientInst.endpoint = endpoint;
                httpClientInst.bodyDocument = doc;
                Map<String, String> headerMap = new Map<String, String> ();
                headerMap.put('Content-Type', 'text/xml;');
                headerMap.put('Method', 'AddUpdateBankAccount');
                httpClientInst.headerMap = headerMap;
                httpClientInst.timeout = 120000;
                responseWrapper = httpClientInst.sendRequest();
                result = parseBankAccountResponse(responseWrapper.baseResponse);
                if (result.statusCode == '200') {
                        ApplicationLogger.logXMLCalloutSuccess(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Bank Account - Callout request sent to RAMS', null);
                    } else {
                        ApplicationLogger.logXMLCalloutFailure(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Bank Account - Callout request sent to RAMS. ' + result.message, null);
                    }
            } catch(System.Exception exp) { 
                ApplicationLogger.logCalloutException(endpoint, httpClientInst.constructedRequest, null, exp, null);
            }
        }
        return result;
    }

    public static API_Response createDraft(CreateDraftRequest request) {
        API_Response result =  new API_Response();
        ApexUtil.requireValue('Create Draft Request', request);
        
        for(DraftWrapper.RAMFeeRecord fee: request.draftWrap.RAMFeeRecords){
            if(fee.FeeType == FeeUtil.RT_CITADEL_FEE){
                request.draftWrap.totalAmount = request.draftWrap.totalAmount + fee.Amount;
                request.draftWrap.totalAmountExclMPA = request.draftWrap.totalAmountExclMPA + fee.Amount;
            }
        }
        
        if (request.draftWrap != null && String.isBlank(request.draftWrap.externalRAMId) && request.draftWrap.draftStatus == DraftUtil.STATUS_PENDING) {           
            result = createDraftService(request.draftWrap);
        } else {
            if(request.draftWrap.draftStatus == DraftUtil.STATUS_CANCELLED || request.draftWrap.draftStatus == DraftUtil.STATUS_SKIPPED){
                result = cancelDraftService(request.draftWrap);            
            }else{
                result = updateDraftService(request.draftWrap);
            }
        } 
        return result;
    }
    public static API_Response createDraftService(DraftWrapper draftWrap) {
        API_Response result =  new API_Response();
        String errorMessage = RAMValidation.draftValidation(draftWrap, RAMWrapper.createDraftRequiredField);
        if (String.isNotBlank(errorMessage)) {
            result = constructErrorResponse(errorMessage);
            /* If any field is not populated/queried, then the returned draft validation error message it should be logged since we won't show them in UI. */
            ApplicationLogger.logException('Create Draft Callout RAMS - Draft data validation.', draftWrap.recordId, errorMessage);
        } else {
            if (String.isBlank(apiKey)) {
                getRAMSCredentials();                
            }
            if (String.isBlank(sessionId)) {
                getSessionId();
                ApexUtil.requireValue('Session Id for RAM processor', sessionId);
            }
            String existingPaymentId = getPaymentIdByExtendedId(draftWrap.recordId);

            if (String.isBlank(existingPaymentId)) {
            Map<String, Object> untypedMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(draftWrap));
            DOM.Document doc = new DOM.Document();
            dom.XmlNode envelope  = doc.createRootElement('Envelope', env, 'soap');
            envelope.setNamespace('xsi', XSI);
            envelope.setNamespace('xsd', soapXSD);
            dom.XmlNode body =  envelope.addChildElement('Body', env, 'soap');
            dom.XmlNode newDraft =  body.addChildElement('PayScheduleAddSingle', XSD , '');
            newDraft.addChildElement('Sessid', null, null).addTextNode(sessionId);
            addChildElementToDoc(untypedMap, newDraft, RAMWrapper.createDraftMap);
            addChildFeeElementToDoc(draftWrap.RAMFeeRecords, newDraft, RAMWrapper.draftFeeMap());
            HttpClient httpClientInst = new HttpClient();
            HttpClient.HttpResponseWrapper responseWrapper;
            try {
                httpClientInst.method = HttpClient.Methods.POST;
                httpClientInst.endpoint = endpoint;
                httpClientInst.bodyDocument = doc;
                Map<String, String> headerMap = new Map<String, String> ();
                headerMap.put('Content-Type', 'text/xml;');
                headerMap.put('Method', 'CreateDraftAndFees');
                httpClientInst.headerMap = headerMap;
                httpClientInst.timeout = 120000;
                responseWrapper = httpClientInst.sendRequest();
                result = parseDraftPaymentResponse(responseWrapper.baseResponse, true);
                if (result.statusCode == '200') {
                    ApplicationLogger.logXMLCalloutSuccess(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Create Draft - Callout request sent to RAMS', null);
                } else {
                    ApplicationLogger.logXMLCalloutFailure(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Create Draft - Callout request sent to RAMS. ' + result.message, null);
                }
            } catch(System.Exception exp) { 
                ApplicationLogger.logCalloutException(endpoint, httpClientInst.constructedRequest, null, exp, null);
            }
            }else {
            draftWrap.externalRAMId = existingPaymentId;
            result = updateDraftService(draftWrap);
            }
        }
        return result;
    }
    
    public static String getPaymentIdByExtendedId(String extendedId) {
        if (String.isBlank(extendedId)) {
            return null;
        }

        DOM.Document doc = new DOM.Document();
        dom.XmlNode envelope  = doc.createRootElement('Envelope', env, 'soap');
        envelope.setNamespace('xsi', XSI);
        envelope.setNamespace('xsd', soapXSD);
        dom.XmlNode body =  envelope.addChildElement('Body', env, 'soap');
        dom.XmlNode getPaymentNode =  body.addChildElement('GetPaymentIDByExtendedID', XSD , '');
        getPaymentNode.addChildElement('sessid', null, null).addTextNode(sessionId);
        getPaymentNode.addChildElement('extendedID', null, null).addTextNode(extendedId);

        HttpClient httpClientInst = new HttpClient();
        HttpClient.HttpResponseWrapper responseWrapper;
        try {
            httpClientInst.method = HttpClient.Methods.POST;
            httpClientInst.endpoint = endpoint;
            httpClientInst.bodyDocument = doc;
            Map<String, String> headerMap = new Map<String, String>();
            headerMap.put('Content-Type', 'text/xml; charset=utf-8');
            headerMap.put('Method', 'GetPaymentIDByExtendedID');
            httpClientInst.headerMap = headerMap;
            httpClientInst.timeout = 120000;
            responseWrapper = httpClientInst.sendRequest();
            if (responseWrapper.baseResponse.getStatusCode() == 200) {
               ApplicationLogger.logXMLCalloutSuccess(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'GetPaymentIDByExtendedID - Callout to RAMS', extendedId);
            } else {
              ApplicationLogger.logXMLCalloutFailure(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'GetPaymentIDByExtendedID - Callout to RAMS Failed', extendedId);
            }
            if (responseWrapper != null && responseWrapper.baseResponse.getStatusCode() == 200) {
                Dom.XMLNode bodyResult = getBodyFromResponse(responseWrapper.baseResponse);
                if (bodyResult != null) {
                    Dom.XMLNode resultNode = bodyResult.getChildElement('GetPaymentIDByExtendedIDResponse', XSD)
                        .getChildElement('GetPaymentIDByExtendedIDResult', XSD);
                    if (resultNode != null) {
                        List<Dom.XMLNode> childStringNodes = resultNode.getChildElements();
                        if (childStringNodes != null && childStringNodes.size() >= 2) {    
                            String paymentId = childStringNodes[1].getText();   
                            return (String.isNotBlank(paymentId) ? paymentId : null);
                        }
                    }
                }
            }
        } catch(System.Exception exp) { 
            ApplicationLogger.logCalloutException(endpoint, httpClientInst.constructedRequest, null, exp, null);
        }
        return null;
    }


    public static API_Response updateDraft(UpdateDraftRequest request) {
        ApexUtil.requireValue('Update Draft Request', request);
        return updateDraftService(request.draftWrap);
    }

    public static API_Response updateDraftService(DraftWrapper draftWrap) {
        API_Response result =  new API_Response();
        String errorMessage = RAMValidation.draftValidation(draftWrap, RAMWrapper.updateDraftRequiredField);
        if (String.isNotBlank(errorMessage)) {
            result = constructErrorResponse(errorMessage);
            /* If any field is not populated/queried, then the returned draft validation error message it should be logged since we won't show them in UI. */
            ApplicationLogger.logException('Update Draft Callout RAMS - Draft data validation.', draftWrap.recordId, errorMessage);
        } else {
            if (String.isBlank(apiKey)) {
                getRAMSCredentials();                
            }
            if (String.isBlank(sessionId)) {
                getSessionId();
                ApexUtil.requireValue('Session Id for RAM processor', sessionId);
            }
            Map<String, Object> untypedMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(draftWrap));
            DOM.Document doc = new DOM.Document();
            dom.XmlNode envelope  = doc.createRootElement('Envelope', env, 'soap');
            envelope.setNamespace('xsi', XSI);
            envelope.setNamespace('xsd', soapXSD);
            dom.XmlNode body =  envelope.addChildElement('Body', env, 'soap');
            dom.XmlNode newDraft =  body.addChildElement('PayScheduleUpdateSingle', XSD , '');
            newDraft.addChildElement('Sessid', null, null).addTextNode(sessionId);
            addChildElementToDoc(untypedMap, newDraft, RAMWrapper.updateDraftMap);
            addChildFeeElementToDoc(draftWrap.RAMFeeRecords, newDraft, RAMWrapper.draftFeeMap());
            HttpClient httpClientInst = new HttpClient();
            HttpClient.HttpResponseWrapper responseWrapper;
            try {
                httpClientInst.method = HttpClient.Methods.POST;
                httpClientInst.endpoint = endpoint;
                httpClientInst.bodyDocument = doc;
                Map<String, String> headerMap = new Map<String, String> ();
                headerMap.put('Content-Type', 'text/xml;');
                headerMap.put('Method', 'UpdateDraftAndFees');
                httpClientInst.headerMap = headerMap;
                httpClientInst.timeout = 120000;
                responseWrapper = httpClientInst.sendRequest();
                result = parseDraftPaymentResponse(responseWrapper.baseResponse, false);
                result.externalId = draftWrap.externalRAMId;
                if (result.statusCode == '200') {
                    ApplicationLogger.logXMLCalloutSuccess(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Update Draft - Callout request sent to RAMS', null);
                } else {
                    ApplicationLogger.logXMLCalloutFailure(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Update Draft - Callout request sent to RAMS. ' + result.message, null);
                }
            } catch(System.Exception exp) { 
                ApplicationLogger.logCalloutException(endpoint, httpClientInst.constructedRequest, null, exp, null);
            }
        }
        return result;
    }
    
    public static API_Response cancelDraftService(DraftWrapper draftWrap) {
        API_Response result =  new API_Response();
        String errorMessage = RAMValidation.draftValidation(draftWrap, RAMWrapper.updateDraftRequiredField);
        if (String.isNotBlank(errorMessage)) {
            result = constructErrorResponse(errorMessage);
            /* If any field is not populated/queried, then the returned draft validation error message it should be logged since we won't show them in UI. */
            ApplicationLogger.logException('Cancel Draft Callout RAMS - Draft data validation.', draftWrap.recordId, errorMessage);
        } else {
            if (String.isBlank(apiKey)) {
                getRAMSCredentials();                
            }
            if (String.isBlank(sessionId)) {
                getSessionId();
                ApexUtil.requireValue('Session Id for RAM processor', sessionId);
            }
            DraftWrapper cancelDraftWrap = getCanceldraftWrapper(draftWrap);
            Map<String, Object> untypedMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(cancelDraftWrap));
            DOM.Document doc = new DOM.Document();
            dom.XmlNode envelope  = doc.createRootElement('Envelope', env, 'soap');
            envelope.setNamespace('xsi', XSI);
            envelope.setNamespace('xsd', soapXSD);
            dom.XmlNode body =  envelope.addChildElement('Body', env, 'soap');
            dom.XmlNode newDraft =  body.addChildElement('PayScheduleUpdateSingle', XSD , '');
            newDraft.addChildElement('Sessid', null, null).addTextNode(sessionId);
            addChildElementToDoc(untypedMap, newDraft, RAMWrapper.cancelDraftMap);
            addChildFeeElementToDoc(draftWrap.RAMFeeRecords, newDraft, RAMWrapper.draftFeeMap());
            HttpClient httpClientInst = new HttpClient();
            HttpClient.HttpResponseWrapper responseWrapper;
            try {
                httpClientInst.method = HttpClient.Methods.POST;
                httpClientInst.endpoint = endpoint;
                httpClientInst.bodyDocument = doc;
                Map<String, String> headerMap = new Map<String, String> ();
                headerMap.put('Content-Type', 'text/xml;');
                headerMap.put('Method', 'UpdateDraftAndFees');
                httpClientInst.headerMap = headerMap;
                httpClientInst.timeout = 120000;
                responseWrapper = httpClientInst.sendRequest();
                result = parseDraftPaymentResponse(responseWrapper.baseResponse, false);
                result.externalId = draftWrap.externalRAMId;
                if (result.statusCode == '200') {
                    ApplicationLogger.logXMLCalloutSuccess(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Cancel Draft - Callout request sent to RAMS', null);
                } else {
                    ApplicationLogger.logXMLCalloutFailure(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Cancel Draft - Callout request sent to RAMS. ' + result.message, null);
                }
            } catch(System.Exception exp) { 
                ApplicationLogger.logCalloutException(endpoint, httpClientInst.constructedRequest, null, exp, null);
            }
        }
        return result;
    }
    
    public static DraftWrapper getCanceldraftWrapper(DraftWrapper draftWrap) {
        draftWrap.paymentAmount = 0;
        draftWrap.retainerFee = 0;
        draftWrap.setupFee = 0;
        draftWrap.processorFee = 0;
        draftWrap.serviceFee = 0;
        draftWrap.citaldelFee = 0;
        draftWrap.totalAmount = 0;
        draftWrap.totalAmountExclMPA = 0;
        draftWrap.programFee = 0;
        for(DraftWrapper.RAMFeeRecord ramFee : draftWrap.RAMFeeRecords){
            ramFee.Amount = 0;    
        } 
        return draftWrap;
    }

    public static API_Response uploadContract(UploadContractRequest request) {
        ApexUtil.requireValue('Update Contract Request', request);
        API_Response result =  new API_Response();
        
        if (String.isBlank(apiKey)) {
            getRAMSCredentials();            
        }
        if (String.isBlank(sessionId)) {
            getSessionId();
            ApexUtil.requireValue('Session Id for RAM processor', sessionId);
        }         
        if(String.isBlank(request.fileWrap.clientExtProcId)){
            ApexUtil.requireValue('RAM External Id', request.fileWrap.clientExtProcId);
        } 
        String contractBody = '';
        if(request.fileWrap.contractDetails != null){
            ApexUtil.requireValue('Content Version Data', request.fileWrap.contractDetails);
            contractBody = EncodingUtil.base64Encode(request.fileWrap.contractDetails); 
        }   
        
        DOM.Document doc = new DOM.Document();
        dom.XmlNode envelope  = doc.createRootElement('Envelope', env, 'soap');
        envelope.setNamespace('xsi', XSI);
        envelope.setNamespace('xsd', soapXSD);
        dom.XmlNode body =  envelope.addChildElement('Body', env, 'soap');
        dom.XmlNode documentSync =  body.addChildElement('UploadClientDocument', XSD , '');
        documentSync.addChildElement('sessid', null, null).addTextNode(sessionId);
        documentSync.addChildElement('ClientID', null, null).addTextNode(request.fileWrap.clientExtProcId);
        documentSync.addChildElement('DocType', null, null).addTextNode(request.fileWrap.docType);
        documentSync.addChildElement('DocBody', null, null).addTextNode(contractBody);
        HttpClient httpClientInst = new HttpClient();
        HttpClient.HttpResponseWrapper responseWrapper;
        try {
            httpClientInst.method = HttpClient.Methods.POST;
            httpClientInst.endpoint = endpoint;
            httpClientInst.bodyDocument = doc;
            Map<String, String> headerMap = new Map<String, String> ();
            headerMap.put('Content-Type', 'text/xml;');
            headerMap.put('Method', 'UploadClientDocument');
            httpClientInst.headerMap = headerMap;
            httpClientInst.timeout = 120000;
            responseWrapper = httpClientInst.sendRequest();
            result = parseUploadClientDocumentResponse(responseWrapper.baseResponse);
            if (result.statusCode == '200') {                
                ApplicationLogger.logXMLCalloutSuccess(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Upload Client Document - Callout request sent to RAMS', null);
            } else {
                ApplicationLogger.logXMLCalloutFailure(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Upload Client Document  - Callout request sent to RAMS. ' + result.message, null);
            }
        } catch(System.Exception exp) { 
            ApplicationLogger.logCalloutException(endpoint, httpClientInst.constructedRequest, null, exp, null);
        }
        return result;
    }

    public static API_Response syncPayee(PayeeRequest request) {
        return null;
    }

    public static void getSessionId() {
        ApexUtil.requireValue('API Key for RAM processor', apiKey);
        DOM.Document doc = new DOM.Document();
        dom.XmlNode envelope  = doc.createRootElement('Envelope', env, 'soap');
        envelope.setNamespace('xsi', XSI);
        envelope.setNamespace('xsd', soapXSD);
        dom.XmlNode body =  envelope.addChildElement('Body', env, 'soap');
        dom.XmlNode StartSession =  body.addChildElement('StartSession', XSD , '');
        StartSession.addChildElement('ClientKey', null, null).addTextNode(apiKey);
        HttpClient httpClientInst = new HttpClient();
        HttpClient.HttpResponseWrapper responseWrapper;
        try {
            httpClientInst.method = HttpClient.Methods.POST;
            httpClientInst.endpoint = endpoint;
            httpClientInst.bodyDocument = doc;
            Map<String, String> headerMap = new Map<String, String> ();
            headerMap.put('Content-Type', 'text/xml;charset=UTF-8');
            headerMap.put('Method', 'GetSessionId');
            httpClientInst.headerMap = headerMap;
            httpClientInst.timeout = 120000;
            responseWrapper = httpClientInst.sendRequest();
            ApplicationLogger.logXMLCalloutSuccess(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'GetSessionId - Callout request sent to RAMS', null);
            sessionId = getSessionIdFromElement(responseWrapper.baseResponse);
         } catch(System.Exception exp) {
            ApplicationLogger.logCalloutException(endpoint, httpClientInst.constructedRequest, null, exp, null);
            throw new CustomException(exp.getMessage());
         }
    }

    public static String endSession() {
        
        DOM.Document doc = new DOM.Document();
        dom.XmlNode envelope  = doc.createRootElement('Envelope', env, '');
        dom.XmlNode body =  envelope.addChildElement('Body', env, '');
        dom.XmlNode endSession =  body.addChildElement('EndSession', XSD , '');
        endSession.addChildElement('sessid', null, null).addTextNode(sessionId);
        HttpClient httpClientInst = new HttpClient();
        HttpClient.HttpResponseWrapper responseWrapper;
        try {
            httpClientInst.method = HttpClient.Methods.POST;
            httpClientInst.endpoint = endpoint;
            httpClientInst.bodyDocument = doc;
            Map<String, String> headerMap = new Map<String, String> ();
            headerMap.put('Content-Type', 'text/xml;charset=UTF-8');
            headerMap.put('Method', 'EndSessionId');
            httpClientInst.headerMap = headerMap;
            httpClientInst.timeout = 120000;
            responseWrapper = httpClientInst.sendRequest();
            ApplicationLogger.logXMLCalloutSuccess(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'EndSessionId - Callout request sent to RAMS', null);
        } catch(System.Exception exp) { 
            ApplicationLogger.logCalloutException(endpoint, httpClientInst.constructedRequest, null, exp, null);
        }
        return null;
    }

    public static void addChildElementToDoc(Map<String, Object> untypedMap, dom.XmlNode parentNode, Map<String, String> fieldNameAPINodeMap) {
        if (parentNode != null) {
            for (String fieldName : fieldNameAPINodeMap.keySet()) {
                String textNodeValue;
                if (untypedMap.containsKey(fieldName) && untypedMap.get(fieldName) != null) {
                    //textNodeValue = EncodingUtil.urlEncode(String.valueOf(untypedMap.get(fieldName)), 'UTF-8');
                    textNodeValue = String.valueOf(untypedMap.get(fieldName));
                    parentNode.addChildElement(fieldNameAPINodeMap.get(fieldName), null, null).addTextNode(textNodeValue);
                } else {
                    parentNode.addChildElement(fieldNameAPINodeMap.get(fieldName), null, null);
                }
            }
        }
    }

    /* This method is to iterate list of fee payments and add them to the nodes. */
    public static void addChildFeeElementToDoc(List<DraftWrapper.RAMFeeRecord> RAMFeeRecordList, dom.XmlNode parentNode, Map<String, String> draftFeeMap) {
        Map<String, String> feeMap = new Map<String, String>();
        if (parentNode != null) {
            for (DraftWrapper.RAMFeeRecord RAMFeeRecordInst : RAMFeeRecordList) {
                if (RAMFeeRecordInst.FeeType != null && draftFeeMap.containsKey(RAMFeeRecordInst.FeeType) && draftFeeMap.get(RAMFeeRecordInst.FeeType) != null) {
                    String feeAmount = String.valueOf((RAMFeeRecordInst.Amount != null && RAMFeeRecordInst.Amount > 0) ? RAMFeeRecordInst.Amount : 0);
                        //parentNode.addChildElement(draftFeeMap.get(RAMFeeRecordInst.FeeType), null, null).addTextNode(feeAmount);
                    if(!feeMap.containsKey(draftFeeMap.get(RAMFeeRecordInst.FeeType))){
                        feeMap.put(draftFeeMap.get(RAMFeeRecordInst.FeeType), feeAmount);
                    }else {
                        feeMap.put(draftFeeMap.get(RAMFeeRecordInst.FeeType), String.valueOf(Decimal.valueOf(feeMap.get(draftFeeMap.get(RAMFeeRecordInst.FeeType))) + Decimal.valueOf(feeAmount)));
                    }
                    
                }
            }
            
            for(String key: feeMap.keySet()){
                parentNode.addChildElement(key, null, null).addTextNode(feeMap.get(key));
            }
        }
    }   

    private static String getSessionIdFromElement(HttpResponse res) {
        Dom.XMLNode bodyResult = getBodyFromResponse(res);
        if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false
            && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false) {
            return bodyResult.getChildElements()[0].getChildElements()[0].getText();
        }
        return null;
    }

    private static API_Response parseResponse(HttpResponse response) {
        API_Response result = new API_Response();
        result.status = response.getStatus();
        result.statusCode = String.valueOf(response.getStatusCode());
        if (response.getStatusCode() == 200) {
            Dom.XMLNode bodyResult = getBodyFromResponse(response);
            if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false 
                && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[0].getText().equalsIgnoreCase('OK')) {
                result.isSuccess = true;
                result.externalId = clientId;
            }
        } else if (response.getStatusCode() == 500) {
            result.isSuccess = false;
            result.message = response.getStatus();
            Dom.XMLNode bodyResult = getBodyFromResponse(response);
            if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false 
                && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[1] != null && bodyResult.getChildElements()[0].getChildElements()[1].getText() != null) {
                    result.message += '. ' + bodyResult.getChildElements()[0].getChildElements()[1].getText();
                    result.isSuccess = false;
            }
        } else {
            result.isSuccess = false;
            result.message = response.getStatus();
        } 
        return result;
    }
    
    private static API_Response parseGetSavingsResponse(HttpResponse response) {
        API_Response result = new API_Response();
        result.status = response.getStatus();
        result.statusCode = String.valueOf(response.getStatusCode());
        if (response.getStatusCode() == 200) {
            Dom.XMLNode bodyResult = getBodyFromResponse(response);
            if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false 
                && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements().isEmpty() == false
               ) {
                result.balance = Decimal.valueOf(bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[0].getText());
                result.isSuccess = true;
                result.externalId = clientId;
            }
        } else if (response.getStatusCode() == 500) {
            result.isSuccess = false;
            result.message = response.getStatus();
            Dom.XMLNode bodyResult = getBodyFromResponse(response);
            if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false 
                && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[1] != null && bodyResult.getChildElements()[0].getChildElements()[1].getText() != null) {
                    result.message += '. ' + bodyResult.getChildElements()[0].getChildElements()[1].getText();
                    result.isSuccess = false;
            }
        } else {
            result.isSuccess = false;
            result.message = response.getStatus();
        } 
        return result;
    }
    
    private static API_Response parseGetUpdatedSavingsResponse(HttpResponse response) {
        API_Response result = new API_Response();
        result.status = response.getStatus();
        result.statusCode = String.valueOf(response.getStatusCode());
        if (response.getStatusCode() == 200) {
            Dom.XMLNode bodyResult = getBodyFromResponse(response);      
            
            if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false 
                && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[1].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[1].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[1].getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[1].getChildElements()[0].getChildElements().isEmpty() == false
                ) {
               
                List<GetUpdatedSavingResponse> savingList = new List<GetUpdatedSavingResponse>();
                for (Dom.XmlNode tableNode : bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[1].getChildElements()[0].getChildElements()) {
                    if (tableNode.getName() == 'Table') {
                        Dom.XmlNode vendorNode = tableNode.getChildElement('vendoraccountnumber', null);
                        Dom.XmlNode balanceNode = tableNode.getChildElement('balance', null);  
                        if (balanceNode != null && !String.isBlank(balanceNode.getText()) && vendorNode != null && !String.isBlank(vendorNode.getText())) {
                            GetUpdatedSavingResponse getSaving = new GetUpdatedSavingResponse();
                            getSaving.externalId = vendorNode.getText();
                            getSaving.balance = Decimal.valueOf(balanceNode.getText());
                            savingList.add(getSaving);
                        } 
                    }
                }
                result.processData = JSON.serialize(savingList);
                result.isSuccess = true;
            }
        } else if (response.getStatusCode() == 500) {
            result.isSuccess = false;
            result.message = response.getStatus();
            Dom.XMLNode bodyResult = getBodyFromResponse(response);
            if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false 
                && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[1] != null && bodyResult.getChildElements()[0].getChildElements()[1].getText() != null) {
                    result.message += '. ' + bodyResult.getChildElements()[0].getChildElements()[1].getText();
                    result.isSuccess = false;
            }
        } else {
            result.isSuccess = false;
            result.message = response.getStatus();
        } 
        return result;
    }

     private static API_Response parseGetClientTransactionsByUpdateDateResponse(HttpResponse response) {
        API_Response result = new API_Response();
        result.status = response.getStatus();
        result.statusCode = String.valueOf(response.getStatusCode());
        if (response.getStatusCode() == 200) {
            Dom.XMLNode bodyResult = getBodyFromResponse(response);      
            
            if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false 
                && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[1].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[1].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[1].getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[1].getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[1].getChildElements()[0].getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[1].getChildElements()[0].getChildElements()[0].getChildElements().isEmpty() == false
                ) {
                
                List<GetClientTransactionsByUpdateDateResponse> getClientList = new List<GetClientTransactionsByUpdateDateResponse>();
                for (Dom.XmlNode tableNode : bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[1].getChildElements()[0].getChildElements()) {
                    if (tableNode.getName() == 'table1') {
                        Dom.XmlNode statusNode = tableNode.getChildElement('status', null);
                        Dom.XmlNode clidNode = tableNode.getChildElement('clid', null);
                        Dom.XmlNode paymentIdNode = tableNode.getChildElement('paymentscheduleid', null);
                        GetClientTransactionsByUpdateDateResponse getClientDetail = new GetClientTransactionsByUpdateDateResponse();
                        if (statusNode != null && !String.isBlank(statusNode.getText())) {                            
                            getClientDetail.status = statusNode.getText();
                        }
                        if (clidNode != null && !String.isBlank(clidNode.getText())) {                            
                            getClientDetail.clientExternalId = clidNode.getText();
                        }
                        if (paymentIdNode != null && !String.isBlank(paymentIdNode.getText())) {                            
                            getClientDetail.draftExternalId = paymentIdNode.getText();
                        }
                        getClientList.add(getClientDetail);
                    }
                }
                result.processData = JSON.serialize(getClientList);
                result.isSuccess = true;
            }
        } else if (response.getStatusCode() == 500) {
            result.isSuccess = false;
            result.message = response.getStatus();
            Dom.XMLNode bodyResult = getBodyFromResponse(response);
            if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false 
                && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[1] != null && bodyResult.getChildElements()[0].getChildElements()[1].getText() != null) {
                    result.message += '. ' + bodyResult.getChildElements()[0].getChildElements()[1].getText();
                    result.isSuccess = false;
            }
        } else {
            result.isSuccess = false;
            result.message = response.getStatus();
        } 
        return result;
    }

    private static API_Response parseResponseUpdateClient(HttpResponse response) {
        API_Response result = new API_Response();
        result.status = response.getStatus();
        result.statusCode = String.valueOf(response.getStatusCode());
        if (response.getStatusCode() == 200) {
            Dom.XMLNode bodyResult = getBodyFromResponse(response);
            if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false 
                && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[0].getText() != null && bodyResult.getChildElements()[0].getChildElements()[0].getText().equalsIgnoreCase('OK')) {
                result.isSuccess = true;
            }
        } else if (response.getStatusCode() == 500) {
            result.isSuccess = false;
            result.message = response.getStatus();
            Dom.XMLNode bodyResult = getBodyFromResponse(response);
            if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false 
                && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[1] != null && bodyResult.getChildElements()[0].getChildElements()[1].getText() != null) {
                    result.message += '. ' + bodyResult.getChildElements()[0].getChildElements()[1].getText();
                    result.isSuccess = false;
            }
        } else {
            result.isSuccess = false;
            result.message = response.getStatus();
        } 
        return result;
    }

    private static API_Response parseBankAccountResponse(HttpResponse response) {
        API_Response result = new API_Response();
        result.status = response.getStatus();
        result.statusCode = String.valueOf(response.getStatusCode());
        if (response.getStatusCode() == 200) {
            Dom.XMLNode bodyResult = getBodyFromResponse(response);
                if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false 
                    && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false
                    && bodyResult.getChildElements()[0].getChildElements()[0].getText().equalsIgnoreCase('OK')) {
                    result.isSuccess = true;
                }
        } else if (response.getStatusCode() == 500) {
            result.isSuccess = false;
            result.message = response.getStatus();
            Dom.XMLNode bodyResult = getBodyFromResponse(response);
            if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false 
                && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[1] != null && bodyResult.getChildElements()[0].getChildElements()[1].getText() != null) {
                    result.message += '. ' + bodyResult.getChildElements()[0].getChildElements()[1].getText();
                    result.isSuccess = false;
            }
        } else {
            result.isSuccess = false;
            result.message = response.getStatus();
        } 
        return result;
    }

    private static API_Response parseUploadClientDocumentResponse(HttpResponse response){
        API_Response result = new API_Response();
        result.status = response.getStatus();
        result.statusCode = String.valueOf(response.getStatusCode());
        if (response.getStatusCode() == 200) {
            result.isSuccess = true;
            Dom.XMLNode bodyResult = getBodyFromResponse(response);
            if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false 
                && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[0].getText() != null) {               
                result.externalId = bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[0].getText();
            }
        } else if (response.getStatusCode() == 500) {
            result.isSuccess = false;
            result.message = response.getStatus();
            Dom.XMLNode bodyResult = getBodyFromResponse(response);
            if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false 
                && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[1] != null && bodyResult.getChildElements()[0].getChildElements()[1].getText() != null) {
                    result.message += '. ' + bodyResult.getChildElements()[0].getChildElements()[1].getText();
                    result.isSuccess = false;
            }
        } else {
            result.isSuccess = false;
            result.message = response.getStatus();
        } 
        return result;
    }

    private static API_Response parseDraftPaymentResponse(HttpResponse response, Boolean isCreateApi) {
        API_Response result = new API_Response();
        result.status = response.getStatus();
        result.statusCode = String.valueOf(response.getStatusCode());
        if (response.getStatusCode() == 200) {
            Dom.XMLNode bodyResult = getBodyFromResponse(response);
            if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false 
                && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[0].getText().equalsIgnoreCase('OK')) {
                    result.isSuccess = true;
                    if (isCreateApi) {
                        result.externalId = bodyResult.getChildElements()[0].getChildElements()[0].getChildElements()[1].getText();
                    }
                }
        } else if (response.getStatusCode() == 500) {
            result.isSuccess = false;
            result.message = response.getStatus();
            Dom.XMLNode bodyResult = getBodyFromResponse(response);
            if (bodyResult != null && bodyResult.getChildElements() != null && bodyResult.getChildElements().isEmpty() == false 
                && bodyResult.getChildElements()[0].getChildElements() != null && bodyResult.getChildElements()[0].getChildElements().isEmpty() == false
                && bodyResult.getChildElements()[0].getChildElements()[1] != null && bodyResult.getChildElements()[0].getChildElements()[1].getText() != null) {
                    result.message += '. ' + bodyResult.getChildElements()[0].getChildElements()[1].getText();
                    result.isSuccess = false;
            }
        } else {
            result.isSuccess = false;
            result.message = response.getStatus();
        } 
        return result;
    }

    private static Dom.XMLNode getBodyFromResponse (HttpResponse res) {
        Dom.Document docResult = new Dom.Document();
        docResult.load(res.getbody());
        Dom.XMLNode bodyResult;
        Dom.XMLNode envelopeResult = docResult.getRootElement();
        if (envelopeResult != null && envelopeResult.getChildElements().size() > 0) {
            bodyResult = envelopeResult.getChildElements()[0];
        }
        return bodyResult;
    }

    private static API_Response constructErrorResponse(String errorMessage) {
        API_Response result = new API_Response();
        result.message = errorMessage;
        return result;
    }

    private static void getRAMSCredentials() {
        RAMSettings ramsSettingInstance = new RAMSettings();
        endpoint = ramsSettingInstance.endpoint;
        apiKey = ramsSettingInstance.apiKey;
        affiliateId = ramsSettingInstance.affiliateId;
        feeSplitGroupId = ramsSettingInstance.feeSplitGroupId;
    }
    
    public static ClientWrapper getSetupValuesForAPI (ClientWrapper clientWrap) {
        clientWrap.affiliateId = affiliateId;
        clientWrap.feeSplitGroupId = feeSplitGroupId;
        clientWrap.accountStatus = RAMWrapper.getAccountStatus(clientWrap.accountStatus);
        return clientWrap;
    }

    private static void getClientId(Map<String, Object> untypedMap) {
        clientId = String.valueOf(untypedMap.get(CLIENT_NUMBER));
    }

    public static API_Response getBalances() {
        API_Response result =  new API_Response();
        return result;
    }
    
    public static API_Response getDebitSchedule(Datetime startDateTime, Datetime endDateTime, Integer currentPage, Integer pageSize) {
        API_Response result =  new API_Response();
        return result;
    }
    
    public static API_Response cancelClient(ProcessorWrapper.CancelClientRequest request) {
        API_Response result =  new API_Response();
        return result;
    }
    
    public static API_Response setCustomerStatus(ProcessorWrapper.SetCustomerStatuRequest request, String customerStatus) {
        API_Response result =  new API_Response();
        if (request != null) {
            if (request.clientWrap != null && String.isNotBlank(request.clientWrap.externalRAMId)) {                
                if (String.isBlank(apiKey)) {
                    getRAMSCredentials();                    
                }   
                if (String.isBlank(sessionId)) {
                    getSessionId();
                    ApexUtil.requireValue('Session Id for RAM processor', sessionId);
                }     
                Map<String, Object> untypedMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(request));
                DOM.Document doc = new DOM.Document();
                dom.XmlNode envelope  = doc.createRootElement('Envelope', env, 'soap');
                envelope.setNamespace('xsi', XSI);
                envelope.setNamespace('xsd', soapXSD);
                dom.XmlNode body =  envelope.addChildElement('Body', env, 'soap');
                dom.XmlNode documentSync =  body.addChildElement('ChangeAccountStatus', XSD , '');
                documentSync.addChildElement('sessid', null, null).addTextNode(sessionId);
                documentSync.addChildElement('ClientID', null, null).addTextNode(request.clientWrap.externalRAMId);
                documentSync.addChildElement('AccountStatus', null, null).addTextNode(customerStatus);
                HttpClient httpClientInst = new HttpClient();
                HttpClient.HttpResponseWrapper responseWrapper;
                try {
                    httpClientInst.method = HttpClient.Methods.POST;
                    httpClientInst.endpoint = endpoint;
                    httpClientInst.bodyDocument = doc;
                    Map<String, String> headerMap = new Map<String, String> ();
                    headerMap.put('Content-Type', 'text/xml;');
                    headerMap.put('Method', 'ChangeAccountStatus');
                    httpClientInst.headerMap = headerMap;
                    httpClientInst.timeout = 120000;
                    responseWrapper = httpClientInst.sendRequest();
                    result = parseUploadClientDocumentResponse(responseWrapper.baseResponse);                  
                    if (result.statusCode == '200') {
                        result.isSuccess = true;
                        ApplicationLogger.logXMLCalloutSuccess(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Change Account Status - Callout request sent to RAMS', null);
                    } else {
                        ApplicationLogger.logXMLCalloutFailure(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Change Account Status  - Callout request sent to RAMS. ' + result.message, null);
                    }
                } catch(System.Exception exp) { 
                    ApplicationLogger.logCalloutException(endpoint, httpClientInst.constructedRequest, null, exp, null);
                }
            }
        } 
        return result;
    }
    
     public static API_Response getCustomerDetails(String externalRAMId) {
        API_Response result =  new API_Response();
        ApexUtil.requireValue('External RAM Id',externalRAMId);
        if (String.isBlank(apiKey)) {
            getRAMSCredentials();            
        }
        if (String.isBlank(sessionId)) {
            getSessionId();
            ApexUtil.requireValue('Session Id for RAM processor', sessionId);
        }        
        DOM.Document doc = new DOM.Document();
        dom.XmlNode envelope  = doc.createRootElement('Envelope', env, 'soap');
        envelope.setNamespace('xsi', XSI);
        envelope.setNamespace('xsd', soapXSD);
        dom.XmlNode body =  envelope.addChildElement('Body', env, 'soap');
        dom.XmlNode documentSync =  body.addChildElement('GetClientSavings', XSD , '');
        documentSync.addChildElement('sessid', null, null).addTextNode(sessionId);
        documentSync.addChildElement('clientid', null, null).addTextNode(externalRAMId);
        HttpClient httpClientInst = new HttpClient();
        HttpClient.HttpResponseWrapper responseWrapper;
        try {
            httpClientInst.method = HttpClient.Methods.POST;
            httpClientInst.endpoint = endpoint;
            httpClientInst.bodyDocument = doc;
            Map<String, String> headerMap = new Map<String, String> ();
            headerMap.put('Content-Type', 'text/xml;');
            headerMap.put('Method', 'GetClientSavings');
            httpClientInst.headerMap = headerMap;
            httpClientInst.timeout = 120000;
            responseWrapper = httpClientInst.sendRequest();
            result = parseGetSavingsResponse(responseWrapper.baseResponse);                  
            if (result.statusCode == '200') {
                result.isSuccess = true;
                ApplicationLogger.logXMLCalloutSuccess(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Get Escrow Balance - Callout request sent to RAMS', null);
            } else {
                ApplicationLogger.logXMLCalloutFailure(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Get Escrow Balance - Callout request sent to RAMS. ' + result.message, null);
            }
        } catch(System.Exception exp) { 
            ApplicationLogger.logCalloutException(endpoint, httpClientInst.constructedRequest, null, exp, null);
        }
        return result;
    }
    
    //To get bulk customer details from the processor to update escrow balance on Account.
    public static API_Response getUpdatedSavingDetails(String fromDate) {
        API_Response result =  new API_Response();
        ApexUtil.requireValue('From Date',fromDate);
        if (String.isBlank(apiKey)) {
            getRAMSCredentials();            
        }
        if (String.isBlank(sessionId)) {
            getSessionId();
            ApexUtil.requireValue('Session Id for RAM processor', sessionId);
        }                  
        DOM.Document doc = new DOM.Document();
        dom.XmlNode envelope  = doc.createRootElement('Envelope', env, 'soap');
        envelope.setNamespace('xsi', XSI);
        envelope.setNamespace('xsd', soapXSD);
        dom.XmlNode body =  envelope.addChildElement('Body', env, 'soap');
        dom.XmlNode documentSync =  body.addChildElement('GetUpdatedSavings', XSD , '');
        documentSync.addChildElement('sessid', null, null).addTextNode(sessionId);
        documentSync.addChildElement('FromDate', null, null).addTextNode(fromDate);
        HttpClient httpClientInst = new HttpClient();
        HttpClient.HttpResponseWrapper responseWrapper;
        try {
            httpClientInst.method = HttpClient.Methods.POST;
            httpClientInst.endpoint = endpoint;
            httpClientInst.bodyDocument = doc;
            Map<String, String> headerMap = new Map<String, String> ();
            headerMap.put('Content-Type', 'text/xml;');
            headerMap.put('Method', 'GetUpdatedSavings');
            httpClientInst.headerMap = headerMap;
            httpClientInst.timeout = 120000;
            responseWrapper = httpClientInst.sendRequest();
            result = parseGetUpdatedSavingsResponse(responseWrapper.baseResponse);                  
            if (result.statusCode == '200') {
                result.isSuccess = true;
                ApplicationLogger.logXMLCalloutSuccess(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Get Escrow Balance - Callout request sent to RAMS', null);
            } else {
                ApplicationLogger.logXMLCalloutFailure(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Get Escrow Balance - Callout request sent to RAMS. ' + result.message, null);
            }
        } catch(System.Exception exp) { 
            ApplicationLogger.logCalloutException(endpoint, httpClientInst.constructedRequest, null, exp, null);
        }
        return result;
    }

    //To get bulk customer details from the processor to update escrow balance on Account.
    public static API_Response getGetClientTransactionsByUpdateDate(String fromDate) {
        API_Response result =  new API_Response();
        ApexUtil.requireValue('From Date',fromDate);
        if (String.isBlank(apiKey)) {
            getRAMSCredentials();            
        }
        if (String.isBlank(sessionId)) {
            getSessionId();
            ApexUtil.requireValue('Session Id for RAM processor', sessionId);
        }          
        DOM.Document doc = new DOM.Document();
        dom.XmlNode envelope  = doc.createRootElement('Envelope', env, 'soap');
        envelope.setNamespace('xsi', XSI);
        envelope.setNamespace('xsd', soapXSD);
        dom.XmlNode body =  envelope.addChildElement('Body', env, 'soap');
        dom.XmlNode documentSync =  body.addChildElement('GetClientTransactionsByUpdateDate', XSD , '');
        documentSync.addChildElement('sessid', null, null).addTextNode(sessionId);
        documentSync.addChildElement('update_date', null, null).addTextNode(fromDate);
        HttpClient httpClientInst = new HttpClient();
        HttpClient.HttpResponseWrapper responseWrapper;
        try {
            httpClientInst.method = HttpClient.Methods.POST;
            httpClientInst.endpoint = endpoint;
            httpClientInst.bodyDocument = doc;
            Map<String, String> headerMap = new Map<String, String> ();
            headerMap.put('Content-Type', 'text/xml;');
            headerMap.put('Method', 'GetClientTransactionsByUpdateDate');
            httpClientInst.headerMap = headerMap;
            httpClientInst.timeout = 120000;
            responseWrapper = httpClientInst.sendRequest();
            result = parseGetClientTransactionsByUpdateDateResponse(responseWrapper.baseResponse);                  
            if (result.statusCode == '200') {
                result.isSuccess = true;
                ApplicationLogger.logXMLCalloutSuccess(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Get Escrow Balance - Callout request sent to RAMS', null);
            } else {
                ApplicationLogger.logXMLCalloutFailure(endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Get Escrow Balance - Callout request sent to RAMS. ' + result.message, null);
            }
        } catch(System.Exception exp) { 
            ApplicationLogger.logCalloutException(endpoint, httpClientInst.constructedRequest, null, exp, null);
        }
        return result;
    }
    
    /**
     * @description: Method to do callout to request bulk customer information.
     * @return apiResponse - Wrapper to store the parsed response from getCustomerRecords callout. 
     */
    public static API_Response getCustomerRecords(Datetime startDateTime, Datetime endDateTime) {
        API_Response result =  new API_Response();
        return result;
    }
    /**
     * @description: Method to do callout to get the status of the payment.
     * @return apiResponse - Wrapper to store the parsed response from getPaymentStatus callout. 
     */
    public static API_Response getPaymentStatus() {
        API_Response result =  new API_Response();
        return result;
    }

    public static API_Response SyncDrafts(ProcessorWrapper.SyncDraftsRequest request) {
        return null;
    }

    public static API_Response syncSettlements(ProcessorWrapper.SyncSettlementsRequest request) {
        return null;
    }
}